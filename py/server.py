#!/usr/bin/env python3
"""
Local Server and REST API for MSG Viewer
Serves web app frontend and processes .msg files using Python extract-msg
"""

import base64
import ctypes
from ctypes import wintypes
import datetime
import email.utils
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from urllib.parse import parse_qs, quote, unquote, urlparse
import webbrowser

if sys.platform == 'win32':
    import winreg

try:
    import tkinter as tk
    from tkinter import filedialog
    HAS_TKINTER = True
except ImportError:
    HAS_TKINTER = False

import extract_msg

if sys.platform == 'win32':
    class SHFILEOPSTRUCTW(ctypes.Structure):  # pylint: disable=too-few-public-methods,too-many-instance-attributes,invalid-name
        """Structure for Windows SHFileOperationW API."""
        _fields_ = [
            ("hwnd", wintypes.HWND),
            ("wFunc", wintypes.UINT),
            ("pFrom", wintypes.LPCWSTR),
            ("pTo", wintypes.LPCWSTR),
            ("fFlags", wintypes.WORD),
            ("fAnyOperationsAborted", wintypes.BOOL),
            ("hNameMappings", wintypes.LPVOID),
            ("lpszProgressTitle", wintypes.LPCWSTR),
        ]

    class GUID(ctypes.Structure):  # pylint: disable=too-few-public-methods
        _fields_ = [
            ('Data1', ctypes.c_ulong),
            ('Data2', ctypes.c_ushort),
            ('Data3', ctypes.c_ushort),
            ('Data4', ctypes.c_ubyte * 8)
        ]

    class PROPERTYKEY(ctypes.Structure):  # pylint: disable=too-few-public-methods
        _fields_ = [
            ('fmtid', GUID),
            ('pid', ctypes.c_ulong)
        ]

    class PROPVARIANT(ctypes.Structure):  # pylint: disable=too-few-public-methods
        _fields_ = [
            ('vt', ctypes.c_ushort),
            ('wReserved1', ctypes.c_ushort),
            ('wReserved2', ctypes.c_ushort),
            ('wReserved3', ctypes.c_ushort),
            ('pwszVal', ctypes.c_wchar_p)
        ]

    _PKEY_AppUserModel_ID = PROPERTYKEY(
        GUID(0x9F4C2855, 0x9F79, 0x4B39, (ctypes.c_ubyte * 8)(0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3)),
        5
    )
    _PKEY_AppUserModel_RelaunchIconResource = PROPERTYKEY(
        GUID(0x9F4C2855, 0x9F79, 0x4B39, (ctypes.c_ubyte * 8)(0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3)),
        2
    )
    _IID_IPropertyStore = GUID(
        0x886d8eeb, 0x8cf2, 0x4446, (ctypes.c_ubyte * 8)(0x8d, 0x02, 0xcd, 0xba, 0x1d, 0xbd, 0xcf, 0x99)
    )

    def _customize_window_taskbar(hwnd, icon_path, app_id='MSGViewer.App'):
        """Assign custom AppUserModelID and window icons to decouple from Edge taskbar group."""
        try:
            p_store = ctypes.c_void_p()
            hr = ctypes.windll.shell32.SHGetPropertyStoreForWindow(
                hwnd,
                ctypes.byref(_IID_IPropertyStore),
                ctypes.byref(p_store)
            )
            if hr == 0 and p_store:
                vtable = ctypes.cast(p_store, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
                set_val_proto = ctypes.WINFUNCTYPE(ctypes.HRESULT, ctypes.c_void_p, ctypes.POINTER(PROPERTYKEY), ctypes.POINTER(PROPVARIANT))
                commit_proto = ctypes.WINFUNCTYPE(ctypes.HRESULT, ctypes.c_void_p)
                release_proto = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)

                set_value = set_val_proto(vtable[6])
                commit = commit_proto(vtable[7])
                release = release_proto(vtable[2])

                pv = PROPVARIANT()
                pv.vt = 31  # VT_LPWSTR
                pv.pwszVal = app_id
                set_value(p_store, ctypes.byref(_PKEY_AppUserModel_ID), ctypes.byref(pv))

                if icon_path and os.path.exists(icon_path):
                    pv_icon = PROPVARIANT()
                    pv_icon.vt = 31
                    pv_icon.pwszVal = f"{os.path.abspath(icon_path)},0"
                    set_value(p_store, ctypes.byref(_PKEY_AppUserModel_RelaunchIconResource), ctypes.byref(pv_icon))

                commit(p_store)
                release(p_store)

            if icon_path and os.path.exists(icon_path):
                abs_icon = os.path.abspath(icon_path)
                h_big = ctypes.windll.user32.LoadImageW(None, abs_icon, 1, 48, 48, 0x10)
                h_small = ctypes.windll.user32.LoadImageW(None, abs_icon, 1, 16, 16, 0x10)
                if h_big:
                    ctypes.windll.user32.SendMessageW(hwnd, 0x0080, 1, h_big)
                if h_small:
                    ctypes.windll.user32.SendMessageW(hwnd, 0x0080, 0, h_small)
        except Exception:  # pylint: disable=broad-exception-caught
            pass
