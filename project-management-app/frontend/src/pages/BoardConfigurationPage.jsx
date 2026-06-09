import { Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useProjects } from '../logic/hooks/useProjects';
import { useWorkflowDetails, useWorkflows } from '../logic/hooks/useWorkflows';
import { BOARD_CARD_FIELDS, getBoardConfig, saveBoardConfig } from '../logic/services/boardConfigStorage';
import { useUiStore } from '../store/uiStore';

const createColumn = () => ({
  id: `column-${Date.now()}`,
  label: 'New Column',
  status: 'Not Started',
  workflow_category: 'TODO',
});

const createQuickFilter = () => ({
  id: `filter-${Date.now()}`,
  label: 'New filter',
  jql: 'status != Done',
});

function BoardConfigurationPage() {
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const [config, setConfig] = useState(() => getBoardConfig('global'));
  const { workflows } = useWorkflows(projectId, { enabled: Boolean(projectId) });
  const defaultWorkflow = workflows.find((workflow) => workflow.is_default) || workflows[0] || null;
  const { workflow } = useWorkflowDetails(defaultWorkflow?.id, { enabled: Boolean(defaultWorkflow?.id) });
  const showToast = useUiStore((state) => state.showToast);

  const workflowStates = useMemo(
    () => workflow?.states || [],
    [workflow],
  );

  useEffect(() => {
    setConfig(getBoardConfig(projectId || 'global'));
  }, [projectId]);

  const updateConfig = (updater) => {
    setConfig((current) => (typeof updater === 'function' ? updater(current) : updater));
  };

  const handleColumnChange = (columnId, field, value) => {
    updateConfig((current) => ({
      ...current,
      columns: current.columns.map((column) => (column.id === columnId ? { ...column, [field]: value } : column)),
    }));
  };

  const handleQuickFilterChange = (filterId, field, value) => {
    updateConfig((current) => ({
      ...current,
      quick_filters: current.quick_filters.map((filter) => (filter.id === filterId ? { ...filter, [field]: value } : filter)),
    }));
  };

  const toggleCardField = (fieldKey) => {
    updateConfig((current) => {
      const currentFields = new Set(current.card_fields || []);

      if (currentFields.has(fieldKey)) {
        currentFields.delete(fieldKey);
      } else {
        currentFields.add(fieldKey);
      }

      return {
        ...current,
        card_fields: Array.from(currentFields),
      };
    });
  };

  const handleSave = () => {
    const savedConfig = saveBoardConfig(projectId || 'global', config);
    setConfig(savedConfig);
    showToast({ type: 'success', message: 'Board configuration disimpan.' });
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Board Configuration</p>
          <h1 className="page-title">Board Configuration</h1>
          <p className="page-description">Atur column mapping, swimlane, quick filter, dan field yang muncul pada kartu board.</p>
        </div>
        <button className="btn-primary" type="button" onClick={handleSave}>
          <Save className="h-4 w-4" />
          Save
        </button>
      </div>

      <div className="toolbar">
        <label className="grid gap-1 text-sm font-semibold text-text-dark">
          Project
          <select className="field min-w-64" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Global default</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-text-dark">
          Default swimlane
          <select
            className="field min-w-48"
            value={config.swimlane_default}
            onChange={(event) => updateConfig((current) => ({ ...current, swimlane_default: event.target.value }))}
          >
            <option value="none">None</option>
            <option value="assignee">Assignee</option>
            <option value="epic">Epic</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-text-dark">
          Card color
          <select
            className="field min-w-48"
            value={config.card_color_mode}
            onChange={(event) => updateConfig((current) => ({ ...current, card_color_mode: event.target.value }))}
          >
            <option value="priority">Priority</option>
            <option value="issue_type">Issue type</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Columns</h2>
              <p className="text-sm text-text-muted">Mapping column ke legacy status dan workflow category.</p>
            </div>
            <button className="btn-secondary" type="button" onClick={() => updateConfig((current) => ({ ...current, columns: [...current.columns, createColumn()] }))}>
              Add Column
            </button>
          </div>
          <div className="space-y-3">
            {config.columns.map((column) => (
              <div key={column.id} className="grid gap-2 rounded-lg border border-border p-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  className="field"
                  value={column.label}
                  onChange={(event) => handleColumnChange(column.id, 'label', event.target.value)}
                />
                <select className="field" value={column.status} onChange={(event) => handleColumnChange(column.id, 'status', event.target.value)}>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Waiting Review">Waiting Review</option>
                  <option value="Done">Done</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <select
                  className="field"
                  value={column.workflow_state_id || column.workflow_category || ''}
                  onChange={(event) => {
                    const selectedState = workflowStates.find((state) => String(state.id) === event.target.value);
                    handleColumnChange(column.id, 'workflow_state_id', selectedState?.id || '');
                    handleColumnChange(column.id, 'workflow_category', selectedState?.category || event.target.value);
                  }}
                >
                  <option value="TODO">Workflow TODO</option>
                  <option value="IN_PROGRESS">Workflow IN_PROGRESS</option>
                  <option value="DONE">Workflow DONE</option>
                  {workflowStates.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name} ({state.category})
                    </option>
                  ))}
                </select>
                <button
                  className="btn-secondary text-danger"
                  disabled={config.columns.length <= 1}
                  type="button"
                  onClick={() => updateConfig((current) => ({ ...current, columns: current.columns.filter((item) => item.id !== column.id) }))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold">Card Fields</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {BOARD_CARD_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold">
                <input
                  checked={(config.card_fields || []).includes(field.key)}
                  type="checkbox"
                  onChange={() => toggleCardField(field.key)}
                />
                {field.label}
              </label>
            ))}
          </div>
        </section>
      </div>

      <section className="card mt-4 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Quick Filters</h2>
            <p className="text-sm text-text-muted">Filter JQL yang dapat dipakai ulang oleh board.</p>
          </div>
          <button className="btn-secondary" type="button" onClick={() => updateConfig((current) => ({ ...current, quick_filters: [...current.quick_filters, createQuickFilter()] }))}>
            Add Filter
          </button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {config.quick_filters.map((filter) => (
            <div key={filter.id} className="grid gap-2 rounded-lg border border-border p-3">
              <input className="field" value={filter.label} onChange={(event) => handleQuickFilterChange(filter.id, 'label', event.target.value)} />
              <textarea className="field min-h-20" value={filter.jql} onChange={(event) => handleQuickFilterChange(filter.id, 'jql', event.target.value)} />
              <button
                className="btn-secondary justify-self-end text-danger"
                type="button"
                onClick={() => updateConfig((current) => ({ ...current, quick_filters: current.quick_filters.filter((item) => item.id !== filter.id) }))}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default BoardConfigurationPage;
