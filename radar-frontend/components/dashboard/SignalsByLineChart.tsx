'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface SignalsByLineChartProps {
  data: Record<string, number>;
}

const lineaColors: Record<string, string> = {
  'BHS':            '#3b82f6', // blue-500
  'Cartón':         '#f59e0b', // amber-500
  'Intralogística': '#10b981', // emerald-500
  'Final de Línea': '#8b5cf6', // violet-500
  'Motos':          '#f97316', // orange-500
  'SOLUMAT':        '#06b6d4', // cyan-500
};

export function SignalsByLineChart({ data }: SignalsByLineChartProps) {
  const chartData = Object.entries(data).map(([linea, count]) => ({ linea, count }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-600 text-sm">
        Sin datos — lanza un escaneo para ver señales
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis dataKey="linea" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6', fontWeight: 600 }}
          itemStyle={{ color: '#d1d5db' }}
          cursor={{ fill: 'rgba(55,65,81,0.4)' }}
        />
        <Bar dataKey="count" name="Señales activas" radius={[4, 4, 0, 0]}>
          {chartData.map(({ linea }) => (
            <Cell key={linea} fill={lineaColors[linea] ?? '#6b7280'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
