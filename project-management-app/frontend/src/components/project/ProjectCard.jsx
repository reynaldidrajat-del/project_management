import { Link } from 'react-router-dom';

import { formatDate } from '../../logic/helpers/dateHelper';
import { getProgressBarClass } from '../../logic/helpers/statusHelper';

// Kartu ringkasan project di halaman daftar project.
function ProjectCard({ project, onEdit, onDelete }) {
  return (
    <div className="card flex flex-col p-4 transition hover:border-primary/40 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-text-dark">{project.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{project.description || 'No description'}</p>
        </div>
        <span className="badge bg-blue-100 text-blue-700">{project.status}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="info-tile">
          <p className="label">Teams Involved</p>
          <p className="font-semibold">{project.department_names || project.department_name || '-'}</p>
        </div>
        <div className="info-tile">
          <p className="label">Lokasi</p>
          <p className="font-semibold">{project.location_names || '-'}</p>
        </div>
        <div className="info-tile">
          <p className="label">Owner</p>
          <p className="font-semibold">{project.owner_name || '-'}</p>
        </div>
        <div className="info-tile">
          <p className="label">Members</p>
          <p className="font-semibold">{project.member_count || 0}</p>
        </div>
        <div className="info-tile">
          <p className="label">Start</p>
          <p className="font-semibold">{formatDate(project.start_date)}</p>
        </div>
        <div className="info-tile">
          <p className="label">End</p>
          <p className="font-semibold">{formatDate(project.end_date)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-semibold text-text-muted">Progress</span>
          <span className="font-bold">{project.progress || 0}%</span>
        </div>
        <div className="progress-track">
          <div className={`progress-fill ${getProgressBarClass(project)}`} style={{ width: `${project.progress || 0}%` }} />
        </div>
      </div>

      <div className="action-row mt-4">
        <Link className="btn-primary" to={`/projects/${project.id}`}>
          Detail
        </Link>
        <button className="btn-secondary" type="button" onClick={() => onEdit(project)}>
          Edit
        </button>
        <button className="btn-secondary text-danger" type="button" onClick={() => onDelete(project.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}

export default ProjectCard;
