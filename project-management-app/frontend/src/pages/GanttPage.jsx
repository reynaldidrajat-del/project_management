import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import GanttChart from '../components/gantt/GanttChart';
import GanttFilters from '../components/gantt/GanttFilters';
import ProjectHeader from '../components/project/ProjectHeader';
import TaskDetailModal from '../components/task/TaskDetailModal';
import { useDepartments } from '../logic/hooks/useDepartments';
import { useLocations } from '../logic/hooks/useLocations';
import { useProject, useProjects } from '../logic/hooks/useProjects';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { getAllGanttTasks, getProjectGanttTasks } from '../logic/services/ganttApi';

// Halaman Gantt global atau project untuk melihat timeline task.
function GanttPage() {
  const { projectId } = useParams();
  const [filters, setFilters] = useState({});
  const [viewMode, setViewMode] = useState('week');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const { project, refetch: refetchProject } = useProject(projectId);
  const { projects } = useProjects();
  const { departments } = useDepartments();
  const { locations } = useLocations();
  const { users } = useUsers();
  const filterKey = JSON.stringify(filters);
  const filteredProject = projects.find((projectOption) => String(projectOption.id) === String(filters.project_id));
  const quickResumeScopeLabel = project?.name || filteredProject?.name || 'All projects';

  // Mengambil data task yang akan digambar di Gantt berdasarkan filter.
  const fetchGantt = async () => {
    setLoading(true);
    setError('');

    try {
      setTasks(projectId ? await getProjectGanttTasks(projectId) : await getAllGanttTasks(filters));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Memuat ulang Gantt setelah task diubah dari modal detail.
  const refreshGanttData = async () => {
    await fetchGantt();

    if (projectId) {
      await refetchProject();
    }
  };

  useEffect(() => {
    fetchGantt();
  }, [projectId, filterKey]);

  return (
    <div className="page-shell">
      {project ? <ProjectHeader project={project} /> : null}
      <div className="page-header">
        <div>
          <p className="page-kicker">Timeline</p>
          <h1 className="page-title">{project ? `${project.name} Gantt` : 'Gantt Chart'}</h1>
          <p className="page-description">Timeline otomatis dari task board: start, end, progress, status, PIC, bucket, dan parent task.</p>
        </div>
      </div>

      {!projectId ? (
        <GanttFilters
          filters={filters}
          projects={projects}
          departments={departments}
          locations={locations}
          users={users}
          viewMode={viewMode}
          onChange={setFilters}
          onViewModeChange={setViewMode}
        />
      ) : (
        <div className="toolbar justify-end">
          <select className="field max-w-xs" value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
            <option value="week">Week view</option>
            <option value="month">Month view</option>
          </select>
        </div>
      )}

      {loading ? <div className="card p-6 text-text-muted">Loading Gantt...</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}
      <GanttChart
        quickResumeScopeLabel={quickResumeScopeLabel}
        tasks={tasks}
        viewMode={viewMode}
        groupByProject={!projectId}
        onTaskClick={setSelectedTask}
      />

      <TaskDetailModal
        task={selectedTask}
        projects={projects}
        users={users}
        tasks={tasks}
        onClose={() => setSelectedTask(null)}
        onSaved={refreshGanttData}
      />
    </div>
  );
}

export default GanttPage;
