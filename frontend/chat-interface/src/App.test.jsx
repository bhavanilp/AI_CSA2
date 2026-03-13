import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import axios from 'axios'
import App from './App'

vi.mock('axios')

const mockedAxios = axios

const createSseResponse = (events) => {
  const payload = events
    .map((event) => `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`)
    .join('')
  const encoded = new TextEncoder().encode(payload)
  let sent = false

  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (sent) {
            return { done: true, value: undefined }
          }
          sent = true
          return { done: false, value: encoded }
        },
      }),
    },
  }
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    mockedAxios.post.mockReset()
    mockedAxios.get.mockReset()
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: 'token-123'
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows startup ingested URLs after auto-login', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        urls: [
          'https://en.wikipedia.org/wiki/Bapatla',
          'https://en.wikipedia.org/wiki/Hyderabad'
        ]
      }
    })

    render(<App />)

    expect(await screen.findByText(/Ingested URLs currently loaded/i)).toBeInTheDocument()
    expect(screen.getByText(/1. https:\/\/en.wikipedia.org\/wiki\/Bapatla/i)).toBeInTheDocument()
    expect(screen.getByText(/2. https:\/\/en.wikipedia.org\/wiki\/Hyderabad/i)).toBeInTheDocument()
  })

  it('shows confidence reason and response time from stream completion metadata', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { urls: [] } })
    fetch.mockResolvedValueOnce(
      createSseResponse([
        {
          event: 'meta',
          data: {
            conversation_id: 'conv-1',
            should_escalate: false,
            used_vector_store: false,
            vector_store_note: 'No relevant vector-store content matched the question.',
            sources: [],
          },
        },
        { event: 'token', data: { token: '_Note: This answer does not use vector store context._\n\nParis.' } },
        {
          event: 'done',
          data: {
            confidence: 0.8,
            confidence_reason: 'No relevant vector-store evidence; baseline confidence applied.',
            response_time_sec: 0.421,
          },
        },
      ]),
    )

    render(<App />)

    await screen.findByText(/No ingested URLs are loaded yet/i)

    fireEvent.change(screen.getByPlaceholderText(/Ask a question about the ingested content/i), {
      target: { value: 'What is the capital of France?' }
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText(/General knowledge answer/i)).toBeInTheDocument()
    expect(screen.getByText(/Paris\./i)).toBeInTheDocument()
    expect(screen.getByText(/Confidence: 80.0%/i)).toBeInTheDocument()
    expect(screen.getByText(/baseline confidence applied/i)).toBeInTheDocument()
    expect(screen.getByText(/Response time: 0.42s/i)).toBeInTheDocument()
    expect(screen.getByText(/Round-trip for this request: 0.42s/i)).toBeInTheDocument()
  })
})