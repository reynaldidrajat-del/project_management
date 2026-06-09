import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { CalendarDays, GripVertical, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getTaskDisplayKey } from '../../logic/helpers/taskDisplayHelper';
import { useBacklog } from '../../logic/hooks/useBacklog';
import { useSprintIssues, useSprintMetrics } from '../../logic/hooks/useSprints';
import { getApiErrorMessage } from '../../logic/services/api';
import { moveIssuesToSprint } from '../../logic/services/backlogApi';
import { createSprint, updateSprint } from '../../logic/services/sprintApi';
import { useUiStore } from '../../store/uiStore';
import FormField from '../shared/FormField';
import Modal from '../shared/Modal';
import SyncStatusBadge from '../shared/SyncStatusBadge';

const initialForm = {
  name: '',
  goal: '',
  start_date: '',
  end_date: '',
};

function DraggablePlanningIssue({ issue, disabled = false, syncStatus = null }) {
  const drag = useDraggable({
    id: String(issue.id),
    disabled,
  });
  const issueDisplayKey = getTaskDisplayKey(issue);

  return (
    <div
      ref={drag.setNodeRef}
      className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-sm"
      style={drag.transform ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` } : undefined}
      {...drag.listeners}
      {...drag.attributes}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-text-dark">{issueDisplayKey ? `${issueDisplayKey} ` : ''}{issue.title}</p>
          <SyncStatusBadge status={syncStatus} />
        </div>
        <p className="text-xs text-text-muted">{issue.story_points || 0} SP - {issue.priority || 'Medium'}</p>
      </div>
    </div>
  );
}

function SprintDropZone({ children, disabled }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'sprint-drop-zone',
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-72 rounded-xl border border-dashed p-3 transition',
        isOver ? 'border-primary bg-blue-50' : 'border-border bg-slate-50',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function SprintPlanningModal({ open, projectId, sprint = null, onClose, onSaved }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [currentSprintId, setCurrentSprintId] = useState(sprint?.id || null);
  const [localBacklogIssues, setLocalBacklogIssues] = useState([]);
  const [localSprintIssues, setLocalSprintIssues] = useState([]);
  const [syncStatusByIssueId, setSyncStatusByIssueId] = useState({});
  const [assignmentSyncStatus, setAssignmentSyncStatus] = useState(null);
  const { issues: backlogIssues, refetch: refetchBacklog } = useBacklog(projectId, {}, { enabled: open && Boolean(projectId) });
  const { issues: sprintIssues, refetch: refetchSprintIssues } = useSprintIssues(currentSprintId, { enabled: open && Boolean(currentSprintId) });
  const { metrics, refetch: refetchMetrics } = useSprintMetrics(currentSprintId, { enabled: open && Boolean(currentSprintId) });
  const showToast = useUiStore((state) => state.showToast);
  const localSprintStoryPoints = useMemo(
    () => localSprintIssues.reduce((total, issue) => total + Number(issue.story_points || 0), 0),
    [localSprintIssues],
  );

  useEffect(() => {
    setLocalBacklogIssues(backlogIssues);
  }, [backlogIssues]);

  useEffect(() => {
    setLocalSprintIssues(sprintIssues);
  }, [sprintIssues]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCurrentSprintId(sprint?.id || null);
    setForm({
      name: sprint?.name || '',
      goal: sprint?.goal || '',
      start_date: sprint?.start_date ? String(sprint.start_date).slice(0, 10) : '',
      end_date: sprint?.end_date ? String(sprint.end_date).slice(0, 10) : '',
    });
    setErrors({});
    setAssignmentSyncStatus(null);
    setSyncStatusByIssueId({});
  }, [open, sprint]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Masukkan nama sprint.';
    }

    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      nextErrors.end_date = 'Tanggal selesai harus setelah tanggal mulai.';
    }

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  const saveSprint = async () => {
    if (!validateForm()) {
      return null;
    }

    const payload = {
      project_id: projectId,
      name: form.name.trim(),
      goal: form.goal.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };

    setSubmitting(true);

    try {
      const savedSprint = currentSprintId ? await updateSprint(currentSprintId, payload) : await createSprint(payload);
      setCurrentSprintId(savedSprint.id);
      showToast({ type: 'success', message: currentSprintId ? 'Sprint diperbarui.' : 'Sprint dibuat.' });
      await onSaved?.();
      return savedSprint;
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const refreshPlanningData = async () => {
    const refreshRequests = [refetchBacklog(), onSaved?.()];

    if (currentSprintId) {
      refreshRequests.push(refetchSprintIssues(), refetchMetrics());
    }

    await Promise.all(refreshRequests);
  };

  const markIssueSyncStatus = (issueId, status) => {
    setSyncStatusByIssueId((current) => ({
      ...current,
      [issueId]: status,
    }));
    setAssignmentSyncStatus(status);
  };

  const clearIssueSyncStatus = (issueId, status) => {
    window.setTimeout(() => {
      setSyncStatusByIssueId((current) => {
        if (current[issueId] !== status) {
          return current;
        }

        const next = { ...current };
        delete next[issueId];
        return next;
      });
      setAssignmentSyncStatus((current) => (current === status ? null : current));
    }, 1800);
  };

  const handleDragEnd = async (event) => {
    if (event.over?.id !== 'sprint-drop-zone' || !event.active?.id) {
      return;
    }

    let sprintId = currentSprintId;

    if (!sprintId) {
      const savedSprint = await saveSprint();
      sprintId = savedSprint?.id;
    }

    if (!sprintId) {
      return;
    }

    const issue = localBacklogIssues.find((item) => Number(item.id) === Number(event.active.id));

    if (!issue || localSprintIssues.some((item) => Number(item.id) === Number(issue.id))) {
      return;
    }

    const previousBacklogIssues = localBacklogIssues;
    const previousSprintIssues = localSprintIssues;

    setLocalBacklogIssues((current) => current.filter((item) => Number(item.id) !== Number(issue.id)));
    setLocalSprintIssues((current) => [...current, { ...issue, sprint_id: sprintId }]);
    markIssueSyncStatus(issue.id, 'syncing');

    try {
      await moveIssuesToSprint(sprintId, [Number(event.active.id)]);
      markIssueSyncStatus(issue.id, 'synced');
      showToast({ type: 'success', message: 'Issue masuk ke sprint.' });
      await refreshPlanningData();
      clearIssueSyncStatus(issue.id, 'synced');
    } catch (error) {
      setLocalBacklogIssues(previousBacklogIssues);
      setLocalSprintIssues(previousSprintIssues);
      markIssueSyncStatus(issue.id, 'failed');
      showToast({ type: 'error', message: getApiErrorMessage(error) });
      clearIssueSyncStatus(issue.id, 'failed');
    }
  };

  const handleSaveAndClose = async (event) => {
    event.preventDefault();
    const savedSprint = await saveSprint();

    if (savedSprint) {
      onClose?.();
    }
  };

  return (
    <Modal
      description="Buat atau edit sprint, lalu drag issue backlog ke area sprint."
      footer={
        <>
          <button className="btn-secondary" disabled={submitting} type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={submitting} form="sprint-planning-form" type="submit">
            {currentSprintId ? 'Save Sprint' : 'Create Sprint'}
          </button>
        </>
      }
      open={open}
      size="2xl"
      title={currentSprintId ? 'Sprint Planning' : 'Create Sprint'}
      onClose={onClose}
    >
      <form id="sprint-planning-form" noValidate onSubmit={handleSaveAndClose}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField error={errors.name} htmlFor="sprint-name" label="Sprint Name" required>
            <input
              className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
              id="sprint-name"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </FormField>
          <FormField htmlFor="sprint-goal" label="Goal">
            <input
              className="field mt-1"
              id="sprint-goal"
              value={form.goal}
              onChange={(event) => updateField('goal', event.target.value)}
            />
          </FormField>
          <FormField htmlFor="sprint-start" label="Start Date">
            <input
              className="field mt-1"
              id="sprint-start"
              type="date"
              value={form.start_date}
              onChange={(event) => updateField('start_date', event.target.value)}
            />
          </FormField>
          <FormField error={errors.end_date} htmlFor="sprint-end" label="End Date">
            <input
              className={`field mt-1 ${errors.end_date ? 'field-error' : ''}`}
              id="sprint-end"
              type="date"
              value={form.end_date}
              onChange={(event) => updateField('end_date', event.target.value)}
            />
          </FormField>
        </div>
      </form>

      {currentSprintId ? (
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="info-tile">
            <p className="label">Issues</p>
            <p className="mt-1 text-xl font-bold">{assignmentSyncStatus ? localSprintIssues.length : metrics?.total_issues ?? localSprintIssues.length}</p>
          </div>
          <div className="info-tile">
            <p className="label">Story Points</p>
            <p className="mt-1 text-xl font-bold">{assignmentSyncStatus ? localSprintStoryPoints : metrics?.total_story_points ?? localSprintStoryPoints}</p>
          </div>
          <div className="info-tile">
            <p className="label">Completed</p>
            <p className="mt-1 text-xl font-bold">{metrics?.completed_story_points ?? 0} SP</p>
          </div>
          <div className="info-tile">
            <p className="label">Window</p>
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" />
              {form.start_date || '-'} / {form.end_date || '-'}
            </p>
          </div>
        </div>
      ) : null}

      <DndContext onDragEnd={handleDragEnd}>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-text-dark">Backlog</h3>
              <div className="flex items-center gap-2">
                <SyncStatusBadge status={assignmentSyncStatus} />
                <span className="text-xs font-semibold text-text-muted">{localBacklogIssues.length} issues</span>
              </div>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border bg-slate-50 p-3">
              {localBacklogIssues.length ? (
                localBacklogIssues.map((issue) => (
                  <DraggablePlanningIssue key={issue.id} issue={issue} syncStatus={syncStatusByIssueId[issue.id]} />
                ))
              ) : (
                <p className="rounded-lg bg-white p-3 text-sm text-text-muted">Backlog kosong.</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-text-dark">Sprint Scope</h3>
              <span className="text-xs font-semibold text-text-muted">{localSprintIssues.length} issues</span>
            </div>
            <SprintDropZone disabled={!projectId}>
              {localSprintIssues.length ? (
                <div className="space-y-2">
                  {localSprintIssues.map((issue) => (
                    <DraggablePlanningIssue
                      key={issue.id}
                      disabled
                      issue={issue}
                      syncStatus={syncStatusByIssueId[issue.id]}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-56 items-center justify-center rounded-lg bg-white text-sm font-semibold text-text-muted">
                  <Plus className="mr-2 h-4 w-4" />
                  Drop backlog issue here
                </div>
              )}
            </SprintDropZone>
          </div>
        </div>
      </DndContext>
    </Modal>
  );
}

export default SprintPlanningModal;
