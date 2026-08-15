#!/usr/bin/env python3
"""
Local Server and REST API for MSG Viewer
Serves web app frontend and processes .msg files using Python extract-msg
"""

import http.server
import socketserver
import os
import json
import base64
import sys
import time
import datetime
import subprocess
import threading
from urllib.parse import urlparse, parse_qs, unquote, quote
import extract_msg
import email.utils

# Safe stdout/stderr redirection for pythonw (GUI mode without console)
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')

PORT = 8080
if getattr(sys, 'frozen', False):
    DIRECTORY = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
else:
    DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def find_file_on_disk(file_name, file_size=None):
    """Attempt to locate a file on local disk by name (and optionally size)."""
    if not file_name:
        return None
    norm = os.path.normpath(file_name.strip(' "\''))
    if os.path.exists(norm) and os.path.isfile(norm):
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
        if os.path.isfile(direct):
            if file_size is None or os.path.getsize(direct) == file_size:
                return os.path.abspath(direct)
        try:
            for item in os.listdir(root_dir):
                sub = os.path.join(root_dir, item)
                if os.path.isdir(sub):
                    sub_file = os.path.join(sub, clean_name)
                    if os.path.isfile(sub_file):
                        if file_size is None or os.path.getsize(sub_file) == file_size:
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
        subprocess.Popen(f'explorer.exe /select,"{target_path}"')
        return True
    elif os.path.isdir(target_path):
        target_path = os.path.abspath(target_path)
        os.startfile(target_path)
        return True
    else:
        found = find_file_on_disk(target_path)
        if found:
            found = os.path.abspath(found)
            subprocess.Popen(f'explorer.exe /select,"{found}"')
            return True
        parent = os.path.dirname(target_path)
        if parent and os.path.isdir(parent):
            os.startfile(os.path.abspath(parent))
            return True
    return False


def pick_files_native():
    """Open native Windows file dialog to select .msg files."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        file_paths = filedialog.askopenfilenames(
            title="Seleccionar archivos de correo .msg",
            filetypes=[("Archivos MSG (*.msg)", "*.msg"), ("Todos los archivos (*.*)", "*.*")]
        )
        root.destroy()
        return [os.path.normpath(f) for f in file_paths if f]
    except Exception as e:
        print("Error in pick_files_native:", e)
        return []


def pick_folder_native():
    """Open native Windows folder dialog."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        folder_path = filedialog.askdirectory(
            title="Seleccionar carpeta con archivos .msg"
        )
        root.destroy()
        return os.path.normpath(folder_path) if folder_path else ""
    except Exception as e:
        print("Error in pick_folder_native:", e)
        return ""


def extract_msg_data(msg, file_path=None):
    """Helper to convert an extract_msg.Message instance to a JSON-serializable dict."""
    attachments_list = []
    for att in msg.attachments:
        try:
            att_name = att.longFilename or att.shortFilename or "attachment.bin"
            att_data = att.data if hasattr(att, 'data') else b''
            b64_content = base64.b64encode(att_data).decode('ascii') if att_data else ""
            ext = att_name.split('.')[-1].lower() if '.' in att_name else ""

            attachments_list.append({
                "fileName": att_name,
                "mimeType": getattr(att, 'mimetype', 'application/octet-stream'),
                "size": len(att_data),
                "extension": ext,
                "base64Content": b64_content
            })
        except Exception:
            pass

    body_html = ""
    if msg.htmlBody:
        try:
            body_html = msg.htmlBody.decode('utf-8', errors='ignore')
        except Exception:
            try:
                body_html = msg.htmlBody.decode('iso-8859-1', errors='ignore')
            except Exception:
                body_html = str(msg.htmlBody)

    body_text = msg.body or ""

    date_str = ""
    if msg.date:
        try:
            if isinstance(msg.date, (datetime.datetime, datetime.date)):
                date_str = msg.date.isoformat()
            else:
                date_str = str(msg.date)
        except Exception:
            date_str = str(msg.date)

    if not date_str:
        for attr in ['headerDate', 'sentDate', 'receivedTime']:
            val = getattr(msg, attr, None)
            if val:
                try:
                    if isinstance(val, (datetime.datetime, datetime.date)):
                        date_str = val.isoformat()
                    else:
                        date_str = str(val)
                    if date_str:
                        break
                except Exception:
                    pass

    if not date_str and getattr(msg, 'headers', None):
        try:
            h_date = msg.headers.get('date') or msg.headers.get('Date')
            if h_date:
                date_str = str(h_date)
        except Exception:
            pass

    # Clean sender extraction
    sender_raw = str(msg.sender or "").strip()
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

    # Check for additional sender properties if available
    if not sender_name:
        s_name = getattr(msg, 'senderName', None) or getattr(msg, 'sender_name', None)
        if s_name:
            sender_name = str(s_name).strip('"\' ')
    if not sender_email:
        s_email = getattr(msg, 'senderEmail', None) or getattr(msg, 'sender_email', None)
        if s_email and '@' in str(s_email):
            sender_email = str(s_email).strip()

    if sender_name and sender_email and sender_name.lower() == sender_email.lower():
        sender_name = ""

    response_data = {
        "subject": msg.subject or "(No Subject)",
        "senderName": sender_name,
        "senderEmail": sender_email,
        "displayTo": msg.to or "",
        "displayCc": msg.cc or "",
        "bodyText": body_text,
        "bodyHtml": body_html,
        "date": date_str,
        "attachments": attachments_list
    }

    if file_path:
        response_data["filePath"] = os.path.abspath(file_path)
        response_data["fileName"] = os.path.basename(file_path)

    return response_data


