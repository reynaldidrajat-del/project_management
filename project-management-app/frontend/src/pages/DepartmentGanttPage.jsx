import { useEffect, useState } from 'react';

import GanttChart from '../components/gantt/GanttChart';
import TaskDetailModal from '../components/task/TaskDetailModal';
import { formatDate } from '../logic/helpers/dateHelper';
import { getTaskAssigneeNames, getTaskLeadName } from '../logic/helpers/taskPeopleHelper';
import { flattenTaskTree } from '../logic/helpers/taskTreeHelper';
import { getProgressBarClass } from '../logic/helpers/statusHelper';
import { useDepartments } from '../logic/hooks/useDepartments';
import { useLocations } from '../logic/hooks/useLocations';
import { useProjects } from '../logic/hooks/useProjects';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { getDepartmentGanttTasks } from '../logic/services/ganttApi';

// Halaman Gantt per department untuk melihat project dan task yang melibatkan department tertentu.
function DepartmentGanttPage() {
  const { departments } = useDepartments();
  const { locations } = useLocations();
  const { projects } = useProjects();
  const { users } = useUsers();
  const [departmentId, setDepartmentId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [viewMode, setViewMode] = useState('week');
  const [ganttData, setGanttData] = useState({
    department: null,
    users: [],
    projects: [],
    tasks: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const flatTasks = flattenTaskTree(ganttData.tasks || []);
  const scopeLabel = [
    ganttData.department?.name || 'Department',
    ganttData.location?.name || 'All business units',
  ].join(' / ');

  useEffect(() => {
    if (!departmentId && departments.length) {
      setDepartmentId(String(departments[0].id));
    }
  }, [departments, departmentId]);

  // Mengambil data Gantt department, termasuk user, project, dan task.
  const fetchDepartmentGantt = async () => {
    if (!departmentId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      setGanttData(await getDepartmentGanttTasks(departmentId, { location_id: locationId || undefined }));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentGantt();
  }, [departmentId, locationId]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Department Monitoring</p>
          <h1 className="page-title">Department Gantt</h1>
          <p className="page-description">
          Gantt department dibentuk dari task yang ditugaskan ke user dalam department tersebut, bukan dari project yang menempel ke satu department.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <select className="field max-w-xs" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">Pilih department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select className="field max-w-xs" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
          <option value="">All business units</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <select className="field max-w-xs" value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
          <option value="week">Week view</option>
          <option value="month">Month view</option>
        </select>
      </div>

      {loading ? <div className="card p-6 text-text-muted">Loading department Gantt...</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card p-4">
          <div className="section-header">
            <div>
              <h2 className="section-title">Users in {scopeLabel}</h2>
              <p className="section-subtitle">PIC yang menjadi sumber task department Gantt sesuai filter lokasi.</p>
            </div>
            <span className="text-sm text-text-muted">{ganttData.users.length} users</span>
          </div>
          <div className="space-y-2">
            {ganttData.users.map((user) => (
              <div key={user.id} className="info-tile">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs text-text-muted">{user.email || 'No email'}</p>
                  </div>
                  <span className="badge bg-blue-100 text-blue-700">{user.task_count || 0} tasks</span>
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Projects: {(user.projects || []).map((project) => project.name).join(', ') || '-'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="section-header">
            <div>
              <h2 className="section-title">Projects Involving Department</h2>
              <p className="section-subtitle">Project lintas department yang memiliki kontribusi dari department dan bisnis unit terpilih.</p>
            </div>
            <span className="text-sm text-text-muted">{ganttData.projects.length} projects</span>
          </div>
          <div className="space-y-2">
            {ganttData.projects.map((project) => (
              <div key={project.id} className="info-tile">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-xs text-text-muted">{project.department_user_count || 0} users involved</p>
                  </div>
                  <span className="badge bg-slate-100 text-slate-700">{project.progress || 0}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${getProgressBarClass(project)}`} style={{ width: `${project.progress || 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <GanttChart
        projectGroups={ganttData.projects || []}
        quickResumeScopeLabel={`${scopeLabel} projects`}
        tasks={ganttData.tasks || []}
        viewMode={viewMode}
        groupByProject
        onTaskClick={setSelectedTask}
      />

      <div className="card p-4">
        <div className="section-header">
          <div>
            <h2 className="section-title">Task List</h2>
            <p className="section-subtitle">Daftar task untuk kombinasi department dan bisnis unit yang sedang difilter.</p>
          </div>
          <span className="text-sm text-text-muted">{flatTasks.length} tasks</span>
        </div>
        <div className="table-shell shadow-none">
          <div className="table-scroll">
            <table className="data-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>PIC</th>
                  <th>Lead</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {flatTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <button className="text-left font-semibold text-primary hover:text-primary-dark" type="button" onClick={() => setSelectedTask(task)}>
                        {task.title}
                      </button>
                    </td>
                    <td>{task.project_name || '-'}</td>
                    <td>{getTaskAssigneeNames(task)}</td>
                    <td>{getTaskLeadName(task)}</td>
                    <td>{formatDate(task.start_date)}</td>
                    <td>{formatDate(task.end_date)}</td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-700">{task.status}</span>
                    </td>
                    <td className="font-semibold">{task.progress || 0}%</td>
                  </tr>
                ))}
                {!flatTasks.length ? (
                  <tr>
                    <td className="text-text-muted" colSpan="8">
                      Tidak ada task untuk filter ini.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TaskDetailModal
        task={selectedTask}
        projects={projects}
        users={users}
        tasks={ganttData.tasks || []}
        onClose={() => setSelectedTask(null)}
        onSaved={fetchDepartmentGantt}
      />
    </div>
  );
}

export default DepartmentGanttPage;
