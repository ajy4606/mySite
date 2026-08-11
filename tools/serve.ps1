param([ValidateRange(1, 65535)][int]$Port = 5173)

$ErrorActionPreference = 'Stop'
$site = Split-Path -Parent $PSScriptRoot
$serveJs = Join-Path $PSScriptRoot 'serve.js'
Set-Location $site

Write-Host ""
Write-Host "  Preview: http://localhost:$Port" -ForegroundColor Green
Write-Host '  Press Ctrl+C in this window to stop.'
Write-Host ""

if (Get-Command node -ErrorAction SilentlyContinue) {
  Start-Process "http://localhost:$Port"
  & node $serveJs $Port
  exit $LASTEXITCODE
}

# Use Python's basic server only when Node is unavailable.
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) {
  throw 'Node or Python was not found. Install Node.js and try again.'
}

Write-Host '  Node is unavailable; using the Python fallback.' -ForegroundColor Yellow
Write-Host '  If a change looks stale, refresh with Ctrl+Shift+R.' -ForegroundColor Yellow
Start-Process "http://localhost:$Port"
& $python.Source -m http.server $Port
exit $LASTEXITCODE
