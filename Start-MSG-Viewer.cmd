@echo off
cd /d "%~dp0"

:: Launch Python server in the background if not active
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0py\launch.ps1"

set "USER_DATA=%LOCALAPPDATA%\MSGViewer\Profile"

:: Open app native window with optional file parameter
if "%~1"=="" (
    start "" "msedge.exe" --app="http://127.0.0.1:8080" --user-data-dir="%USER_DATA%" --no-first-run --no-default-browser-check
) else (
    start "" "msedge.exe" --app="http://127.0.0.1:8080?file=%~1" --user-data-dir="%USER_DATA%" --no-first-run --no-default-browser-check
)
