# Security Policy

## 🛡️ Supported Versions

We actively support and provide security updates for the following versions of **MSG Viewer**:

| Version / Branch | Supported          |
| ---------------- | ------------------ |
| `main` (Latest)  | :white_check_mark: |
| Releases (>=1.0) | :white_check_mark: |
| < 1.0            | :x:                |

---

## 🚨 Reporting a Vulnerability

We take the security, privacy, and integrity of **MSG Viewer** and its users very seriously. If you discover a security vulnerability or potential threat, please follow responsible disclosure practices.

### Preferred Reporting Method

* **GitHub Private Vulnerability Reporting:**  
  Please submit a private advisory through the [GitHub Security Advisory page](https://github.com/javierorp/MSG-Viewer/security/advisories/new).

> [!CAUTION]
> **Please do NOT open public GitHub Issues for suspected security vulnerabilities or zero-day exploits.** Disclosing security issues publicly before a fix is available can put users at risk.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:

1. **Description:** Clear explanation of the vulnerability and its potential impact.
2. **Steps to Reproduce:** Step-by-step instructions or Proof of Concept (PoC).
3. **Sample File (Sanitized):** If the vulnerability involves parsing a malformed `.msg` or `.eml` file, attach a sanitized sample file containing no confidential or personally identifiable information (PII).
4. **Environment Details:**
   - Operating System & version (e.g., Windows 11 23H2).
   - Execution mode (Standalone `MSG-Viewer.exe` or Python script `server.py`).
   - Browser / Edge WebView version.
   - Python and dependency versions (if running from source).

---

## 🎯 Security Scope & Threat Model

MSG Viewer is designed with a strict offline and privacy-first architecture:

* **100% Local Processing:** All message parsing, attachment handling, and UI rendering happen locally on the user's workstation. The application makes no external outbound telemetry or tracking requests.
* **Localhost API Isolation:** The backend REST server binds strictly to `127.0.0.1:48721`.
* **HTML Sanitization & Untrusted Content:** Since emails may contain untrusted HTML/CSS/JavaScript, rendering is subject to content sanitization to mitigate XSS (Cross-Site Scripting) and unauthorized script execution.
* **Attachment Safe Handling:** Attachment extraction and previews implement safeguards against path traversal vulnerabilities (e.g., `../../filename`).

Areas of particular interest for security research:
- Malformed `.msg` / OLE compound file and `.eml` / MIME parsing anomalies.
- Stored/DOM Cross-Site Scripting (XSS) via email headers or bodies.
- Path traversal during attachment extraction or temporary file creation.
- Cross-origin request forgery against the local API (`127.0.0.1:48721`).

---

## ⏱️ Response & Disclosure Process

1. **Acknowledgment:** We will acknowledge receipt of your report within 48 to 72 hours.
2. **Assessment & Confirmation:** We will investigate and validate the issue, keeping you informed of our findings.
3. **Patch & Release:** Once a fix is developed and verified, we will publish a security patch release and credit the reporter (unless anonymity is requested).