else:
    SHFILEOPSTRUCTW = None  # type: ignore
    _customize_window_taskbar = lambda *args, **kwargs: None  # type: ignore

# Safe stdout/stderr redirection for pythonw (GUI mode without console)
class NullWriter:
    """Safe no-op writer for GUI/pythonw mode."""
    def write(self, s):
        pass

    def flush(self):
        pass

if sys.stdout is None or not hasattr(sys.stdout, 'write'):
    sys.stdout = NullWriter()
if sys.stderr is None or not hasattr(sys.stderr, 'write'):
    sys.stderr = NullWriter()

PORT = 8080
if getattr(sys, 'frozen', False):
    DIRECTORY = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
else:
    DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _matches_file(file_path, file_size=None):
    """Check if file exists and matches the optional file size."""
    if not os.path.isfile(file_path):
        return False
    if file_size is None:
        return True
    try:
        return os.path.getsize(file_path) == file_size
    except OSError:
        return False


def find_file_on_disk(file_name, file_size=None):
    """Attempt to locate a file on local disk by name (and optionally size)."""
    if not file_name:
        return None
    norm = os.path.normpath(file_name.strip(' "\''))
    if _matches_file(norm, file_size):
        return os.path.abspath(norm)

    clean_name = os.path.basename(norm)
    home = os.path.expanduser('~')
    search_roots = [
        os.path.join(home, 'Downloads'),
        os.path.join(home, 'Desktop'),
        os.path.join(home, 'Documents'),
        DIRECTORY,
        os.getcwd()
    ]

    for root_dir in search_roots:
        if not os.path.exists(root_dir):
            continue
        direct = os.path.join(root_dir, clean_name)
        if _matches_file(direct, file_size):
            return os.path.abspath(direct)
        try:
            entries = os.scandir(root_dir)
        except (PermissionError, OSError):
            continue

        with entries:
            for entry in entries:
                try:
                    if entry.is_dir(follow_symlinks=False):
                        sub_file = os.path.join(entry.path, clean_name)
                        if _matches_file(sub_file, file_size):
                            return os.path.abspath(sub_file)
                except (PermissionError, OSError):
                    continue

    return None


def open_in_explorer(target_path):
    """Open Windows Explorer and highlight the file/folder."""
    if not target_path:
        return False
    target_path = os.path.normpath(target_path.strip(' "\''))
    if os.path.isfile(target_path):
        target_path = os.path.abspath(target_path)
        # pylint: disable=consider-using-with
        subprocess.Popen(['explorer.exe', f'/select,{target_path}'])
        return True
    if os.path.isdir(target_path):
        target_path = os.path.abspath(target_path)
        if hasattr(os, 'startfile'):
            os.startfile(target_path)
        else:
            # pylint: disable=consider-using-with
            subprocess.Popen(['explorer.exe', target_path])
        return True

    found = find_file_on_disk(target_path)
    if found:
        found = os.path.abspath(found)
        # pylint: disable=consider-using-with
        subprocess.Popen(['explorer.exe', f'/select,{found}'])
        return True
    parent = os.path.dirname(target_path)
    if parent and os.path.isdir(parent):
        parent_abs = os.path.abspath(parent)
        if hasattr(os, 'startfile'):
            os.startfile(parent_abs)
        else:
            # pylint: disable=consider-using-with
            subprocess.Popen(['explorer.exe', parent_abs])
        return True
    return False


def _send_to_recycle_bin(file_path):
    """Send a file to the Windows Recycle Bin using native shell API."""
    if sys.platform != 'win32' or SHFILEOPSTRUCTW is None:
        return False
    try:
        fo_delete = 3
        fof_allowundo = 0x40
        fof_noconfirmation = 0x10
        fof_silent = 0x04
        fof_noerrorui = 0x0400

        p_from = file_path + '\0\0'
        flags = fof_allowundo | fof_noconfirmation | fof_silent | fof_noerrorui
        op = SHFILEOPSTRUCTW(
            hwnd=None,
            wFunc=fo_delete,
            pFrom=p_from,
            pTo=None,
            fFlags=flags,
            fAnyOperationsAborted=False,
            hNameMappings=None,
            lpszProgressTitle=None
        )

        res = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
        return res == 0 and not op.fAnyOperationsAborted
    except Exception:  # pylint: disable=broad-exception-caught
        return False


