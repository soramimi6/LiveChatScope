# LiveChatScope E2E API test runner
# Usage:
#   .\scripts\e2e-api.ps1                    # smoke tests only
#   .\scripts\e2e-api.ps1 -Url "https://..."  # smoke + full flow

param(
    [string]$Url = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $RepoRoot "backend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Error "Virtual environment not found at $VenvPython — run: python -m venv .venv; pip install -r requirements.txt"
    exit 1
}

if ($Url) {
    $env:LIVECHATSCOPE_E2E_URL = $Url
    Write-Host "LIVECHATSCOPE_E2E_URL set — running smoke + flow tests"
} else {
    Remove-Item Env:LIVECHATSCOPE_E2E_URL -ErrorAction SilentlyContinue
    Write-Host "LIVECHATSCOPE_E2E_URL not set — running smoke tests only"
}

Push-Location $BackendDir
try {
    & $VenvPython -m pytest tests/ -v
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
