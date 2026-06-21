# LiveChatScope — start backend + frontend if not already running.
# Usage: .\scripts\dev.ps1 [-FrontendPort 3001]

param(
    [int]$FrontendPort = 3001
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"

function Test-PortListening {
    param([int]$Port)
    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if (-not (Test-PortListening -Port 8000)) {
    Write-Host "Starting backend on http://localhost:8000 ..."
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$BackendDir'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000"
    )
} else {
    Write-Host "Backend already running on :8000"
}

if (-not (Test-PortListening -Port $FrontendPort)) {
    Write-Host "Starting frontend on http://localhost:$FrontendPort ..."
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$FrontendDir'; npm run dev -- -p $FrontendPort"
    )
} else {
    Write-Host "Frontend already running on :$FrontendPort"
}

Write-Host "Done. Backend: http://localhost:8000  Frontend: http://localhost:$FrontendPort"