def delete_file_on_disk(target_path, file_size=None):
    """Send a file to the Windows Recycle Bin or delete it physically."""
    if not target_path:
        return False, "No file path provided"
    target_path = os.path.normpath(target_path.strip(' "\''))
    resolved_path = None
    if os.path.isfile(target_path):
        resolved_path = os.path.abspath(target_path)
    else:
        found = find_file_on_disk(target_path, file_size)
        if found and os.path.isfile(found):
            resolved_path = os.path.abspath(found)

    if not resolved_path:
        return False, f"File not found on disk: {target_path}"

    try:
        if _send_to_recycle_bin(resolved_path):
            return True, resolved_path
        os.remove(resolved_path)
        return True, resolved_path
    except PermissionError:
        return False, f"Permission denied while deleting: {resolved_path}"
    except OSError as e:
        return False, f"Error deleting file: {str(e)}"


def ensure_app_executable():
    """Ensure MSG-Viewer.exe exists in project root. If missing, copy from dist or compile native launcher."""
    if sys.platform != 'win32':
        return None

    if getattr(sys, 'frozen', False):
        return os.path.abspath(sys.executable)

    app_dir = os.path.abspath(DIRECTORY)
    root_exe = os.path.join(app_dir, "MSG-Viewer.exe")
    dist_exe = os.path.join(app_dir, "dist", "MSG-Viewer.exe")
    icon_file = os.path.join(app_dir, "docs", "images", "msg-viewer-icon.ico")
    if not os.path.exists(icon_file):
        icon_file = os.path.join(app_dir, "favicon.ico")

    if os.path.exists(root_exe):
        return root_exe

    if os.path.exists(dist_exe):
        try:
            shutil.copy2(dist_exe, root_exe)
            return root_exe
        except Exception:
            return dist_exe

    # If neither exists, compile an instant native launcher with csc.exe
    csc_paths = [
        r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
        r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
    ]
    csc_exe = next((p for p in csc_paths if os.path.exists(p)), None)
    if not csc_exe:
        return None

    cs_source = r"""
using System;
using System.Diagnostics;
using System.IO;

namespace MSGViewerLauncher
{
    class Program
    {
        static void Main(string[] args)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string vbsPath = Path.Combine(baseDir, "MSG-Viewer.vbs");
            string cmdPath = Path.Combine(baseDir, "Start-MSG-Viewer.cmd");
            
            string argStr = "";
            if (args != null && args.Length > 0)
            {
                foreach (string arg in args)
                {
                    argStr += " \"" + arg.Replace("\"", "\\\"") + "\"";
                }
            }
            
            ProcessStartInfo psi;
            if (File.Exists(vbsPath))
            {
                psi = new ProcessStartInfo("wscript.exe", "\"" + vbsPath + "\"" + argStr);
            }
            else
            {
                psi = new ProcessStartInfo("cmd.exe", "/c \"" + cmdPath + "\"" + argStr);
            }
            psi.WorkingDirectory = baseDir;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.CreateNoWindow = true;
            psi.UseShellExecute = false;
            try
            {
                Process.Start(psi);
            }
            catch {}
        }
    }
}
"""
    try:
        temp_cs = os.path.join(tempfile.gettempdir(), f"msg_launcher_{os.getpid()}.cs")
        with open(temp_cs, "w", encoding="utf-8") as f:
            f.write(cs_source)

        cmd = [csc_exe, "/nologo", "/target:winexe", f"/out:{root_exe}"]
        if os.path.exists(icon_file):
            cmd.append(f"/win32icon:{icon_file}")
        cmd.append(temp_cs)

        creation_flags = 0x08000000 if sys.platform == 'win32' else 0
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
            creationflags=creation_flags
        )
        if os.path.exists(temp_cs):
            os.remove(temp_cs)

        if res.returncode == 0 and os.path.exists(root_exe):
            return root_exe
    except Exception:
        pass

    return None


