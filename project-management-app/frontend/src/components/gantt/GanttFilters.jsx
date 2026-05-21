import { TASK_STATUSES } from '../../logic/constants/status';

// Filter untuk halaman Gantt, termasuk pilihan tampilan week/month.
function GanttFilters({ filters, projects = [], departments = [], locations = [], users = [], viewMode, onViewModeChange, onChange }) {
  // Mengubah satu filter dan mengirim hasilnya ke parent.
  const updateFilter = (field, value) => onChange({ ...filters, [field]: value });

  return (
    <div className="toolbar grid md:grid-cols-3 xl:grid-cols-8">
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
      <select className="field" value={filters.assignee_id || ''} onChange={(event) => updateFilter('assignee_id', event.target.value)}>
        <option value="">All PIC</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
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
      <input className="field" type="date" value={filters.start_date || ''} onChange={(event) => updateFilter('start_date', event.target.value)} />
      <input className="field" type="date" value={filters.end_date || ''} onChange={(event) => updateFilter('end_date', event.target.value)} />
      <select className="field" value={viewMode} onChange={(event) => onViewModeChange(event.target.value)}>
        <option value="week">Week view</option>
        <option value="month">Month view</option>
      </select>
    </div>
  );
}

export default GanttFilters;
