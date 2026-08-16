# Startup and health check script for the MSG Viewer Python server
$port = 8080
$ready = $false

try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) { $ready = $true }
} catch {}

if (-not $ready) {
    $appDir = Split-Path $PSScriptRoot -Parent
    $pyScript = Join-Path $PSScriptRoot "server.py"
    $venvPyw = Join-Path $appDir ".venv\Scripts\pythonw.exe"
    $venvPy = Join-Path $appDir ".venv\Scripts\python.exe"
    
    if (Test-Path $venvPyw) {
        $pyExe = $venvPyw
    } elseif (Test-Path $venvPy) {
        $pyExe = $venvPy
    } else {
        $pyExe = "pythonw"
    }
    
    Start-Process -FilePath $pyExe -ArgumentList $pyScript -WorkingDirectory $appDir
    
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 200
        try {
            $res = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($res.StatusCode -eq 200) { break }
        } catch {}
    }
}
