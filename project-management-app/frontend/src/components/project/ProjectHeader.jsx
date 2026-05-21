import { Link } from 'react-router-dom';

import { formatDate } from '../../logic/helpers/dateHelper';
import { getProgressBarClass } from '../../logic/helpers/statusHelper';

// Header ringkasan project di halaman detail project.
function ProjectHeader({ project }) {
  if (!project) {
    return null;
  }

  return (
    <div className="card mb-5 overflow-hidden">
      <div className="border-b border-border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="page-kicker">Project timeline</p>
            <h1 className="page-title mt-1">{project.name}</h1>
            <p className="page-description">{project.description || 'No description'}</p>
          </div>
          <span className="badge bg-blue-100 text-blue-700">{project.status}</span>
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="info-tile bg-white">
          <p className="label">Teams Involved</p>
          <p className="font-semibold">{project.department_names || project.department_name || '-'}</p>
        </div>
        <div className="info-tile bg-white">
          <p className="label">Lokasi</p>
          <p className="font-semibold">{project.location_names || project.owner_location_name || '-'}</p>
        </div>
        <div className="info-tile bg-white">
          <p className="label">Owner</p>
          <p className="font-semibold">
            {project.owner_name || '-'} {project.owner_department_name ? `(${project.owner_department_name})` : ''}
          </p>
        </div>
        <div className="info-tile bg-white">
          <p className="label">Start</p>
          <p className="font-semibold">{formatDate(project.start_date)}</p>
        </div>
        <div className="info-tile bg-white">
          <p className="label">End</p>
          <p className="font-semibold">{formatDate(project.end_date)}</p>
        </div>
        <div className="info-tile bg-white">
          <p className="label">Progress</p>
          <p className="font-semibold">{project.progress || 0}%</p>
          <div className="progress-track mt-2">
            <div className={`progress-fill ${getProgressBarClass(project)}`} style={{ width: `${project.progress || 0}%` }} />
          </div>
        </div>
      </div>
      {project.members?.length ? (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {project.members.map((member) => (
            <span key={member.id} className="badge bg-slate-100 text-slate-700">
              {member.name} {member.department_name ? `- ${member.department_name}` : ''}{' '}
              {member.location_name ? `(${member.location_name})` : ''}
            </span>
          ))}
        </div>
      ) : null}
      <div className="action-row border-t border-border bg-slate-50 px-4 py-3">
        <Link className="btn-secondary" to={`/projects/${project.id}/board`}>
          Board
        </Link>
        <Link className="btn-secondary" to={`/projects/${project.id}/list`}>
          List
        </Link>
        <Link className="btn-secondary" to={`/projects/${project.id}/gantt`}>
          Gantt
        </Link>
      </div>
    </div>
  );
}

export default ProjectHeader;
