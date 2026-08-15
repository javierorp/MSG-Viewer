#!/usr/bin/env python3
"""
Local Server and REST API for MSG Viewer
Serves web app frontend and processes .msg files using Python extract-msg
"""

import base64
import datetime
import email.utils
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading
import time
from urllib.parse import parse_qs, quote, unquote, urlparse
import webbrowser

try:
    import tkinter as tk
    from tkinter import filedialog
    HAS_TKINTER = True
except ImportError:
    HAS_TKINTER = False

import extract_msg

# Safe stdout/stderr redirection for pythonw (GUI mode without console)
if sys.stdout is None:
    # pylint: disable=consider-using-with
    sys.stdout = open(os.devnull, 'w', encoding='utf-8')
if sys.stderr is None:
    # pylint: disable=consider-using-with
    sys.stderr = open(os.devnull, 'w', encoding='utf-8')

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


def _extract_attachments(msg):
    """Extract attachments from MSG into serializable dictionary format."""
    attachments_list = []
    attachments = getattr(msg, 'attachments', []) or []
    for att in attachments:
        try:
            att_name = (
                getattr(att, 'longFilename', None)
                or getattr(att, 'shortFilename', None)
                or "attachment.bin"
            )
            att_data = getattr(att, 'data', b'') or b''
            b64_content = (
                base64.b64encode(att_data).decode('ascii')
                if att_data else ""
            )
            ext = att_name.split('.')[-1].lower() if '.' in att_name else ""

            attachments_list.append({
                "fileName": att_name,
                "mimeType": getattr(
                    att, 'mimetype', 'application/octet-stream'
                ),
                "size": len(att_data),
                "extension": ext,
                "base64Content": b64_content
            })
        except Exception:  # pylint: disable=broad-exception-caught
            pass
    return attachments_list


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
    response_data = {
        "subject": getattr(msg, 'subject', None) or "(No Subject)",
        "senderName": sender_name,
        "senderEmail": sender_email,
        "displayTo": getattr(msg, 'to', None) or "",
        "displayCc": getattr(msg, 'cc', None) or "",
        "bodyText": getattr(msg, 'body', None) or "",
        "bodyHtml": _extract_body_html(msg),
        "date": _extract_date(msg),
        "attachments": _extract_attachments(msg)
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
                response_data = extract_msg_data(msg, file_path=target_path)
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
        """Handle POST requests for file uploads and native dialogs."""
        parsed_url = urlparse(self.path)
        if parsed_url.path == '/api/pick-files':
            self.handle_pick_files()
        elif parsed_url.path == '/api/pick-folder':
            self.handle_pick_folder()
        elif parsed_url.path == '/api/parse':
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
                found_path = (
                    find_file_on_disk(file_name, file_size)
                    if file_name else None
                )
                response_data = extract_msg_data(msg, file_path=found_path)
                if not found_path and file_name:
                    response_data["fileName"] = file_name
                    response_data["filePath"] = file_name

                self.send_json(response_data)
            except Exception as e:  # pylint: disable=broad-exception-caught
                self.send_json({"error": str(e)}, status=500)
        elif parsed_url.path == '/api/open-folder':
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
        else:
            self.send_error(404)

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
                    messages.append(extract_msg_data(msg, file_path=fp))
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
                    messages.append(extract_msg_data(msg, file_path=fp))
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


def launch_app_window(file_param=None):
    """Launch Microsoft Edge in app mode or default web browser."""
    time.sleep(0.6)
    url = f"http://127.0.0.1:{PORT}"
    if file_param:
        url += f"?file={quote(file_param)}"
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    for ep in edge_paths:
        if os.path.exists(ep):
            # pylint: disable=consider-using-with
            subprocess.Popen([ep, f"--app={url}"])
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
    if getattr(sys, 'frozen', False):
        threading.Thread(
            target=launch_app_window,
            args=(file_arg,),
            daemon=True
        ).start()
    try:
        with ReusableTCPServer(("127.0.0.1", PORT), MsgHandler) as httpd:
            print(
                f"MSG Viewer server started at http://127.0.0.1:{PORT}",
                flush=True
            )
            httpd.serve_forever()
    except OSError:
        if file_arg:
            launch_app_window(file_arg)
        sys.exit(0)


if __name__ == '__main__':
    run_server()
