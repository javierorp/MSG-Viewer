@echo off
cd /d "%~dp0"

:: Lanzar el servidor Python en segundo plano si no está activo
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0py\launch.ps1"

:: Abrir únicamente la ventana nativa de la aplicación
start "" "msedge.exe" --app="http://127.0.0.1:8080"
