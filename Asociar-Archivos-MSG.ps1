# Script to associate .msg extension with MSG Viewer (Without Administrator permissions)

$AppPath = "$PSScriptRoot\index.html".Replace("\", "/")
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

$CommandPath = "$ProgIdPath\shell\open\command"
if (-not (Test-Path $CommandPath)) {
    New-Item -Path $CommandPath -Force | Out-Null
}

$ExecCommand = "msedge.exe --app=`"file:///$AppPath`""
Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value $ExecCommand

Write-Host "File association completed successfully for the current user!" -ForegroundColor Cyan
Write-Host "Now you can double-click any .msg file to open it in the application." -ForegroundColor Green

