import { lazy, Suspense } from 'react';

const TaskDetailModal = lazy(() => import('./TaskDetailModal'));

function LazyTaskDetailModal(props) {
  return (
    <Suspense fallback={<div className="card p-6 text-text-muted">Loading issue details...</div>}>
      <TaskDetailModal {...props} />
    </Suspense>
  );
}

export default LazyTaskDetailModal;
