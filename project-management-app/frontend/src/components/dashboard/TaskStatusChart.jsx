import { TASK_STATUSES } from '../../logic/constants/status';
import { getStatusBadgeClass } from '../../logic/helpers/statusHelper';

// Chart sederhana berbasis bar untuk jumlah task per status.
function TaskStatusChart({ rows = [], onStatusClick }) {
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);

  return (
    <div className="card p-4">
      <div className="section-header">
        <h3 className="section-title">Task Status</h3>
        <span className="text-sm text-text-muted">{total} tasks</span>
      </div>
      <div className="space-y-3">
        {TASK_STATUSES.map((status) => {
          const value = Number(rows.find((row) => row.status === status)?.total || 0);
          const width = total ? Math.round((value / total) * 100) : 0;

          const content = (
            <>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className={`badge ${getStatusBadgeClass(status)}`}>{status}</span>
                <span className="font-semibold text-text-dark">{value}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${width}%` }} />
              </div>
            </>
          );

          return onStatusClick ? (
            <button
              key={status}
              className="block w-full rounded-lg p-1 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              type="button"
              onClick={() => onStatusClick(status)}
            >
              {content}
            </button>
          ) : (
            <div key={status}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TaskStatusChart;
