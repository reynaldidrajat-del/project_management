import { useDroppable } from '@dnd-kit/core';

import TaskCard from '../task/TaskCard';

// Kolom board yang menjadi area drop saat task dipindahkan.
function BoardColumn({ canMoveTask = true, id, title, tasks = [], selectedTaskIds, syncStatusByTaskId = {}, onSelectionChange, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });
  const selectable = Boolean(onSelectionChange);

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
          tasks.map((task) => {
            const selected = selectedTaskIds?.has(Number(task.id));

            return (
              <div key={task.id} className="relative">
                {selectable ? (
                  <label
                    className="absolute right-2 top-2 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-border bg-white shadow-sm"
                    title={selected ? 'Unselect task' : 'Select task'}
                  >
                    <input
                      checked={selected}
                      type="checkbox"
                      onChange={(event) => onSelectionChange(task.id, event.target.checked)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </label>
                ) : null}
                <TaskCard
                  draggable={canMoveTask}
                  selected={selected}
                  syncStatus={syncStatusByTaskId[task.id]}
                  task={task}
                  onClick={() => onTaskClick(task)}
                />
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white p-4 text-center text-sm text-text-muted">Drop task here</div>
        )}
      </div>
    </section>
  );
}

export default BoardColumn;
