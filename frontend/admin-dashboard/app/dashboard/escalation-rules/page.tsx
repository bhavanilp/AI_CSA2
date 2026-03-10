'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface EscalationRule {
  id: string;
  rule_type: string;
  name: string;
  config: string | { keywords?: string[] };
  escalation_email: string;
  enabled: boolean;
}

export default function EscalationRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingId, setIsSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchRules = async () => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const response = await axios.get('/api/admin/escalation-rules', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      setRules(response.data.rules || []);
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/auth/login');
      } else {
        setError(err.response?.data?.error || 'Failed to load escalation rules');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const parseKeywords = (config: EscalationRule['config']): string[] => {
    if (!config) {
      return [];
    }
    if (typeof config === 'string') {
      try {
        const parsed = JSON.parse(config);
        return parsed?.keywords || [];
      } catch {
        return [];
      }
    }
    return config.keywords || [];
  };

  const updateRule = async (rule: EscalationRule) => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    try {
      setSuccess('');
      setIsSavingId(rule.id);
      await axios.put(
        `/api/admin/escalation-rules/${rule.id}`,
        {
          enabled: rule.enabled,
          escalation_email: rule.escalation_email,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        },
      );
      setSuccess(`Saved changes for "${rule.name}"`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save escalation rule');
    } finally {
      setIsSavingId(null);
    }
  };

  const patchRule = (id: string, partial: Partial<EscalationRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Escalation Rules</h1>
        <button
          onClick={fetchRules}
          disabled={isLoading}
          className="px-3 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">{success}</div>}

      <div className="bg-white rounded-lg shadow p-6">
        {isLoading ? (
          <div className="py-10 text-center text-gray-500 text-sm">Loading escalation rules...</div>
        ) : rules.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">No escalation rules found.</div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => {
              const keywords = parseKeywords(rule.config);
              return (
                <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{rule.name}</h3>
                      <p className="text-sm text-gray-500">Type: {rule.rule_type}</p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => patchRule(rule.id, { enabled: e.target.checked })}
                        className="h-4 w-4"
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Escalation Email</label>
                      <input
                        type="email"
                        value={rule.escalation_email || ''}
                        onChange={(e) => patchRule(rule.id, { escalation_email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="support@company.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Keywords</label>
                      <div className="min-h-10 border border-gray-200 rounded-lg p-2 flex flex-wrap gap-2 bg-gray-50">
                        {keywords.length === 0 ? (
                          <span className="text-xs text-gray-500">No keywords configured</span>
                        ) : (
                          keywords.map((k) => (
                            <span key={k} className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                              {k}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => updateRule(rule)}
                      disabled={isSavingId === rule.id}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {isSavingId === rule.id ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
