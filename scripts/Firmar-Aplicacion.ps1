# Script para generar certificado de desarrollo local y firmar ejecutables sin permisos de administrador

Param(
    [string]$FilePath
)

Write-Host "Iniciando proceso de firma digital para el usuario..." -ForegroundColor Cyan

# 1. Buscar o crear certificado local de desarrollo en Cert:\CurrentUser\My
$CertSubject = "CN=MSGViewerDevCert"
$Cert = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $CertSubject } | Select-Object -First 1

if (-not $Cert) {
    Write-Host "Creando nuevo certificado digital autofirmado en el almacén de usuario..." -ForegroundColor Yellow
    $Cert = New-SelfSignedCertificate -Subject $CertSubject -Type CodeSigningCert -CertStoreLocation Cert:\CurrentUser\My
}

Write-Host "Certificado encontrado: $($Cert.Thumbprint)" -ForegroundColor Green

# 2. Firmar el archivo ejecutable especificado
if ($FilePath -and (Test-Path $FilePath)) {
    Write-Host "Firmando archivo: $FilePath" -ForegroundColor Yellow
    Set-AuthenticodeSignature -FilePath $FilePath -Certificate $Cert
    Write-Host "¡Archivo firmado correctamente!" -ForegroundColor Green
} else {
    Write-Host "Instrucciones de uso: .\Firmar-Aplicacion.ps1 -FilePath 'c:\ruta\tu_aplicacion.exe'" -ForegroundColor White
}
