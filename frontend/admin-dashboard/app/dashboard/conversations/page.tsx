'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface Conversation {
  id: string;
  session_id: string;
  user_email: string | null;
  user_name: string | null;
  message_count: number;
  was_escalated: boolean;
  feedback_rating: number | null;
  created_at: string;
}

interface ConversationSource {
  source_id?: string;
  name?: string;
  url?: string;
  score?: number;
  confidence_min?: number;
  confidence_max?: number;
  match_count?: number;
}

interface ConversationMessage {
  role: 'user' | 'bot' | string;
  content: string;
  timestamp?: string;
  confidence?: number;
  confidence_reason?: string;
  response_time_sec?: number;
  response_time_ms?: number;
  sources?: ConversationSource[];
}

interface ConversationDetail {
  id: string;
  session_id: string;
  user_email: string | null;
  user_name: string | null;
  messages: ConversationMessage[];
  message_count: number;
  was_escalated: boolean;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 20;

export default function ConversationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingFeedback, setIsSavingFeedback] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchConversations = async (nextOffset: number) => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const response = await axios.get('/api/admin/conversations', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: PAGE_SIZE, offset: nextOffset },
        timeout: 10000,
      });
      setItems(response.data.conversations || []);
      setTotal(response.data.total || 0);
      setOffset(nextOffset);
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/auth/login');
      } else {
        setError(err.response?.data?.error || 'Failed to load conversations');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const filteredItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((item) => {
      const name = item.user_name?.toLowerCase() || '';
      const email = item.user_email?.toLowerCase() || '';
      const session = item.session_id?.toLowerCase() || '';
      return name.includes(q) || email.includes(q) || session.includes(q);
    });
  }, [items, searchText]);

  const submitFeedback = async (conversationId: string, rating: number, isCorrect: boolean) => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    try {
      setIsSavingFeedback(conversationId);
      await axios.post(
        `/api/admin/conversations/${conversationId}/feedback`,
        {
          rating,
          is_correct: isCorrect,
          comment: isCorrect ? 'Marked as helpful by admin' : 'Marked for review by admin',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        },
      );
      setItems((prev) =>
        prev.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                feedback_rating: rating,
              }
            : item,
        ),
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save feedback');
    } finally {
      setIsSavingFeedback(null);
    }
  };

  const viewConversation = async (conversationId: string) => {
    try {
      setError('');
      setIsLoadingDetail(true);
      const response = await axios.get(`/api/chat/conversation/${conversationId}`, {
        timeout: 10000,
      });
      setSelectedConversation(response.data as ConversationDetail);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load conversation transcript');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const canGoPrev = offset > 0;
  const canGoNext = offset + PAGE_SIZE < total;

  const formatConfidence = (src: ConversationSource) => {
    if (typeof src.confidence_min === 'number' && typeof src.confidence_max === 'number') {
      if (Math.abs(src.confidence_max - src.confidence_min) < 0.0005) {
        return src.confidence_max.toFixed(2);
      }
      return `${src.confidence_min.toFixed(2)}-${src.confidence_max.toFixed(2)}`;
    }

    if (typeof src.score === 'number') {
      return src.score.toFixed(2);
    }

    return null;
  };

  const deriveResponseTimeSec = (messages: ConversationMessage[], index: number): number | null => {
    const current = messages[index];
    if (typeof current?.response_time_sec === 'number') {
      return Math.max(0, Number(current.response_time_sec));
    }

    if (typeof current?.response_time_ms === 'number') {
      return Math.max(0, Number((current.response_time_ms / 1000).toFixed(3)));
    }

    if (current?.role === 'bot') {
      for (let i = index - 1; i >= 0; i -= 1) {
        if (messages[i]?.role !== 'user') continue;
        const userTs = Date.parse(messages[i].timestamp || '');
        const botTs = Date.parse(current.timestamp || '');
        if (!Number.isNaN(userTs) && !Number.isNaN(botTs) && botTs >= userTs) {
          return Number(((botTs - userTs) / 1000).toFixed(3));
        }
        break;
      }
    }

    if (current?.role === 'user') {
      for (let i = index + 1; i < messages.length; i += 1) {
        if (messages[i]?.role !== 'bot') continue;
        const userTs = Date.parse(current.timestamp || '');
        const botTs = Date.parse(messages[i].timestamp || '');
        if (!Number.isNaN(userTs) && !Number.isNaN(botTs) && botTs >= userTs) {
          return Number(((botTs - userTs) / 1000).toFixed(3));
        }
        break;
      }
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-3xl font-bold">Conversations</h1>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Filter current page by user/session"
          className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Sessions</h2>
          <span className="text-sm text-gray-500">Total: {total}</span>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-gray-500 text-sm">Loading conversations...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">No conversations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Session</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Messages</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Escalated</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Feedback</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Created</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-800">{item.user_name || 'Anonymous user'}</div>
                      <div className="text-xs text-gray-500">{item.user_email || 'No email provided'}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{item.session_id}</td>
                    <td className="px-4 py-2">{item.message_count}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.was_escalated ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {item.was_escalated ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-2">{item.feedback_rating ? `${item.feedback_rating}/5` : 'Not rated'}</td>
                    <td className="px-4 py-2 text-gray-500">{new Date(item.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => viewConversation(item.id)}
                          disabled={isLoadingDetail}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                        >
                          View Transcript
                        </button>
                        <button
                          onClick={() => submitFeedback(item.id, 5, true)}
                          disabled={isSavingFeedback === item.id}
                          className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                        >
                          Helpful
                        </button>
                        <button
                          onClick={() => submitFeedback(item.id, 2, false)}
                          disabled={isSavingFeedback === item.id}
                          className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded disabled:opacity-50"
                        >
                          Needs Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => fetchConversations(Math.max(offset - PAGE_SIZE, 0))}
            disabled={!canGoPrev || isLoading}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => fetchConversations(offset + PAGE_SIZE)}
            disabled={!canGoNext || isLoading}
            className="px-3 py-1.5 text-sm border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {selectedConversation && (
        <div className="fixed inset-0 z-40 bg-black/40 flex justify-end" onClick={() => setSelectedConversation(null)}>
          <div
            className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Conversation Transcript</h2>
                <p className="text-xs text-gray-500 mt-1">Session: {selectedConversation.session_id}</p>
              </div>
              <button
                onClick={() => setSelectedConversation(null)}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">User</p>
                  <p className="font-medium text-gray-800">{selectedConversation.user_name || 'Anonymous user'}</p>
                  <p className="text-xs text-gray-500">{selectedConversation.user_email || 'No email provided'}</p>
                </div>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-gray-500">Message Count</p>
                  <p className="font-medium text-gray-800">{selectedConversation.message_count}</p>
                  <p className="text-xs text-gray-500">
                    {selectedConversation.was_escalated ? 'Escalated' : 'Not escalated'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedConversation.messages?.length ? (
                  selectedConversation.messages.map((msg, idx) => (
                    (() => {
                      const responseSec = deriveResponseTimeSec(selectedConversation.messages, idx);
                      return (
                    <div
                      key={`${msg.timestamp || idx}-${idx}`}
                      className={`rounded-lg p-4 border ${msg.role === 'user' ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">{msg.role}</span>
                        <span className="text-xs text-gray-500">
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'No timestamp'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>

                      {typeof responseSec === 'number' && (
                        <p className="mt-2 text-xs text-gray-600">
                          {msg.role === 'bot' ? 'Response time' : 'Round-trip'}: {responseSec.toFixed(2)}s
                        </p>
                      )}

                      {msg.role === 'bot' && typeof msg.confidence === 'number' && (
                        <p className="mt-1 text-xs text-gray-600">
                          Confidence: {(msg.confidence * 100).toFixed(1)}%
                          {msg.confidence_reason ? ` (${msg.confidence_reason})` : ''}
                        </p>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                          <p className="text-xs font-medium text-gray-600">Sources</p>
                          {msg.sources.map((src, sIdx) => (
                            <div key={`${src.source_id || sIdx}-${sIdx}`} className="text-xs text-gray-700">
                              <span className="font-medium">{src.name || 'Source'}</span>
                              {formatConfidence(src) && <span className="text-gray-500"> (Confidence: {formatConfidence(src)})</span>}
                              {typeof src.match_count === 'number' && src.match_count > 1 && (
                                <span className="text-gray-500"> ({src.match_count} matches)</span>
                              )}
                              {src.url && (
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-blue-600 hover:underline break-all"
                                >
                                  Open
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                      );
                    })()
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-gray-500">No messages found for this conversation.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
