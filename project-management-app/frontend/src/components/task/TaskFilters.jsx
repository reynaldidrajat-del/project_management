import { TASK_PRIORITIES } from '../../logic/constants/priority';
import { TASK_STATUSES } from '../../logic/constants/status';

// Kumpulan filter untuk menyaring task berdasarkan project, department, lokasi, status, PIC, priority, dan tanggal.
function TaskFilters({ filters, projects = [], departments = [], locations = [], users = [], labels = [], onChange, compact = false }) {
  // Mengubah satu filter lalu mengirim filter baru ke parent.
  const updateFilter = (field, value) => onChange({ ...filters, [field]: value });

  return (
    <div className={`toolbar grid ${compact ? 'lg:grid-cols-4' : 'md:grid-cols-3 xl:grid-cols-8'}`}>
      <input
        className="field"
        placeholder="Search task"
        value={filters.search || ''}
        onChange={(event) => updateFilter('search', event.target.value)}
      />
      <select className="field" value={filters.project_id || ''} onChange={(event) => updateFilter('project_id', event.target.value)}>
        <option value="">All projects</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <select className="field" value={filters.department_id || ''} onChange={(event) => updateFilter('department_id', event.target.value)}>
        <option value="">All PIC departments</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      <select className="field" value={filters.location_id || ''} onChange={(event) => updateFilter('location_id', event.target.value)}>
        <option value="">All business units</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
      <select className="field" value={filters.status || ''} onChange={(event) => updateFilter('status', event.target.value)}>
        <option value="">All statuses</option>
        {TASK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <select className="field" value={filters.assignee_id || ''} onChange={(event) => updateFilter('assignee_id', event.target.value)}>
        <option value="">All PIC</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      <select className="field" value={filters.priority || ''} onChange={(event) => updateFilter('priority', event.target.value)}>
        <option value="">All priorities</option>
        {TASK_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </select>
      <select className="field" value={filters.label_id || ''} onChange={(event) => updateFilter('label_id', event.target.value)}>
        <option value="">All labels</option>
        {labels.map((label) => (
          <option key={label.id} value={label.id}>
            {label.project_name ? `${label.project_name} / ` : ''}{label.name}
          </option>
        ))}
      </select>
      <input className="field" type="date" value={filters.start_date || ''} onChange={(event) => updateFilter('start_date', event.target.value)} />
      <input className="field" type="date" value={filters.end_date || ''} onChange={(event) => updateFilter('end_date', event.target.value)} />
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-text-muted">
        <input
          checked={filters.include_archived === 'true'}
          type="checkbox"
          onChange={(event) => updateFilter('include_archived', event.target.checked ? 'true' : '')}
        />
        Archived
      </label>
    </div>
  );
}

export default TaskFilters;
