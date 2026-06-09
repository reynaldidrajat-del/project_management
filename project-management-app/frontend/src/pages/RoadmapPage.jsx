import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { CalendarRange, Flag, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import FormField from '../components/shared/FormField';
import Modal from '../components/shared/Modal';
import { useEpics } from '../logic/hooks/useEpics';
import { useProjects } from '../logic/hooks/useProjects';
import { useVersions } from '../logic/hooks/useVersions';
import { getApiErrorMessage } from '../logic/services/api';
import { createEpic, updateEpic } from '../logic/services/epicApi';
import { getIssueLinks } from '../logic/services/issueLinkApi';
import { createVersion } from '../logic/services/versionApi';
import { useUiStore } from '../store/uiStore';

const DAY_MS = 24 * 60 * 60 * 1000;
const ROADMAP_LEFT_COLUMN_WIDTH = 220;
const ROADMAP_ROW_HEIGHT = 104;

const DEPENDENCY_COLORS = {
  blocks: '#DC2626',
  is_blocked_by: '#DC2626',
  relates_to: '#64748B',
  duplicates: '#F59E0B',
  is_duplicated_by: '#F59E0B',
};

const initialEpicForm = {
  epic_name: '',
  description: '',
  epic_color: '#6554C0',
  start_date: '',
  target_end_date: '',
};

const initialVersionForm = {
  name: '',
  description: '',
  start_date: '',
  release_date: '',
};

const toDateKey = (date) => date.toISOString().slice(0, 10);

const addDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

const addMonths = (date, months) => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};

const getTimelineCells = (zoom) => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(1);
  start.setMonth(start.getMonth() - 1);

  const cellCount = zoom === 'quarters' ? 6 : zoom === 'weeks' ? 16 : 8;

  return Array.from({ length: cellCount }, (_, index) => {
    if (zoom === 'quarters') {
      const date = addMonths(start, index * 3);
      const endDate = addMonths(date, 3);
      endDate.setDate(endDate.getDate() - 1);

      return {
        key: toDateKey(date),
        label: `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`,
        start_date: toDateKey(date),
        end_date: toDateKey(endDate),
      };
    }

    if (zoom === 'weeks') {
      const date = new Date(today);
      date.setDate(today.getDate() + index * 7 - 14);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 6);

      return {
        key: toDateKey(date),
        label: `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })}`,
        start_date: toDateKey(date),
        end_date: toDateKey(endDate),
      };
    }

    const date = addMonths(start, index);
    const endDate = addMonths(date, 1);
    endDate.setDate(endDate.getDate() - 1);

    return {
      key: toDateKey(date),
      label: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      start_date: toDateKey(date),
      end_date: toDateKey(endDate),
    };
  });
};

const getDurationDays = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 14;
  }

  return Math.max(1, Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / DAY_MS));
};

const getEpicTimelineSpan = (epic, cells) => {
  const startDate = epic.start_date || cells[0]?.start_date;
  const endDate = epic.target_end_date || addDays(startDate, 14);
  const matchingIndexes = cells
    .map((cell, index) => (endDate >= cell.start_date && startDate <= cell.end_date ? index : -1))
    .filter((index) => index >= 0);

  const startIndex = matchingIndexes[0] ?? 0;
  const endIndex = matchingIndexes[matchingIndexes.length - 1] ?? startIndex;

  return { endDate, endIndex, startDate, startIndex };
};

function RoadmapDropCell({ cell }) {
  const { setNodeRef, isOver } = useDroppable({ id: cell.key });

  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-12 border-r border-border px-2 py-2 text-xs font-semibold text-text-muted last:border-r-0',
        isOver ? 'bg-blue-50' : 'bg-slate-50',
      ].join(' ')}
    >
      {cell.label}
    </div>
  );
}

