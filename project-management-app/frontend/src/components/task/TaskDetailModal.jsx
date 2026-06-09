import { ArrowRight, Clock, Eye, Link2, Loader2, Trash2, UserPlus } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

import { getApplicableCustomFields, getIssueCustomFieldValues, setIssueCustomFieldValue } from '../../logic/services/customFieldApi';
import { createIssueLink, deleteIssueLink, getIssueLinks } from '../../logic/services/issueLinkApi';
import {
  approveTask,
  createTask,
  createTaskChecklist,
  deleteTask,
  deleteTaskChecklist,
  getTaskChecklists,
  getTask,
  updateTask,
  updateTaskChecklist,
  updateTaskProgress,
  updateTaskRealization,
} from '../../logic/services/taskApi';
import { createWorkLog, deleteWorkLog, getIssueTimeTracking, listWorkLogs, updateIssueEstimates } from '../../logic/services/timeTrackingApi';
import { addIssueWatcher, getIssueWatchers, removeIssueWatcher } from '../../logic/services/watcherApi';
import { executeIssueTransition, getAvailableIssueTransitions } from '../../logic/services/workflowApi';
import { formatDate } from '../../logic/helpers/dateHelper';
import { getApiErrorMessage } from '../../logic/services/api';
import { hasRolePermission } from '../../logic/helpers/permissionHelper';
import { getTaskLabelBadgeClass } from '../../logic/helpers/taskLabelHelper';
import { getTaskDisplayKey } from '../../logic/helpers/taskDisplayHelper';
import { getTaskAssigneeNames, getTaskLeadName } from '../../logic/helpers/taskPeopleHelper';
import { getPriorityBadgeClass, getProgressBarClass, getStatusBadgeClass } from '../../logic/helpers/statusHelper';
import { getRealizationModeBadgeClass, getRealizationModeLabel } from '../../logic/helpers/realizationHelper';
import { useUiStore } from '../../store/uiStore';
import FormField from '../shared/FormField';
import Modal from '../shared/Modal';
import SyncStatusBadge from '../shared/SyncStatusBadge';
import IssueTypeBadge from './IssueTypeBadge';
import SubtaskList from './SubtaskList';
import TaskFormModal from './TaskFormModal';
import TaskRealizationManualModal from './TaskRealizationManualModal';

const CommentThread = lazy(() => import('./CommentThread'));
const SUBTASK_PARENT_ISSUE_TYPES = ['Story', 'Task', 'Bug'];

const canTaskHaveSubtask = (task) => SUBTASK_PARENT_ISSUE_TYPES.includes(task?.issue_type_name);

const normalizeWorkflowArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
};

const getRequiredTransitionFields = (transition) => {
  const validators = normalizeWorkflowArray(transition?.validators);
  const fields = validators.flatMap((validator) => {
    if (validator?.type !== 'required_fields') {
      return [];
    }

    return Array.isArray(validator.config?.fields) ? validator.config.fields : [];
  });

  return Array.from(new Set(fields));
};

const getTransitionFieldLabel = (field) =>
  ({
    resolution: 'Resolution',
    environment: 'Environment',
    story_points: 'Story Points',
    priority: 'Priority',
    description: 'Description',
    title: 'Title',
    start_date: 'Start Date',
    end_date: 'End Date',
  })[field] || field;

const getTransitionFieldType = (field) => {
  if (field === 'story_points') {
    return 'number';
  }

  if (field === 'start_date' || field === 'end_date') {
    return 'date';
  }

  return 'text';
};

const mapWorkflowCategoryToStatus = (category) => {
  if (category === 'TODO') {
    return 'Not Started';
  }

  if (category === 'DONE') {
    return 'Done';
  }

  return 'In Progress';
};

const ISSUE_LINK_TYPES = [
  { value: 'relates_to', label: 'relates to' },
  { value: 'blocks', label: 'blocks' },
  { value: 'is_blocked_by', label: 'is blocked by' },
  { value: 'duplicates', label: 'duplicates' },
  { value: 'is_duplicated_by', label: 'is duplicated by' },
];

const formatHours = (value) => {
  const numericValue = Number(value || 0);
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(2);
};

const normalizeCustomFieldOptions = (options) => {
  if (Array.isArray(options)) {
    return options;
  }

  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
};

const getCustomFieldOptionValue = (option) => {
  if (option && typeof option === 'object') {
    return option.value ?? option.label ?? option.name ?? '';
  }

  return option ?? '';
};

const getCustomFieldOptionLabel = (option) => {
  if (option && typeof option === 'object') {
    return option.label ?? option.name ?? option.value ?? '';
  }

  return option ?? '';
};

const normalizeCustomFieldPayloadValue = (field, rawValue) => {
  if (field.field_type === 'number') {
    return rawValue === '' ? null : Number(rawValue);
  }

  if (field.field_type === 'checkbox') {
    return Boolean(rawValue);
  }

  if (field.field_type === 'multi_select') {
    return Array.isArray(rawValue) ? rawValue : String(rawValue || '').split(',').map((item) => item.trim()).filter(Boolean);
  }

  return rawValue;
};

