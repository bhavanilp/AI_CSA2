'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface Source {
  id: string;
  name: string;
  source_type: string;
  status: string;
  created_at: string;
}

export default function SourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [ingestedUrls, setIngestedUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = async (authToken: string) => {
    const [sourcesRes, urlsRes] = await Promise.all([
      axios.get('/api/admin/sources', {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 8000,
      }),
      axios.get('/api/chat/ingested-urls', { timeout: 5000 }),
    ]);
    setSources(sourcesRes.data.sources || []);
    setIngestedUrls(urlsRes.data.urls || []);
  };

  const handleRemoveUrl = async (url: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    const confirmed = window.confirm(`Remove this URL from the vector store?\n\n${url}`);
    if (!confirmed) {
      return;
    }

    try {
      setRemovingUrl(url);
      setError('');
      await axios.post(
        '/api/admin/sources/remove-url',
        { url },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        },
      );
      await loadData(token);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove URL from vector store');
    } finally {
      setRemovingUrl(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    const load = async () => {
      try {
        await loadData(token);
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          router.replace('/auth/login');
        } else {
          setError('Failed to load sources');
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Knowledge Sources</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Vector store URL list */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Ingested URLs in Vector Store ({ingestedUrls.length})
        </h2>
        {ingestedUrls.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No URLs ingested yet. Use the{' '}
            <a href="http://localhost:5173" target="_blank" className="text-blue-600 underline">
              Chat Interface
            </a>{' '}
            to ingest a URL.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ingestedUrls.map((url) => (
              <li key={url} className="py-2 flex items-center gap-3">
                <span className="text-green-500 text-lg">✓</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm break-all"
                >
                  {url}
                </a>
                <button
                  type="button"
                  onClick={() => handleRemoveUrl(url)}
                  disabled={removingUrl === url}
                  className="ml-auto px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60"
                >
                  {removingUrl === url ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* DB sources table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Source Records ({sources.length})</h2>
        {sources.length === 0 ? (
          <p className="text-gray-500 text-sm">No source records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sources.map((src) => (
                  <tr key={src.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{src.name}</td>
                    <td className="px-4 py-2 capitalize">{src.source_type}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          src.status === 'indexed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {src.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(src.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
