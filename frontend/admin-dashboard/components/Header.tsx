'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/auth/login');
  };

  return (
    <div className="bg-white shadow px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Welcome back</h2>
        <p className="text-sm text-gray-600">{user?.email}</p>
      </div>
      <button
        onClick={handleLogout}
        className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition"
      >
        Sign Out
      </button>
    </div>
  );
}
