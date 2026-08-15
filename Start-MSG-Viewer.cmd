@echo off
cd /d "%~dp0"

:: Launch Python server in the background if not active
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0py\launch.ps1"

:: Open app native window only
start "" "msedge.exe" --app="http://127.0.0.1:8080"

