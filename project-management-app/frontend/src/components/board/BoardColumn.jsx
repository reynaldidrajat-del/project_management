import { useDroppable } from '@dnd-kit/core';

import TaskCard from '../task/TaskCard';

// Kolom board yang menjadi area drop saat task dipindahkan.
function BoardColumn({ id, title, tasks = [], onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <section
      ref={setNodeRef}
      className={[
        'flex max-h-[calc(100vh-240px)] min-h-96 w-80 shrink-0 flex-col rounded-xl border bg-slate-50 shadow-sm',
        isOver ? 'border-primary bg-blue-50' : 'border-border',
      ].join(' ')}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-border bg-white px-3 py-3">
        <h3 className="font-bold text-text-dark">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-text-muted">{tasks.length}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {tasks.length ? (
          tasks.map((task) => <TaskCard key={task.id} draggable task={task} onClick={() => onTaskClick(task)} />)
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white p-4 text-center text-sm text-text-muted">Drop task here</div>
        )}
      </div>
    </section>
  );
}

export default BoardColumn;
