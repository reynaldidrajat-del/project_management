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
import { CalendarPlus, GripVertical, Plus, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import SprintPlanningModal from '../components/sprint/SprintPlanningModal';
import FormField from '../components/shared/FormField';
import SyncStatusBadge from '../components/shared/SyncStatusBadge';
import IssueTypeBadge from '../components/task/IssueTypeBadge';
import { useBacklog, useBacklogStats } from '../logic/hooks/useBacklog';
import { useEpics } from '../logic/hooks/useEpics';
import { useIssueTypes } from '../logic/hooks/useIssueTypes';
import { useProjects } from '../logic/hooks/useProjects';
import { useSprints } from '../logic/hooks/useSprints';
import { useUsers } from '../logic/hooks/useUsers';
import { useVirtualRows } from '../logic/hooks/useVirtualRows';
import { getTaskDisplayKey } from '../logic/helpers/taskDisplayHelper';
import { getApiErrorMessage } from '../logic/services/api';
import { moveIssuesToSprint, reorderBacklogIssue } from '../logic/services/backlogApi';
import { useUiStore } from '../store/uiStore';

const initialFilters = {
  search: '',
  issue_type_id: '',
  assignee_id: '',
  epic_id: '',
};

function SortableBacklogIssue({ issue, checked, epic, syncStatus, onCheckedChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(issue.id),
  });
  const issueDisplayKey = getTaskDisplayKey(issue);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} className={isDragging ? 'bg-blue-50 opacity-80' : ''} style={style}>
      <td className="w-10">
        <input checked={checked} type="checkbox" onChange={(event) => onCheckedChange(issue.id, event.target.checked)} />
      </td>
      <td className="w-12">
        <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-text-muted" type="button" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td>
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <IssueTypeBadge color={issue.issue_type_color} icon={issue.issue_type_icon} name={issue.issue_type_name} />
            {issueDisplayKey ? <span className="text-xs font-bold text-text-muted">{issueDisplayKey}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-text-dark">{issue.title}</p>
            <SyncStatusBadge status={syncStatus} />
          </div>
          <p className="text-xs text-text-muted">{issue.description || 'No description'}</p>
        </div>
      </td>
      <td>
        {issue.epic_name ? (
          <div className="min-w-40">
            <span className="badge bg-purple-100 text-purple-700">{issue.epic_name}</span>
            <div className="progress-track mt-2">
              <div className="progress-fill" style={{ width: `${epic?.progress || 0}%`, backgroundColor: epic?.epic_color || '#7C3AED' }} />
            </div>
          </div>
        ) : '-'}
      </td>
      <td>{issue.assignee_name || '-'}</td>
      <td><span className="badge bg-slate-100 text-slate-700">{issue.priority || 'Medium'}</span></td>
      <td className="font-semibold">{issue.story_points || 0}</td>
    </tr>
  );
}