class MsgHandler(http.server.SimpleHTTPRequestHandler):
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
        self.send_response(status)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, X-File-Size')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, X-File-Size')
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        if parsed_url.path == '/api/health' or parsed_url.path == '/api/ping':
            self.send_json({"status": "ok"})
            return

        if parsed_url.path == '/api/load-file':
            try:
                query_params = parse_qs(parsed_url.query)
                target_path = query_params.get('path', [''])[0]
                target_path = unquote(target_path).strip(' "\'')

                if not target_path or not os.path.exists(target_path) or not os.path.isfile(target_path):
                    found = find_file_on_disk(target_path)
                    if found:
                        target_path = found
                    else:
                        self.send_json({"error": f"File not found: {target_path}"}, status=404)
                        return

                msg = extract_msg.Message(target_path)
                response_data = extract_msg_data(msg, file_path=target_path)
                self.send_json(response_data)
            except Exception as e:
                self.send_json({"error": str(e)}, status=500)
            return

        if parsed_url.path == '/api/pick-files':
            self.handle_pick_files()
            return

        if parsed_url.path == '/api/pick-folder':
            self.handle_pick_folder()
            return

        super().do_GET()

    def do_POST(self):
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
                file_size = int(file_size_hdr) if file_size_hdr.isdigit() else len(post_data)

                msg = extract_msg.Message(post_data)
                found_path = find_file_on_disk(file_name, file_size) if file_name else None
                response_data = extract_msg_data(msg, file_path=found_path)
                if not found_path and file_name:
                    response_data["fileName"] = file_name
                    response_data["filePath"] = file_name

                self.send_json(response_data)
            except Exception as e:
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
                    self.send_json({"success": False, "error": f"Path '{target_path}' not found"}, status=404)
            except Exception as e:
                self.send_json({"error": str(e)}, status=500)
        else:
            self.send_error(404)

    def handle_pick_files(self):
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
                except Exception as ex:
                    print(f"Error parsing {fp}:", ex)
            self.send_json({"cancelled": False, "messages": messages})
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def handle_pick_folder(self):
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
                except Exception as ex:
                    print(f"Error parsing {fp}:", ex)
            self.send_json({"cancelled": False, "folder": folder, "messages": messages})
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def launch_app_window(file_param=None):
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
            subprocess.Popen([ep, f"--app={url}"])
            return
    import webbrowser
    webbrowser.open(url)


def run_server():
    os.chdir(DIRECTORY)
    file_arg = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else None
    if getattr(sys, 'frozen', False):
        threading.Thread(target=launch_app_window, args=(file_arg,), daemon=True).start()
    try:
        with ReusableTCPServer(("127.0.0.1", PORT), MsgHandler) as httpd:
            print(f"MSG Viewer server started at http://127.0.0.1:{PORT}", flush=True)
            httpd.serve_forever()
    except OSError:
        if file_arg:
            launch_app_window(file_arg)
        sys.exit(0)


if __name__ == '__main__':
    run_server()
