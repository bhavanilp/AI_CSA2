Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

$job = Start-Job -ScriptBlock {
  Set-Location 'c:\Anil\AI_CSA\backend'
  $env:REDIS_DISABLED = 'true'
  $env:LLM_PROVIDER = 'ollama'
  $env:OLLAMA_API_URL = 'http://localhost:11434'
  $env:OLLAMA_MODEL = 'qwen:latest'
  $env:OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text:latest'
  node dist/index.js
}

Start-Sleep -Seconds 5

try {
  $loginBody = @{ email = 'admin@aicsa.local'; password = 'Admin@123' } | ConvertTo-Json
  $login = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/login' -ContentType 'application/json' -Body $loginBody

  $headers = @{ Authorization = "Bearer $($login.access_token)" }

  $ingestBody = @{ url = 'https://www.ust.com/en'; source_name = 'UST Website' } | ConvertTo-Json
  $ingest = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/admin/sources/ingest-url' -Headers $headers -ContentType 'application/json' -Body $ingestBody

  $chatBody = @{ conversation_id = ''; session_id = 'sess-local-2'; message = 'What services does UST provide?' } | ConvertTo-Json
  $chat = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/chat/message' -ContentType 'application/json' -Body $chatBody

  [PSCustomObject]@{
    health = 'ok'
    login_user = $login.user.email
    ingest_chunks = $ingest.chunk_count
    chat_confidence = $chat.confidence
    chat_escalate = $chat.should_escalate
    chat_sources = $chat.sources.Count
    chat_preview = $chat.content.Substring(0, [Math]::Min(200, $chat.content.Length))
  } | ConvertTo-Json -Depth 6
}
finally {
  $logs = Receive-Job $job -Keep
  if ($logs) {
    "---SERVER LOG TAIL---"
    $logs | Select-Object -Last 20
  }

  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -ErrorAction SilentlyContinue
}
