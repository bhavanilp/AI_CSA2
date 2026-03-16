'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import MetricCard from '@/components/MetricCard';
import ConversationChart from '@/components/ConversationChart';

interface Metrics {
  total_conversations: number;
  avg_response_time_sec: number;
  escalation_rate: number;
  avg_satisfaction: number;
  unique_users: number;
  token_usage?: {
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    avg_tokens_per_response: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    const fetchMetrics = async () => {
      try {
        // Use relative URL — proxied to backend via next.config.js rewrites
        const response = await axios.get('/api/admin/metrics', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });
        setMetrics(response.data.stats);
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.replace('/auth/login');
        } else {
          setError(
            err.code === 'ECONNABORTED'
              ? 'Backend is unreachable. Make sure the backend is running on port 3000.'
              : err.response?.data?.error || 'Failed to load metrics',
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-gray-500 text-sm">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  const m = metrics ?? {
    total_conversations: 0,
    avg_response_time_sec: 0,
    escalation_rate: 0,
    avg_satisfaction: 0,
    unique_users: 0,
    token_usage: {
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      total_tokens: 0,
      avg_tokens_per_response: 0,
    },
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {m.total_conversations === 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
          No conversations yet. Start chatting via the{' '}
          <a href="http://localhost:5173" target="_blank" className="underline font-medium">
            Chat Interface
          </a>{' '}
          to see metrics here.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6 mb-8">
        <MetricCard label="Total Conversations" value={m.total_conversations} icon="💬" />
        <MetricCard label="Avg Response Time" value={`${m.avg_response_time_sec.toFixed(2)}s`} icon="⚡" />
        <MetricCard
          label="Escalation Rate"
          value={`${(m.escalation_rate * 100).toFixed(1)}%`}
          icon="📈"
        />
        <MetricCard
          label="Avg Satisfaction"
          value={`${m.avg_satisfaction?.toFixed(1) || 'N/A'}/5`}
          icon="⭐"
        />
        <MetricCard label="Unique Users" value={m.unique_users} icon="👥" />
        <MetricCard label="Total Tokens" value={m.token_usage?.total_tokens || 0} icon="🧮" />
        <MetricCard
          label="Avg Tokens / Response"
          value={m.token_usage?.avg_tokens_per_response?.toFixed(1) || '0.0'}
          icon="🔤"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversationChart />
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Operations Snapshot</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <span className="text-gray-600">Escalated Conversations</span>
              <span className="font-semibold text-amber-700">{Math.round(m.total_conversations * m.escalation_rate)}</span>
            </div>
            <div className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <span className="text-gray-600">Knowledge Source Coverage</span>
              <span className="font-semibold text-blue-700">Manage in Sources</span>
            </div>
            <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              <a
                href="/dashboard/conversations"
                className="text-center px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
              >
                Review Conversations
              </a>
              <a
                href="/dashboard/escalation-rules"
                className="text-center px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
              >
                Tune Escalation Rules
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
