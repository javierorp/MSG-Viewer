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
import extract_msg

# Safe stdout/stderr redirection for pythonw (GUI mode without console)
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')

PORT = 8080
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/parse':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)

                msg = extract_msg.Message(post_data)
                
                attachments_list = []
                for att in msg.attachments:
                    try:
                        att_name = att.longFilename or att.shortFilename or "adjunto.bin"
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

                response_data = {
                    "subject": msg.subject or "(Sin Asunto)",
                    "senderName": msg.sender or "",
                    "senderEmail": msg.sender or "",
                    "displayTo": msg.to or "",
                    "displayCc": msg.cc or "",
                    "bodyText": body_text,
                    "bodyHtml": body_html,
                    "date": date_str,
                    "attachments": attachments_list
                }

                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_error(404)

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def run_server():
    os.chdir(DIRECTORY)
    try:
        with ReusableTCPServer(("127.0.0.1", PORT), MsgHandler) as httpd:
            print(f"Servidor del MSG Viewer iniciado en http://127.0.0.1:{PORT}", flush=True)
            httpd.serve_forever()
    except OSError:
        sys.exit(0)

if __name__ == '__main__':
    run_server()
