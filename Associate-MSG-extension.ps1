# Script to associate .msg extension with MSG Viewer (Without Administrator permissions)

$LauncherPath = "$PSScriptRoot\MSG-Viewer.vbs"
Write-Host "Associating .msg files with MSG Viewer..." -ForegroundColor Green

$RegPath = "HKCU:\Software\Classes\.msg"
$ProgId = "MSGViewer.Document"

if (-not (Test-Path $RegPath)) {
    New-Item -Path $RegPath -Force | Out-Null
}
Set-ItemProperty -Path $RegPath -Name "(Default)" -Value $ProgId

$ProgIdPath = "HKCU:\Software\Classes\$ProgId"
if (-not (Test-Path $ProgIdPath)) {
    New-Item -Path $ProgIdPath -Force | Out-Null
}
Set-ItemProperty -Path $ProgIdPath -Name "(Default)" -Value "MSG Viewer"

# Register DefaultIcon so .msg files show the MSG Viewer icon instead of generic/browser icon
$IconPath = "$PSScriptRoot\docs\images\msg-viewer-icon.ico"
if (Test-Path $IconPath) {
    $DefaultIconPath = "$ProgIdPath\DefaultIcon"
    if (-not (Test-Path $DefaultIconPath)) {
        New-Item -Path $DefaultIconPath -Force | Out-Null
    }
    Set-ItemProperty -Path $DefaultIconPath -Name "(Default)" -Value "`"$IconPath`",0"
}

$CommandPath = "$ProgIdPath\shell\open\command"
if (-not (Test-Path $CommandPath)) {
    New-Item -Path $CommandPath -Force | Out-Null
}

$ExecCommand = "wscript.exe `"$LauncherPath`" `"%1`""
Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value $ExecCommand

# Notify Windows Explorer of shell file association changes
try {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class ShellIconRefresh {
        [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
    }
"@ -ErrorAction SilentlyContinue
    [ShellIconRefresh]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero) # SHCNE_ASSOCCHANGED
} catch {}

Write-Host "File association completed successfully for the current user!" -ForegroundColor Cyan
Write-Host "Now you can double-click any .msg file to open it in the application." -ForegroundColor Green
