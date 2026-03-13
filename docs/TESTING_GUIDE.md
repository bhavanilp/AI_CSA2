# Testing Guide

This repository now includes automated tests plus manual regression checks for the recent backend, dashboard, and vector-store fixes.

## Automated tests

### Backend unit and regression tests

```powershell
Set-Location backend
npm test
```

Coverage focus:

- vector-store answer path in `chatService`
- non-vector fallback path
- timeout-safe LLM failure handling
- escalation keyword matching
- conversation transcript retrieval

### Admin dashboard tests

```powershell
Set-Location frontend/admin-dashboard
npm test
```

Coverage focus:

- conversation transcript drill-down
- admin feedback submission
- settings health load
- local UI preference persistence

### Chat interface tests

```powershell
Set-Location frontend/chat-interface
npm test
```

Coverage focus:

- startup ingested URL list rendering
- general-knowledge badge for non-vector answers
- response-time and confidence-reason metadata rendering from streaming responses

## Build validation

```powershell
Set-Location backend
npm run build

Set-Location ..\frontend\admin-dashboard
npm run build

Set-Location ..\chat-interface
npm run build
```

## Manual regression checklist

## 1. Backend health and persisted URLs

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/api/health'
```

Verify:

- `status` is `ok`
- `vector_store.ingested_url_count` is correct
- `vector_store.ingested_urls` contains previously ingested URLs

## 2. Login and admin token

```powershell
$body = @{ email='admin@aicsa.local'; password='Admin@123' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/login' -ContentType 'application/json' -Body $body
$token = $login.access_token
```

## 3. Ingest a URL

```powershell
$headers = @{ Authorization = "Bearer $token" }
$body = @{ url='https://en.wikipedia.org/wiki/Hyderabad'; source_name='Hyderabad Wikipedia' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/admin/sources/ingest-url' -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 180
```

Verify:

- request succeeds
- response status is `indexed`
- `chunk_count` is greater than zero

## 4. Verify dashboard sources

```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/admin/sources' -Headers $headers
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/chat/ingested-urls'
```

Verify:

- source records exist in `/api/admin/sources`
- ingested URLs exist in `/api/chat/ingested-urls`
- after backend restart, both are still visible in the dashboard

## 5. Relevant vector-store query

```powershell
$body = @{ conversation_id=''; session_id='regression-1'; message='What is Hyderabad known for?' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/chat/message' -ContentType 'application/json' -Body $body -TimeoutSec 180
```

Verify:

- `used_vector_store` is `true`
- response contains source records
- answer is grounded in the ingested content
- `response_time_sec` is present and non-negative
- `confidence_reason` is present

## 6. Non-vector fallback query

```powershell
$body = @{ conversation_id=''; session_id='regression-2'; message='What is the capital of France?' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/chat/message' -ContentType 'application/json' -Body $body -TimeoutSec 180
```

Verify:

- `used_vector_store` is `false`
- `vector_store_note` explains why
- answer starts with the non-vector note
- `response_time_sec` is present and non-negative
- `confidence_reason` explains baseline confidence

## 7. Dashboard pages

Open `http://localhost:3001` and verify:

- login works
- overview page loads without a blank screen
- overview `Avg Response Time` reflects per-turn bot latency (not session lifetime)
- sources page shows ingested URLs and source records
- removing a URL from sources page removes it from vector store and the ingested URL list
- conversations page lists sessions and opens transcript drawer
- transcript drawer shows response time in seconds for each request/response turn
- transcript drawer shows confidence score with reason for bot messages
- escalation rules page loads and saves rule changes
- settings page shows backend health and saved local preferences

## 8. Chat interface

Open `http://localhost:5173` and verify:

- startup message lists ingested URLs
- ingest URL action works
- vector-store answers show the green badge
- fallback answers show the yellow general-knowledge badge
- each request/response turn shows response time in seconds
- confidence displays reason text in brackets
- no editor tab is present