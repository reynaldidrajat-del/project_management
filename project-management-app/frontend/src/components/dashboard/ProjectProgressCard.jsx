import { Link } from 'react-router-dom';

import { getProgressBarClass } from '../../logic/helpers/statusHelper';

// Kartu kecil untuk menampilkan progress satu project di dashboard.
function ProjectProgressCard({ project }) {
  return (
    <Link to={`/projects/${project.id}`} className="block rounded-xl border border-border bg-white p-4 shadow-sm transition hover:border-primary/40 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-text-dark">{project.name}</h3>
          <p className="text-sm text-text-muted">{project.department_names || project.department_name || 'Cross department'}</p>
        </div>
        <span className="badge bg-blue-100 text-blue-700">{project.status}</span>
      </div>
      <div className="progress-track mt-4">
        <div className={`progress-fill ${getProgressBarClass(project)}`} style={{ width: `${project.progress || 0}%` }} />
      </div>
      <p className="mt-2 text-sm font-semibold text-text-dark">{project.progress || 0}% complete</p>
    </Link>
  );
}

export default ProjectProgressCard;