function BacklogPage() {
  const [projectId, setProjectId] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedIssueIds, setSelectedIssueIds] = useState([]);
  const [targetSprintId, setTargetSprintId] = useState('');
  const [planningOpen, setPlanningOpen] = useState(false);
  const [localIssues, setLocalIssues] = useState([]);
  const [syncStatusByIssueId, setSyncStatusByIssueId] = useState({});
  const [pageSyncStatus, setPageSyncStatus] = useState(null);
  const { projects } = useProjects();
  const { users } = useUsers();
  const { issueTypes } = useIssueTypes(projectId, { enabled: Boolean(projectId) });
  const { epics } = useEpics(projectId, { enabled: Boolean(projectId) });
  const { sprints, refetch: refetchSprints } = useSprints(projectId, { state: 'FUTURE' }, { enabled: Boolean(projectId) });
  const { issues, loading, error, refetch } = useBacklog(projectId, filters, { enabled: Boolean(projectId) });
  const { stats, refetch: refetchStats } = useBacklogStats(projectId, { enabled: Boolean(projectId) });
  const showToast = useUiStore((state) => state.showToast);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setLocalIssues(issues);
    setSyncStatusByIssueId({});
    setPageSyncStatus(null);
  }, [issues]);

  const selectedSet = useMemo(() => new Set(selectedIssueIds.map(Number)), [selectedIssueIds]);
  const epicsById = useMemo(() => new Map(epics.map((epic) => [Number(epic.id), epic])), [epics]);
  const selectedStoryPoints = useMemo(
    () => localIssues.filter((issue) => selectedSet.has(Number(issue.id))).reduce((total, issue) => total + Number(issue.story_points || 0), 0),
    [localIssues, selectedSet],
  );
  const localStoryPoints = useMemo(
    () => localIssues.reduce((total, issue) => total + Number(issue.story_points || 0), 0),
    [localIssues],
  );
  const backlogRows = useVirtualRows(localIssues, {
    enabled: localIssues.length > 80,
    estimatedRowHeight: 86,
    overscan: 10,
  });

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setSelectedIssueIds([]);
  };

  const refreshBacklog = async () => {
    await Promise.all([refetch(), refetchStats(), refetchSprints()]);
  };

  const markIssueSyncStatus = (issueIds, status) => {
    const ids = Array.isArray(issueIds) ? issueIds : [issueIds];

    setSyncStatusByIssueId((current) => ({
      ...current,
      ...ids.reduce((statuses, issueId) => ({ ...statuses, [issueId]: status }), {}),
    }));
    setPageSyncStatus(status);
  };

  const clearIssueSyncStatus = (issueIds, status) => {
    const ids = Array.isArray(issueIds) ? issueIds : [issueIds];

    window.setTimeout(() => {
      setSyncStatusByIssueId((current) => {
        const next = { ...current };

        ids.forEach((issueId) => {
          if (next[issueId] === status) {
            delete next[issueId];
          }
        });

        return next;
      });
      setPageSyncStatus((current) => (current === status ? null : current));
    }, 1800);
  };

  const handleCheckedChange = (issueId, checked) => {
    setSelectedIssueIds((current) => {
      const nextIds = new Set(current.map(Number));

      if (checked) {
        nextIds.add(Number(issueId));
      } else {
        nextIds.delete(Number(issueId));
      }

      return Array.from(nextIds);
    });
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id || !projectId) {
      return;
    }

    const oldIndex = localIssues.findIndex((issue) => String(issue.id) === String(active.id));
    const newIndex = localIssues.findIndex((issue) => String(issue.id) === String(over.id));

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const previousIssues = localIssues;
    setLocalIssues((current) => arrayMove(current, oldIndex, newIndex));
    markIssueSyncStatus(Number(active.id), 'syncing');

    try {
      await reorderBacklogIssue(projectId, Number(active.id), newIndex);
      markIssueSyncStatus(Number(active.id), 'synced');
      showToast({ type: 'success', message: 'Backlog order diperbarui.' });
      await refreshBacklog();
      clearIssueSyncStatus(Number(active.id), 'synced');
    } catch (err) {
      setLocalIssues(previousIssues);
      markIssueSyncStatus(Number(active.id), 'failed');
      showToast({ type: 'error', message: getApiErrorMessage(err) });
      clearIssueSyncStatus(Number(active.id), 'failed');
    }
  };

  const handleMoveToSprint = async () => {
    if (!targetSprintId || !selectedIssueIds.length) {
      showToast({ type: 'error', message: 'Pilih sprint dan minimal satu issue.' });
      return;
    }

    const issueIds = selectedIssueIds.map(Number);
    const previousIssues = localIssues;
    const previousSelectedIssueIds = selectedIssueIds;

    setLocalIssues((current) => current.filter((issue) => !issueIds.includes(Number(issue.id))));
    setSelectedIssueIds([]);
    markIssueSyncStatus(issueIds, 'syncing');

    try {
      await moveIssuesToSprint(targetSprintId, issueIds);
      markIssueSyncStatus(issueIds, 'synced');
      setSelectedIssueIds([]);
      await refreshBacklog();
      showToast({ type: 'success', message: 'Issue dipindahkan ke sprint.' });
      clearIssueSyncStatus(issueIds, 'synced');
    } catch (err) {
      setLocalIssues(previousIssues);
      setSelectedIssueIds(previousSelectedIssueIds);
      markIssueSyncStatus(issueIds, 'failed');
      showToast({ type: 'error', message: getApiErrorMessage(err) });
      clearIssueSyncStatus(issueIds, 'failed');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Agile Planning</p>
          <h1 className="page-title">Backlog</h1>
          <p className="page-description">Prioritaskan issue, filter by type/assignee/epic, dan pindahkan scope ke sprint planning.</p>
        </div>
        <button className="btn-primary" disabled={!projectId} type="button" onClick={() => setPlanningOpen(true)}>
          <CalendarPlus className="h-4 w-4" />
          Sprint Planning
        </button>
      </div>

      <div className="toolbar grid md:grid-cols-2 xl:grid-cols-6">
        <FormField htmlFor="backlog-project" label="Project">
          <select className="field mt-1" id="backlog-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="backlog-search" label="Search">
          <input className="field mt-1" id="backlog-search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} />
        </FormField>
        <FormField htmlFor="backlog-type" label="Issue Type">
          <select className="field mt-1" id="backlog-type" value={filters.issue_type_id} onChange={(event) => updateFilter('issue_type_id', event.target.value)}>
            <option value="">All types</option>
            {issueTypes.map((issueType) => (
              <option key={issueType.id} value={issueType.id}>{issueType.name}</option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="backlog-assignee" label="Assignee">
          <select className="field mt-1" id="backlog-assignee" value={filters.assignee_id} onChange={(event) => updateFilter('assignee_id', event.target.value)}>
            <option value="">All assignees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="backlog-epic" label="Epic">
          <select className="field mt-1" id="backlog-epic" value={filters.epic_id} onChange={(event) => updateFilter('epic_id', event.target.value)}>
            <option value="">All epics</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>{epic.epic_name}</option>
            ))}
          </select>
        </FormField>
        <button className="btn-secondary self-end" type="button" onClick={() => setFilters(initialFilters)}>
          Reset
        </button>
      </div>

      {projectId ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="metric-card">
            <p className="label">Backlog Issues</p>
            <p className="mt-2 text-2xl font-bold">{pageSyncStatus ? localIssues.length : stats?.total_issues ?? localIssues.length}</p>
          </div>
          <div className="metric-card">
            <p className="label">Story Points</p>
            <p className="mt-2 text-2xl font-bold">{pageSyncStatus ? localStoryPoints : stats?.total_story_points ?? localStoryPoints}</p>
          </div>
          <div className="metric-card">
            <p className="label">Epics</p>
            <p className="mt-2 text-2xl font-bold">{stats?.epic_count ?? epics.length}</p>
          </div>
          <div className="metric-card">
            <p className="label">Selected</p>
            <p className="mt-2 text-2xl font-bold">{selectedIssueIds.length} / {selectedStoryPoints} SP</p>
          </div>
        </div>
      ) : null}

      {selectedIssueIds.length ? (
        <div className="toolbar justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold text-text-dark">{selectedIssueIds.length} issue selected</div>
            <SyncStatusBadge status={pageSyncStatus} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field w-64" value={targetSprintId} onChange={(event) => setTargetSprintId(event.target.value)}>
              <option value="">Select future sprint</option>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
              ))}
            </select>
            <button className="btn-primary" type="button" onClick={handleMoveToSprint}>
              <Send className="h-4 w-4" />
              Move to Sprint
            </button>
            <button className="btn-secondary" type="button" onClick={() => setSelectedIssueIds([])}>Clear</button>
          </div>
        </div>
      ) : null}

      {!projectId ? <div className="empty-state">Pilih project untuk melihat backlog.</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}
      {loading ? <div className="card p-6 text-text-muted">Loading backlog...</div> : null}
      {!selectedIssueIds.length && pageSyncStatus ? (
        <div className="toolbar justify-between">
          <SyncStatusBadge status={pageSyncStatus} />
          <p className="text-sm text-text-muted">Backlog changes are applied immediately and restored if the backend rejects them.</p>
        </div>
      ) : null}

      {projectId ? (
        <div className="table-shell">
          <div
            ref={backlogRows.containerRef}
            className="table-scroll"
            style={backlogRows.isVirtualized ? { maxHeight: '68vh' } : undefined}
            onScroll={backlogRows.onScroll}
          >
            <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={localIssues.map((issue) => String(issue.id))} strategy={verticalListSortingStrategy}>
                <table className="data-table min-w-[1080px]">
                  <thead>
                    <tr>
                      <th />
                      <th />
                      <th>Issue</th>
                      <th>Epic</th>
                      <th>Assignee</th>
                      <th>Priority</th>
                      <th>SP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localIssues.length ? (
                      <>
                        {backlogRows.topPadding ? (
                          <tr aria-hidden="true">
                            <td colSpan="7" style={{ border: 0, height: backlogRows.topPadding, padding: 0 }} />
                          </tr>
                        ) : null}
                        {backlogRows.virtualRows.map(({ item: issue }) => (
                          <SortableBacklogIssue
                            key={issue.id}
                            checked={selectedSet.has(Number(issue.id))}
                            epic={epicsById.get(Number(issue.epic_id))}
                            issue={issue}
                            syncStatus={syncStatusByIssueId[issue.id]}
                            onCheckedChange={handleCheckedChange}
                          />
                        ))}
                        {backlogRows.bottomPadding ? (
                          <tr aria-hidden="true">
                            <td colSpan="7" style={{ border: 0, height: backlogRows.bottomPadding, padding: 0 }} />
                          </tr>
                        ) : null}
                      </>
                    ) : (
                      <tr>
                        <td className="text-text-muted" colSpan="7">Backlog kosong.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      ) : null}

      <SprintPlanningModal
        open={planningOpen}
        projectId={projectId}
        onClose={() => setPlanningOpen(false)}
        onSaved={refreshBacklog}
      />
    </div>
  );
}

export default BacklogPage;
