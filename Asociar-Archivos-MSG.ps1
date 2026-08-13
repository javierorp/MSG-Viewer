# Script para asociar la extensión .msg con MSG Viewer (Sin permisos de Administrador)

$AppPath = "$PSScriptRoot\index.html".Replace("\", "/")
Write-Host "Asociando archivos .msg con MSG Viewer..." -ForegroundColor Green

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

Write-Host "¡Asociación completada con éxito para el usuario actual!" -ForegroundColor Cyan
Write-Host "Ahora puedes hacer doble clic en cualquier archivo .msg para abrirlo en la aplicación." -ForegroundColor Green
