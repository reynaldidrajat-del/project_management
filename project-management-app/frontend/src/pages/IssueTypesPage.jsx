import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import FormField from '../components/shared/FormField';
import Modal from '../components/shared/Modal';
import IssueTypeBadge from '../components/task/IssueTypeBadge';
import { useIssueTypes, useIssueTypeStats } from '../logic/hooks/useIssueTypes';
import { useProjects } from '../logic/hooks/useProjects';
import { getApiErrorMessage } from '../logic/services/api';
import { createIssueType, deleteIssueType, updateIssueType } from '../logic/services/issueTypeApi';
import { useUiStore } from '../store/uiStore';

const iconOptions = [
  { value: 'epic', label: 'Epic' },
  { value: 'story', label: 'Story' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'subtask', label: 'Subtask' },
];

const hierarchyOptions = [
  { value: 0, label: '0 - Epic' },
  { value: 1, label: '1 - Story' },
  { value: 2, label: '2 - Task / Bug' },
  { value: 3, label: '3 - Subtask' },
];

const initialForm = {
  name: '',
  icon: 'task',
  color: '#4BADE8',
  hierarchy_level: 2,
  allowed_parent_types: [],
  allowed_child_types: [],
  project_id: '',
};

const toNameList = (values) => (Array.isArray(values) && values.length ? values.join(', ') : '-');

const toggleOption = (values, option, checked) => {
  const nextValues = new Set(values);

  if (checked) {
    nextValues.add(option);
  } else {
    nextValues.delete(option);
  }

  return Array.from(nextValues);
};

function IssueTypeRelationshipField({ id, label, options, value, onChange }) {
  return (
    <FormField htmlFor={id} label={label}>
      <div id={id} className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text-dark">
            <input
              checked={value.includes(option)}
              type="checkbox"
              onChange={(event) => onChange(toggleOption(value, option, event.target.checked))}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </FormField>
  );
}

