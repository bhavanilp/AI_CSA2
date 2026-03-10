'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/auth/login');
  };

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold">AICSA</h1>
        <p className="text-sm text-gray-400">Admin Dashboard</p>
      </div>

      <nav className="flex-1 p-6 space-y-4">
        <Link
          href="/dashboard"
          className="block px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          📊 Dashboard
        </Link>
        <Link
          href="/dashboard/sources"
          className="block px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          📚 Knowledge Sources
        </Link>
        <Link
          href="/dashboard/conversations"
          className="block px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          💬 Conversations
        </Link>
        <Link
          href="/dashboard/escalation-rules"
          className="block px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          ⚙️ Escalation Rules
        </Link>
        <Link
          href="/dashboard/settings"
          className="block px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          🔧 Settings
        </Link>
      </nav>

      <div className="p-6 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
