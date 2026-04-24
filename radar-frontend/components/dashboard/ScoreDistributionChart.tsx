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
  'Monitoreo': '#2563eb', // blue-600
  'Contexto':  '#60758a', // muted-foreground
  'Sin Señal': '#cbd5e1', // slate-300
};

export function ScoreDistributionChart({ tierCounts }: ScoreDistributionChartProps) {
  const data = Object.entries(tierCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  if (data.length === 0 || data.every(d => d.value === 0)) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
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
            <Cell key={name} fill={TIER_COLORS[name] ?? '#71acd2'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #d2dce4',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(20,46,71,0.08)',
          }}
          labelStyle={{ color: '#142e47', fontWeight: 600, fontSize: 13 }}
          itemStyle={{ color: '#60758a', fontSize: 12 }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: '#60758a', fontSize: 12 }}>{value}</span>
          )}
          iconSize={10}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