function RoadmapEpicBar({ epic, cells, onEdit }) {
  const drag = useDraggable({ id: String(epic.id) });
  const { endIndex, startIndex } = getEpicTimelineSpan(epic, cells);
  const gridColumn = `${startIndex + 1} / ${Math.max(startIndex + 2, endIndex + 2)}`;

  return (
    <button
      ref={drag.setNodeRef}
      className="relative z-10 my-2 min-h-14 rounded-lg px-3 py-2 text-left text-white shadow-sm transition hover:brightness-95"
      style={{
        backgroundColor: epic.epic_color || '#6554C0',
        gridColumn,
        transform: drag.transform ? `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` : undefined,
      }}
      type="button"
      {...drag.listeners}
      {...drag.attributes}
      onDoubleClick={() => onEdit(epic)}
    >
      <p className="truncate text-sm font-bold">{epic.epic_name}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/30">
        <div className="h-full rounded-full bg-white" style={{ width: `${epic.progress || 0}%` }} />
      </div>
      <p className="mt-1 text-xs font-semibold text-white/85">{epic.progress || 0}% complete</p>
    </button>
  );
}

function RoadmapDependencyOverlay({ cells, epics, links }) {
  if (!links.length || !epics.length) {
    return null;
  }

  const epicsByIssueId = new Map(
    epics
      .map((epic, index) => [
        Number(epic.issue_id),
        {
          epic,
          index,
          span: getEpicTimelineSpan(epic, cells),
        },
      ])
      .filter(([issueId]) => Number.isInteger(issueId)),
  );
  const height = epics.length * ROADMAP_ROW_HEIGHT;
  const lines = links
    .map((link) => {
      const source = epicsByIssueId.get(Number(link.source_issue_id));
      const target = epicsByIssueId.get(Number(link.target_issue_id));

      if (!source || !target || source.index === target.index) {
        return null;
      }

      const sourceBeforeTarget = source.index <= target.index;
      const sourceAnchor = sourceBeforeTarget ? source.span.endIndex + 1 : source.span.startIndex;
      const targetAnchor = sourceBeforeTarget ? target.span.startIndex : target.span.endIndex + 1;
      const x1 = Math.max(0, Math.min(100, (sourceAnchor / cells.length) * 100));
      const x2 = Math.max(0, Math.min(100, (targetAnchor / cells.length) * 100));
      const y1 = source.index * ROADMAP_ROW_HEIGHT + ROADMAP_ROW_HEIGHT / 2;
      const y2 = target.index * ROADMAP_ROW_HEIGHT + ROADMAP_ROW_HEIGHT / 2;
      const midX = (x1 + x2) / 2;

      return {
        color: DEPENDENCY_COLORS[link.link_type] || '#64748B',
        d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
        id: `${link.source_issue_id}:${link.target_issue_id}:${link.link_type}`,
      };
    })
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-0 z-20"
      preserveAspectRatio="none"
      style={{ height, left: ROADMAP_LEFT_COLUMN_WIDTH, right: 0 }}
      viewBox={`0 0 100 ${height}`}
    >
      {lines.map((line) => (
        <path
          key={line.id}
          d={line.d}
          fill="none"
          opacity="0.7"
          stroke={line.color}
          strokeDasharray="6 5"
          strokeLinecap="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function RoadmapPage() {
  const [projectId, setProjectId] = useState('');
  const [zoom, setZoom] = useState('months');
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState(null);
  const [epicForm, setEpicForm] = useState(initialEpicForm);
  const [versionForm, setVersionForm] = useState(initialVersionForm);
  const [errors, setErrors] = useState({});
  const [dependencyLinks, setDependencyLinks] = useState([]);
  const [dependencyError, setDependencyError] = useState('');
  const { projects } = useProjects();
  const { epics, loading, error, refetch: refetchEpics } = useEpics(projectId, { enabled: Boolean(projectId) });
  const { versions, refetch: refetchVersions } = useVersions(projectId, {}, { enabled: Boolean(projectId) });
  const cells = useMemo(() => getTimelineCells(zoom), [zoom]);
  const epicIssueIds = useMemo(() => epics.map((epic) => Number(epic.issue_id)).filter((issueId) => Number.isInteger(issueId)), [epics]);
  const epicIssueIdKey = epicIssueIds.join(',');
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    let ignore = false;

    const loadDependencyLinks = async () => {
      if (!projectId || !epicIssueIds.length) {
        setDependencyLinks([]);
        setDependencyError('');
        return;
      }

      try {
        const issueIdSet = new Set(epicIssueIds);
        const linkGroups = await Promise.all(epicIssueIds.map((issueId) => getIssueLinks(issueId)));
        const seenPairs = new Set();
        const nextLinks = linkGroups
          .flat()
          .filter((link) => issueIdSet.has(Number(link.source_issue_id)) && issueIdSet.has(Number(link.target_issue_id)))
          .filter((link) => {
            const pairKey = [Number(link.source_issue_id), Number(link.target_issue_id)].sort((a, b) => a - b).join(':');

            if (seenPairs.has(pairKey)) {
              return false;
            }

            seenPairs.add(pairKey);
            return true;
          });

        if (!ignore) {
          setDependencyLinks(nextLinks);
          setDependencyError('');
        }
      } catch (err) {
        if (!ignore) {
          setDependencyLinks([]);
          setDependencyError(getApiErrorMessage(err));
        }
      }
    };

    loadDependencyLinks();

    return () => {
      ignore = true;
    };
  }, [epicIssueIdKey, epicIssueIds, projectId]);

  const closeEpicModal = () => {
    setEpicModalOpen(false);
    setEditingEpic(null);
    setEpicForm(initialEpicForm);
    setErrors({});
  };

  const openEpicModal = (epic = null) => {
    setEditingEpic(epic);
    setEpicForm({
      epic_name: epic?.epic_name || '',
      description: epic?.issue_description || '',
      epic_color: epic?.epic_color || '#6554C0',
      start_date: epic?.start_date || '',
      target_end_date: epic?.target_end_date || '',
    });
    setErrors({});
    setEpicModalOpen(true);
  };

  const handleEpicSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = {};

    if (!epicForm.epic_name.trim()) {
      nextErrors.epic_name = 'Masukkan nama epic.';
    }

    if (epicForm.start_date && epicForm.target_end_date && epicForm.start_date > epicForm.target_end_date) {
      nextErrors.target_end_date = 'Target end harus setelah start.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    const payload = {
      project_id: projectId,
      epic_name: epicForm.epic_name.trim(),
      description: epicForm.description.trim() || null,
      epic_color: epicForm.epic_color,
      start_date: epicForm.start_date || null,
      target_end_date: epicForm.target_end_date || null,
    };

    try {
      if (editingEpic) {
        await updateEpic(editingEpic.id, payload);
      } else {
        await createEpic(payload);
      }

      closeEpicModal();
      await refetchEpics();
      showToast({ type: 'success', message: editingEpic ? 'Epic diperbarui.' : 'Epic dibuat.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleVersionSubmit = async (event) => {
    event.preventDefault();

    if (!versionForm.name.trim()) {
      setErrors({ name: 'Masukkan nama version.' });
      return;
    }

    try {
      await createVersion({
        project_id: projectId,
        name: versionForm.name.trim(),
        description: versionForm.description.trim() || null,
        start_date: versionForm.start_date || null,
        release_date: versionForm.release_date || null,
      });
      setVersionForm(initialVersionForm);
      setVersionModalOpen(false);
      await refetchVersions();
      showToast({ type: 'success', message: 'Version dibuat.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  const handleDragEnd = async (event) => {
    if (!event.over || !event.active?.id) {
      return;
    }

    const epic = epics.find((item) => Number(item.id) === Number(event.active.id));
    const targetCell = cells.find((cell) => cell.key === event.over.id);

    if (!epic || !targetCell) {
      return;
    }

    const durationDays = getDurationDays(epic.start_date, epic.target_end_date);

    try {
      await updateEpic(epic.id, {
        start_date: targetCell.start_date,
        target_end_date: addDays(targetCell.start_date, durationDays),
      });
      await refetchEpics();
      showToast({ type: 'success', message: 'Epic timeline diperbarui.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Planning</p>
          <h1 className="page-title">Roadmap</h1>
          <p className="page-description">Timeline epics dan versions untuk melihat arah release, progress, dan dependensi delivery.</p>
        </div>
        <div className="action-row">
          <button className="btn-secondary" disabled={!projectId} type="button" onClick={() => setVersionModalOpen(true)}>
            <Flag className="h-4 w-4" />
            Version
          </button>
          <button className="btn-primary" disabled={!projectId} type="button" onClick={() => openEpicModal()}>
            <Plus className="h-4 w-4" />
            Epic
          </button>
        </div>
      </div>

      <div className="toolbar grid md:grid-cols-2 xl:grid-cols-3">
        <FormField htmlFor="roadmap-project" label="Project">
          <select className="field mt-1" id="roadmap-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </FormField>
        <FormField htmlFor="roadmap-zoom" label="Zoom">
          <select className="field mt-1" id="roadmap-zoom" value={zoom} onChange={(event) => setZoom(event.target.value)}>
            <option value="quarters">Quarters</option>
            <option value="months">Months</option>
            <option value="weeks">Weeks</option>
          </select>
        </FormField>
        <button className="btn-secondary self-end" type="button" onClick={() => Promise.all([refetchEpics(), refetchVersions()])}>
          Refresh
        </button>
      </div>

      {!projectId ? <div className="empty-state">Pilih project untuk membuka roadmap.</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}
      {loading ? <div className="card p-6 text-text-muted">Loading roadmap...</div> : null}

      {projectId ? (
        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-title">Timeline</h2>
                <p className="section-subtitle">Drag epic ke cell timeline untuk reschedule. Double click epic untuk edit detail.</p>
              </div>
              <span className="badge bg-slate-100 text-slate-700">{epics.length} epics / {versions.length} versions</span>
            </div>
          </div>

          <DndContext onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid border-b border-border" style={{ gridTemplateColumns: `220px repeat(${cells.length}, minmax(120px, 1fr))` }}>
                  <div className="border-r border-border bg-slate-100 px-4 py-2 text-xs font-bold uppercase text-text-muted">Work Item</div>
                  {cells.map((cell) => <RoadmapDropCell key={cell.key} cell={cell} />)}
                </div>

                {versions.length ? (
                  <div className="grid border-b border-border" style={{ gridTemplateColumns: `220px repeat(${cells.length}, minmax(120px, 1fr))` }}>
                    <div className="border-r border-border px-4 py-3">
                      <p className="font-bold text-text-dark">Versions</p>
                    </div>
                    <div className="relative col-span-full col-start-2 grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(120px, 1fr))` }}>
                      {versions.map((version) => {
                        const targetCellIndex = Math.max(0, cells.findIndex((cell) => version.release_date && version.release_date >= cell.start_date && version.release_date <= cell.end_date));
                        return (
                          <div key={version.id} className="my-3 flex justify-center" style={{ gridColumn: `${targetCellIndex + 1} / ${targetCellIndex + 2}` }}>
                            <span className="badge bg-amber-100 text-amber-700">
                              <Flag className="mr-1 h-3.5 w-3.5" />
                              {version.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {dependencyError ? (
                  <div className="border-b border-border bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                    Dependency links unavailable: {dependencyError}
                  </div>
                ) : null}

                {epics.length ? (
                  <div className="relative" style={{ minHeight: epics.length * ROADMAP_ROW_HEIGHT }}>
                    <RoadmapDependencyOverlay cells={cells} epics={epics} links={dependencyLinks} />
                    {epics.map((epic) => (
                      <div
                        key={epic.id}
                        className="grid border-b border-border last:border-b-0"
                        style={{ gridTemplateColumns: `220px repeat(${cells.length}, minmax(120px, 1fr))`, minHeight: ROADMAP_ROW_HEIGHT }}
                      >
                        <div className="border-r border-border px-4 py-4">
                          <p className="truncate font-bold text-text-dark">{epic.epic_name}</p>
                          <p className="mt-1 text-xs text-text-muted">{epic.issue_key || 'Epic'} - {epic.progress || 0}%</p>
                          <div className="progress-track mt-2">
                            <div className="progress-fill" style={{ width: `${epic.progress || 0}%`, backgroundColor: epic.epic_color || '#6554C0' }} />
                          </div>
                        </div>
                        <div className="relative col-span-full col-start-2 grid px-2" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(120px, 1fr))` }}>
                          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-slate-200" />
                          <RoadmapEpicBar cells={cells} epic={epic} onEdit={openEpicModal} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state m-4">Belum ada epic untuk roadmap.</div>
                )}
              </div>
            </div>
          </DndContext>
        </div>
      ) : null}

      <Modal
        footer={
          <>
            <button className="btn-secondary" type="button" onClick={closeEpicModal}>Cancel</button>
            <button className="btn-primary" form="roadmap-epic-form" type="submit">{editingEpic ? 'Save Epic' : 'Create Epic'}</button>
          </>
        }
        open={epicModalOpen}
        title={editingEpic ? 'Edit Epic' : 'Create Epic'}
        onClose={closeEpicModal}
      >
        <form id="roadmap-epic-form" noValidate onSubmit={handleEpicSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField className="md:col-span-2" error={errors.epic_name} htmlFor="epic-name" label="Epic Name" required>
              <input className={`field mt-1 ${errors.epic_name ? 'field-error' : ''}`} id="epic-name" value={epicForm.epic_name} onChange={(event) => setEpicForm((current) => ({ ...current, epic_name: event.target.value }))} />
            </FormField>
            <FormField error={errors.target_end_date} htmlFor="epic-start" label="Start Date">
              <input className="field mt-1" id="epic-start" type="date" value={epicForm.start_date} onChange={(event) => setEpicForm((current) => ({ ...current, start_date: event.target.value }))} />
            </FormField>
            <FormField error={errors.target_end_date} htmlFor="epic-end" label="Target End">
              <input className={`field mt-1 ${errors.target_end_date ? 'field-error' : ''}`} id="epic-end" type="date" value={epicForm.target_end_date} onChange={(event) => setEpicForm((current) => ({ ...current, target_end_date: event.target.value }))} />
            </FormField>
            <FormField htmlFor="epic-color" label="Color">
              <input className="h-10 w-16 rounded-lg border border-border bg-white p-1" id="epic-color" type="color" value={epicForm.epic_color} onChange={(event) => setEpicForm((current) => ({ ...current, epic_color: event.target.value }))} />
            </FormField>
            <FormField className="md:col-span-2" htmlFor="epic-description" label="Description">
              <textarea className="field mt-1 min-h-24 resize-y" id="epic-description" value={epicForm.description} onChange={(event) => setEpicForm((current) => ({ ...current, description: event.target.value }))} />
            </FormField>
          </div>
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <button className="btn-secondary" type="button" onClick={() => setVersionModalOpen(false)}>Cancel</button>
            <button className="btn-primary" form="roadmap-version-form" type="submit">Create Version</button>
          </>
        }
        open={versionModalOpen}
        title="Create Version"
        onClose={() => setVersionModalOpen(false)}
      >
        <form id="roadmap-version-form" noValidate onSubmit={handleVersionSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField className="md:col-span-2" error={errors.name} htmlFor="version-name" label="Version Name" required>
              <input className={`field mt-1 ${errors.name ? 'field-error' : ''}`} id="version-name" value={versionForm.name} onChange={(event) => setVersionForm((current) => ({ ...current, name: event.target.value }))} />
            </FormField>
            <FormField htmlFor="version-start" label="Start Date">
              <input className="field mt-1" id="version-start" type="date" value={versionForm.start_date} onChange={(event) => setVersionForm((current) => ({ ...current, start_date: event.target.value }))} />
            </FormField>
            <FormField htmlFor="version-release" label="Release Date">
              <input className="field mt-1" id="version-release" type="date" value={versionForm.release_date} onChange={(event) => setVersionForm((current) => ({ ...current, release_date: event.target.value }))} />
            </FormField>
            <FormField className="md:col-span-2" htmlFor="version-description" label="Description">
              <textarea className="field mt-1 min-h-24 resize-y" id="version-description" value={versionForm.description} onChange={(event) => setVersionForm((current) => ({ ...current, description: event.target.value }))} />
            </FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default RoadmapPage;
