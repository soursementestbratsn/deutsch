<# 
.SYNOPSIS
    Launch Deutsch Quest Admin Panel - starts server and opens browser

.DESCRIPTION
    Starts the local server and opens the admin panel in your default browser.
    On localhost, no admin token is required.

.PARAMETER Port
    Server port (default: 8000)

.PARAMETER Token
    Admin token (optional, reads from env DEUTSCH_QUEST_ADMIN_TOKEN)

.PARAMETER NoBrowser
    Don't open browser automatically

.EXAMPLE
    .\Launch-Admin.ps1

.EXAMPLE
    .\Launch-Admin.ps1 -Port 9000

.EXAMPLE
    .\Launch-Admin.ps1 -Token "my-secret-token"
#>
param(
    [int]$Port = 8000,
    [string]$Token = $env:DEUTSCH_QUEST_ADMIN_TOKEN,
    [switch]$NoBrowser
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$serverPy = Join-Path $scriptDir "server.py"
$adminHtml = Join-Path $scriptDir "web\admin.html"

if (-not (Test-Path $serverPy)) {
    Write-Error "server.py not found in $scriptDir"
    exit 1
}

Write-Host "🚀 Starting server on port $Port..." -ForegroundColor Green

$serverArgs = "--port $Port --no-browser"
$proc = Start-Process python -ArgumentList $serverPy, $serverArgs -PassThru -WindowStyle Hidden

# Wait for server
Write-Host "⏳ Waiting for server to be ready..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 50; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/data" -TimeoutSec 1 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 200
}

if (-not $ready) {
    Write-Error "❌ Server failed to start"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

$url = "http://127.0.0.1:$Port/admin.html"
if ($Token) { $url += "?token=$Token" }

Write-Host "✅ Server ready!" -ForegroundColor Green
Write-Host "🌐 Opening: $url" -ForegroundColor Cyan

if (-not $NoBrowser) {
    Start-Process $url
}

Write-Host "`n📋 Admin panel loaded. Press Ctrl+C to stop server." -ForegroundColor Gray

try {
    $proc.WaitForExit()
} catch {
    Write-Host "`n👋 Stopping server..." -ForegroundColor Yellow
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}