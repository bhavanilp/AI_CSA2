'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import MetricCard from '@/components/MetricCard';
import ConversationChart from '@/components/ConversationChart';

interface Metrics {
  total_conversations: number;
  avg_response_time_ms: number;
  escalation_rate: number;
  avg_satisfaction: number;
  unique_users: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }

    const fetchMetrics = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_ENDPOINT}/api/admin/metrics`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setMetrics(response.data.stats);
      } catch (err: any) {
        if (err.response?.status === 401) {
          // Unauthorized - redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/auth/login');
        } else {
          setError('Failed to load metrics');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [router]);

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (error) {
    return <div className="bg-red-50 text-red-700 p-4 rounded">{error}</div>;
  }

  if (!metrics) {
    return <div className="text-center py-12">No data available</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <MetricCard
          label="Total Conversations"
          value={metrics.total_conversations}
          icon="💬"
        />
        <MetricCard
          label="Avg Response Time"
          value={`${metrics.avg_response_time_ms}ms`}
          icon="⚡"
        />
        <MetricCard
          label="Escalation Rate"
          value={`${(metrics.escalation_rate * 100).toFixed(1)}%`}
          icon="📈"
        />
        <MetricCard
          label="Avg Satisfaction"
          value={`${metrics.avg_satisfaction?.toFixed(1) || 'N/A'}/5`}
          icon="⭐"
        />
        <MetricCard
          label="Unique Users"
          value={metrics.unique_users}
          icon="👥"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversationChart />
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Top Questions</h2>
          <div className="text-gray-500 text-center py-8">
            Coming soon...
          </div>
        </div>
      </div>
    </div>
  );
}
