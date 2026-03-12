import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [urlToIngest, setUrlToIngest] = useState('https://en.wikipedia.org/wiki/Hyderabad')
  const [isLoading, setIsLoading] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [sessionId] = useState(`session-${Date.now()}`)
  const [conversationId, setConversationId] = useState('')
  const [token, setToken] = useState('')
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const messagesEndRef = useRef(null)
  const logsEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const scrollLogsToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const addLog = (type, message, details = null) => {
    const logEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      details
    }
    setLogs(prev => [...prev, logEntry])
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    scrollLogsToBottom()
  }, [logs])

  // Auto-login on mount
  useEffect(() => {
    const login = async () => {
      try {
        const response = await axios.post('/api/auth/login', {
          email: 'admin@aicsa.local',
          password: 'Admin@123'
        })
        setToken(response.data.access_token)
        addLog('auth', 'Successfully authenticated as admin@aicsa.local')

        let startupUrls = []
        try {
          const urlsResponse = await axios.get('/api/chat/ingested-urls')
          startupUrls = urlsResponse.data.urls || []
          addLog('ingestion', 'Loaded ingested URLs at startup', { count: startupUrls.length, urls: startupUrls })
        } catch (urlsError) {
          addLog('error', 'Could not load startup ingested URLs', urlsError.message)
        }

        const startupUrlsMessage = startupUrls.length > 0
          ? `\n\n📚 Ingested URLs currently loaded:\n${startupUrls.map((url, idx) => `${idx + 1}. ${url}`).join('\n')}`
          : '\n\n📚 No ingested URLs are loaded yet. Ingest one using the URL box below.'

        setMessages([{
          role: 'assistant',
          content: '👋 Hello! I\'m your AI Customer Support Agent. You can:\n\n1. **Ingest Wikipedia URLs** - The Hyderabad Wikipedia page is pre-filled\n2. **Ask me questions** about the ingested content\n\nCheck the "📊 Activity Log" tab to see ingestion details and LLM prompts!' + startupUrlsMessage,
          timestamp: new Date()
        }])
      } catch (error) {
        console.error('Auto-login failed:', error)
        addLog('error', 'Authentication failed', error.message)
        setMessages([{
          role: 'assistant',
          content: '⚠️ Failed to authenticate. Please check if the backend is running.',
          timestamp: new Date()
        }])
      }
    }
    login()
  }, [])

  const handleIngestUrl = async (e) => {
    e.preventDefault()
    if (!urlToIngest.trim() || !token) return

    setIsIngesting(true)
    addLog('ingestion', 'Starting URL ingestion', { url: urlToIngest })
    setMessages(prev => [...prev, {
      role: 'system',
      content: `📥 Ingesting: ${urlToIngest}`,
      timestamp: new Date()
    }])

    try {
      const response = await axios.post('/api/admin/sources/ingest-url', {
        url: urlToIngest,
        source_name: urlToIngest
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      addLog('ingestion', 'URL ingestion completed', {
        source_id: response.data.source_id,
        chunk_count: response.data.chunk_count,
        status: response.data.status
      })

      setMessages(prev => [...prev, {
        role: 'system',
        content: `✅ Successfully ingested ${response.data.chunk_count} chunks from ${urlToIngest}`,
        timestamp: new Date()
      }])
      setUrlToIngest('https://en.wikipedia.org/wiki/Hyderabad')
    } catch (error) {
      addLog('error', 'Ingestion failed', {
        error: error.response?.data?.error || error.message,
        status: error.response?.status
      })
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Error ingesting URL: ${error.response?.data?.error || error.message}`,
        timestamp: new Date()
      }])
    } finally {
      setIsIngesting(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || isLoading) return

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    addLog('chat', 'User query', { message: inputMessage })
    setInputMessage('')
    setIsLoading(true)

    // Add an empty assistant message that we will fill token-by-token
    const placeholderId = Date.now()
    setMessages(prev => [...prev, {
      id: placeholderId,
      role: 'assistant',
      content: '',
      streaming: true,
      timestamp: new Date()
    }])

    try {
      const response = await fetch('/api/chat/message/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          session_id: sessionId,
          message: inputMessage,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let meta = null

      const applyMeta = (m) => {
        if (m.conversation_id) setConversationId(m.conversation_id)
        meta = m
        setMessages(prev =>
          prev.map(msg =>
            msg.id === placeholderId
              ? {
                  ...msg,
                  sources: m.sources || [],
                  shouldEscalate: m.should_escalate,
                  usedVectorStore: m.used_vector_store,
                  vectorStoreNote: m.vector_store_note,
                }
              : msg
          )
        )
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines from buffer
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          let eventName = 'message'
          let dataLine = ''
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim()
            if (line.startsWith('data: ')) dataLine = line.slice(6).trim()
          }

          if (!dataLine) continue
          let parsed
          try { parsed = JSON.parse(dataLine) } catch { continue }

          if (eventName === 'meta') {
            applyMeta(parsed)
          } else if (eventName === 'think_token') {
            // Native thinking field (qwen3-style models)
            setMessages(prev =>
              prev.map(msg =>
                msg.id === placeholderId
                  ? { ...msg, nativeThinking: (msg.nativeThinking || '') + (parsed.token || '') }
                  : msg
              )
            )
          } else if (eventName === 'token') {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === placeholderId
                  ? { ...msg, content: msg.content + (parsed.token || '') }
                  : msg
              )
            )
          } else if (eventName === 'done') {
            const confidence = parsed.confidence ?? 0
            setMessages(prev =>
              prev.map(msg =>
                msg.id === placeholderId
                  ? { ...msg, streaming: false, confidence }
                  : msg
              )
            )
            addLog('chat', 'LLM Response received', {
              confidence: (confidence * 100).toFixed(1) + '%',
              sources: meta?.sources?.length ?? 0,
              escalation: meta?.should_escalate,
            })
          } else if (eventName === 'error') {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === placeholderId
                  ? { ...msg, streaming: false, content: `❌ ${parsed.message || 'Streaming error'}` }
                  : msg
              )
            )
          }
        }
      }
    } catch (error) {
      addLog('error', 'Chat request failed', {
        error: error.message
      })
      setMessages(prev =>
        prev.map(msg =>
          msg.id === placeholderId
            ? { ...msg, streaming: false, content: `❌ Error: ${error.message}` }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const parseMessageContent = (msg) => {
    // Native thinking (from think_token SSE events) takes priority
    if (msg.nativeThinking) {
      return { thinking: msg.nativeThinking, answer: msg.content, stillThinking: false }
    }
    // Parse inline <think>...</think> from response tokens
    const raw = msg.content || ''
    const openIdx = raw.indexOf('<think>')
    if (openIdx === -1) return { thinking: '', answer: raw, stillThinking: false }
    const closeIdx = raw.indexOf('</think>')
    if (closeIdx === -1) {
      // Still inside the thinking block
      return { thinking: raw.slice(openIdx + 7), answer: '', stillThinking: true }
    }
    return {
      thinking: raw.slice(openIdx + 7, closeIdx),
      answer: raw.slice(closeIdx + 8).trimStart(),
      stillThinking: false,
    }
  }

  const formatSourceConfidence = (source) => {
    if (typeof source.confidence_min === 'number' && typeof source.confidence_max === 'number') {
      if (Math.abs(source.confidence_max - source.confidence_min) < 0.0005) {
        return source.confidence_max.toFixed(3)
      }
      return `${source.confidence_min.toFixed(3)}-${source.confidence_max.toFixed(3)}`
    }

    if (typeof source.score === 'number') {
      return source.score.toFixed(3)
    }

    return 'N/A'
  }

  return (
    <div className="app">
      <div className="header">
        <h1>🤖 AI Customer Support Agent</h1>
        <p>Powered by Ollama + Local RAG</p>
        <div className="header-tabs">
          <button 
            className={`tab-btn ${!showLogs ? 'active' : ''}`}
            onClick={() => setShowLogs(false)}
          >
            💬 Chat
          </button>
          <button 
            className={`tab-btn ${showLogs ? 'active' : ''}`}
            onClick={() => setShowLogs(true)}
          >
            📊 Activity Log ({logs.length})
          </button>
        </div>
      </div>

      {!showLogs ? (
        <>
          {/* URL Ingestion Form */}
          <div className="ingest-panel">
            <form onSubmit={handleIngestUrl}>
              <input
                type="url"
                value={urlToIngest}
                onChange={(e) => setUrlToIngest(e.target.value)}
                placeholder="Enter website URL to ingest (e.g., https://www.ust.com/en)"
                disabled={isIngesting || !token}
                required
              />
              <button type="submit" disabled={isIngesting || !token}>
                {isIngesting ? '📥 Ingesting...' : '📥 Ingest URL'}
              </button>
            </form>
          </div>

          {/* Chat Messages */}
          <div className="chat-container">
            <div className="messages">
              {messages.map((msg, index) => {
                const parsed = msg.role === 'assistant' ? parseMessageContent(msg) : null
                return (
                <div key={msg.id ?? index} className={`message ${msg.role}`}>
                  <div className="message-content">
                    {/* Non-vector-store answer badge */}
                    {msg.role === 'assistant' && msg.usedVectorStore === false && msg.vectorStoreNote && (
                      <div style={{
                        background: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        marginBottom: '8px',
                        fontSize: '0.78rem',
                        color: '#856404'
                      }}>
                        ⚠️ <strong>General knowledge answer</strong> — {msg.vectorStoreNote}
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.usedVectorStore === true && (
                      <div style={{
                        background: '#d4edda',
                        border: '1px solid #28a745',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        marginBottom: '8px',
                        fontSize: '0.78rem',
                        color: '#155724'
                      }}>
                        ✅ Answer from vector store
                      </div>
                    )}
                    {/* Thinking section (collapsible) */}
                    {msg.role === 'assistant' && parsed?.thinking && (
                      <details className="thinking-block" open={parsed.stillThinking}>
                        <summary>
                          💭 {parsed.stillThinking ? 'Thinking…' : 'View thinking'}
                        </summary>
                        <div className="thinking-content">
                          {parsed.thinking}
                          {parsed.stillThinking && <span className="streaming-cursor" />}
                        </div>
                      </details>
                    )}
                    <div className="message-text">
                      {msg.role === 'assistant' ? parsed?.answer : msg.content}
                      {msg.streaming && !parsed?.stillThinking && <span className="streaming-cursor" />}
                    </div>
                    {!msg.streaming && msg.sources && msg.sources.length > 0 && (
                      <div className="sources">
                        <strong>📚 Sources:</strong>
                        <ul>
                          {msg.sources.map((source, idx) => (
                            <li key={idx}>
                              {source.name || source.source_name} — Confidence: {formatSourceConfidence(source)}
                              {source.match_count > 1 ? ` (${source.match_count} matches)` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!msg.streaming && msg.confidence !== undefined && (
                      <div className="metadata">
                        Confidence: {(msg.confidence * 100).toFixed(1)}%
                        {msg.shouldEscalate && ' ⚠️ Escalation recommended'}
                      </div>
                    )}
                  </div>
                  <div className="message-time">
                    {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString() : ''}
                  </div>
                </div>
                )
              })}
              {isLoading && !messages.some(m => m.streaming) && (
                <div className="message assistant loading">
                  <div className="message-content">Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="input-form">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question about the ingested content..."
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading || !inputMessage.trim()}>
                {isLoading ? '⏳' : '📤 Send'}
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="logs-panel">
          <div className="logs-content">
            {logs.length === 0 ? (
              <div className="empty-logs">No activity logged yet</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`log-entry log-${log.type}`}>
                  <div className="log-header">
                    <span className="log-time">{log.timestamp}</span>
                    <span className={`log-type log-type-${log.type}`}>
                      {log.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="log-message">{log.message}</div>
                  {log.details && (
                    <details className="log-details">
                      <summary>Details</summary>
                      <pre>{JSON.stringify(log.details, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
