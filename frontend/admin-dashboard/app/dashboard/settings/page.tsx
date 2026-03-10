'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface HealthResponse {
  status: string;
  dependencies?: {
    database?: string;
    vector_db?: string;
    llm_provider?: string;
  };
  vector_store?: {
    ingested_url_count?: number;
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [refreshMs, setRefreshMs] = useState(30000);
  const [showHints, setShowHints] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const user = userRaw ? JSON.parse(userRaw) : null;

  const loadSystemState = async () => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    try {
      setError('');
      const response = await axios.get('/api/health', { timeout: 8000 });
      setHealth(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load system health');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const savedRefresh = localStorage.getItem('dashboard_refresh_ms');
    const savedHints = localStorage.getItem('dashboard_show_hints');
    if (savedRefresh) {
      setRefreshMs(parseInt(savedRefresh, 10));
    }
    if (savedHints) {
      setShowHints(savedHints === 'true');
    }
    loadSystemState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const saveUiPreferences = () => {
    localStorage.setItem('dashboard_refresh_ms', String(refreshMs));
    localStorage.setItem('dashboard_show_hints', String(showHints));
    setMessage('UI preferences saved locally in this browser.');
    setTimeout(() => setMessage(''), 2500);
  };

  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/auth/login');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <button
          onClick={loadSystemState}
          className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
        >
          Refresh Status
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      {message && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold">Admin Profile</h2>
          <div className="text-sm text-gray-700 space-y-2">
            <p>
              <span className="font-medium">Email:</span> {user?.email || 'Unknown'}
            </p>
            <p>
              <span className="font-medium">Role:</span> {user?.role || 'Unknown'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={clearSession}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Sign Out Everywhere (This Browser)
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold">System Health</h2>
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading health status...</p>
          ) : (
            <div className="text-sm space-y-2">
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span className={health?.status === 'ok' ? 'text-green-700' : 'text-red-700'}>
                  {health?.status || 'unknown'}
                </span>
              </p>
              <p>
                <span className="font-medium">Database:</span> {health?.dependencies?.database || 'unknown'}
              </p>
              <p>
                <span className="font-medium">Vector DB:</span> {health?.dependencies?.vector_db || 'unknown'}
              </p>
              <p>
                <span className="font-medium">LLM Provider:</span> {health?.dependencies?.llm_provider || 'unknown'}
              </p>
              <p>
                <span className="font-medium">Ingested URLs:</span>{' '}
                {health?.vector_store?.ingested_url_count ?? 0}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-xl font-semibold">Dashboard Preferences</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Auto-refresh Interval (ms)</label>
            <select
              value={refreshMs}
              onChange={(e) => setRefreshMs(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value={10000}>10,000 (10 sec)</option>
              <option value={30000}>30,000 (30 sec)</option>
              <option value={60000}>60,000 (1 min)</option>
              <option value={300000}>300,000 (5 min)</option>
            </select>
          </div>
          <div className="flex items-center pt-7">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showHints}
                onChange={(e) => setShowHints(e.target.checked)}
                className="h-4 w-4"
              />
              Show onboarding hints
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveUiPreferences}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
