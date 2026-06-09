import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, GitBranch, GripVertical, Pencil, PlayCircle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import FormField from '../components/shared/FormField';
import Modal from '../components/shared/Modal';
import { useProjects } from '../logic/hooks/useProjects';
import { useWorkflowDetails, useWorkflows } from '../logic/hooks/useWorkflows';
import { getApiErrorMessage } from '../logic/services/api';
import {
  createDefaultWorkflow,
  createWorkflow,
  createWorkflowState,
  createWorkflowTransition,
  deleteWorkflow,
  deleteWorkflowState,
  deleteWorkflowTransition,
  updateWorkflow,
  updateWorkflowState,
  updateWorkflowTransition,
} from '../logic/services/workflowApi';
import { useUiStore } from '../store/uiStore';

const stateCategoryOptions = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
];

const initialWorkflowForm = {
  name: '',
  description: '',
  project_id: '',
  is_default: false,
};

const initialStateForm = {
  name: '',
  category: 'TODO',
  color: '#DFE1E6',
  sort_order: 0,
  is_initial: false,
  is_final: false,
};

const initialTransitionForm = {
  name: '',
  from_state_id: '',
  to_state_id: '',
  sort_order: 0,
  conditionsJson: '[]',
  validatorsJson: '[]',
  postFunctionsJson: '[]',
};

const parseJsonArray = (value, label) => {
  try {
    const parsed = JSON.parse(value || '[]');

    if (!Array.isArray(parsed)) {
      return { error: `${label} harus berupa JSON array.` };
    }

    return { value: parsed };
  } catch (_error) {
    return { error: `${label} bukan JSON valid.` };
  }
};

const toJsonText = (value) => {
  if (!value) {
    return '[]';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
};

const getArrayLength = (value) => {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (_error) {
      return 0;
    }
  }

  return 0;
};

const getStateCategoryClass = (category) => {
  if (category === 'DONE') {
    return 'bg-green-100 text-green-700';
  }

  if (category === 'IN_PROGRESS') {
    return 'bg-blue-100 text-blue-700';
  }

  return 'bg-slate-100 text-slate-700';
};

