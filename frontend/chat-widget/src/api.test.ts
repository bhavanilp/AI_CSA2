import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ChatAPI } from './api';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}));

describe('ChatAPI', () => {
  const post = vi.fn();
  const get = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (axios.create as any).mockReturnValue({ post, get });
  });

  it('sends chat messages to the backend payload shape used by the widget', async () => {
    post.mockResolvedValueOnce({ data: { content: 'Hello back' } });
    const api = new ChatAPI('http://localhost:3000', 'default');

    const result = await api.sendMessage('conv-1', 'Hello', 'session-1');

    expect(post).toHaveBeenCalledWith('/api/chat/message', {
      conversation_id: 'conv-1',
      message: 'Hello',
      session_id: 'session-1',
    });
    expect(result).toEqual({ content: 'Hello back' });
  });

  it('sends escalation requests with user details', async () => {
    post.mockResolvedValueOnce({ data: { ticket_reference: 'SUP-1' } });
    const api = new ChatAPI('http://localhost:3000', 'default');

    const result = await api.escalate('conv-1', 'Jane', 'jane@example.com', 'Need urgent help');

    expect(post).toHaveBeenCalledWith('/api/chat/escalate', {
      conversation_id: 'conv-1',
      user_name: 'Jane',
      user_email: 'jane@example.com',
      message: 'Need urgent help',
    });
    expect(result).toEqual({ ticket_reference: 'SUP-1' });
  });

  it('fetches a conversation by id', async () => {
    get.mockResolvedValueOnce({ data: { id: 'conv-1' } });
    const api = new ChatAPI('http://localhost:3000', 'default');

    const result = await api.getConversation('conv-1');

    expect(get).toHaveBeenCalledWith('/api/chat/conversation/conv-1');
    expect(result).toEqual({ id: 'conv-1' });
  });
});