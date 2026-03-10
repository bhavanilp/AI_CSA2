# Start All Services for AI Customer Support Agent
Write-Host "🚀 Starting AI Customer Support Agent..." -ForegroundColor Cyan

# Kill any existing node processes
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Set environment variables
$env:REDIS_DISABLED = 'true'
$env:LLM_PROVIDER = 'ollama'
$env:OLLAMA_API_URL = 'http://localhost:11434'
$env:OLLAMA_MODEL = 'qwen:latest'
$env:OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text:latest'

# Start Backend
Write-Host "`n📦 Starting Backend Server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Anil\AI_CSA\backend'; `$env:REDIS_DISABLED='true'; `$env:LLM_PROVIDER='ollama'; `$env:OLLAMA_API_URL='http://localhost:11434'; `$env:OLLAMA_MODEL='qwen:latest'; `$env:OLLAMA_EMBEDDING_MODEL='nomic-embed-text:latest'; npm run dev"

# Wait for backend to start
Write-Host "Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Test backend health
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    Write-Host "✅ Backend is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Backend health check failed, but continuing..." -ForegroundColor Yellow
}

# Start Admin Dashboard
Write-Host "`n📊 Starting Admin Dashboard..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Anil\AI_CSA\frontend\admin-dashboard'; npm run dev"

# Start Chat Interface
Write-Host "`n💬 Starting Chat Interface..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Anil\AI_CSA\frontend\chat-interface'; npm run dev"

Write-Host "`n✨ All services started!" -ForegroundColor Cyan
Write-Host "`n📍 URLs:" -ForegroundColor White
Write-Host "   Backend API:        http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Admin Dashboard:    http://localhost:3001" -ForegroundColor Cyan
Write-Host "   Chat Interface:     http://localhost:5173" -ForegroundColor Cyan
Write-Host "`n🔐 Default Login:" -ForegroundColor White
Write-Host "   Email:    admin@aicsa.local" -ForegroundColor Gray
Write-Host "   Password: Admin@123" -ForegroundColor Gray
Write-Host "`nPress any key to stop all services..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Cleanup
Write-Host "`n🛑 Stopping all services..." -ForegroundColor Red
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Done!" -ForegroundColor Green
