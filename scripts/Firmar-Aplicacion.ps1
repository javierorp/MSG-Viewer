# Script to generate local development certificate and sign executables without administrator permissions

Param(
    [string]$FilePath
)

Write-Host "Starting digital signing process for user..." -ForegroundColor Cyan

# 1. Find or create local development certificate in Cert:\CurrentUser\My
$CertSubject = "CN=MSGViewerDevCert"
$Cert = Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $CertSubject } | Select-Object -First 1

if (-not $Cert) {
    Write-Host "Creating new self-signed digital certificate in user store..." -ForegroundColor Yellow
    $Cert = New-SelfSignedCertificate -Subject $CertSubject -Type CodeSigningCert -CertStoreLocation Cert:\CurrentUser\My
}

Write-Host "Certificate found: $($Cert.Thumbprint)" -ForegroundColor Green

# 2. Sign specified executable file
if ($FilePath -and (Test-Path $FilePath)) {
    Write-Host "Signing file: $FilePath" -ForegroundColor Yellow
    Set-AuthenticodeSignature -FilePath $FilePath -Certificate $Cert
    Write-Host "File signed successfully!" -ForegroundColor Green
} else {
    Write-Host "Usage instructions: .\Firmar-Aplicacion.ps1 -FilePath 'c:\path\your_app.exe'" -ForegroundColor White
}

