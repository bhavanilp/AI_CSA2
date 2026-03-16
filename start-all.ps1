# Start All Services for AI Customer Support Agent
Write-Host "Starting AI Customer Support Agent..." -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root "backend"
$adminPath = Join-Path $root "frontend\admin-dashboard"
$chatPath = Join-Path $root "frontend\chat-interface"

function Stop-ProcessOnPort {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        return
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "Freed port $Port by stopping PID $pid" -ForegroundColor Yellow
        } catch {
            Write-Host "Could not stop PID $pid on port $Port" -ForegroundColor Red
        }
    }
}

function Ensure-NodeModules {
    param([string]$Path)

    if (-not (Test-Path (Join-Path $Path "node_modules"))) {
        Write-Host "Installing dependencies in $Path" -ForegroundColor Yellow
        Push-Location $Path
        try {
            npm install
        } finally {
            Pop-Location
        }
    }
}

Write-Host "Cleaning up occupied service ports..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 3001
Stop-ProcessOnPort -Port 5173

Ensure-NodeModules -Path $backendPath
Ensure-NodeModules -Path $adminPath
Ensure-NodeModules -Path $chatPath

Write-Host "Starting Backend Server..." -ForegroundColor Green
$backendCommand = "Set-Location '$backendPath'; " +
    "`$env:BACKEND_PORT='3000'; " +
    "`$env:REDIS_DISABLED='true'; " +
    "`$env:VECTOR_DB_PROVIDER='local'; " +
    "`$env:LLM_PROVIDER='ollama'; " +
    "`$env:OLLAMA_API_URL='http://localhost:11434'; " +
    "`$env:OLLAMA_MODEL='qwen3.5:2b'; " +
    "`$env:OLLAMA_EMBEDDING_MODEL='nomic-embed-text:latest'; " +
    "npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand

Write-Host "Waiting for backend health endpoint..." -ForegroundColor Yellow
$backendHealthy = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 3
        if ($health.status -eq 'ok') {
            $backendHealthy = $true
            break
        }
    } catch {
        # Continue retrying
    }
}

if ($backendHealthy) {
    Write-Host "Backend is healthy." -ForegroundColor Green
} else {
    Write-Host "Backend did not become healthy in time. Check backend terminal logs." -ForegroundColor Red
}

Write-Host "Starting Admin Dashboard on port 3001..." -ForegroundColor Green
$adminCommand = "Set-Location '$adminPath'; npm run dev -- -p 3001"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $adminCommand

Write-Host "Starting Chat Interface on port 5173..." -ForegroundColor Green
$chatCommand = "Set-Location '$chatPath'; npm run dev -- --host 0.0.0.0 --port 5173"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $chatCommand

Write-Host "All services started." -ForegroundColor Cyan
Write-Host "URLs:" -ForegroundColor White
Write-Host "  Backend API:      http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Admin Dashboard:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Chat Interface:   http://localhost:5173" -ForegroundColor Cyan
Write-Host "Default Login:" -ForegroundColor White
Write-Host "  Email:    admin@aicsa.local" -ForegroundColor Gray
Write-Host "  Password: Admin@123" -ForegroundColor Gray

Write-Host "Press any key to stop services started on known ports..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "Stopping services..." -ForegroundColor Red
Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 3001
Stop-ProcessOnPort -Port 5173
Write-Host "Done." -ForegroundColor Green