function IssueTypesPage() {
  const [projectId, setProjectId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIssueType, setEditingIssueType] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const { projects } = useProjects();
  const { issueTypes, loading, error, refetch } = useIssueTypes(projectId);
  const { stats, refetch: refetchStats } = useIssueTypeStats(projectId);
  const showToast = useUiStore((state) => state.showToast);

  const statsById = useMemo(() => {
    const nextStats = new Map();
    stats.forEach((item) => nextStats.set(Number(item.id), item.issue_count || 0));
    return nextStats;
  }, [stats]);

  const relationshipOptions = useMemo(
    () => Array.from(new Set(issueTypes.map((issueType) => issueType.name).filter(Boolean))).sort(),
    [issueTypes],
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const openCreateModal = () => {
    setEditingIssueType(null);
    setForm({ ...initialForm, project_id: projectId || '' });
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (issueType) => {
    setEditingIssueType(issueType);
    setForm({
      name: issueType.name || '',
      icon: issueType.icon || 'task',
      color: issueType.color || '#4BADE8',
      hierarchy_level: Number(issueType.hierarchy_level || 2),
      allowed_parent_types: issueType.allowed_parent_types || [],
      allowed_child_types: issueType.allowed_child_types || [],
      project_id: issueType.project_id || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditingIssueType(null);
    setForm(initialForm);
    setErrors({});
    setModalOpen(false);
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Masukkan nama issue type.';
    }

    if (!/^#[0-9a-f]{6}$/i.test(form.color)) {
      nextErrors.color = 'Gunakan warna hex valid.';
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      hierarchy_level: Number(form.hierarchy_level),
      allowed_parent_types: form.allowed_parent_types,
      allowed_child_types: form.allowed_child_types,
      project_id: form.project_id || null,
    };

    try {
      if (editingIssueType) {
        await updateIssueType(editingIssueType.id, payload);
        showToast({ type: 'success', message: 'Issue type diperbarui.' });
      } else {
        await createIssueType(payload);
        showToast({ type: 'success', message: 'Issue type dibuat.' });
      }

      closeModal();
      await Promise.all([refetch(), refetchStats()]);
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleDelete = async (issueType) => {
    if (!window.confirm(`Hapus issue type "${issueType.name}"?`)) {
      return;
    }

    try {
      await deleteIssueType(issueType.id);
      showToast({ type: 'success', message: 'Issue type dihapus.' });
      await Promise.all([refetch(), refetchStats()]);
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Administration</p>
          <h1 className="page-title">Issue Types</h1>
          <p className="page-description">Master work type untuk Epic, Story, Task, Bug, Subtask, dan tipe khusus per project.</p>
        </div>
        <button className="btn-primary" type="button" onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Tambah Issue Type
        </button>
      </div>

      <div className="toolbar">
        <FormField className="w-full sm:w-80" htmlFor="issue-type-project-filter" label="Project Scope">
          <select
            className="field mt-1"
            id="issue-type-project-filter"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">Global issue types</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {error ? <div className="card p-6 text-danger">{error}</div> : null}

      <div className="table-shell">
        <div className="table-scroll">
          <table className="data-table min-w-[1040px]">
            <thead>
              <tr>
                <th>Issue Type</th>
                <th>Scope</th>
                <th>Hierarchy</th>
                <th>Allowed Parents</th>
                <th>Allowed Children</th>
                <th>Issues</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="text-text-muted" colSpan="7">
                    Loading issue types...
                  </td>
                </tr>
              ) : (
                issueTypes.map((issueType) => (
                  <tr key={issueType.id}>
                    <td>
                      <IssueTypeBadge issueType={issueType} />
                    </td>
                    <td>{issueType.project_id ? projects.find((project) => Number(project.id) === Number(issueType.project_id))?.name || 'Project' : 'Global'}</td>
                    <td>{issueType.hierarchy_level}</td>
                    <td className="max-w-48 text-text-muted">{toNameList(issueType.allowed_parent_types)}</td>
                    <td className="max-w-48 text-text-muted">{toNameList(issueType.allowed_child_types)}</td>
                    <td className="font-semibold">{statsById.get(Number(issueType.id)) || 0}</td>
                    <td>
                      {issueType.is_system ? (
                        <span className="badge bg-slate-100 text-slate-600">System</span>
                      ) : (
                        <div className="action-row">
                          <button className="btn-secondary py-1" type="button" onClick={() => openEditModal(issueType)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button className="btn-secondary py-1 text-danger" type="button" onClick={() => handleDelete(issueType)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && !issueTypes.length ? <div className="empty-state">Belum ada issue type.</div> : null}

      <Modal
        description={editingIssueType ? 'Perubahan berlaku untuk issue type custom.' : 'Issue type custom dapat dibuat global atau khusus project.'}
        footer={
          <>
            <button className="btn-secondary" type="button" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn-primary" form="issue-type-form" type="submit">
              {editingIssueType ? 'Save Changes' : 'Create Issue Type'}
            </button>
          </>
        }
        open={modalOpen}
        size="lg"
        title={editingIssueType ? 'Edit Issue Type' : 'Tambah Issue Type'}
        onClose={closeModal}
      >
        <form id="issue-type-form" noValidate onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={errors.name} htmlFor="issue-type-name" label="Name" required>
              <input
                className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
                id="issue-type-name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </FormField>
            <FormField htmlFor="issue-type-icon" label="Icon">
              <select className="field mt-1" id="issue-type-icon" value={form.icon} onChange={(event) => updateField('icon', event.target.value)}>
                {iconOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField error={errors.color} htmlFor="issue-type-color" label="Color" required>
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="h-10 w-14 rounded-lg border border-border bg-white p-1"
                  id="issue-type-color"
                  type="color"
                  value={form.color}
                  onChange={(event) => updateField('color', event.target.value)}
                />
                <input
                  className={`field ${errors.color ? 'field-error' : ''}`}
                  value={form.color}
                  onChange={(event) => updateField('color', event.target.value)}
                />
              </div>
            </FormField>
            <FormField htmlFor="issue-type-hierarchy" label="Hierarchy Level">
              <select
                className="field mt-1"
                id="issue-type-hierarchy"
                value={form.hierarchy_level}
                onChange={(event) => updateField('hierarchy_level', Number(event.target.value))}
              >
                {hierarchyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField className="md:col-span-2" htmlFor="issue-type-project" label="Project Scope">
              <select
                className="field mt-1"
                disabled={Boolean(editingIssueType)}
                id="issue-type-project"
                value={form.project_id}
                onChange={(event) => updateField('project_id', event.target.value)}
              >
                <option value="">Global</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            <IssueTypeRelationshipField
              id="issue-type-parents"
              label="Allowed Parent Types"
              options={relationshipOptions.filter((option) => option !== form.name)}
              value={form.allowed_parent_types}
              onChange={(nextValue) => updateField('allowed_parent_types', nextValue)}
            />
            <IssueTypeRelationshipField
              id="issue-type-children"
              label="Allowed Child Types"
              options={relationshipOptions.filter((option) => option !== form.name)}
              value={form.allowed_child_types}
              onChange={(nextValue) => updateField('allowed_child_types', nextValue)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default IssueTypesPage;
