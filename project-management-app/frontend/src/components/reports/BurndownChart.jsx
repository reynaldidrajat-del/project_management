import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatPointLabel = (dateKey) => {
  if (!dateKey) {
    return '-';
  }

  const date = new Date(`${dateKey}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
};

function BurndownChart({ data }) {
  const points = (data?.points || []).map((point) => ({
    ...point,
    label: formatPointLabel(point.date),
  }));

  if (!points.length) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 text-sm font-semibold text-text-muted">
        No burndown data available.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={points} margin={{ bottom: 8, left: 0, right: 12, top: 12 }}>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
          <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line
            dataKey="ideal_remaining"
            dot={false}
            name="Ideal remaining"
            stroke="#94A3B8"
            strokeDasharray="6 4"
            strokeWidth={2}
            type="monotone"
          />
          <Line
            dataKey="actual_remaining"
            name="Actual remaining"
            stroke="#2563EB"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BurndownChart;
