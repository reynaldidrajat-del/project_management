import { TASK_PRIORITIES } from '../../logic/constants/priority';
import { TASK_STATUSES } from '../../logic/constants/status';
import SearchableSelect from '../shared/SearchableSelect';

// Kumpulan filter untuk menyaring task berdasarkan project, department, lokasi, status, PIC, priority, dan tanggal.
function TaskFilters({ filters, projects = [], departments = [], locations = [], users = [], labels = [], onChange, compact = false }) {
  // Mengubah satu filter lalu mengirim filter baru ke parent.
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
  const statusOptions = [
    { value: '', label: 'All statuses' },
    ...TASK_STATUSES.map((status) => ({ value: status, label: status })),
  ];
  const assigneeOptions = [
    { value: '', label: 'All PIC' },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ];
  const priorityOptions = [
    { value: '', label: 'All priorities' },
    ...TASK_PRIORITIES.map((priority) => ({ value: priority, label: priority })),
  ];
  const labelOptions = [
    { value: '', label: 'All labels' },
    ...labels.map((label) => ({ value: label.id, label: `${label.project_name ? `${label.project_name} / ` : ''}${label.name}` })),
  ];

  return (
    <div className={`toolbar grid ${compact ? 'lg:grid-cols-4' : 'md:grid-cols-3 xl:grid-cols-8'}`}>
      <input
        className="field"
        placeholder="Search task"
        value={filters.search || ''}
        onChange={(event) => updateFilter('search', event.target.value)}
      />
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
        options={statusOptions}
        searchPlaceholder="Search statuses"
        value={filters.status || ''}
        onChange={(value) => updateFilter('status', value)}
      />
      <SearchableSelect
        options={assigneeOptions}
        searchPlaceholder="Search PIC"
        value={filters.assignee_id || ''}
        onChange={(value) => updateFilter('assignee_id', value)}
      />
      <SearchableSelect
        options={priorityOptions}
        searchPlaceholder="Search priorities"
        value={filters.priority || ''}
        onChange={(value) => updateFilter('priority', value)}
      />
      <SearchableSelect
        options={labelOptions}
        searchPlaceholder="Search labels"
        value={filters.label_id || ''}
        onChange={(value) => updateFilter('label_id', value)}
      />
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
