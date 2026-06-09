import { TASK_STATUSES } from '../../logic/constants/status';
import SearchableSelect from '../shared/SearchableSelect';

// Filter untuk halaman Gantt, termasuk pilihan tampilan week/month.
function GanttFilters({ filters, projects = [], departments = [], locations = [], users = [], viewMode, onViewModeChange, onChange }) {
  // Mengubah satu filter dan mengirim hasilnya ke parent.
  const updateFilter = (field, value) => onChange({ ...filters, [field]: value });
  const projectOptions = [
    { value: '', label: 'All projects' },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ];
  const departmentOptions = [
    { value: '', label: 'All PIC departments' },
    ...departments.map((department) => ({ value: department.id, label: department.name })),
  ];
  const locationOptions = [
    { value: '', label: 'All business units' },
    ...locations.map((location) => ({ value: location.id, label: location.name })),
  ];
  const assigneeOptions = [
    { value: '', label: 'All PIC' },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ];
  const statusOptions = [
    { value: '', label: 'All statuses' },
    ...TASK_STATUSES.map((status) => ({ value: status, label: status })),
  ];
  const viewModeOptions = [
    { value: 'week', label: 'Week view' },
    { value: 'month', label: 'Month view' },
  ];

  return (
    <div className="toolbar grid md:grid-cols-3 xl:grid-cols-8">
      <SearchableSelect
        options={projectOptions}
        searchPlaceholder="Search projects"
        value={filters.project_id || ''}
        onChange={(value) => updateFilter('project_id', value)}
      />
      <SearchableSelect
        options={departmentOptions}
        searchPlaceholder="Search departments"
        value={filters.department_id || ''}
        onChange={(value) => updateFilter('department_id', value)}
      />
      <SearchableSelect
        options={locationOptions}
        searchPlaceholder="Search business units"
        value={filters.location_id || ''}
        onChange={(value) => updateFilter('location_id', value)}
      />
      <SearchableSelect
        options={assigneeOptions}
        searchPlaceholder="Search PIC"
        value={filters.assignee_id || ''}
        onChange={(value) => updateFilter('assignee_id', value)}
      />
      <SearchableSelect
        options={statusOptions}
        searchPlaceholder="Search statuses"
        value={filters.status || ''}
        onChange={(value) => updateFilter('status', value)}
      />
      <input className="field" type="date" value={filters.start_date || ''} onChange={(event) => updateFilter('start_date', event.target.value)} />
      <input className="field" type="date" value={filters.end_date || ''} onChange={(event) => updateFilter('end_date', event.target.value)} />
      <SearchableSelect options={viewModeOptions} searchPlaceholder="Search views" value={viewMode} onChange={onViewModeChange} />
    </div>
  );
}

export default GanttFilters;
