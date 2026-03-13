import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import ConversationsPage from './page';

jest.mock('axios');

const replace = jest.fn();
const router = { replace };

jest.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ConversationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem('token', 'token-123');
    window.localStorage.setItem('user', JSON.stringify({ email: 'admin@aicsa.local', role: 'admin' }));
  });

  it('loads conversations and opens the transcript drawer', async () => {
    mockedAxios.get.mockImplementation((url) => {
      if (url === '/api/admin/conversations') {
        return Promise.resolve({
          data: {
            conversations: [
              {
                id: 'conv-1',
                session_id: 'session-1',
                user_email: 'test@example.com',
                user_name: 'Test User',
                message_count: 2,
                was_escalated: false,
                feedback_rating: null,
                created_at: '2026-03-10T12:00:00.000Z',
              },
            ],
            total: 1,
          },
        } as any);
      }

      if (url === '/api/chat/conversation/conv-1') {
        return Promise.resolve({
          data: {
            id: 'conv-1',
            session_id: 'session-1',
            user_email: 'test@example.com',
            user_name: 'Test User',
            message_count: 2,
            was_escalated: false,
            created_at: '2026-03-10T12:00:00.000Z',
            updated_at: '2026-03-10T12:01:00.000Z',
            messages: [
              { role: 'user', content: 'Hello', timestamp: '2026-03-10T12:00:00.000Z' },
              {
                role: 'bot',
                content: 'Hi there',
                timestamp: '2026-03-10T12:00:10.000Z',
                response_time_sec: 0.98,
                confidence: 0.81,
                confidence_reason: 'avg similarity 0.81; no major penalties',
                sources: [{ name: 'Hyderabad Wiki', url: 'https://en.wikipedia.org/wiki/Hyderabad', score: 0.81 }],
              },
            ],
          },
        } as any);
      }

      return Promise.reject(new Error(`Unexpected GET ${String(url)}`));
    });

    render(<ConversationsPage />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/admin/conversations', expect.any(Object));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Loading conversations/i)).not.toBeInTheDocument();
    });
    const viewButtons = await screen.findAllByRole('button', { name: 'View Transcript' });
    expect(viewButtons).toHaveLength(1);

    fireEvent.click(viewButtons[0]);

    expect(await screen.findByText('Conversation Transcript')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.getByText(/Response time: 0.98s/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: 81.0%/i)).toBeInTheDocument();
    expect(screen.getByText('Hyderabad Wiki')).toBeInTheDocument();
  });

  it('submits admin feedback for a conversation', async () => {
    mockedAxios.get.mockImplementation((url) => {
      if (url === '/api/admin/conversations') {
        return Promise.resolve({
          data: {
            conversations: [
              {
                id: 'conv-2',
                session_id: 'session-2',
                user_email: null,
                user_name: null,
                message_count: 2,
                was_escalated: false,
                feedback_rating: null,
                created_at: '2026-03-10T12:00:00.000Z',
              },
            ],
            total: 1,
          },
        } as any);
      }

      return Promise.reject(new Error(`Unexpected GET ${String(url)}`));
    });
    mockedAxios.post.mockResolvedValueOnce({ data: { conversation_id: 'conv-2', feedback_recorded: true } } as any);

    render(<ConversationsPage />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/admin/conversations', expect.any(Object));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Loading conversations/i)).not.toBeInTheDocument();
    });
    const helpfulButtons = await screen.findAllByRole('button', { name: 'Helpful' });
    expect(helpfulButtons).toHaveLength(1);
    fireEvent.click(helpfulButtons[0]);

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/admin/conversations/conv-2/feedback',
        expect.objectContaining({ rating: 5, is_correct: true }),
        expect.any(Object),
      );
    });
  });
});