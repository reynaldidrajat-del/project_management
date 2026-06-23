import { Link } from 'react-router-dom';

import { formatDate } from '../../logic/helpers/dateHelper';
import { getPriorityBadgeClass, getStatusBadgeClass } from '../../logic/helpers/statusHelper';
import { getTaskDisplayKey } from '../../logic/helpers/taskDisplayHelper';
import Modal from '../shared/Modal';

const getAssigneeLabel = (task) => {
  if (task.assignee_names) {
    return task.assignee_names;
  }

  if (Array.isArray(task.assignees) && task.assignees.length) {
    return task.assignees.map((assignee) => assignee.name).filter(Boolean).join(', ');
  }

  return task.assignee_name || task.lead_name || '-';
};

const getProjectDepartmentLabel = (project) => {
  if (project.department_names || project.department_name) {
    return project.department_names || project.department_name;
  }

  if (Array.isArray(project.departments) && project.departments.length) {
    return project.departments.map((department) => department.name).filter(Boolean).join(', ');
  }

  return 'Cross department';
};

const clampProgress = (progress) => Math.min(100, Math.max(0, Number(progress || 0)));

function EmptyRows() {
  return <div className="empty-state">Tidak ada data.</div>;
}

function LoadingRows() {
  return <div className="card p-4 text-sm text-text-muted">Loading data...</div>;
}

function ErrorRows({ message }) {
  return <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-danger">{message}</div>;
}

function TaskDataTable({ rows, onTaskOpen }) {
  if (!rows.length) {
    return <EmptyRows />;
  }

  return (
    <div className="table-shell">
      <div className="table-scroll">
        <table className="data-table min-w-[920px]">
          <thead>
            <tr>
              <th>Task</th>
              <th>Project</th>
              <th>Status</th>
              <th>Priority</th>
              <th>PIC</th>
              <th>Due Date</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const progress = clampProgress(task.progress);
              const handleTaskOpen = () => onTaskOpen?.(task);

              return (
                <tr
                  key={task.id}
                  className={onTaskOpen ? 'cursor-pointer' : undefined}
                  role={onTaskOpen ? 'button' : undefined}
                  tabIndex={onTaskOpen ? 0 : undefined}
                  onClick={handleTaskOpen}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || !onTaskOpen || (event.key !== 'Enter' && event.key !== ' ')) {
                      return;
                    }

                    event.preventDefault();
                    handleTaskOpen();
                  }}
                >
                  <td>
                    <p className="text-xs font-semibold text-text-muted">{getTaskDisplayKey(task) || '-'}</p>
                    <p className="font-semibold text-primary">{task.title}</p>
                  </td>
                  <td>
                    {task.project_id ? (
                      <Link
                        className="font-semibold text-primary hover:text-primary-dark"
                        to={`/projects/${task.project_id}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {task.project_name || '-'}
                      </Link>
                    ) : (
                      <span>{task.project_name || '-'}</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(task.status)}`}>{task.status || '-'}</span>
                  </td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(task.priority)}`}>{task.priority || '-'}</span>
                  </td>
                  <td>{getAssigneeLabel(task)}</td>
                  <td>{formatDate(task.end_date)}</td>
                  <td>
                    <div className="min-w-[8rem]">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-text-dark">{progress}%</p>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectDataTable({ rows }) {
  if (!rows.length) {
    return <EmptyRows />;
  }

  return (
    <div className="table-shell">
      <div className="table-scroll">
        <table className="data-table min-w-[860px]">
          <thead>
            <tr>
              <th>Project</th>
              <th>Department</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Timeline</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((project) => {
              const progress = clampProgress(project.progress);

              return (
                <tr key={project.id}>
                  <td>
                    <Link className="font-semibold text-primary hover:text-primary-dark" to={`/projects/${project.id}`}>
                      {project.name}
                    </Link>
                    {project.description ? <p className="mt-1 max-w-md text-xs text-text-muted">{project.description}</p> : null}
                  </td>
                  <td>{getProjectDepartmentLabel(project)}</td>
                  <td>{project.owner_name || '-'}</td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-700">{project.status || '-'}</span>
                  </td>
                  <td>
                    {formatDate(project.start_date)} - {formatDate(project.end_date)}
                  </td>
                  <td>
                    <div className="min-w-[8rem]">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-text-dark">{progress}%</p>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardDataModal({ open, title, type, rows = [], loading = false, error = '', onClose, onTaskOpen }) {
  const description = loading ? 'Loading data...' : `${rows.length} data`;

  return (
    <Modal description={description} open={open} size="2xl" title={title} onClose={onClose}>
      {loading ? <LoadingRows /> : null}
      {!loading && error ? <ErrorRows message={error} /> : null}
      {!loading && !error && type === 'tasks' ? <TaskDataTable rows={rows} onTaskOpen={onTaskOpen} /> : null}
      {!loading && !error && type === 'projects' ? <ProjectDataTable rows={rows} /> : null}
    </Modal>
  );
}

export default DashboardDataModal;