// Modal detail task untuk melihat, mengedit, menghapus, dan mengelola realisasi/subtask.
function TaskDetailModal({ task: selectedTask, projects = [], users = [], tasks = [], labels = [], onClose, onSaved }) {
  const [mode, setMode] = useState(null);
  const [currentTask, setCurrentTask] = useState(selectedTask);
  const [checklists, setChecklists] = useState([]);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [progress, setProgress] = useState(selectedTask?.progress || 0);
  const [workflowTransitions, setWorkflowTransitions] = useState([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState('');
  const [transitionSubmittingId, setTransitionSubmittingId] = useState(null);
  const [transitionSyncStatus, setTransitionSyncStatus] = useState(null);
  const [transitionModal, setTransitionModal] = useState(null);
  const [transitionFields, setTransitionFields] = useState({});
  const [transitionFieldErrors, setTransitionFieldErrors] = useState({});
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionError, setExtensionError] = useState('');
  const [extensionSaving, setExtensionSaving] = useState('');
  const [issueLinks, setIssueLinks] = useState([]);
  const [issueLinkForm, setIssueLinkForm] = useState({ target_issue_id: '', link_type: 'relates_to' });
  const [timeTracking, setTimeTracking] = useState(null);
  const [estimateForm, setEstimateForm] = useState({ original_estimate_hours: '', remaining_estimate_hours: '' });
  const [workLogs, setWorkLogs] = useState([]);
  const [workLogForm, setWorkLogForm] = useState({
    time_spent_hours: '',
    remaining_estimate_hours: '',
    work_date: new Date().toISOString().slice(0, 10),
    description: '',
  });
  const [watchers, setWatchers] = useState([]);
  const [watcherUserId, setWatcherUserId] = useState('');
  const [customFields, setCustomFields] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const showToast = useUiStore((state) => state.showToast);
  const currentUserId = useUiStore((state) => state.currentUserId);
  const currentUser = useUiStore((state) => state.currentUser);
  const currentUserRole = currentUser?.role;
  const canCreateTask = hasRolePermission(currentUser, 'task', 'create');
  const canUpdateTask = hasRolePermission(currentUser, 'task', 'update');
  const canDeleteTask = hasRolePermission(currentUser, 'task', 'delete');
  const canProgressTask = hasRolePermission(currentUser, 'task', 'progress');
  const canRealizeTask = hasRolePermission(currentUser, 'task', 'realization');
  const canApproveTask = hasRolePermission(currentUser, 'task', 'approve');
  const canExecuteWorkflow = hasRolePermission(currentUser, 'workflow', 'execute');
  const canCreateChecklist = hasRolePermission(currentUser, 'task_checklist', 'create');
  const canUpdateChecklist = hasRolePermission(currentUser, 'task_checklist', 'update');
  const canDeleteChecklist = hasRolePermission(currentUser, 'task_checklist', 'delete');
  const canCreateIssueLink = hasRolePermission(currentUser, 'issue_links', 'create');
  const canDeleteIssueLink = hasRolePermission(currentUser, 'issue_links', 'delete');
  const canCreateWatcher = hasRolePermission(currentUser, 'issue_watcher', 'create');
  const canDeleteWatcher = hasRolePermission(currentUser, 'issue_watcher', 'delete');
  const canUpdateCustomField = hasRolePermission(currentUser, 'custom_field', 'update');
  const canCreateWorkLog = hasRolePermission(currentUser, 'time_log', 'create');
  const canUpdateWorkLog = hasRolePermission(currentUser, 'time_log', 'update');
  const canDeleteWorkLog = hasRolePermission(currentUser, 'time_log', 'delete');

  async function loadIssueExtensions(issue, { silent = false } = {}) {
    if (!issue?.id) {
      setIssueLinks([]);
      setTimeTracking(null);
      setWorkLogs([]);
      setWatchers([]);
      setCustomFields([]);
      setCustomFieldValues({});
      return;
    }

    if (!silent) {
      setExtensionLoading(true);
    }

    setExtensionError('');

    const issueTypeName = issue.issue_type_name || issue.issue_type || 'Task';
    const [linksResult, trackingResult, logsResult, watchersResult, fieldsResult, valuesResult] = await Promise.allSettled([
      getIssueLinks(issue.id),
      getIssueTimeTracking(issue.id),
      listWorkLogs({ issue_id: issue.id }),
      getIssueWatchers(issue.id),
      getApplicableCustomFields(issue.project_id, issueTypeName),
      getIssueCustomFieldValues(issue.id),
    ]);

    if (linksResult.status === 'fulfilled') {
      setIssueLinks(linksResult.value);
    }

    if (trackingResult.status === 'fulfilled') {
      const summary = trackingResult.value;
      setTimeTracking(summary);
      setEstimateForm({
        original_estimate_hours: summary.original_estimate_hours ?? '',
        remaining_estimate_hours: summary.remaining_estimate_hours ?? '',
      });
    }

    if (logsResult.status === 'fulfilled') {
      setWorkLogs(logsResult.value);
    }

    if (watchersResult.status === 'fulfilled') {
      setWatchers(watchersResult.value);
    }

    const fields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
    const values = valuesResult.status === 'fulfilled' ? valuesResult.value : [];

    setCustomFields(fields);
    setCustomFieldValues(
      fields.reduce((fieldValues, field) => {
        const existingValue = values.find((value) => Number(value.custom_field_id) === Number(field.id));
        const rawValue = existingValue?.value ?? field.default_value ?? '';

        return {
          ...fieldValues,
          [field.id]: field.field_type === 'checkbox' ? rawValue === true || rawValue === 'true' : rawValue,
        };
      }, {}),
    );

    const hasFailedRequest = [linksResult, trackingResult, logsResult, watchersResult, fieldsResult, valuesResult].some(
      (result) => result.status === 'rejected',
    );

    if (hasFailedRequest) {
      setExtensionError('Sebagian data issue gagal dimuat. Cek izin akses atau konfigurasi backend.');
    }

    if (!silent) {
      setExtensionLoading(false);
    }
  }

  useEffect(() => {
    setCurrentTask(selectedTask);
    setProgress(selectedTask?.progress || 0);
    setMode(null);
    setTransitionSyncStatus(null);
    setIssueLinkForm({ target_issue_id: '', link_type: 'relates_to' });
    setWorkLogForm({
      time_spent_hours: '',
      remaining_estimate_hours: '',
      work_date: new Date().toISOString().slice(0, 10),
      description: '',
    });
  }, [selectedTask]);

  useEffect(() => {
    let active = true;

    const fetchChecklists = async () => {
      if (!currentTask?.id) {
        setChecklists([]);
        return;
      }

      try {
        const rows = await getTaskChecklists(currentTask.id);

        if (active) {
          setChecklists(rows);
        }
      } catch (error) {
        if (active) {
          showToast({ type: 'error', message: getApiErrorMessage(error) });
        }
      }
    };

    fetchChecklists();

    return () => {
      active = false;
    };
  }, [currentTask?.id, showToast]);

  useEffect(() => {
    let active = true;

    const fetchWorkflowTransitions = async () => {
      if (!currentTask?.id || !currentTask?.workflow_state_id || !canExecuteWorkflow) {
        setWorkflowTransitions([]);
        setWorkflowLoading(false);
        setWorkflowError('');
        return;
      }

      setWorkflowLoading(true);
      setWorkflowError('');

      try {
        const rows = await getAvailableIssueTransitions(currentTask.id);

        if (active) {
          setWorkflowTransitions(rows);
        }
      } catch (error) {
        if (active) {
          setWorkflowError(getApiErrorMessage(error));
        }
      } finally {
        if (active) {
          setWorkflowLoading(false);
        }
      }
    };

    fetchWorkflowTransitions();

    return () => {
      active = false;
    };
  }, [canExecuteWorkflow, currentTask?.id, currentTask?.workflow_state_id]);

  useEffect(() => {
    loadIssueExtensions(currentTask);
  }, [currentTask?.id, currentTask?.project_id, currentTask?.issue_type_name, currentTask?.issue_type]);

  if (!currentTask) {
    return null;
  }

  const task = currentTask;
  const taskDisplayKey = getTaskDisplayKey(task);
  const hasActualStarted = Boolean(task.actual_start_date);
  const hasActualFinished = Boolean(task.actual_end_date);
  const rawStatus = task.raw_status || task.status;
  const approvalPending = rawStatus === 'Waiting Review';
  const canAddSubtask = canCreateTask && canTaskHaveSubtask(task);
  const approvalEnabled =
    canApproveTask && approvalPending && (currentUserRole === 'super_admin' || (task.lead_id && Number(task.lead_id) === Number(currentUserId)));
  const manualRealizationBlocked = Boolean(task.children?.length) || rawStatus === 'Done';

  // Menggabungkan hasil update dari API ke task yang sedang ditampilkan.
  const applyUpdatedTask = (updatedTask) => {
    setCurrentTask((current) => ({
      ...current,
      ...updatedTask,
      children: current?.children || [],
    }));
  };

  const denyUnauthorizedAction = (message) => {
    showToast({ type: 'error', message });
  };

  const executeWorkflowTransition = async (transition, fields = {}) => {
    if (!canExecuteWorkflow) {
      showToast({ type: 'error', message: 'User tidak memiliki izin untuk menjalankan workflow transition.' });
      return;
    }

    setTransitionSubmittingId(transition.id);
    setTransitionSyncStatus('syncing');

    const previousTask = task;
    const optimisticPatch = {
      ...fields,
      status: transition.to_state_category ? mapWorkflowCategoryToStatus(transition.to_state_category) : task.status,
      workflow_state_color: transition.to_state_color || task.workflow_state_color,
      workflow_state_id: transition.to_state_id || task.workflow_state_id,
      workflow_state_name: transition.to_state_name || task.workflow_state_name,
    };

    applyUpdatedTask(optimisticPatch);

    try {
      await executeIssueTransition(task.id, transition.id, { fields });
      const updatedTask = await getTask(task.id);
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      setTransitionSyncStatus('synced');
      setTransitionModal(null);
      setTransitionFields({});
      setTransitionFieldErrors({});
      showToast({ type: 'success', message: 'Workflow transition berhasil dijalankan.' });
      await onSaved?.();
      window.setTimeout(() => {
        setTransitionSyncStatus((current) => (current === 'synced' ? null : current));
      }, 1800);
    } catch (error) {
      setCurrentTask(previousTask);
      setProgress(previousTask.progress || 0);
      setTransitionSyncStatus('failed');
      showToast({ type: 'error', message: getApiErrorMessage(error) });
      window.setTimeout(() => {
        setTransitionSyncStatus((current) => (current === 'failed' ? null : current));
      }, 1800);
    } finally {
      setTransitionSubmittingId(null);
    }
  };

  const handleWorkflowTransitionClick = (transition) => {
    const requiredFields = getRequiredTransitionFields(transition);

    if (!requiredFields.length) {
      executeWorkflowTransition(transition);
      return;
    }

    setTransitionModal(transition);
    setTransitionFields(
      requiredFields.reduce(
        (fieldValues, field) => ({
          ...fieldValues,
          [field]: task[field] ?? '',
        }),
        {},
      ),
    );
    setTransitionFieldErrors({});
  };

  const handleTransitionFieldSubmit = async (event) => {
    event.preventDefault();

    const requiredFields = getRequiredTransitionFields(transitionModal);
    const nextErrors = {};

    requiredFields.forEach((field) => {
      if (transitionFields[field] === undefined || transitionFields[field] === null || String(transitionFields[field]).trim() === '') {
        nextErrors[field] = `${getTransitionFieldLabel(field)} wajib diisi.`;
      }
    });

    setTransitionFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    await executeWorkflowTransition(transitionModal, transitionFields);
  };

  // Menyimpan perubahan progress cepat dari modal detail.
  const handleProgressSave = async () => {
    if (!canProgressTask) {
      denyUnauthorizedAction('User tidak memiliki izin untuk mengubah progress task.');
      return;
    }

    try {
      const updatedTask = await updateTaskProgress(task.id, progress);
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      showToast({ type: 'success', message: 'Progress task diperbarui.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Mengapprove task yang sudah menunggu review lead.
  const handleApprove = async () => {
    if (!canApproveTask) {
      denyUnauthorizedAction('User tidak memiliki izin untuk approve task.');
      return;
    }

    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      const updatedTask = await approveTask(task.id, currentUserId);
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      showToast({ type: 'success', message: 'Task diapprove.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menghapus task setelah user mengonfirmasi.
  const handleDelete = async () => {
    if (!canDeleteTask) {
      denyUnauthorizedAction('User tidak memiliki izin untuk menghapus task.');
      return;
    }

    if (!window.confirm('Hapus task ini beserta seluruh subtask?')) {
      return;
    }

    try {
      await deleteTask(task.id);
      showToast({ type: 'success', message: 'Task dihapus.' });
      await onSaved?.();
      onClose();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menyimpan perubahan task dari form edit.
  const handleEditSubmit = async (payload) => {
    if (!canUpdateTask) {
      denyUnauthorizedAction('User tidak memiliki izin untuk mengubah task.');
      return;
    }

    try {
      const updatedTask = await updateTask(task.id, payload);
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      setMode(null);
      showToast({ type: 'success', message: 'Task diperbarui.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Menjalankan aksi realisasi mulai atau selesai.
  const handleRealizationAction = async (action) => {
    if (!canRealizeTask) {
      denyUnauthorizedAction('User tidak memiliki izin untuk mengubah realisasi task.');
      return;
    }

    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      const updatedTask = await updateTaskRealization(task.id, { action, actor_user_id: currentUserId });
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      showToast({
        type: 'success',
        message: action === 'start' ? 'Realisasi task dimulai.' : 'Realisasi task diselesaikan.',
      });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Membuka modal untuk input realisasi manual.
  const openManualRealizationModal = () => {
    if (!canRealizeTask) {
      denyUnauthorizedAction('User tidak memiliki izin untuk mengubah realisasi task.');
      return;
    }

    setMode('manual-realization');
  };

  // Menyimpan tanggal realisasi manual.
  const handleManualRealizationSubmit = async (payload) => {
    if (!canRealizeTask) {
      denyUnauthorizedAction('User tidak memiliki izin untuk mengubah realisasi task.');
      return;
    }

    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    try {
      const updatedTask = await updateTaskRealization(task.id, {
        action: 'manual',
        actor_user_id: currentUserId,
        ...payload,
      });
      applyUpdatedTask(updatedTask);
      setProgress(updatedTask.progress || 0);
      setMode(null);
      showToast({ type: 'success', message: 'Realisasi manual task disimpan.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  // Membuat subtask baru di bawah task yang sedang dibuka.
  const handleSubtaskSubmit = async (payload) => {
    if (!canCreateTask) {
      denyUnauthorizedAction('User tidak memiliki izin untuk membuat subtask.');
      return;
    }

    if (!canTaskHaveSubtask(task)) {
      showToast({ type: 'error', message: `Issue type ${task.issue_type_name || 'ini'} tidak dapat memiliki Subtask.` });
      return;
    }

    try {
      const createdSubtask = await createTask({
        ...payload,
        project_id: task.project_id,
        bucket_id: payload.bucket_id || task.bucket_id || null,
        parent_task_id: task.id,
      });
      setCurrentTask((current) => ({
        ...current,
        children: [
          ...(current?.children || []),
          {
            ...createdSubtask,
            level: (current?.level || 0) + 1,
            children: [],
          },
        ],
      }));
      setMode(null);
      showToast({ type: 'success', message: 'Subtask dibuat.' });
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const refreshChecklists = async () => {
    setChecklists(await getTaskChecklists(task.id));
  };

  const handleChecklistSubmit = async (event) => {
    event.preventDefault();

    if (!canCreateChecklist) {
      denyUnauthorizedAction('User tidak memiliki izin untuk membuat checklist.');
      return;
    }

    if (!checklistTitle.trim()) {
      showToast({ type: 'error', message: 'Judul checklist wajib diisi.' });
      return;
    }

    try {
      await createTaskChecklist(task.id, { title: checklistTitle.trim() });
      setChecklistTitle('');
      await refreshChecklists();
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const handleChecklistToggle = async (checklist) => {
    if (!canUpdateChecklist) {
      denyUnauthorizedAction('User tidak memiliki izin untuk mengubah checklist.');
      return;
    }

    try {
      await updateTaskChecklist(checklist.id, { is_done: !checklist.is_done });
      await refreshChecklists();
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const handleChecklistDelete = async (checklist) => {
    if (!canDeleteChecklist) {
      denyUnauthorizedAction('User tidak memiliki izin untuk menghapus checklist.');
      return;
    }

    try {
      await deleteTaskChecklist(checklist.id);
      await refreshChecklists();
      await onSaved?.();
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    }
  };

  const handleIssueLinkSubmit = async (event) => {
    event.preventDefault();

    if (!canCreateIssueLink) {
      denyUnauthorizedAction('User tidak memiliki izin untuk menambahkan issue link.');
      return;
    }

    if (!issueLinkForm.target_issue_id) {
      showToast({ type: 'error', message: 'Target issue wajib diisi.' });
      return;
    }

    setExtensionSaving('issue-link');

    try {
      await createIssueLink({
        source_issue_id: task.id,
        target_issue_id: Number(issueLinkForm.target_issue_id),
        link_type: issueLinkForm.link_type,
      });
      setIssueLinkForm({ target_issue_id: '', link_type: 'relates_to' });
      await loadIssueExtensions(task, { silent: true });
      showToast({ type: 'success', message: 'Issue link ditambahkan.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setExtensionSaving('');
    }
  };

  const handleIssueLinkDelete = async (issueLinkId) => {
    if (!canDeleteIssueLink) {
      denyUnauthorizedAction('User tidak memiliki izin untuk menghapus issue link.');
      return;
    }

    setExtensionSaving(`issue-link-${issueLinkId}`);

    try {
      await deleteIssueLink(issueLinkId);
      await loadIssueExtensions(task, { silent: true });
      showToast({ type: 'success', message: 'Issue link dihapus.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setExtensionSaving('');
    }
  };

  const handleEstimateSubmit = async (event) => {
    event.preventDefault();

    if (!canUpdateWorkLog) {
      denyUnauthorizedAction('User tidak memiliki izin untuk mengubah estimasi waktu.');
      return;
    }

    setExtensionSaving('estimates');

    try {
      await updateIssueEstimates(task.id, {
        original_estimate_hours: Number(estimateForm.original_estimate_hours || 0),
        remaining_estimate_hours: Number(estimateForm.remaining_estimate_hours || 0),
      });
      await loadIssueExtensions(task, { silent: true });
      showToast({ type: 'success', message: 'Estimasi waktu diperbarui.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setExtensionSaving('');
    }
  };

  const handleWorkLogSubmit = async (event) => {
    event.preventDefault();

    if (!canCreateWorkLog) {
      denyUnauthorizedAction('User tidak memiliki izin untuk menambahkan work log.');
      return;
    }

    if (!currentUserId) {
      showToast({ type: 'error', message: 'User login tidak ditemukan.' });
      return;
    }

    if (!Number(workLogForm.time_spent_hours)) {
      showToast({ type: 'error', message: 'Time spent wajib lebih dari 0 jam.' });
      return;
    }

    setExtensionSaving('work-log');

    try {
      await createWorkLog(task.id, {
        user_id: currentUserId,
        time_spent_hours: Number(workLogForm.time_spent_hours),
        remaining_estimate_hours: workLogForm.remaining_estimate_hours === '' ? undefined : Number(workLogForm.remaining_estimate_hours),
        work_date: workLogForm.work_date,
        description: workLogForm.description.trim() || null,
      });
      setWorkLogForm({
        time_spent_hours: '',
        remaining_estimate_hours: '',
        work_date: new Date().toISOString().slice(0, 10),
        description: '',
      });
      await loadIssueExtensions(task, { silent: true });
      showToast({ type: 'success', message: 'Work log ditambahkan.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setExtensionSaving('');
    }
  };

  const handleWorkLogDelete = async (workLogId) => {
    if (!canDeleteWorkLog) {
      denyUnauthorizedAction('User tidak memiliki izin untuk menghapus work log.');
      return;
    }

    setExtensionSaving(`work-log-${workLogId}`);

    try {
      await deleteWorkLog(workLogId);
      await loadIssueExtensions(task, { silent: true });
      showToast({ type: 'success', message: 'Work log dihapus.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setExtensionSaving('');
    }
  };

  const handleWatcherAdd = async () => {
    if (!canCreateWatcher) {
      denyUnauthorizedAction('User tidak memiliki izin untuk menambahkan watcher.');
      return;
    }

    const selectedWatcherId = watcherUserId || currentUserId;

    if (!selectedWatcherId) {
      showToast({ type: 'error', message: 'Pilih watcher terlebih dahulu.' });
      return;
    }

    setExtensionSaving('watcher');

    try {
      await addIssueWatcher(task.id, selectedWatcherId);
      setWatcherUserId('');
      await loadIssueExtensions(task, { silent: true });
      showToast({ type: 'success', message: 'Watcher ditambahkan.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setExtensionSaving('');
    }
  };

  const handleWatcherRemove = async (userId) => {
    if (!canDeleteWatcher) {
      denyUnauthorizedAction('User tidak memiliki izin untuk menghapus watcher.');
      return;
    }

    setExtensionSaving(`watcher-${userId}`);

    try {
      await removeIssueWatcher(task.id, userId);
      await loadIssueExtensions(task, { silent: true });
      showToast({ type: 'success', message: 'Watcher dihapus.' });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setExtensionSaving('');
    }
  };

  const handleCustomFieldSave = async (field) => {
    if (!canUpdateCustomField) {
      denyUnauthorizedAction('User tidak memiliki izin untuk mengubah custom field.');
      return;
    }

    setExtensionSaving(`custom-field-${field.id}`);

    try {
      await setIssueCustomFieldValue(task.id, field.id, normalizeCustomFieldPayloadValue(field, customFieldValues[field.id]));
      await loadIssueExtensions(task, { silent: true });
      showToast({ type: 'success', message: `${field.name} disimpan.` });
    } catch (error) {
      showToast({ type: 'error', message: getApiErrorMessage(error) });
    } finally {
      setExtensionSaving('');
    }
  };

  const renderCustomFieldInput = (field) => {
    const value = customFieldValues[field.id] ?? '';

    if (field.field_type === 'checkbox') {
      return (
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input
            checked={Boolean(value)}
            disabled={!canUpdateCustomField}
            type="checkbox"
            onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.id]: event.target.checked }))}
          />
          Checked
        </label>
      );
    }

    if (field.field_type === 'select') {
      return (
        <select
          className="field"
          disabled={!canUpdateCustomField}
          value={value}
          onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
        >
          <option value="">Select option</option>
          {normalizeCustomFieldOptions(field.options).map((option) => {
            const optionValue = getCustomFieldOptionValue(option);

            return (
              <option key={optionValue} value={optionValue}>
                {getCustomFieldOptionLabel(option)}
              </option>
            );
          })}
        </select>
      );
    }

    if (field.field_type === 'user') {
      return (
        <select
          className="field"
          disabled={!canUpdateCustomField}
          value={value}
          onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
        >
          <option value="">Select user</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        className="field"
        disabled={!canUpdateCustomField}
        placeholder={field.field_type === 'multi_select' ? 'Pisahkan opsi dengan koma' : field.name}
        type={field.field_type === 'date' || field.field_type === 'number' || field.field_type === 'url' ? field.field_type : 'text'}
        value={value}
        onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="card max-h-[92vh] w-full max-w-6xl overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-muted">{task.project_name} / {task.bucket_name || 'No bucket'}</p>
            <h2 className="text-xl font-bold">{task.title}</h2>
          </div>
          <button className="text-2xl text-text-muted" type="button" onClick={onClose}>
            x
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="label">Status</p>
            <span className={`badge mt-2 ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="label">Priority</p>
            <span className={`badge mt-2 ${getPriorityBadgeClass(task.priority)}`}>{task.priority}</span>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="label">PIC</p>
            <p className="mt-2 font-semibold">{getTaskAssigneeNames(task)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="label">Lead</p>
            <p className="mt-2 font-semibold">{getTaskLeadName(task)}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Workflow</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {task.workflow_state_name ? (
                  <span className="badge bg-slate-100 text-slate-700">
                    <span className="mr-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: task.workflow_state_color || '#CBD5E1' }} />
                    {task.workflow_state_name}
                  </span>
                ) : (
                  <span className="text-sm text-text-muted">Belum ada workflow state.</span>
                )}
                {workflowLoading ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading
                  </span>
                ) : null}
                <SyncStatusBadge status={transitionSyncStatus} />
              </div>
              {workflowError ? <p className="form-error">{workflowError}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {canExecuteWorkflow ? workflowTransitions.map((transition) => (
                <button
                  key={transition.id}
                  className="btn-secondary"
                  disabled={Boolean(transitionSubmittingId)}
                  type="button"
                  onClick={() => handleWorkflowTransitionClick(transition)}
                >
                  {transitionSubmittingId === transition.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {transition.name}
                </button>
              )) : null}
              {canExecuteWorkflow && !workflowLoading && task.workflow_state_id && !workflowTransitions.length ? (
                <span className="text-sm font-semibold text-text-muted">Tidak ada transition tersedia.</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <p className="label">Plan Start</p>
            <p className="font-semibold">{formatDate(task.start_date)}</p>
          </div>
          <div>
            <p className="label">Plan End</p>
            <p className="font-semibold">{formatDate(task.end_date)}</p>
          </div>
          <div>
            <p className="label">Plan Duration</p>
            <p className="font-semibold">{task.duration_days || 0} days</p>
          </div>
          <div>
            <p className="label">Plan Work Days</p>
            <p className="font-semibold">{task.work_days || 0} days</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Realisasi</p>
              <p className="text-sm text-text-muted">Actual start dan finish disimpan terpisah dari jadwal plan untuk perbandingan di Gantt.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasActualStarted ? (
                <span className={`badge ${getRealizationModeBadgeClass(task.realization_mode)}`}>
                  {getRealizationModeLabel(task.realization_mode)}
                </span>
              ) : null}
              {canRealizeTask && !approvalPending && !hasActualStarted ? (
                <button className="btn-primary" type="button" onClick={() => handleRealizationAction('start')}>
                  Mulai Realisasi
                </button>
              ) : null}
              {canRealizeTask && !approvalPending && hasActualStarted && !hasActualFinished ? (
                <button className="btn-primary" type="button" onClick={() => handleRealizationAction('finish')}>
                  Selesaikan Realisasi
                </button>
              ) : null}
              {hasActualFinished ? <span className="badge bg-green-100 text-green-700">Realisasi selesai</span> : null}
              {approvalEnabled ? (
                <button className="btn-primary bg-success hover:bg-green-700" type="button" onClick={handleApprove}>
                  Approve
                </button>
              ) : null}
              {approvalPending && !approvalEnabled ? <span className="badge bg-amber-100 text-amber-700">Waiting lead approval</span> : null}
              {canRealizeTask ? (
                <button
                  className="btn-secondary"
                  disabled={manualRealizationBlocked}
                  title={manualRealizationBlocked ? 'Realisasi manual hanya untuk leaf task yang belum Done.' : 'Isi realisasi manual'}
                  type="button"
                  onClick={openManualRealizationModal}
                >
                  Realisasi Manual
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <div>
              <p className="label">Actual Start</p>
              <p className="font-semibold">{formatDate(task.actual_start_date)}</p>
            </div>
            <div>
              <p className="label">Actual Finish</p>
              <p className="font-semibold">{formatDate(task.actual_end_date)}</p>
            </div>
            <div>
              <p className="label">Actual Duration</p>
              <p className="font-semibold">{task.actual_duration_days || 0} days</p>
            </div>
            <div>
              <p className="label">Actual Work Days</p>
              <p className="font-semibold">{task.actual_work_days || 0} days</p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="label">Description</p>
          <p className="mt-1 rounded-xl bg-slate-50 p-3 text-sm text-text-muted">{task.description || 'No description'}</p>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label">Labels</p>
              <p className="text-sm text-text-muted">Label dipakai untuk filter dan pengelompokan task.</p>
            </div>
            {canUpdateTask ? (
              <button className="btn-secondary" type="button" onClick={() => setMode('edit')}>
                Edit Labels
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {task.labels?.length ? (
              task.labels.map((label) => (
                <span key={label.id} className={`badge ${getTaskLabelBadgeClass(label.color)}`}>
                  {label.name}
                </span>
              ))
            ) : (
              <p className="text-sm text-text-muted">Belum ada label.</p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Issue Metadata</p>
              <p className="text-sm text-text-muted">Linked issues, custom fields, watcher, dan time tracking.</p>
            </div>
            {extensionLoading ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading
              </span>
            ) : null}
          </div>
          {extensionError ? <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm font-semibold text-amber-700">{extensionError}</p> : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-lg bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <h3 className="font-bold">Linked Issues</h3>
              </div>
              {canCreateIssueLink ? (
                <form className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleIssueLinkSubmit}>
                  <input
                    className="field"
                    min="1"
                    placeholder="Target issue ID"
                    type="number"
                    value={issueLinkForm.target_issue_id}
                    onChange={(event) => setIssueLinkForm((current) => ({ ...current, target_issue_id: event.target.value }))}
                  />
                  <select
                    className="field"
                    value={issueLinkForm.link_type}
                    onChange={(event) => setIssueLinkForm((current) => ({ ...current, link_type: event.target.value }))}
                  >
                    {ISSUE_LINK_TYPES.map((linkType) => (
                      <option key={linkType.value} value={linkType.value}>
                        {linkType.label}
                      </option>
                    ))}
                  </select>
                  <button className="btn-secondary" disabled={extensionSaving === 'issue-link'} type="submit">
                    Add
                  </button>
                </form>
              ) : null}
              <div className="space-y-2">
                {issueLinks.length ? (
                  issueLinks.map((issueLink) => (
                    <div key={issueLink.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-bold">{issueLink.link_type.replaceAll('_', ' ')}</p>
                        <p className="truncate text-text-muted">
                          {issueLink.target_issue_key || `#${issueLink.target_issue_id}`} - {issueLink.target_issue_title}
                        </p>
                      </div>
                      {canDeleteIssueLink ? (
                        <button
                          className="text-danger"
                          disabled={extensionSaving === `issue-link-${issueLink.id}`}
                          title="Delete link"
                          type="button"
                          onClick={() => handleIssueLinkDelete(issueLink.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">Belum ada linked issue.</p>
                )}
              </div>
            </section>

            <section className="rounded-lg bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <h3 className="font-bold">Watchers</h3>
              </div>
              {canCreateWatcher ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  <select className="field min-w-48 flex-1" value={watcherUserId} onChange={(event) => setWatcherUserId(event.target.value)}>
                    <option value="">Current user</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn-secondary" disabled={extensionSaving === 'watcher'} type="button" onClick={handleWatcherAdd}>
                    <UserPlus className="h-4 w-4" />
                    Watch
                  </button>
                </div>
              ) : null}
              <div className="space-y-2">
                {watchers.length ? (
                  watchers.map((watcher) => (
                    <div key={watcher.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{watcher.user_name}</p>
                        <p className="truncate text-text-muted">{watcher.user_email || 'No email'}</p>
                      </div>
                      {canDeleteWatcher ? (
                        <button
                          className="text-danger"
                          disabled={extensionSaving === `watcher-${watcher.user_id}`}
                          title="Remove watcher"
                          type="button"
                          onClick={() => handleWatcherRemove(watcher.user_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">Belum ada watcher.</p>
                )}
              </div>
            </section>
          </div>

          <section className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-bold">Time Tracking</h3>
            </div>
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-white p-3">
                <p className="label">Original Estimate</p>
                <p className="text-lg font-bold">{formatHours(timeTracking?.original_estimate_hours)}h</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="label">Remaining</p>
                <p className="text-lg font-bold">{formatHours(timeTracking?.remaining_estimate_hours)}h</p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="label">Time Spent</p>
                <p className="text-lg font-bold">{formatHours(timeTracking?.time_spent_hours)}h</p>
              </div>
            </div>
            {canUpdateWorkLog ? (
              <form className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleEstimateSubmit}>
                <input
                  className="field"
                  min="0"
                  placeholder="Original estimate hours"
                  type="number"
                  value={estimateForm.original_estimate_hours}
                  onChange={(event) => setEstimateForm((current) => ({ ...current, original_estimate_hours: event.target.value }))}
                />
                <input
                  className="field"
                  min="0"
                  placeholder="Remaining hours"
                  type="number"
                  value={estimateForm.remaining_estimate_hours}
                  onChange={(event) => setEstimateForm((current) => ({ ...current, remaining_estimate_hours: event.target.value }))}
                />
                <button className="btn-secondary" disabled={extensionSaving === 'estimates'} type="submit">
                  Save Estimate
                </button>
              </form>
            ) : null}
            {canCreateWorkLog ? (
              <form className="grid gap-2 lg:grid-cols-[0.8fr_0.8fr_0.9fr_1.4fr_auto]" onSubmit={handleWorkLogSubmit}>
                <input
                  className="field"
                  min="0"
                  placeholder="Spent hours"
                  step="0.25"
                  type="number"
                  value={workLogForm.time_spent_hours}
                  onChange={(event) => setWorkLogForm((current) => ({ ...current, time_spent_hours: event.target.value }))}
                />
                <input
                  className="field"
                  min="0"
                  placeholder="Remaining"
                  step="0.25"
                  type="number"
                  value={workLogForm.remaining_estimate_hours}
                  onChange={(event) => setWorkLogForm((current) => ({ ...current, remaining_estimate_hours: event.target.value }))}
                />
                <input
                  className="field"
                  type="date"
                  value={workLogForm.work_date}
                  onChange={(event) => setWorkLogForm((current) => ({ ...current, work_date: event.target.value }))}
                />
                <input
                  className="field"
                  placeholder="Work description"
                  value={workLogForm.description}
                  onChange={(event) => setWorkLogForm((current) => ({ ...current, description: event.target.value }))}
                />
                <button className="btn-primary" disabled={extensionSaving === 'work-log'} type="submit">
                  Log Work
                </button>
              </form>
            ) : null}
            <div className="mt-3 space-y-2">
              {workLogs.length ? (
                workLogs.slice(0, 5).map((workLog) => (
                  <div key={workLog.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-bold">
                        {formatHours(workLog.time_spent_hours)}h by {workLog.user_name}
                      </p>
                      <p className="truncate text-text-muted">
                        {workLog.work_date} - {workLog.description || 'No description'}
                      </p>
                    </div>
                    {canDeleteWorkLog ? (
                      <button
                        className="text-danger"
                        disabled={extensionSaving === `work-log-${workLog.id}`}
                        title="Delete work log"
                        type="button"
                        onClick={() => handleWorkLogDelete(workLog.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted">Belum ada work log.</p>
              )}
            </div>
          </section>

          <section className="mt-3 rounded-lg bg-slate-50 p-3">
            <h3 className="mb-3 font-bold">Custom Fields</h3>
            {customFields.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {customFields.map((field) => (
                  <div key={field.id} className="rounded-md bg-white p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{field.name}{field.is_required ? ' *' : ''}</p>
                        {field.description ? <p className="text-xs text-text-muted">{field.description}</p> : null}
                      </div>
                      <span className="badge bg-slate-100 text-slate-600">{field.field_type}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-48 flex-1">{renderCustomFieldInput(field)}</div>
                      {canUpdateCustomField ? (
                        <button
                          className="btn-secondary"
                          disabled={extensionSaving === `custom-field-${field.id}`}
                          type="button"
                          onClick={() => handleCustomFieldSave(field)}
                        >
                          Save
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Tidak ada custom field untuk issue type ini.</p>
            )}
          </section>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label">Progress</p>
              <p className="text-sm text-text-muted">{task.children?.length ? 'Parent progress dihitung otomatis dari subtask.' : 'Update manual progress task.'}</p>
            </div>
            {canProgressTask ? (
              <div className="flex items-center gap-2">
                <input
                  className="field w-28"
                  disabled={Boolean(task.children?.length)}
                  max="100"
                  min="0"
                  type="number"
                  value={progress}
                  onChange={(event) => setProgress(event.target.value)}
                />
                <button className="btn-primary" disabled={Boolean(task.children?.length)} type="button" onClick={handleProgressSave}>
                  Save
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${getProgressBarClass(task)}`} style={{ width: `${task.progress || 0}%` }} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">Checklist</p>
              <p className="text-sm text-text-muted">
                {checklists.filter((item) => item.is_done).length}/{checklists.length} item selesai.
              </p>
            </div>
          </div>
          {canCreateChecklist ? (
            <form className="mb-3 flex gap-2" onSubmit={handleChecklistSubmit}>
              <input
                className="field"
                placeholder="Tambah checklist"
                value={checklistTitle}
                onChange={(event) => setChecklistTitle(event.target.value)}
              />
              <button className="btn-primary" type="submit">
                Add
              </button>
            </form>
          ) : null}
          <div className="space-y-2">
            {checklists.length ? (
              checklists.map((checklist) => (
                <div key={checklist.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
                    <input checked={checklist.is_done} disabled={!canUpdateChecklist} type="checkbox" onChange={() => handleChecklistToggle(checklist)} />
                    <span className={checklist.is_done ? 'truncate text-text-muted line-through' : 'truncate text-text-dark'}>
                      {checklist.title}
                    </span>
                  </label>
                  {canDeleteChecklist ? (
                    <button className="text-xs font-bold text-danger" type="button" onClick={() => handleChecklistDelete(checklist)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-text-muted">Belum ada checklist.</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">Subtasks</h3>
            {canAddSubtask ? (
              <button className="btn-secondary" type="button" onClick={() => setMode('subtask')}>
                Add Subtask
              </button>
            ) : null}
          </div>
          <SubtaskList
            subtasks={task.children || []}
            onOpen={(subtask) => {
              setCurrentTask(subtask);
              setProgress(subtask.progress || 0);
            }}
          />
        </div>

        <Suspense fallback={<div className="mt-4 rounded-xl border border-border p-4 text-sm text-text-muted">Loading comments...</div>}>
          <CommentThread
            canCreate={hasRolePermission(currentUser, 'task_comment', 'create')}
            canDelete={hasRolePermission(currentUser, 'task_comment', 'delete')}
            canUpdate={hasRolePermission(currentUser, 'task_comment', 'update')}
            task={task}
            users={users}
          />
        </Suspense>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {canUpdateTask ? (
            <button className="btn-secondary" type="button" onClick={() => setMode('edit')}>
              Edit
            </button>
          ) : null}
          {canDeleteTask ? (
            <button className="btn-secondary text-danger" type="button" onClick={handleDelete}>
              Delete
            </button>
          ) : null}
          <button className="btn-primary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
            <section className="rounded-xl border border-border bg-slate-50 p-4">
              <p className="label">Issue</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <IssueTypeBadge color={task.issue_type_color} icon={task.issue_type_icon} name={task.issue_type_name} />
                {taskDisplayKey ? <span className="text-sm font-bold text-text-muted">{taskDisplayKey}</span> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`badge ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
                <span className={`badge ${getPriorityBadgeClass(task.priority)}`}>{task.priority}</span>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-white p-4">
              <h3 className="mb-3 font-bold text-text-dark">Details</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="label">Project</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{task.project_name || '-'}</dd>
                </div>
                <div>
                  <dt className="label">Bucket</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{task.bucket_name || '-'}</dd>
                </div>
                <div>
                  <dt className="label">Epic</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{task.epic_name || '-'}</dd>
                </div>
                <div>
                  <dt className="label">Sprint</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{task.sprint_name || '-'}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="label">Story Points</dt>
                    <dd className="mt-1 font-semibold text-text-dark">{task.story_points || 0}</dd>
                  </div>
                  <div>
                    <dt className="label">Progress</dt>
                    <dd className="mt-1 font-semibold text-text-dark">{task.progress || 0}%</dd>
                  </div>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-border bg-white p-4">
              <h3 className="mb-3 font-bold text-text-dark">People</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="label">PIC</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{getTaskAssigneeNames(task)}</dd>
                </div>
                <div>
                  <dt className="label">Lead</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{getTaskLeadName(task)}</dd>
                </div>
                <div>
                  <dt className="label">Watchers</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{watchers.length}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-border bg-white p-4">
              <h3 className="mb-3 font-bold text-text-dark">Time</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="label">Original</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{formatHours(timeTracking?.original_estimate_hours)}h</dd>
                </div>
                <div>
                  <dt className="label">Remaining</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{formatHours(timeTracking?.remaining_estimate_hours)}h</dd>
                </div>
                <div>
                  <dt className="label">Spent</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{formatHours(timeTracking?.time_spent_hours)}h</dd>
                </div>
                <div>
                  <dt className="label">Due</dt>
                  <dd className="mt-1 font-semibold text-text-dark">{formatDate(task.end_date)}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>

      <TaskFormModal
        open={mode === 'edit' && canUpdateTask}
        task={task}
        projects={projects}
        users={users}
        tasks={tasks}
        labels={labels}
        onClose={() => setMode(null)}
        onSubmit={handleEditSubmit}
      />
      <TaskFormModal
        open={mode === 'subtask' && canAddSubtask}
        parentTask={task}
        projects={projects}
        users={users}
        tasks={tasks}
        labels={labels}
        onClose={() => setMode(null)}
        onSubmit={handleSubtaskSubmit}
      />
      <TaskRealizationManualModal
        open={mode === 'manual-realization' && canRealizeTask}
        task={task}
        onClose={() => setMode(null)}
        onSubmit={handleManualRealizationSubmit}
      />
      <Modal
        footer={
          <>
            <button className="btn-secondary" disabled={Boolean(transitionSubmittingId)} type="button" onClick={() => setTransitionModal(null)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={Boolean(transitionSubmittingId)} form="workflow-transition-fields-form" type="submit">
              {transitionSubmittingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Apply Transition
            </button>
          </>
        }
        open={Boolean(transitionModal)}
        title={transitionModal ? transitionModal.name : 'Workflow Transition'}
        onClose={() => setTransitionModal(null)}
      >
        <form id="workflow-transition-fields-form" noValidate onSubmit={handleTransitionFieldSubmit}>
          <div className="grid gap-4">
            {getRequiredTransitionFields(transitionModal).map((field) => (
              <FormField key={field} error={transitionFieldErrors[field]} htmlFor={`transition-field-${field}`} label={getTransitionFieldLabel(field)} required>
                {field === 'priority' ? (
                  <select
                    className={`field mt-1 ${transitionFieldErrors[field] ? 'field-error' : ''}`}
                    id={`transition-field-${field}`}
                    value={transitionFields[field] || ''}
                    onChange={(event) => setTransitionFields((current) => ({ ...current, [field]: event.target.value }))}
                  >
                    <option value="">Select priority</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                ) : (
                  <input
                    className={`field mt-1 ${transitionFieldErrors[field] ? 'field-error' : ''}`}
                    id={`transition-field-${field}`}
                    type={getTransitionFieldType(field)}
                    value={transitionFields[field] || ''}
                    onChange={(event) => setTransitionFields((current) => ({ ...current, [field]: event.target.value }))}
                  />
                )}
              </FormField>
            ))}
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TaskDetailModal;
