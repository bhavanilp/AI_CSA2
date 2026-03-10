'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { date: 'Mon', conversations: 45, escalations: 8 },
  { date: 'Tue', conversations: 52, escalations: 9 },
  { date: 'Wed', conversations: 48, escalations: 7 },
  { date: 'Thu', conversations: 61, escalations: 11 },
  { date: 'Fri', conversations: 55, escalations: 10 },
  { date: 'Sat', conversations: 40, escalations: 6 },
  { date: 'Sun', conversations: 38, escalations: 5 },
];

export default function ConversationChart() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Conversations (Last 7 Days)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="conversations"
            stroke="#007bff"
            name="Conversations"
          />
          <Line
            type="monotone"
            dataKey="escalations"
            stroke="#ff6b6b"
            name="Escalations"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
