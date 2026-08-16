# Script to compile MSG-Viewer.exe using PyInstaller
$AppDir = Split-Path $PSScriptRoot -Parent
Set-Location $AppDir

Write-Host "======================================" -ForegroundColor Cyan
Write-Host " Building MSG-Viewer.exe executable  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Stop any running instances of MSG-Viewer before overwriting
Get-Process -Name "MSG-Viewer" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

# Locate python and pyinstaller
$PythonPath = "$AppDir\.venv\Scripts\python.exe"
$PyInstallerPath = "$AppDir\.venv\Scripts\pyinstaller.exe"

if (-not (Test-Path $PyInstallerPath)) {
    $PyInstallerPath = (Get-Command pyinstaller -ErrorAction SilentlyContinue).Source
}

if (-not $PyInstallerPath) {
    Write-Host "PyInstaller not found in .venv. Installing dependencies..." -ForegroundColor Yellow
    if (Test-Path $PythonPath) {
        & $PythonPath -m pip install pyinstaller pillow extract-msg
    } else {
        python -m pip install pyinstaller pillow extract-msg
    }
    $PyInstallerPath = "$AppDir\.venv\Scripts\pyinstaller.exe"
}

Write-Host "Compiling with MSG-Viewer.spec..." -ForegroundColor Green
& $PyInstallerPath MSG-Viewer.spec --clean --noconfirm

if ($LASTEXITCODE -eq 0) {
    $ExePath = Join-Path $AppDir "dist\MSG-Viewer.exe"
    Write-Host ""
    Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "Executable generated at: $ExePath" -ForegroundColor Cyan
} else {
    Write-Host "Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