def create_desktop_shortcut():
    """Create a Windows desktop shortcut for MSG Viewer."""
    if sys.platform != 'win32':
        return False, "Desktop shortcuts are only supported on Windows."

    try:
        app_dir = os.path.abspath(DIRECTORY)
        vbs_file = os.path.join(app_dir, "MSG-Viewer.vbs")
        cmd_file = os.path.join(app_dir, "Start-MSG-Viewer.cmd")
        icon_file = os.path.join(app_dir, "docs", "images", "msg-viewer-icon.ico")
        if not os.path.exists(icon_file):
            icon_file = os.path.join(app_dir, "favicon.ico")

        resolved_exe = ensure_app_executable()

        if getattr(sys, 'frozen', False):
            target_path = os.path.abspath(sys.executable)
            target_cmd = target_path
            args = ""
            icon_location = f"{target_path},0"
        elif resolved_exe and os.path.exists(resolved_exe):
            target_cmd = os.path.abspath(resolved_exe)
            args = ""
            icon_location = f"{target_cmd},0"
        elif os.path.exists(vbs_file):
            target_cmd = "wscript.exe"
            args = f'"{vbs_file}"'
            icon_location = (
                f"{os.path.abspath(icon_file)},0"
                if os.path.exists(icon_file)
                else f"{target_cmd},0"
            )
        else:
            target_cmd = cmd_file
            args = ""
            icon_location = (
                f"{os.path.abspath(icon_file)},0"
                if os.path.exists(icon_file)
                else f"{target_cmd},0"
            )

        ps_code = f'''
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "MSG Viewer.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "{target_cmd.replace('"', '`"')}"
$Shortcut.Arguments = '{args}'
$Shortcut.WorkingDirectory = "{app_dir.replace('"', '`"')}"
$Shortcut.Description = "MSG Viewer - Offline .msg File Viewer"
$Shortcut.IconLocation = "{icon_location.replace('"', '`"')}"
$Shortcut.Save()
'''
        creation_flags = 0x08000000 if sys.platform == 'win32' else 0
        res = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_code],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
            creationflags=creation_flags
        )
        if res.returncode == 0:
            return True, "Shortcut created successfully on Desktop."
        return False, res.stderr.strip() or "Failed to create shortcut."
    except Exception as e:  # pylint: disable=broad-exception-caught
        return False, str(e)






def pick_files_native():
    """Open native Windows file dialog to select .msg files."""
    if not HAS_TKINTER:
        return []
    try:
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        file_types = [
            ("Archivos MSG (*.msg)", "*.msg"),
            ("Todos los archivos (*.*)", "*.*")
        ]
        file_paths = filedialog.askopenfilenames(
            title="Seleccionar archivos de correo .msg",
            filetypes=file_types
        )
        root.destroy()
        return [os.path.normpath(f) for f in file_paths if f]
    except Exception as e:  # pylint: disable=broad-exception-caught
        print("Error in pick_files_native:", e)
        return []


def pick_folder_native():
    """Open native Windows folder dialog."""
    if not HAS_TKINTER:
        return ""
    try:
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        folder_path = filedialog.askdirectory(
            title="Seleccionar carpeta con archivos .msg"
        )
        root.destroy()
        return os.path.normpath(folder_path) if folder_path else ""
    except Exception as e:  # pylint: disable=broad-exception-caught
        print("Error in pick_folder_native:", e)
        return ""


def _detect_mime_type(att_name, att_data, default_mime=""):
    """Detect accurate MIME type from filename extension or magic bytes."""
    if default_mime and default_mime != "application/octet-stream":
        return default_mime

    ext = att_name.split('.')[-1].lower() if '.' in att_name else ""
    mime_map = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "svg": "image/svg+xml",
        "bmp": "image/bmp",
        "ico": "image/x-icon",
        "tif": "image/tiff",
        "tiff": "image/tiff",
        "pdf": "application/pdf",
        "txt": "text/plain",
        "log": "text/plain",
        "csv": "text/csv",
        "json": "application/json",
        "xml": "application/xml",
        "html": "text/html",
        "htm": "text/html"
    }
    if ext in mime_map:
        return mime_map[ext]

    if att_data:
        if att_data.startswith(b'\x89PNG\r\n\x1a\n'):
            return 'image/png'
        if att_data.startswith(b'\xff\xd8\xff'):
            return 'image/jpeg'
        if att_data.startswith(b'GIF87a') or att_data.startswith(b'GIF89a'):
            return 'image/gif'
        if att_data.startswith(b'RIFF') and len(att_data) > 12 and att_data[8:12] == b'WEBP':
            return 'image/webp'
        if att_data.startswith(b'BM'):
            return 'image/bmp'
        if b'<svg' in att_data[:300].lower():
            return 'image/svg+xml'

    return default_mime or 'application/octet-stream'


def _extract_attachments(msg):
    """Extract attachments from MSG into serializable dictionary format with Content-ID."""
    attachments_list = []
    attachments = getattr(msg, 'attachments', []) or []
    for att in attachments:
        try:
            att_name = (
                getattr(att, 'longFilename', None)
                or getattr(att, 'shortFilename', None)
                or getattr(att, 'displayName', None)
                or "attachment.bin"
            )
            att_data = getattr(att, 'data', b'') or b''
            b64_content = (
                base64.b64encode(att_data).decode('ascii')
                if att_data else ""
            )
            ext = att_name.split('.')[-1].lower() if '.' in att_name else ""

            # Extract Content-ID / CID for inline attachments
            cid = getattr(att, 'cid', None) or getattr(att, 'contentId', None) or ""
            if not cid and hasattr(att, 'props'):
                try:
                    cid = att.props.get('3712001F') or att.props.get('3712001E') or ""
                except Exception:
                    pass
            cid_str = str(cid).strip(' \t\r\n\0') if cid else ""

            # Extract Content-Location
            loc = ""
            if hasattr(att, 'props'):
                try:
                    loc = att.props.get('3713001F') or att.props.get('3713001E') or ""
                except Exception:
                    pass
            loc_str = str(loc).strip(' \t\r\n\0') if loc else ""

            raw_mime = getattr(att, 'mimetype', '') or ''
            mime_type = _detect_mime_type(att_name, att_data, raw_mime)

            attachments_list.append({
                "fileName": att_name,
                "contentId": cid_str,
                "cid": cid_str,
                "contentLocation": loc_str,
                "mimeType": mime_type,
                "size": len(att_data),
                "extension": ext,
                "base64Content": b64_content
            })
        except Exception:  # pylint: disable=broad-exception-caught
            pass
    return attachments_list


