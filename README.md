# MSG Viewer

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6.svg)](https://www.microsoft.com)
[![Privacy: 100% Offline](https://img.shields.io/badge/Privacy-100%25%20Offline-success.svg)](#-features)

**MSG Viewer** is a lightweight, secure, and fully offline Outlook `.msg` file viewer designed for Windows. It allows users to open, inspect, and extract attachments from Microsoft Outlook message files without requiring Microsoft Outlook, administrative permissions, or uploading sensitive data to external servers.

![MSG Viewer Preview](docs/images/preview.png)

---

## ✨ Features

- **🔒 100% Offline & Private**: All file processing occurs locally on your machine. Your emails and attachments never leave your device.
- **📧 Complete Email Rendering**: High-fidelity display of HTML bodies, plain text fallbacks, sender/recipient metadata, headers, and dates.
- **📎 Attachment Management**: Detects, previews, and allows direct one-click downloads of all attached files.
- **🎨 Modern Web UI**: Responsive email client layout featuring:
  - **Dark Mode / Light Mode** (automatic system detection & persistent preference).
  - **Multi-language Support** (English and Spanish with live switching).
  - **Drag & Drop** file opening support.
- **💻 Zero-Admin Windows Integration**:
  - Run standalone in native Edge App Mode (`--app`).
  - Silent launcher script to hide terminal windows.
  - Non-administrator PowerShell script for registering `.msg` file associations.

---

## 🛠️ Architecture Overview

MSG Viewer operates as a dual-layer application:

1. **Frontend**: Standalone web interface built with HTML5, CSS3, and JavaScript, styled with modern UI design patterns.
2. **Backend**: Lightweight local Python REST API server using the `extract-msg` library to parse OLE/MSG binary formats smoothly.

```text
[ .msg File ] ──► [ Local Python Server (127.0.0.1:8080) ] ──► [ MSG Viewer App (Edge/Browser UI) ]
```

---

## 🚀 Getting Started

### Prerequisites

- **Windows 10 / 11**
- **Python 3.8+** (recommended for full binary parsing)
- **Dependencies**:

  ```bash
  pip install extract-msg
  ```

### Quick Launch

```bash
git clone https://github.com/YOUR_USERNAME/msg-viewer.git
cd msg-viewer
```

1. Start the viewer:
   - **Silent Mode (Recommended)**: Double-click `MSG-Viewer.vbs` to launch the application seamlessly without opening a console window.
   - **Command Prompt**: Run `Start-MSG-Viewer.cmd`.

---

## 🔗 Registering File Association (Windows)

To open `.msg` files directly by double-clicking them in Windows File Explorer **without requiring Administrator rights**:

1. Open PowerShell.
2. Navigate to the project directory and run:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\Associate-MSG-extension.ps1
   ```

3. Now all `.msg` files will automatically open in MSG Viewer.

---

## 📂 Project Structure

```text
msg-viewer/
├── index.html                    # Main application user interface
├── manifest.json                 # Web app manifest configuration
├── Start-MSG-Viewer.cmd          # Windows batch launcher (starts server & opens app mode)
├── MSG-Viewer.vbs                # Silent VBScript launcher (hides command prompt)
├── Associate-MSG-extension.ps1   # Windows non-admin registry file association script
├── css/                          # CSS stylesheets (design system, dark/light themes)
├── js/                           # Client-side logic (UI, parsing fallback, i18n)
├── py/                           # Local Python server & backend scripts
│   ├── server.py                 # HTTP REST API server (processes .msg via extract-msg)
│   └── launch.ps1                # Background python server launcher
└── scripts/                      # Code signing and utility scripts
    └── Sign-Application.ps1      # Self-signing code certificate script
```

---

## 🔒 Security & Privacy

- **No Remote Calls**: No telemetry, tracking scripts, or external dependencies.
- **Localhost Binding**: The local backend server binds strictly to `127.0.0.1:8080` and is inaccessible from external networks.
- **No Installation Needed**: Works cleanly out of local directories without installing system-wide drivers or background services.

---

## 📄 License

Distributed under the GNU General Public License v3.0 (GPLv3). See `LICENSE` for more information.
