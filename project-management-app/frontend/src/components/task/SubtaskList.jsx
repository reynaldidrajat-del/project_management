import { getStatusBadgeClass } from '../../logic/helpers/statusHelper';

// Daftar subtask kecil yang bisa diklik untuk membuka detailnya.
function SubtaskList({ subtasks = [], onOpen }) {
  if (!subtasks.length) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-text-muted">Belum ada subtask.</p>;
  }

  return (
    <div className="space-y-2">
      {subtasks.map((subtask) => (
        <button
          key={subtask.id}
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2 text-left"
          onClick={() => onOpen?.(subtask)}
        >
          <span className="text-sm font-semibold">{subtask.title}</span>
          <span className={`badge ${getStatusBadgeClass(subtask.status)}`}>{subtask.progress || 0}%</span>
        </button>
      ))}
    </div>
  );
}

export default SubtaskList;
