# Startup and health check script for the MSG Viewer Python server
$port = 8080
$ready = $false


try {
    $res = Invoke-WebRequest -Uri "http://127.0.0.1:$port/index.html" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($res.StatusCode -eq 200) { $ready = $true }
} catch {}

if (-not $ready) {
    $pyScript = Join-Path $PSScriptRoot "server.py"
    $appDir = Split-Path $PSScriptRoot -Parent
    Start-Process python -ArgumentList "`"$pyScript`"" -WorkingDirectory $appDir -WindowStyle Hidden
    
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 250
        try {
            $res = Invoke-WebRequest -Uri "http://127.0.0.1:$port/index.html" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($res.StatusCode -eq 200) { break }
        } catch {}
    }
}
