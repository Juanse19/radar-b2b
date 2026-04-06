'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ScoreDistributionChartProps {
  tierCounts: {
    ORO: number;
    Monitoreo: number;
    Contexto: number;
    'Sin Señal': number;
  };
}

const TIER_COLORS: Record<string, string> = {
  'ORO':       '#ca8a04', // yellow-600
  'Monitoreo': '#3b82f6', // blue-500
  'Contexto':  '#6b7280', // gray-500
  'Sin Señal': '#374151', // gray-700
};

export function ScoreDistributionChart({ tierCounts }: ScoreDistributionChartProps) {
  const data = Object.entries(tierCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  if (data.length === 0 || data.every(d => d.value === 0)) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
        Sin datos — lanza un escaneo para ver la distribución
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={65}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map(({ name }) => (
            <Cell key={name} fill={TIER_COLORS[name] ?? '#6b7280'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6', fontWeight: 600 }}
          itemStyle={{ color: '#d1d5db' }}
        />
        <Legend
          formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>}
          iconSize={10}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
