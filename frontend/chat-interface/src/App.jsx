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
        setMessages([{
          role: 'assistant',
          content: '👋 Hello! I\'m your AI Customer Support Agent. You can:\n\n1. **Ingest Wikipedia URLs** - The Hyderabad Wikipedia page is pre-filled\n2. **Ask me questions** about the ingested content\n\nCheck the "📊 Activity Log" tab to see ingestion details and LLM prompts!',
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

    try {
      const response = await axios.post('/api/chat/message', {
        conversation_id: conversationId,
        session_id: sessionId,
        message: inputMessage
      })

      if (response.data.conversation_id) {
        setConversationId(response.data.conversation_id)
      }

      addLog('chat', 'LLM Response received', {
        confidence: (response.data.confidence * 100).toFixed(1) + '%',
        sources: response.data.sources.length,
        escalation: response.data.should_escalate,
        response_preview: response.data.content.substring(0, 100) + '...'
      })

      const assistantMessage = {
        role: 'assistant',
        content: response.data.content,
        sources: response.data.sources || [],
        confidence: response.data.confidence,
        shouldEscalate: response.data.should_escalate,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      addLog('error', 'Chat request failed', {
        error: error.response?.data?.error || error.message
      })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Error: ${error.response?.data?.error || error.message}`,
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
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
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.role}`}>
                  <div className="message-content">
                    <div className="message-text">{msg.content}</div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="sources">
                        <strong>📚 Sources:</strong>
                        <ul>
                          {msg.sources.map((source, idx) => (
                            <li key={idx}>
                              {source.source_name} (Score: {source.score?.toFixed(3)})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {msg.confidence !== undefined && (
                      <div className="metadata">
                        Confidence: {(msg.confidence * 100).toFixed(1)}%
                        {msg.shouldEscalate && ' ⚠️ Escalation recommended'}
                      </div>
                    )}
                  </div>
                  <div className="message-time">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {isLoading && (
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
