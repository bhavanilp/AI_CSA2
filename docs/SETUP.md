# Setup Guide

This project is designed to run locally with Ollama and a persisted local vector store.

## Prerequisites

- Node.js 18+
- npm
- Ollama

## Required Ollama models

```powershell
ollama pull qwen:latest
ollama pull nomic-embed-text:latest
```

## Install dependencies manually

```powershell
Set-Location backend
npm install

Set-Location ..\frontend\admin-dashboard
npm install

Set-Location ..\chat-interface
npm install
```

## Recommended startup path

Use the root script:

```powershell
Set-Location C:\Anil\AI_CSA
.\start-all.ps1
```

## What the startup script configures

The script sets the backend environment to local-first development defaults:

```text
BACKEND_PORT=3000
REDIS_DISABLED=true
VECTOR_DB_PROVIDER=local
LLM_PROVIDER=ollama
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=qwen:latest
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest
```

## Manual startup

### Backend

```powershell
Set-Location backend
$env:BACKEND_PORT='3000'
$env:REDIS_DISABLED='true'
$env:VECTOR_DB_PROVIDER='local'
$env:LLM_PROVIDER='ollama'
$env:OLLAMA_API_URL='http://localhost:11434'
$env:OLLAMA_MODEL='qwen:latest'
$env:OLLAMA_EMBEDDING_MODEL='nomic-embed-text:latest'
npm run dev
```

### Admin Dashboard

```powershell
Set-Location frontend/admin-dashboard
npm run dev -- -p 3001
```

### Chat Interface

```powershell
Set-Location frontend/chat-interface
npm run dev -- --host 0.0.0.0 --port 5173
```

## URLs

- Backend API: `http://localhost:3000`
- Admin Dashboard: `http://localhost:3001`
- Chat Interface: `http://localhost:5173`

## Authentication

- Email: `admin@aicsa.local`
- Password: `Admin@123`

## Data persistence behavior

### Vector store

- Local vector data is saved to `backend/data/local-vector-store.json`
- On backend startup, vectors and ingested URLs are loaded from this file

### Database

- If PostgreSQL is unavailable, the app falls back to the in-memory DB implementation in `backend/src/config/database.ts`
- Startup sync repopulates dashboard source records from the persisted vector-store URLs

## Health check

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/health'
```

You should see:

- `status: ok`
- `dependencies.database`
- `dependencies.vector_db`
- `dependencies.llm_provider`
- `vector_store.ingested_url_count`
- `vector_store.ingested_urls`

## Common issues

### Port already in use

The startup script already clears known ports. If needed manually:

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

### Ollama timeouts

The system already limits context size, but if Ollama is slow:

- verify `ollama list`
- ensure `qwen:latest` is available
- retry the request after the model is warm

### Blank dashboard page

This was fixed in the dashboard layout. If the dashboard still appears blank, verify:

- backend is reachable on port `3000`
- dashboard is running on port `3001`
- the browser still has a valid token in local storage