import { useState } from 'react';

import TaskCalendarView from '../components/task/TaskCalendarView';
import TaskDetailModal from '../components/task/TaskDetailModal';
import TaskFilters from '../components/task/TaskFilters';
import { useDepartments } from '../logic/hooks/useDepartments';
import { useLocations } from '../logic/hooks/useLocations';
import { useProjects } from '../logic/hooks/useProjects';
import { useTaskLabels } from '../logic/hooks/useTaskLabels';
import { useTasks } from '../logic/hooks/useTasks';
import { useUsers } from '../logic/hooks/useUsers';

// Halaman calendar view global untuk due date task.
function TaskCalendarPage() {
  const [filters, setFilters] = useState({ tree: true });
  const [selectedTask, setSelectedTask] = useState(null);
  const { tasks, loading, error, refetch } = useTasks({ ...filters, tree: true });
  const { projects } = useProjects();
  const { departments } = useDepartments();
  const { locations } = useLocations();
  const { users } = useUsers();
  const { labels } = useTaskLabels(filters.project_id || '');

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Schedule</p>
          <h1 className="page-title">Task Calendar</h1>
          <p className="page-description">Calendar view untuk melihat due date task dari semua project.</p>
        </div>
      </div>

      <TaskFilters
        departments={departments}
        filters={filters}
        labels={labels}
        locations={locations}
        projects={projects}
        users={users}
        onChange={setFilters}
      />

      {loading ? <div className="card p-6 text-text-muted">Loading task calendar...</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}
      <TaskCalendarView tasks={tasks} onTaskClick={setSelectedTask} />

      <TaskDetailModal
        labels={labels}
        projects={projects}
        task={selectedTask}
        tasks={tasks}
        users={users}
        onClose={() => setSelectedTask(null)}
        onSaved={refetch}
      />
    </div>
  );
}

export default TaskCalendarPage;