function SortableWorkflowStateCard({ state, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(state.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={[
        'flex min-h-20 items-center gap-3 rounded-lg border border-border bg-white px-3 py-3 shadow-sm',
        isDragging ? 'opacity-70 ring-2 ring-primary/25' : '',
      ].join(' ')}
      style={style}
    >
      <button
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-slate-50 text-text-muted"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="h-8 w-2 shrink-0 rounded-full" style={{ backgroundColor: state.color || '#CBD5E1' }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-text-dark">{state.name}</p>
          <span className={`badge ${getStateCategoryClass(state.category)}`}>{state.category}</span>
          {state.is_initial ? <span className="badge bg-indigo-100 text-indigo-700">Initial</span> : null}
          {state.is_final ? <span className="badge bg-green-100 text-green-700">Final</span> : null}
        </div>
        <p className="mt-1 text-xs font-semibold text-text-muted">Order {state.sort_order ?? 0}</p>
      </div>
      <div className="action-row shrink-0">
        <button className="btn-secondary px-2 py-1" type="button" onClick={() => onEdit(state)}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button className="btn-secondary px-2 py-1 text-danger" type="button" onClick={() => onDelete(state)}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function WorkflowPreview({ states, transitions }) {
  const stateById = new Map(states.map((state) => [Number(state.id), state]));

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="section-header">
        <div>
          <h2 className="section-title">Workflow Preview</h2>
          <p className="section-subtitle">{states.length} states, {transitions.length} transitions</p>
        </div>
      </div>

      {states.length ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max items-center gap-3">
            {states.map((state, index) => (
              <div key={state.id} className="flex items-center gap-3">
                <div className="min-w-44 rounded-lg border border-border bg-slate-50 p-3">
                  <div className="mb-2 h-1.5 rounded-full" style={{ backgroundColor: state.color || '#CBD5E1' }} />
                  <p className="truncate text-sm font-bold text-text-dark">{state.name}</p>
                  <span className={`badge mt-2 ${getStateCategoryClass(state.category)}`}>{state.category}</span>
                </div>
                {index < states.length - 1 ? <ArrowRight className="h-4 w-4 text-text-muted" /> : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">Belum ada state workflow.</div>
      )}

      {transitions.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {transitions.map((transition) => {
            const fromState = stateById.get(Number(transition.from_state_id));
            const toState = stateById.get(Number(transition.to_state_id));

            return (
              <span key={transition.id} className="badge bg-slate-100 text-slate-700">
                {fromState?.name || transition.from_state_name} {'->'} {toState?.name || transition.to_state_name}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function WorkflowDesignerPage() {
  const [projectId, setProjectId] = useState('');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [editingState, setEditingState] = useState(null);
  const [editingTransition, setEditingTransition] = useState(null);
  const [workflowForm, setWorkflowForm] = useState(initialWorkflowForm);
  const [stateForm, setStateForm] = useState(initialStateForm);
  const [transitionForm, setTransitionForm] = useState(initialTransitionForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { projects } = useProjects();
  const { workflows, loading, error, refetch } = useWorkflows(projectId || null);
  const {
    workflow,
    loading: workflowLoading,
    error: workflowError,
    refetch: refetchWorkflow,
  } = useWorkflowDetails(selectedWorkflowId);
  const showToast = useUiStore((state) => state.showToast);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const states = workflow?.states || [];
  const transitions = workflow?.transitions || [];
  const stateById = useMemo(() => new Map(states.map((state) => [Number(state.id), state])), [states]);

  useEffect(() => {
    if (!workflows.length) {
      setSelectedWorkflowId('');
      return;
    }

    const selectedExists = workflows.some((item) => Number(item.id) === Number(selectedWorkflowId));

    if (!selectedExists) {
      setSelectedWorkflowId(String(workflows[0].id));
    }
  }, [selectedWorkflowId, workflows]);

  const updateWorkflowField = (field, value) => {
    setWorkflowForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateStateField = (field, value) => {
    setStateForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateTransitionField = (field, value) => {
    setTransitionForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const refreshSelectedWorkflow = async () => {
    await Promise.all([refetch(), refetchWorkflow()]);
  };

  const closeWorkflowModal = () => {
    setWorkflowModalOpen(false);
    setEditingWorkflow(null);
    setWorkflowForm(initialWorkflowForm);
    setErrors({});
  };

  const closeStateModal = () => {
    setStateModalOpen(false);
    setEditingState(null);
    setStateForm(initialStateForm);
    setErrors({});
  };

  const closeTransitionModal = () => {
    setTransitionModalOpen(false);
    setEditingTransition(null);
    setTransitionForm(initialTransitionForm);
    setErrors({});
  };

  const openCreateWorkflowModal = () => {
    setEditingWorkflow(null);
    setWorkflowForm({ ...initialWorkflowForm, project_id: projectId || '' });
    setErrors({});
    setWorkflowModalOpen(true);
  };

  const openEditWorkflowModal = (item) => {
    setEditingWorkflow(item);
    setWorkflowForm({
      name: item.name || '',
      description: item.description || '',
      project_id: item.project_id || '',
      is_default: Boolean(item.is_default),
    });
    setErrors({});
    setWorkflowModalOpen(true);
  };

  const openCreateStateModal = () => {
    setEditingState(null);
    setStateForm({
      ...initialStateForm,
      sort_order: states.length,
      is_initial: states.length === 0,
    });
    setErrors({});
    setStateModalOpen(true);
  };

  const openEditStateModal = (state) => {
    setEditingState(state);
    setStateForm({
      name: state.name || '',
      category: state.category || 'TODO',
      color: state.color || '#DFE1E6',
      sort_order: Number(state.sort_order || 0),
      is_initial: Boolean(state.is_initial),
      is_final: Boolean(state.is_final),
    });
    setErrors({});
    setStateModalOpen(true);
  };

  const openCreateTransitionModal = () => {
    if (states.length < 2) {
      showToast({ type: 'error', message: 'Minimal dua state diperlukan untuk membuat transition.' });
      return;
    }

    setEditingTransition(null);
    setTransitionForm({
      ...initialTransitionForm,
      from_state_id: states[0]?.id || '',
      to_state_id: states[1]?.id || '',
      sort_order: transitions.length,
    });
    setErrors({});
    setTransitionModalOpen(true);
  };

  const openEditTransitionModal = (transition) => {
    setEditingTransition(transition);
    setTransitionForm({
      name: transition.name || '',
      from_state_id: transition.from_state_id || '',
      to_state_id: transition.to_state_id || '',
      sort_order: Number(transition.sort_order || 0),
      conditionsJson: toJsonText(transition.conditions),
      validatorsJson: toJsonText(transition.validators),
      postFunctionsJson: toJsonText(transition.post_functions),
    });
    setErrors({});
    setTransitionModalOpen(true);
  };

  const handleWorkflowSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!workflowForm.name.trim()) {
      nextErrors.name = 'Masukkan nama workflow.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    const payload = {
      name: workflowForm.name.trim(),
      description: workflowForm.description.trim() || null,
      project_id: workflowForm.project_id || null,
      is_default: Boolean(workflowForm.is_default),
    };

    setSubmitting(true);

    try {
      const savedWorkflow = editingWorkflow
        ? await updateWorkflow(editingWorkflow.id, payload)
        : await createWorkflow(payload);

      setSelectedWorkflowId(String(savedWorkflow.id));
      closeWorkflowModal();
      await refetch();
      showToast({ type: 'success', message: editingWorkflow ? 'Workflow diperbarui.' : 'Workflow dibuat.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStateSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!stateForm.name.trim()) {
      nextErrors.name = 'Masukkan nama state.';
    }

    if (!/^#[0-9a-f]{6}$/i.test(stateForm.color)) {
      nextErrors.color = 'Gunakan warna hex valid.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    const payload = {
      name: stateForm.name.trim(),
      category: stateForm.category,
      color: stateForm.color,
      sort_order: Number(stateForm.sort_order || 0),
      is_initial: Boolean(stateForm.is_initial),
      is_final: Boolean(stateForm.is_final),
    };

    setSubmitting(true);

    try {
      if (editingState) {
        await updateWorkflowState(editingState.id, payload);
      } else {
        await createWorkflowState(selectedWorkflowId, payload);
      }

      closeStateModal();
      await refreshSelectedWorkflow();
      showToast({ type: 'success', message: editingState ? 'State diperbarui.' : 'State dibuat.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransitionSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};
    const parsedConditions = parseJsonArray(transitionForm.conditionsJson, 'Conditions');
    const parsedValidators = parseJsonArray(transitionForm.validatorsJson, 'Validators');
    const parsedPostFunctions = parseJsonArray(transitionForm.postFunctionsJson, 'Post-functions');

    if (!transitionForm.name.trim()) {
      nextErrors.name = 'Masukkan nama transition.';
    }

    if (!transitionForm.from_state_id) {
      nextErrors.from_state_id = 'Pilih source state.';
    }

    if (!transitionForm.to_state_id) {
      nextErrors.to_state_id = 'Pilih target state.';
    }

    if (Number(transitionForm.from_state_id) === Number(transitionForm.to_state_id)) {
      nextErrors.to_state_id = 'Target state harus berbeda.';
    }

    if (parsedConditions.error) {
      nextErrors.conditionsJson = parsedConditions.error;
    }

    if (parsedValidators.error) {
      nextErrors.validatorsJson = parsedValidators.error;
    }

    if (parsedPostFunctions.error) {
      nextErrors.postFunctionsJson = parsedPostFunctions.error;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    const payload = {
      name: transitionForm.name.trim(),
      from_state_id: Number(transitionForm.from_state_id),
      to_state_id: Number(transitionForm.to_state_id),
      sort_order: Number(transitionForm.sort_order || 0),
      conditions: parsedConditions.value,
      validators: parsedValidators.value,
      post_functions: parsedPostFunctions.value,
    };

    setSubmitting(true);

    try {
      if (editingTransition) {
        await updateWorkflowTransition(editingTransition.id, payload);
      } else {
        await createWorkflowTransition(selectedWorkflowId, payload);
      }

      closeTransitionModal();
      await refreshSelectedWorkflow();
      showToast({ type: 'success', message: editingTransition ? 'Transition diperbarui.' : 'Transition dibuat.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWorkflow = async (item) => {
    if (!window.confirm(`Hapus workflow "${item.name}"?`)) {
      return;
    }

    try {
      await deleteWorkflow(item.id);
      await refetch();
      showToast({ type: 'success', message: 'Workflow dihapus.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleDeleteState = async (state) => {
    if (!window.confirm(`Hapus state "${state.name}"?`)) {
      return;
    }

    try {
      await deleteWorkflowState(state.id);
      await refreshSelectedWorkflow();
      showToast({ type: 'success', message: 'State dihapus.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleDeleteTransition = async (transition) => {
    if (!window.confirm(`Hapus transition "${transition.name}"?`)) {
      return;
    }

    try {
      await deleteWorkflowTransition(transition.id);
      await refreshSelectedWorkflow();
      showToast({ type: 'success', message: 'Transition dihapus.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleCreateDefaultWorkflow = async () => {
    if (!projectId) {
      showToast({ type: 'error', message: 'Pilih project terlebih dahulu.' });
      return;
    }

    setSubmitting(true);

    try {
      const savedWorkflow = await createDefaultWorkflow(projectId);
      setSelectedWorkflowId(String(savedWorkflow.id));
      await refetch();
      showToast({ type: 'success', message: 'Default workflow dibuat.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStateDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = states.findIndex((state) => String(state.id) === String(active.id));
    const newIndex = states.findIndex((state) => String(state.id) === String(over.id));

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reorderedStates = arrayMove(states, oldIndex, newIndex);

    try {
      await Promise.all(
        reorderedStates.map((state, index) =>
          updateWorkflowState(state.id, {
            sort_order: index,
          }),
        ),
      );
      await refetchWorkflow();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Administration</p>
          <h1 className="page-title">Workflow Designer</h1>
          <p className="page-description">Kelola state, transition, kondisi, validator, dan post-function untuk proses kerja issue.</p>
        </div>
        <div className="action-row">
          <button className="btn-secondary" disabled={!projectId || submitting} type="button" onClick={handleCreateDefaultWorkflow}>
            <PlayCircle className="h-4 w-4" />
            Default Workflow
          </button>
          <button className="btn-primary" type="button" onClick={openCreateWorkflowModal}>
            <Plus className="h-4 w-4" />
            Tambah Workflow
          </button>
        </div>
      </div>

      <div className="toolbar">
        <FormField className="w-full sm:w-80" htmlFor="workflow-project-filter" label="Project Scope">
          <select
            className="field mt-1"
            id="workflow-project-filter"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">Global workflows</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </FormField>
        <button className="btn-secondary self-end" type="button" onClick={() => refreshSelectedWorkflow()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error ? <div className="card p-6 text-danger">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="table-shell self-start">
          <div className="border-b border-border px-4 py-3">
            <h2 className="section-title">Workflows</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <p className="p-4 text-sm text-text-muted">Loading workflows...</p>
            ) : workflows.length ? (
              workflows.map((item) => (
                <button
                  key={item.id}
                  className={[
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
                    Number(selectedWorkflowId) === Number(item.id) ? 'bg-blue-50' : 'bg-white',
                  ].join(' ')}
                  type="button"
                  onClick={() => setSelectedWorkflowId(String(item.id))}
                >
                  <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-text-dark">{item.name}</span>
                      {item.is_default ? <span className="badge bg-indigo-100 text-indigo-700">Default</span> : null}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      {item.state_count || 0} states, {item.transition_count || 0} transitions
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="p-4 text-sm text-text-muted">Belum ada workflow.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {workflowError ? <div className="card p-6 text-danger">{workflowError}</div> : null}

          {workflowLoading ? (
            <div className="card p-6 text-text-muted">Loading workflow...</div>
          ) : workflow ? (
            <>
              <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="section-header">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="section-title">{workflow.name}</h2>
                      {workflow.is_default ? <span className="badge bg-indigo-100 text-indigo-700">Default</span> : null}
                      <span className="badge bg-slate-100 text-slate-700">{workflow.project_id ? 'Project' : 'Global'}</span>
                    </div>
                    {workflow.description ? <p className="section-subtitle">{workflow.description}</p> : null}
                  </div>
                  <div className="action-row">
                    <button className="btn-secondary" type="button" onClick={() => openEditWorkflowModal(workflow)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button className="btn-secondary text-danger" type="button" onClick={() => handleDeleteWorkflow(workflow)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <WorkflowPreview states={states} transitions={transitions} />

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                  <div className="section-header">
                    <div>
                      <h2 className="section-title">States</h2>
                      <p className="section-subtitle">{states.length} workflow states</p>
                    </div>
                    <button className="btn-primary" type="button" onClick={openCreateStateModal}>
                      <Plus className="h-4 w-4" />
                      State
                    </button>
                  </div>

                  {states.length ? (
                    <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleStateDragEnd}>
                      <SortableContext items={states.map((state) => String(state.id))} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3">
                          {states.map((state) => (
                            <SortableWorkflowStateCard key={state.id} state={state} onDelete={handleDeleteState} onEdit={openEditStateModal} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="empty-state">Belum ada state workflow.</div>
                  )}
                </div>

                <div className="table-shell">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div>
                      <h2 className="section-title">Transitions</h2>
                      <p className="section-subtitle">{transitions.length} transition rules</p>
                    </div>
                    <button className="btn-primary" type="button" onClick={openCreateTransitionModal}>
                      <Plus className="h-4 w-4" />
                      Transition
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table className="data-table min-w-[760px]">
                      <thead>
                        <tr>
                          <th>Transition</th>
                          <th>Path</th>
                          <th>Rules</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transitions.length ? (
                          transitions.map((transition) => {
                            const fromState = stateById.get(Number(transition.from_state_id));
                            const toState = stateById.get(Number(transition.to_state_id));

                            return (
                              <tr key={transition.id}>
                                <td className="font-semibold">{transition.name}</td>
                                <td>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span>{fromState?.name || transition.from_state_name}</span>
                                    <ArrowRight className="h-4 w-4 text-text-muted" />
                                    <span>{toState?.name || transition.to_state_name}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="flex flex-wrap gap-1">
                                    <span className="badge bg-slate-100 text-slate-700">{getArrayLength(transition.conditions)} conditions</span>
                                    <span className="badge bg-slate-100 text-slate-700">{getArrayLength(transition.validators)} validators</span>
                                    <span className="badge bg-slate-100 text-slate-700">{getArrayLength(transition.post_functions)} post</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="action-row">
                                    <button className="btn-secondary py-1" type="button" onClick={() => openEditTransitionModal(transition)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                      Edit
                                    </button>
                                    <button className="btn-secondary py-1 text-danger" type="button" onClick={() => handleDeleteTransition(transition)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="text-text-muted" colSpan="4">
                              Belum ada transition.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">Pilih atau buat workflow.</div>
          )}
        </div>
      </div>

      <Modal
        footer={
          <>
            <button className="btn-secondary" disabled={submitting} type="button" onClick={closeWorkflowModal}>
              Cancel
            </button>
            <button className="btn-primary" disabled={submitting} form="workflow-form" type="submit">
              {editingWorkflow ? 'Save Changes' : 'Create Workflow'}
            </button>
          </>
        }
        open={workflowModalOpen}
        title={editingWorkflow ? 'Edit Workflow' : 'Tambah Workflow'}
        onClose={closeWorkflowModal}
      >
        <form id="workflow-form" noValidate onSubmit={handleWorkflowSubmit}>
          <div className="grid gap-4">
            <FormField error={errors.name} htmlFor="workflow-name" label="Name" required>
              <input
                className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
                id="workflow-name"
                value={workflowForm.name}
                onChange={(event) => updateWorkflowField('name', event.target.value)}
              />
            </FormField>
            <FormField htmlFor="workflow-description" label="Description">
              <textarea
                className="field mt-1 min-h-24 resize-y"
                id="workflow-description"
                value={workflowForm.description}
                onChange={(event) => updateWorkflowField('description', event.target.value)}
              />
            </FormField>
            <FormField htmlFor="workflow-project" label="Project Scope">
              <select
                className="field mt-1"
                disabled={Boolean(editingWorkflow)}
                id="workflow-project"
                value={workflowForm.project_id}
                onChange={(event) => updateWorkflowField('project_id', event.target.value)}
              >
                <option value="">Global</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text-dark">
              <input
                checked={workflowForm.is_default}
                type="checkbox"
                onChange={(event) => updateWorkflowField('is_default', event.target.checked)}
              />
              <span>Default workflow</span>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn-secondary" disabled={submitting} type="button" onClick={closeStateModal}>
              Cancel
            </button>
            <button className="btn-primary" disabled={submitting} form="workflow-state-form" type="submit">
              {editingState ? 'Save Changes' : 'Create State'}
            </button>
          </>
        }
        open={stateModalOpen}
        title={editingState ? 'Edit State' : 'Tambah State'}
        onClose={closeStateModal}
      >
        <form id="workflow-state-form" noValidate onSubmit={handleStateSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField error={errors.name} htmlFor="workflow-state-name" label="Name" required>
              <input
                className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
                id="workflow-state-name"
                value={stateForm.name}
                onChange={(event) => updateStateField('name', event.target.value)}
              />
            </FormField>
            <FormField htmlFor="workflow-state-category" label="Category">
              <select
                className="field mt-1"
                id="workflow-state-category"
                value={stateForm.category}
                onChange={(event) => updateStateField('category', event.target.value)}
              >
                {stateCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField error={errors.color} htmlFor="workflow-state-color" label="Color" required>
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="h-10 w-14 rounded-lg border border-border bg-white p-1"
                  id="workflow-state-color"
                  type="color"
                  value={stateForm.color}
                  onChange={(event) => updateStateField('color', event.target.value)}
                />
                <input
                  className={`field ${errors.color ? 'field-error' : ''}`}
                  value={stateForm.color}
                  onChange={(event) => updateStateField('color', event.target.value)}
                />
              </div>
            </FormField>
            <FormField htmlFor="workflow-state-order" label="Sort Order">
              <input
                className="field mt-1"
                id="workflow-state-order"
                min="0"
                type="number"
                value={stateForm.sort_order}
                onChange={(event) => updateStateField('sort_order', event.target.value)}
              />
            </FormField>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text-dark">
              <input
                checked={stateForm.is_initial}
                type="checkbox"
                onChange={(event) => updateStateField('is_initial', event.target.checked)}
              />
              <span>Initial state</span>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text-dark">
              <input
                checked={stateForm.is_final}
                type="checkbox"
                onChange={(event) => updateStateField('is_final', event.target.checked)}
              />
              <span>Final state</span>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn-secondary" disabled={submitting} type="button" onClick={closeTransitionModal}>
              Cancel
            </button>
            <button className="btn-primary" disabled={submitting} form="workflow-transition-form" type="submit">
              {editingTransition ? 'Save Changes' : 'Create Transition'}
            </button>
          </>
        }
        open={transitionModalOpen}
        size="xl"
        title={editingTransition ? 'Edit Transition' : 'Tambah Transition'}
        onClose={closeTransitionModal}
      >
        <form id="workflow-transition-form" noValidate onSubmit={handleTransitionSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField className="md:col-span-2" error={errors.name} htmlFor="workflow-transition-name" label="Name" required>
              <input
                className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
                id="workflow-transition-name"
                value={transitionForm.name}
                onChange={(event) => updateTransitionField('name', event.target.value)}
              />
            </FormField>
            <FormField error={errors.from_state_id} htmlFor="workflow-transition-from" label="From State" required>
              <select
                className={`field mt-1 ${errors.from_state_id ? 'field-error' : ''}`}
                id="workflow-transition-from"
                value={transitionForm.from_state_id}
                onChange={(event) => updateTransitionField('from_state_id', event.target.value)}
              >
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField error={errors.to_state_id} htmlFor="workflow-transition-to" label="To State" required>
              <select
                className={`field mt-1 ${errors.to_state_id ? 'field-error' : ''}`}
                id="workflow-transition-to"
                value={transitionForm.to_state_id}
                onChange={(event) => updateTransitionField('to_state_id', event.target.value)}
              >
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField htmlFor="workflow-transition-order" label="Sort Order">
              <input
                className="field mt-1"
                id="workflow-transition-order"
                min="0"
                type="number"
                value={transitionForm.sort_order}
                onChange={(event) => updateTransitionField('sort_order', event.target.value)}
              />
            </FormField>
            <div />
            <FormField className="md:col-span-2" error={errors.conditionsJson} htmlFor="workflow-transition-conditions" label="Conditions JSON">
              <textarea
                className={`field mt-1 min-h-28 resize-y font-mono ${errors.conditionsJson ? 'field-error' : ''}`}
                id="workflow-transition-conditions"
                value={transitionForm.conditionsJson}
                onChange={(event) => updateTransitionField('conditionsJson', event.target.value)}
              />
            </FormField>
            <FormField className="md:col-span-2" error={errors.validatorsJson} htmlFor="workflow-transition-validators" label="Validators JSON">
              <textarea
                className={`field mt-1 min-h-28 resize-y font-mono ${errors.validatorsJson ? 'field-error' : ''}`}
                id="workflow-transition-validators"
                value={transitionForm.validatorsJson}
                onChange={(event) => updateTransitionField('validatorsJson', event.target.value)}
              />
            </FormField>
            <FormField className="md:col-span-2" error={errors.postFunctionsJson} htmlFor="workflow-transition-post-functions" label="Post-functions JSON">
              <textarea
                className={`field mt-1 min-h-28 resize-y font-mono ${errors.postFunctionsJson ? 'field-error' : ''}`}
                id="workflow-transition-post-functions"
                value={transitionForm.postFunctionsJson}
                onChange={(event) => updateTransitionField('postFunctionsJson', event.target.value)}
              />
            </FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default WorkflowDesignerPage;
