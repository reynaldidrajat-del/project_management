import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const getAverageVelocity = (data) =>
  Number(data?.averages?.last_3_sprints || data?.averages?.last_5_sprints || data?.averages?.last_10_sprints || 0);

function VelocityChart({ data }) {
  const averageVelocity = getAverageVelocity(data);
  const history = [...(data?.history || [])].reverse().map((item) => ({
    ...item,
    average_velocity: averageVelocity,
    sprint_label: item.sprint_name || `Sprint ${item.sprint_id}`,
  }));

  if (!history.length) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 text-sm font-semibold text-text-muted">
        No completed sprint velocity history available.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <ComposedChart data={history} margin={{ bottom: 8, left: 0, right: 12, top: 12 }}>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" />
          <XAxis dataKey="sprint_label" tick={{ fill: '#64748B', fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="committed_story_points" fill="#94A3B8" name="Committed SP" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed_story_points" fill="#2563EB" name="Completed SP" radius={[4, 4, 0, 0]} />
          <Line
            dataKey="average_velocity"
            dot={false}
            name="Average velocity"
            stroke="#16A34A"
            strokeDasharray="6 4"
            strokeWidth={2}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default VelocityChart;