def _resolve_inline_images(html_content, attachments):
    """Replace cid: references, relative filenames, CSS url() and VML tags with base64 data URIs."""
    if not html_content or not attachments:
        return html_content

    cid_map = {}
    file_map = {}

    for att in attachments:
        b64 = att.get('base64Content')
        if not b64:
            continue
        mime = att.get('mimeType') or 'image/png'
        data_uri = f"data:{mime};base64,{b64}"

        def register(key, target_map):
            if not key:
                return
            k = str(key).strip(' \t\r\n\0')
            if not k:
                return
            target_map[k.lower()] = data_uri
            unbracketed = k.strip('<>').strip()
            if unbracketed:
                target_map[unbracketed.lower()] = data_uri
                try:
                    target_map[unquote(unbracketed).lower()] = data_uri
                except Exception:
                    pass
            try:
                target_map[unquote(k).lower()] = data_uri
            except Exception:
                pass

        if att.get('contentId'):
            register(att['contentId'], cid_map)
        if att.get('cid'):
            register(att['cid'], cid_map)
        if att.get('contentLocation'):
            register(att['contentLocation'], file_map)
        if att.get('fileName'):
            register(att['fileName'], file_map)
            register(att['fileName'], cid_map)
        if att.get('longFilename'):
            register(att['longFilename'], file_map)
            register(att['longFilename'], cid_map)
        if att.get('shortFilename'):
            register(att['shortFilename'], file_map)
            register(att['shortFilename'], cid_map)

    if not cid_map and not file_map:
        return html_content

    def _replace_src(match):
        prefix = match.group(1)
        quote_char = match.group(2)
        val = match.group(3).strip()
        val_clean = val.strip('<>').strip()

        if val_clean.lower().startswith('cid:'):
            cid_key = val_clean[4:].strip(' \t\r\n\0<>').lower()
            target = cid_map.get(cid_key)
            if not target:
                try:
                    target = cid_map.get(unquote(cid_key).lower())
                except Exception:
                    pass
            if not target:
                target = file_map.get(cid_key)
            if target:
                return f'{prefix}{quote_char}{target}{quote_char}'
        elif '://' not in val_clean and not val_clean.startswith(('data:', 'blob:', '//', 'mailto:')):
            fn = os.path.basename(val_clean.replace('\\', '/')).lower()
            target = file_map.get(fn) or cid_map.get(fn)
            if not target:
                try:
                    target = file_map.get(unquote(fn).lower()) or cid_map.get(unquote(fn).lower())
                except Exception:
                    pass
            if target:
                return f'{prefix}{quote_char}{target}{quote_char}'

        return match.group(0)

    pattern_src = re.compile(r'(<[^>]+?\bsrc\s*=\s*)(["\'])(.*?)\2', re.IGNORECASE | re.DOTALL)
    result = pattern_src.sub(_replace_src, html_content)

    def _replace_css_url(match):
        prefix = match.group(1)
        val = match.group(3).strip().strip('<>').strip()
        suffix = match.group(5)

        cid_key = val
        if cid_key.lower().startswith('cid:'):
            cid_key = cid_key[4:].strip(' \t\r\n\0<>')
        target = cid_map.get(cid_key.lower()) or file_map.get(cid_key.lower())
        if not target:
            try:
                target = cid_map.get(unquote(cid_key).lower()) or file_map.get(unquote(cid_key).lower())
            except Exception:
                pass
        if target:
            return f'{prefix}"{target}"{suffix}'
        return match.group(0)

    pattern_css = re.compile(r'(url\s*\(\s*)(["\']?)((?:cid:)?.*?)(["\']?)(\s*\))', re.IGNORECASE)
    result = pattern_css.sub(_replace_css_url, result)

    def _replace_vml_imagedata(match):
        tag_str = match.group(0)
        src_m = re.search(r'\bsrc\s*=\s*(["\'])(.*?)\1', tag_str, re.IGNORECASE)
        alt_m = re.search(r'\bo:title\s*=\s*(["\'])(.*?)\1', tag_str, re.IGNORECASE)
        alt_text = alt_m.group(2) if alt_m else "Image"

        if src_m:
            src_val = src_m.group(2).strip().strip('<>').strip()
            if src_val.startswith('data:'):
                img_tag = f'<img src="{src_val}" alt="{alt_text}" style="max-width:100%;height:auto;display:inline-block;" />'
                return f'{tag_str}{img_tag}'
            cid_key = src_val[4:].strip('<>') if src_val.lower().startswith('cid:') else src_val
            target = cid_map.get(cid_key.lower()) or file_map.get(cid_key.lower())
            if target:
                img_tag = f'<img src="{target}" alt="{alt_text}" style="max-width:100%;height:auto;display:inline-block;" />'
                return f'{tag_str}{img_tag}'
        return tag_str

    pattern_vml = re.compile(r'<v:imagedata\b[^>]*?/?>', re.IGNORECASE)
    result = pattern_vml.sub(_replace_vml_imagedata, result)

    return result


