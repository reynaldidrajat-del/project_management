import { DndContext, useDroppable } from '@dnd-kit/core';
import { CalendarCheck, CheckCircle2, Columns3, PlayCircle, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import SprintPlanningModal from '../components/sprint/SprintPlanningModal';
import SyncStatusBadge from '../components/shared/SyncStatusBadge';
import TaskCard from '../components/task/TaskCard';
import TaskDetailModal from '../components/task/LazyTaskDetailModal';
import FormField from '../components/shared/FormField';
import { useEpics } from '../logic/hooks/useEpics';
import { useProjects } from '../logic/hooks/useProjects';
import { useActiveSprint, useSprintIssues, useSprintMetrics, useSprints } from '../logic/hooks/useSprints';
import { useTaskLabels } from '../logic/hooks/useTaskLabels';
import { useUsers } from '../logic/hooks/useUsers';
import { useWorkflowDetails, useWorkflows } from '../logic/hooks/useWorkflows';
import { getApiErrorMessage } from '../logic/services/api';
import { completeSprint, startSprint } from '../logic/services/sprintApi';
import { updateTask } from '../logic/services/taskApi';
import { executeIssueTransition } from '../logic/services/workflowApi';
import { useUiStore } from '../store/uiStore';

const mapWorkflowCategoryToStatus = (category) => {
  if (category === 'TODO') {
    return 'Not Started';
  }

  if (category === 'DONE') {
    return 'Done';
  }

  return 'In Progress';
};

const getIssueSwimlaneKey = (issue, swimlane) => {
  if (swimlane === 'assignee') {
    return issue.assignee_name || 'Unassigned';
  }

  if (swimlane === 'epic') {
    return issue.epic_name || 'No Epic';
  }

  return 'Sprint';
};

function SprintBoardColumn({ id, title, color, issues = [], syncStatusByIssueId = {}, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={[
        'flex min-h-80 min-w-72 flex-1 flex-col rounded-xl border bg-slate-50 shadow-sm',
        isOver ? 'border-primary bg-blue-50' : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-center justify-between rounded-t-xl border-b border-border bg-white px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color || '#CBD5E1' }} />
          <h3 className="truncate font-bold text-text-dark">{title}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-text-muted">{issues.length}</span>
      </div>
      <div className="flex-1 space-y-3 p-3">
        {issues.length ? (
          issues.map((issue) => (
            <TaskCard
              key={issue.id}
              draggable
              syncStatus={syncStatusByIssueId[issue.id]}
              task={issue}
              onClick={() => onTaskClick(issue)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white p-4 text-center text-sm text-text-muted">Drop issue here</div>
        )}
      </div>
    </section>
  );
}

function SprintBoardPage() {
  const [projectId, setProjectId] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningSprint, setPlanningSprint] = useState(null);
  const [swimlane, setSwimlane] = useState('none');
  const [boardIssues, setBoardIssues] = useState([]);
  const [syncStatusByIssueId, setSyncStatusByIssueId] = useState({});
  const [boardSyncStatus, setBoardSyncStatus] = useState(null);
  const { projects } = useProjects();
  const { users } = useUsers();
  const { labels } = useTaskLabels(projectId);
  const { sprint: activeSprint, loading: activeLoading, refetch: refetchActiveSprint } = useActiveSprint(projectId, { enabled: Boolean(projectId) });
  const { sprints, refetch: refetchSprints } = useSprints(projectId, {}, { enabled: Boolean(projectId) });
  const effectiveSprintId = selectedSprintId || activeSprint?.id || '';
  const currentSprint = useMemo(
    () => sprints.find((sprint) => Number(sprint.id) === Number(effectiveSprintId)) || activeSprint || null,
    [activeSprint, effectiveSprintId, sprints],
  );
  const { issues, loading, error, refetch: refetchIssues } = useSprintIssues(effectiveSprintId, { enabled: Boolean(effectiveSprintId) });
  const { metrics, refetch: refetchMetrics } = useSprintMetrics(effectiveSprintId, { enabled: Boolean(effectiveSprintId) });
  const { workflows } = useWorkflows(projectId || null, { enabled: Boolean(projectId) });
  const defaultWorkflow = workflows.find((workflow) => workflow.is_default) || workflows[0] || null;
  const { workflow } = useWorkflowDetails(defaultWorkflow?.id, { enabled: Boolean(defaultWorkflow?.id) });
  const { epics } = useEpics(projectId, { enabled: Boolean(projectId) });
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    setBoardIssues(issues);
    setSyncStatusByIssueId({});
    setBoardSyncStatus(null);
  }, [issues]);

  const states = useMemo(() => {
    const workflowStates = workflow?.states || [];

    if (workflowStates.length) {
      return workflowStates.map((state) => ({
        id: `workflow:${state.id}`,
        workflow_state_id: state.id,
        name: state.name,
        category: state.category,
        color: state.color,
      }));
    }

    return [
      { id: 'status:Not Started', name: 'Not Started', status: 'Not Started', category: 'TODO', color: '#94A3B8' },
      { id: 'status:In Progress', name: 'In Progress', status: 'In Progress', category: 'IN_PROGRESS', color: '#2563EB' },
      { id: 'status:Waiting Review', name: 'Waiting Review', status: 'Waiting Review', category: 'IN_PROGRESS', color: '#F59E0B' },
      { id: 'status:Done', name: 'Done', status: 'Done', category: 'DONE', color: '#16A34A' },
    ];
  }, [workflow]);

  const transitionsByPath = useMemo(() => {
    const map = new Map();

    (workflow?.transitions || []).forEach((transition) => {
      map.set(`${transition.from_state_id}:${transition.to_state_id}`, transition);
    });

    return map;
  }, [workflow]);

  const issuesBySwimlane = useMemo(() => {
    const groups = new Map();
    const epicsById = new Map(epics.map((epic) => [Number(epic.id), epic]));

    boardIssues.forEach((issue) => {
      const epic = epicsById.get(Number(issue.epic_id));
      const enrichedIssue = {
        ...issue,
        epic_progress: epic?.progress,
        epic_color: issue.epic_color || epic?.epic_color,
      };
      const key = swimlane === 'none' ? 'Sprint' : getIssueSwimlaneKey(issue, swimlane);
      const currentIssues = groups.get(key) || [];
      currentIssues.push(enrichedIssue);
      groups.set(key, currentIssues);
    });

    return Array.from(groups.entries()).map(([name, groupedIssues]) => ({ name, issues: groupedIssues }));
  }, [boardIssues, epics, swimlane]);

  const refreshSprintBoard = async () => {
    await Promise.all([refetchActiveSprint(), refetchSprints(), refetchIssues(), refetchMetrics()]);
  };

  const markIssueSyncStatus = (issueId, status) => {
    setSyncStatusByIssueId((current) => ({
      ...current,
      [issueId]: status,
    }));
    setBoardSyncStatus(status);
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
      setBoardSyncStatus((current) => (current === status ? null : current));
    }, 1800);
  };

  const patchBoardIssue = (issueId, patch) => {
    setBoardIssues((current) =>
      current.map((issue) => (Number(issue.id) === Number(issueId) ? { ...issue, ...patch } : issue)),
    );
    setSelectedIssue((current) => (Number(current?.id) === Number(issueId) ? { ...current, ...patch } : current));
  };

  const openPlanning = (sprint = null) => {
    setPlanningSprint(sprint);
    setPlanningOpen(true);
  };

  const handleStartSprint = async (sprint) => {
    try {
      await startSprint(sprint.id);
      await refreshSprintBoard();
      setSelectedSprintId(String(sprint.id));
      showToast({ type: 'success', message: 'Sprint started.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleCompleteSprint = async () => {
    if (!currentSprint || !window.confirm(`Complete sprint "${currentSprint.name}"?`)) {
      return;
    }

    try {
      await completeSprint(currentSprint.id, {});
      setSelectedSprintId('');
      await refreshSprintBoard();
      showToast({ type: 'success', message: 'Sprint completed.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleDragEnd = async (event) => {
    if (!event.over || !event.active?.id) {
      return;
    }

    const issue = boardIssues.find((item) => Number(item.id) === Number(event.active.id));
    const targetStateId = String(event.over.id).split('::').pop();
    const targetState = states.find((state) => state.id === targetStateId);

    if (!issue || !targetState) {
      return;
    }

    if (
      (targetState.workflow_state_id && Number(issue.workflow_state_id) === Number(targetState.workflow_state_id)) ||
      (!targetState.workflow_state_id && issue.status === targetState.status)
    ) {
      return;
    }

    const previousIssues = boardIssues;
    const optimisticPatch = targetState.workflow_state_id
      ? {
          status: mapWorkflowCategoryToStatus(targetState.category),
          workflow_state_color: targetState.color,
          workflow_state_id: targetState.workflow_state_id,
          workflow_state_name: targetState.name,
        }
      : { status: targetState.status };

    patchBoardIssue(issue.id, optimisticPatch);
    markIssueSyncStatus(issue.id, 'syncing');

    try {
      let updatedIssue = null;

      if (targetState.workflow_state_id) {
        const transition = issue.workflow_state_id
          ? transitionsByPath.get(`${issue.workflow_state_id}:${targetState.workflow_state_id}`)
          : null;

        if (transition) {
          updatedIssue = await executeIssueTransition(issue.id, transition.id);
        } else {
          updatedIssue = await updateTask(issue.id, {
            workflow_state_id: targetState.workflow_state_id,
            status: mapWorkflowCategoryToStatus(targetState.category),
          });
        }
      } else {
        updatedIssue = await updateTask(issue.id, { status: targetState.status });
      }

      if (updatedIssue) {
        patchBoardIssue(issue.id, updatedIssue);
      }

      markIssueSyncStatus(issue.id, 'synced');
      await refreshSprintBoard();
      showToast({ type: 'success', message: 'Sprint board diperbarui.' });
      clearIssueSyncStatus(issue.id, 'synced');
    } catch (err) {
      setBoardIssues(previousIssues);
      setSelectedIssue((current) => (Number(current?.id) === Number(issue.id) ? issue : current));
      markIssueSyncStatus(issue.id, 'failed');
      showToast({ type: 'error', message: getApiErrorMessage(err) });
      clearIssueSyncStatus(issue.id, 'failed');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Agile Execution</p>
          <h1 className="page-title">Sprint Board</h1>
          <p className="page-description">Board sprint aktif dengan kolom workflow state, swimlane, dan drag issue antar state.</p>
        </div>
        <div className="action-row">
          <button className="btn-secondary" disabled={!projectId} type="button" onClick={() => openPlanning(currentSprint)}>
            <CalendarCheck className="h-4 w-4" />
            Plan Sprint
          </button>
          <button className="btn-primary" disabled={!projectId} type="button" onClick={() => openPlanning(null)}>
            <Plus className="h-4 w-4" />
            New Sprint
          </button>
        </div>
      </div>

      <div className="toolbar grid md:grid-cols-2 xl:grid-cols-4">
        <FormField htmlFor="sprint-board-project" label="Project">
          <select className="field mt-1" id="sprint-board-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="sprint-board-sprint" label="Sprint">
          <select className="field mt-1" id="sprint-board-sprint" value={effectiveSprintId} onChange={(event) => setSelectedSprintId(event.target.value)}>
            <option value="">Active sprint</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>{sprint.name} ({sprint.state})</option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="sprint-board-swimlane" label="Swimlane">
          <select className="field mt-1" id="sprint-board-swimlane" value={swimlane} onChange={(event) => setSwimlane(event.target.value)}>
            <option value="none">None</option>
            <option value="assignee">Assignee</option>
            <option value="epic">Epic</option>
          </select>
        </FormField>
        <button className="btn-secondary self-end" type="button" onClick={refreshSprintBoard}>
          Refresh
        </button>
      </div>

      {boardSyncStatus ? (
        <div className="toolbar justify-between">
          <SyncStatusBadge status={boardSyncStatus} />
          <p className="text-sm text-text-muted">Perubahan board disimpan otomatis dan akan rollback jika backend menolak update.</p>
        </div>
      ) : null}

      {projectId && !activeLoading && !currentSprint ? (
        <div className="empty-state">Belum ada sprint aktif. Buat sprint baru atau start future sprint.</div>
      ) : null}

      {currentSprint ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="metric-card">
            <p className="label">Sprint</p>
            <p className="mt-2 text-lg font-bold">{currentSprint.name}</p>
            <span className="badge mt-2 bg-slate-100 text-slate-700">{currentSprint.state}</span>
          </div>
          <div className="metric-card">
            <p className="label">Issues</p>
            <p className="mt-2 text-2xl font-bold">{metrics?.total_issues ?? boardIssues.length}</p>
          </div>
          <div className="metric-card">
            <p className="label">Story Points</p>
            <p className="mt-2 text-2xl font-bold">{metrics?.total_story_points ?? currentSprint.total_story_points ?? 0}</p>
          </div>
          <div className="metric-card">
            <p className="label">Actions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {currentSprint.state === 'FUTURE' ? (
                <button className="btn-secondary py-1" type="button" onClick={() => handleStartSprint(currentSprint)}>
                  <PlayCircle className="h-4 w-4" />
                  Start
                </button>
              ) : null}
              {currentSprint.state === 'ACTIVE' ? (
                <button className="btn-secondary py-1 text-success" type="button" onClick={handleCompleteSprint}>
                  <CheckCircle2 className="h-4 w-4" />
                  Complete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div className="card p-6 text-danger">{error}</div> : null}
      {loading ? <div className="card p-6 text-text-muted">Loading sprint board...</div> : null}

      {currentSprint ? (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="space-y-5">
            {issuesBySwimlane.length ? (
              issuesBySwimlane.map((lane) => (
                <section key={lane.name} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                  {swimlane !== 'none' ? (
                    <div className="mb-3 flex items-center gap-2">
                      <Columns3 className="h-4 w-4 text-primary" />
                      <h2 className="font-bold text-text-dark">{lane.name}</h2>
                    </div>
                  ) : null}
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {states.map((state) => (
                      <SprintBoardColumn
                        key={`${lane.name}:${state.id}`}
                        color={state.color}
                        id={`${lane.name}::${state.id}`}
                        issues={lane.issues.filter((issue) =>
                          state.workflow_state_id
                            ? Number(issue.workflow_state_id) === Number(state.workflow_state_id)
                            : issue.status === state.status,
                        )}
                        syncStatusByIssueId={syncStatusByIssueId}
                        title={state.name}
                        onTaskClick={setSelectedIssue}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="empty-state">Sprint belum memiliki issue.</div>
            )}
          </div>
        </DndContext>
      ) : null}

      <SprintPlanningModal
        open={planningOpen}
        projectId={projectId}
        sprint={planningSprint}
        onClose={() => setPlanningOpen(false)}
        onSaved={refreshSprintBoard}
      />

      <TaskDetailModal
        labels={labels}
        projects={projects}
        task={selectedIssue}
        tasks={boardIssues}
        users={users}
        onClose={() => setSelectedIssue(null)}
        onSaved={refreshSprintBoard}
      />
    </div>
  );
}

export default SprintBoardPage;