def _extract_body_html(msg):
    """Extract HTML body with encoding fallbacks."""
    html_raw = getattr(msg, 'htmlBody', None)
    if not html_raw:
        return ""
    if isinstance(html_raw, bytes):
        for encoding in ('utf-8', 'iso-8859-1', 'windows-1252'):
            try:
                return html_raw.decode(encoding)
            except (UnicodeDecodeError, LookupError):
                continue
        return html_raw.decode('utf-8', errors='ignore')
    return str(html_raw)


def _extract_date(msg):
    """Extract ISO formatted date string from MSG message."""
    date_val = getattr(msg, 'date', None)
    if date_val:
        if isinstance(date_val, (datetime.datetime, datetime.date)):
            return date_val.isoformat()
        return str(date_val)

    for attr in ('headerDate', 'sentDate', 'receivedTime'):
        val = getattr(msg, attr, None)
        if val:
            if isinstance(val, (datetime.datetime, datetime.date)):
                return val.isoformat()
            return str(val)

    headers = getattr(msg, 'headers', None)
    if headers and isinstance(headers, dict):
        h_date = headers.get('date') or headers.get('Date')
        if h_date:
            return str(h_date)

    return ""


def _extract_sender(msg):
    """Extract sender name and email address from MSG message."""
    sender_raw = str(getattr(msg, 'sender', '') or "").strip()
    sender_name = ""
    sender_email = ""

    if sender_raw:
        parsed_name, parsed_email = email.utils.parseaddr(sender_raw)
        if parsed_name:
            sender_name = parsed_name.strip('"\' ')
        if parsed_email and '@' in parsed_email:
            sender_email = parsed_email.strip()
        elif not sender_name:
            if '@' in sender_raw:
                sender_email = sender_raw
            else:
                sender_name = sender_raw

    if not sender_name:
        s_name = (
            getattr(msg, 'senderName', None)
            or getattr(msg, 'sender_name', None)
        )
        if s_name:
            sender_name = str(s_name).strip('"\' ')

    if not sender_email:
        s_email = (
            getattr(msg, 'senderEmail', None)
            or getattr(msg, 'sender_email', None)
        )
        if s_email and '@' in str(s_email):
            sender_email = str(s_email).strip()

    if (
        sender_name
        and sender_email
        and sender_name.lower() == sender_email.lower()
    ):
        sender_name = ""

    return sender_name, sender_email


def extract_msg_data(msg, file_path=None):
    """Helper to convert extract_msg.Message to JSON-serializable dict."""
    sender_name, sender_email = _extract_sender(msg)
    attachments = _extract_attachments(msg)
    raw_html = _extract_body_html(msg)
    resolved_html = _resolve_inline_images(raw_html, attachments) if raw_html else ""

    response_data = {
        "subject": getattr(msg, 'subject', None) or "(No Subject)",
        "senderName": sender_name,
        "senderEmail": sender_email,
        "displayTo": getattr(msg, 'to', None) or "",
        "displayCc": getattr(msg, 'cc', None) or "",
        "bodyText": getattr(msg, 'body', None) or "",
        "bodyHtml": resolved_html,
        "date": _extract_date(msg),
        "attachments": attachments
    }

    if file_path:
        response_data["filePath"] = os.path.abspath(file_path)
        response_data["fileName"] = os.path.basename(file_path)

    return response_data


class MsgHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP Request Handler providing static file serving and REST API."""

    def translate_path(self, path):
        clean_path = path.split('?', 1)[0].split('#', 1)[0]
        trailing_slash = clean_path.endswith('/')
        clean_path = os.path.normpath(clean_path)
        words = [w for w in clean_path.split(os.sep) if w and w != '.']

        result_path = DIRECTORY
        for word in words:
            if word == '..':
                continue
            result_path = os.path.join(result_path, word)

        if trailing_slash:
            result_path += os.sep
        return result_path

    def send_json(self, data, status=200):
        """Send JSON response with CORS headers."""
        self.send_response(status)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header(
            'Access-Control-Allow-Headers',
            'Content-Type, X-File-Name, X-File-Size'
        )
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):  # pylint: disable=invalid-name
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header(
            'Access-Control-Allow-Headers',
            'Content-Type, X-File-Name, X-File-Size'
        )
        self.end_headers()

    def do_GET(self):  # pylint: disable=invalid-name
        """Handle GET requests for static files and REST API."""
        parsed_url = urlparse(self.path)
        if parsed_url.path in ('/api/health', '/api/ping'):
            self.send_json({"status": "ok"})
            return

        if parsed_url.path == '/api/load-file':
            try:
                query_params = parse_qs(parsed_url.query)
                target_path = query_params.get('path', [''])[0]
                target_path = unquote(target_path).strip(' "\'')

                if (
                    not target_path
                    or not os.path.exists(target_path)
                    or not os.path.isfile(target_path)
                ):
                    found = find_file_on_disk(target_path)
                    if found:
                        target_path = found
                    else:
                        err = f"File not found: {target_path}"
                        self.send_json({"error": err}, status=404)
                        return

                msg = extract_msg.Message(target_path)
                try:
                    response_data = extract_msg_data(
                        msg, file_path=target_path
                    )
                finally:
                    if hasattr(msg, 'close'):
                        msg.close()
                self.send_json(response_data)
            except Exception as e:  # pylint: disable=broad-exception-caught
                self.send_json({"error": str(e)}, status=500)
            return

        if parsed_url.path == '/api/pick-files':
            self.handle_pick_files()
            return

        if parsed_url.path == '/api/pick-folder':
            self.handle_pick_folder()
            return

        super().do_GET()

    def do_POST(self):  # pylint: disable=invalid-name
        """Handle POST requests for file uploads, native dialogs and system integration."""
        parsed_url = urlparse(self.path)
        handlers = {
            '/api/pick-files': self.handle_pick_files,
            '/api/pick-folder': self.handle_pick_folder,
            '/api/parse': self.handle_parse,
            '/api/open-folder': self.handle_open_folder,
            '/api/delete-file': self.handle_delete_file,
            '/api/create-shortcut': self.handle_create_shortcut
        }
        handler = handlers.get(parsed_url.path)
        if handler:
            handler()
        else:
            self.send_error(404)

    def handle_parse(self):
        """Handle parse request for uploaded .msg file stream."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)

            file_name = self.headers.get('X-File-Name', '')
            file_size_hdr = self.headers.get('X-File-Size', '')
            file_size = (
                int(file_size_hdr)
                if file_size_hdr.isdigit()
                else len(post_data)
            )

            msg = extract_msg.Message(post_data)
            try:
                found_path = (
                    find_file_on_disk(file_name, file_size)
                    if file_name else None
                )
                response_data = extract_msg_data(msg, file_path=found_path)
                if not found_path and file_name:
                    response_data["fileName"] = file_name
                    response_data["filePath"] = file_name
            finally:
                if hasattr(msg, 'close'):
                    msg.close()

            self.send_json(response_data)
        except Exception as e:  # pylint: disable=broad-exception-caught
            self.send_json({"error": str(e)}, status=500)

    def handle_open_folder(self):
        """Handle request to open file location in Windows Explorer."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(post_data)
            target_path = data.get('path', '').strip(' "\'')

            success = open_in_explorer(target_path)
            if success:
                self.send_json({"success": True, "opened": target_path})
            else:
                err_msg = f"Path '{target_path}' not found"
                self.send_json(
                    {"success": False, "error": err_msg},
                    status=404
                )
        except Exception as e:  # pylint: disable=broad-exception-caught
            self.send_json({"error": str(e)}, status=500)

    def handle_delete_file(self):
        """Handle physical file deletion from disk."""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(post_data)
            target_path = data.get('path', '').strip(' "\'')
            file_size = data.get('fileSize')
            if not target_path and data.get('fileName'):
                target_path = data.get('fileName').strip(' "\'')

            success, result = delete_file_on_disk(target_path, file_size)
            if success:
                self.send_json({"success": True, "deleted": result})
            else:
                status_code = 404 if "not found" in result.lower() else 400
                self.send_json(
                    {"success": False, "error": result},
                    status=status_code
                )
        except Exception as e:  # pylint: disable=broad-exception-caught
            self.send_json({"error": str(e)}, status=500)

    def handle_create_shortcut(self):
        """Handle request to create desktop shortcut."""
        success, msg = create_desktop_shortcut()
        if success:
            self.send_json({"success": True, "message": msg})
        else:
            self.send_json({"success": False, "error": msg}, status=500)

    def handle_pick_files(self):
        """Handle native file picker request and return parsed messages."""
        try:
            file_paths = pick_files_native()
            if not file_paths:
                self.send_json({"cancelled": True, "messages": []})
                return
            messages = []
            for fp in file_paths:
                try:
                    msg = extract_msg.Message(fp)
                    try:
                        messages.append(extract_msg_data(msg, file_path=fp))
                    finally:
                        if hasattr(msg, 'close'):
                            msg.close()
                # pylint: disable=broad-exception-caught
                except Exception as ex:
                    print(f"Error parsing {fp}:", ex)
            self.send_json({"cancelled": False, "messages": messages})
        except Exception as e:  # pylint: disable=broad-exception-caught
            self.send_json({"error": str(e)}, status=500)

    def handle_pick_folder(self):
        """Handle native folder picker request and return parsed messages."""
        try:
            folder = pick_folder_native()
            if not folder:
                self.send_json({"cancelled": True, "messages": []})
                return
            file_paths = []
            for root_dir, _, files in os.walk(folder):
                for f in files:
                    if f.lower().endswith('.msg'):
                        file_paths.append(os.path.join(root_dir, f))

            messages = []
            for fp in file_paths:
                try:
                    msg = extract_msg.Message(fp)
                    try:
                        messages.append(extract_msg_data(msg, file_path=fp))
                    finally:
                        if hasattr(msg, 'close'):
                            msg.close()
                # pylint: disable=broad-exception-caught
                except Exception as ex:
                    print(f"Error parsing {fp}:", ex)
            self.send_json({
                "cancelled": False,
                "folder": folder,
                "messages": messages
            })
        except Exception as e:  # pylint: disable=broad-exception-caught
            self.send_json({"error": str(e)}, status=500)


class ReusableTCPServer(socketserver.TCPServer):
    """TCPServer variant allowing address reuse to avoid port locking."""
    allow_reuse_address = True


def _hook_window_taskbar_icon():
    """Poll for the MSG Viewer window and assign custom AppID & icon to taskbar."""
    if sys.platform != 'win32':
        return
    icon_file = os.path.join(DIRECTORY, 'docs', 'images', 'msg-viewer-icon.ico')
    if not os.path.exists(icon_file):
        icon_file = os.path.join(DIRECTORY, 'favicon.ico')
    if not os.path.exists(icon_file):
        return

    abs_icon = os.path.abspath(icon_file)
    for _ in range(30):
        time.sleep(0.3)
        found = []

        def enum_cb(hwnd, _):
            if ctypes.windll.user32.IsWindowVisible(hwnd):
                length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
                    if 'MSG Viewer' in buff.value:
                        found.append(hwnd)
            return True

        cb_proto = ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
        ctypes.windll.user32.EnumWindows(cb_proto(enum_cb), 0)
        if found:
            for h in found:
                _customize_window_taskbar(h, abs_icon)
            break


def launch_app_window(file_param=None):
    """Launch Microsoft Edge in app mode or default web browser."""
    time.sleep(0.6)
    url = f"http://127.0.0.1:{PORT}"
    if file_param:
        url += f"?file={quote(file_param)}"

    user_data_dir = os.path.join(
        os.environ.get('LOCALAPPDATA', os.path.expanduser('~')),
        'MSGViewer',
        'Profile'
    )

    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    for ep in edge_paths:
        if os.path.exists(ep):
            # pylint: disable=consider-using-with
            subprocess.Popen([
                ep,
                f"--app={url}",
                f"--user-data-dir={user_data_dir}",
                "--no-first-run",
                "--no-default-browser-check"
            ])
            threading.Thread(
                target=_hook_window_taskbar_icon,
                daemon=True
            ).start()
            return
    webbrowser.open(url)


def run_server():
    """Start local web server and launch app window."""
    os.chdir(DIRECTORY)
    file_arg = (
        sys.argv[1]
        if len(sys.argv) > 1 and not sys.argv[1].startswith('-')
        else None
    )

    # Check if a server instance is already running
    server_already_running = False
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{PORT}/api/health")
        with urllib.request.urlopen(req, timeout=0.5) as resp:
            if resp.status == 200:
                server_already_running = True
    except Exception:
        server_already_running = False

    if server_already_running:
        launch_app_window(file_arg)
        time.sleep(1.0)
        sys.exit(0)

    if getattr(sys, 'frozen', False):
        threading.Thread(
            target=launch_app_window,
            args=(file_arg,),
            daemon=True
        ).start()

    httpd = None
    for attempt in range(5):
        try:
            httpd = ReusableTCPServer(("127.0.0.1", PORT), MsgHandler)
            break
        except OSError:
            if attempt < 4:
                time.sleep(0.3)
            else:
                if file_arg:
                    launch_app_window(file_arg)
                sys.exit(0)

    if httpd:
        with httpd:
            print(
                f"MSG Viewer server started at http://127.0.0.1:{PORT}",
                flush=True
            )
            httpd.serve_forever()


if __name__ == '__main__':
    run_server()
