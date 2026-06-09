import { Bot, Clock3, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import RuleBuilder, { automationTriggerOptions } from '../components/automation/RuleBuilder';
import Modal from '../components/shared/Modal';
import { useProjects } from '../logic/hooks/useProjects';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import {
  createAutomationRule,
  deleteAutomationRule,
  disableAutomationRule,
  enableAutomationRule,
  getAutomationLogs,
  getAutomationRules,
  updateAutomationRule,
} from '../logic/services/automationApi';
import { useUiStore } from '../store/uiStore';

const initialRuleForm = {
  actions: [{ type: 'update_field', field: 'status', value: 'In Progress' }],
  conditions: [],
  description: '',
  is_enabled: true,
  name: '',
  project_id: '',
  trigger: { type: 'issue_created' },
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const getTriggerType = (trigger) => {
  if (typeof trigger === 'string') {
    return trigger;
  }

  return trigger?.type || trigger?.event || trigger?.name || '';
};

const getTriggerLabel = (trigger) => {
  const type = getTriggerType(trigger);
  return automationTriggerOptions.find((option) => option.value === type)?.label || type || '-';
};

const formatDateTime = (value, fallback = 'Never') => {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return dateTimeFormatter.format(date);
};

const getStatusClassName = (status) => {
  if (status === 'success') {
    return 'bg-green-100 text-green-700';
  }

  if (status === 'failed') {
    return 'bg-red-100 text-red-700';
  }

  if (status === 'skipped') {
    return 'bg-slate-100 text-slate-700';
  }

  return 'bg-blue-100 text-blue-700';
};

const normalizeArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const normalizeRuleForForm = (rule) => ({
  actions: normalizeArray(rule.actions).length ? normalizeArray(rule.actions) : initialRuleForm.actions,
  conditions: normalizeArray(rule.conditions),
  description: rule.description || '',
  is_enabled: Boolean(rule.is_enabled),
  name: rule.name || '',
  project_id: rule.project_id || '',
  trigger: typeof rule.trigger === 'string' ? { type: rule.trigger } : { type: 'issue_created', ...(rule.trigger || {}) },
});

const cleanObject = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(([_key, entryValue]) => {
      if (entryValue === undefined || entryValue === null) {
        return false;
      }

      if (Array.isArray(entryValue)) {
        return entryValue.length > 0;
      }

      return entryValue !== '';
    }),
  );

const sanitizeConditions = (conditions) =>
  normalizeArray(conditions).map((condition) => {
    if (condition.type === 'custom_jql') {
      return cleanObject({
        type: 'custom_jql',
        jql: condition.jql?.trim(),
      });
    }

    return cleanObject({
      type: condition.type || 'field_value',
      field: condition.type === 'field_value' || !condition.type ? condition.field || 'status' : undefined,
      operator: condition.operator || 'equals',
      value: condition.operator === 'is_empty' || condition.operator === 'is_not_empty' ? undefined : condition.value,
    });
  });

const sanitizeActions = (actions) =>
  normalizeArray(actions).map((action) => {
    const type = action.type || 'update_field';

    if (type === 'transition_issue') {
      return cleanObject({
        type,
        status: action.status,
        transition_id: action.transition_id,
      });
    }

    if (type === 'send_notification') {
      return cleanObject({
        type,
        body: action.body?.trim(),
        recipients: normalizeArray(action.recipients),
        title: action.title?.trim(),
        user_ids: normalizeArray(action.user_ids),
      });
    }

    if (type === 'create_issue') {
      return cleanObject({
        type,
        description: action.description?.trim(),
        priority: action.priority || 'Medium',
        status: action.status || 'Not Started',
        title: action.title?.trim(),
      });
    }

    if (type === 'add_comment') {
      return cleanObject({
        type,
        comment: action.comment?.trim(),
      });
    }

    if (type === 'assign_user') {
      return cleanObject({
        type,
        user_ids: normalizeArray(action.user_ids),
      });
    }

    return cleanObject({
      type: 'update_field',
      field: action.field || 'status',
      value: action.value,
    });
  });

const getRuleSummary = (rule) => {
  const conditionCount = normalizeArray(rule.conditions).length;
  const actionCount = normalizeArray(rule.actions).length;

  return `${conditionCount} condition${conditionCount === 1 ? '' : 's'}, ${actionCount} action${actionCount === 1 ? '' : 's'}`;
};

function AutomationToggle({ disabled, enabled, onChange }) {
  return (
    <button
      aria-label={enabled ? 'Disable automation rule' : 'Enable automation rule'}
      className={[
        'inline-flex h-7 w-12 items-center rounded-full p-1 transition',
        enabled ? 'justify-end bg-green-500' : 'justify-start bg-slate-300',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:ring-2 hover:ring-primary/20',
      ].join(' ')}
      disabled={disabled}
      type="button"
      onClick={onChange}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

function AutomationRulesPage() {
  const { projects } = useProjects();
  const { users } = useUsers();
  const [projectId, setProjectId] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('');
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [error, setError] = useState('');
  const [logsError, setLogsError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(initialRuleForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState('');
  const showToast = useUiStore((state) => state.showToast);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        enabled: enabledFilter || undefined,
        project_id: projectId || undefined,
      };
      setRules(await getAutomationRules(params));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [enabledFilter, projectId]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError('');

    try {
      setLogs(await getAutomationLogs({ limit: 10 }));
    } catch (err) {
      setLogsError(getApiErrorMessage(err));
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const handleRealtimeAutomationEvent = (event) => {
      const payloadProjectId = event.detail?.project_id;

      if (projectId && payloadProjectId && Number(payloadProjectId) !== Number(projectId)) {
        return;
      }

      Promise.all([fetchRules(), fetchLogs()]);
    };

    window.addEventListener('realtime:automation.changed', handleRealtimeAutomationEvent);

    return () => {
      window.removeEventListener('realtime:automation.changed', handleRealtimeAutomationEvent);
    };
  }, [fetchLogs, fetchRules, projectId]);

  const stats = useMemo(() => {
    const enabledRules = rules.filter((rule) => rule.is_enabled).length;
    const executionCount = rules.reduce((total, rule) => total + Number(rule.execution_count || 0), 0);
    const lastRun = rules
      .map((rule) => rule.last_executed_at)
      .filter(Boolean)
      .sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0];

    return {
      enabledRules,
      executionCount,
      lastRun,
      totalRules: rules.length,
    };
  }, [rules]);

  const validateForm = () => {
    const nextErrors = {};
    const actions = sanitizeActions(form.actions);

    if (!form.name.trim()) {
      nextErrors.name = 'Masukkan nama rule.';
    }

    if (!getTriggerType(form.trigger)) {
      nextErrors.trigger = 'Pilih trigger rule.';
    }

    if (!actions.length) {
      nextErrors.actions = 'Minimal satu action diperlukan.';
    }

    actions.forEach((action, index) => {
      if (action.type === 'create_issue' && !action.title) {
        nextErrors.actions = `Action ${index + 1}: title issue wajib diisi.`;
      }

      if (action.type === 'add_comment' && !action.comment) {
        nextErrors.actions = `Action ${index + 1}: comment wajib diisi.`;
      }

      if (action.type === 'assign_user' && !normalizeArray(action.user_ids).length) {
        nextErrors.actions = `Action ${index + 1}: pilih minimal satu user.`;
      }

      if (
        action.type === 'send_notification' &&
        !normalizeArray(action.recipients).length &&
        !normalizeArray(action.user_ids).length
      ) {
        nextErrors.actions = `Action ${index + 1}: pilih minimal satu recipient.`;
      }

      if (action.type === 'transition_issue' && !action.status && !action.transition_id) {
        nextErrors.actions = `Action ${index + 1}: pilih status atau transition ID.`;
      }
    });

    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  const openCreateModal = () => {
    setEditingRule(null);
    setForm({
      ...initialRuleForm,
      actions: [...initialRuleForm.actions],
      project_id: projectId || '',
      trigger: { ...initialRuleForm.trigger },
    });
    setErrors({});
    setModalOpen(true);
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setForm(normalizeRuleForForm(rule));
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditingRule(null);
    setForm(initialRuleForm);
    setErrors({});
    setModalOpen(false);
  };

  const refreshData = async () => {
    await Promise.all([fetchRules(), fetchLogs()]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      actions: sanitizeActions(form.actions),
      conditions: sanitizeConditions(form.conditions),
      description: form.description.trim() || null,
      is_enabled: Boolean(form.is_enabled),
      name: form.name.trim(),
      project_id: form.project_id || null,
      trigger: typeof form.trigger === 'string' ? { type: form.trigger } : form.trigger,
    };

    setSubmitting(true);

    try {
      if (editingRule) {
        await updateAutomationRule(editingRule.id, payload);
        showToast({ type: 'success', message: 'Automation rule diperbarui.' });
      } else {
        await createAutomationRule(payload);
        showToast({ type: 'success', message: 'Automation rule dibuat.' });
      }

      closeModal();
      await refreshData();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRule = async (rule) => {
    setTogglingRuleId(String(rule.id));

    try {
      const savedRule = rule.is_enabled
        ? await disableAutomationRule(rule.id)
        : await enableAutomationRule(rule.id);

      setRules((currentRules) =>
        currentRules.map((currentRule) => (Number(currentRule.id) === Number(savedRule.id) ? savedRule : currentRule)),
      );
      showToast({ type: 'success', message: savedRule.is_enabled ? 'Automation rule diaktifkan.' : 'Automation rule dinonaktifkan.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setTogglingRuleId('');
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Hapus automation rule "${rule.name}"?`)) {
      return;
    }

    try {
      await deleteAutomationRule(rule.id);
      showToast({ type: 'success', message: 'Automation rule dihapus.' });
      await refreshData();
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Administration</p>
          <h1 className="page-title">Automation Rules</h1>
          <p className="page-description">Kelola automation rule untuk trigger, condition, action, dan audit eksekusi issue.</p>
        </div>
        <div className="action-row">
          <button className="btn-secondary" disabled={loading || logsLoading} type="button" onClick={refreshData}>
            <RefreshCw className={`h-4 w-4 ${loading || logsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="btn-primary" type="button" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Create Rule
          </button>
        </div>
      </div>

      <div className="toolbar">
        <label className="grid gap-1 text-sm font-semibold text-text-dark">
          Project
          <select className="field min-w-64" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">All projects and global</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-text-dark">
          Status
          <select className="field min-w-44" value={enabledFilter} onChange={(event) => setEnabledFilter(event.target.value)}>
            <option value="">All rules</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="info-tile">
          <p className="label">Rules</p>
          <p className="mt-1 text-2xl font-bold">{stats.totalRules}</p>
        </div>
        <div className="info-tile">
          <p className="label">Enabled</p>
          <p className="mt-1 text-2xl font-bold">{stats.enabledRules}</p>
        </div>
        <div className="info-tile">
          <p className="label">Executions</p>
          <p className="mt-1 text-2xl font-bold">{stats.executionCount}</p>
        </div>
        <div className="info-tile">
          <p className="label">Last Run</p>
          <p className="mt-1 text-sm font-bold">{formatDateTime(stats.lastRun)}</p>
        </div>
      </div>

      {error ? <div className="card p-6 text-danger">{error}</div> : null}

      <div className="table-shell">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="section-title">Rules</h2>
            <p className="section-subtitle">{rules.length} configured automation rules</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table min-w-[1120px]">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Scope</th>
                <th>Trigger</th>
                <th>Rule Steps</th>
                <th>Executions</th>
                <th>Last Run</th>
                <th>Enabled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="text-text-muted" colSpan="8">
                    Loading automation rules...
                  </td>
                </tr>
              ) : rules.length ? (
                rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-primary">
                          <Bot className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-bold text-text-dark">{rule.name}</p>
                          {rule.description ? <p className="mt-1 max-w-sm text-xs text-text-muted">{rule.description}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td>{rule.project_name || (rule.project_id ? 'Project' : 'Global')}</td>
                    <td>
                      <span className="badge bg-blue-100 text-blue-700">{getTriggerLabel(rule.trigger)}</span>
                    </td>
                    <td className="text-text-muted">{getRuleSummary(rule)}</td>
                    <td className="font-semibold">{rule.execution_count || 0}</td>
                    <td>{formatDateTime(rule.last_executed_at)}</td>
                    <td>
                      <AutomationToggle
                        disabled={String(togglingRuleId) === String(rule.id)}
                        enabled={Boolean(rule.is_enabled)}
                        onChange={() => handleToggleRule(rule)}
                      />
                    </td>
                    <td>
                      <div className="action-row">
                        <button className="btn-secondary py-1" type="button" onClick={() => openEditModal(rule)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button className="btn-secondary py-1 text-danger" type="button" onClick={() => handleDeleteRule(rule)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-text-muted" colSpan="8">
                    Belum ada automation rule.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-shell">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="section-title">Recent Executions</h2>
            <p className="section-subtitle">Latest automation activity across rules.</p>
          </div>
          <Clock3 className="h-4 w-4 text-text-muted" />
        </div>
        {logsError ? <div className="border-b border-border px-4 py-3 text-sm font-semibold text-danger">{logsError}</div> : null}
        <div className="table-scroll">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>Status</th>
                <th>Rule</th>
                <th>Issue</th>
                <th>Duration</th>
                <th>Executed At</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr>
                  <td className="text-text-muted" colSpan="6">
                    Loading execution logs...
                  </td>
                </tr>
              ) : logs.length ? (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className={`badge ${getStatusClassName(log.status)}`}>{log.status}</span>
                    </td>
                    <td className="font-semibold">{log.rule_name || `Rule ${log.rule_id}`}</td>
                    <td>{log.issue_key ? `${log.issue_key} - ${log.issue_title || ''}` : '-'}</td>
                    <td>{log.execution_time_ms ?? 0} ms</td>
                    <td>{formatDateTime(log.executed_at, '-')}</td>
                    <td className="max-w-sm text-danger">{log.error_message || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-text-muted" colSpan="6">
                    Belum ada execution log.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        footer={
          <>
            <button className="btn-secondary" disabled={submitting} type="button" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn-primary" disabled={submitting} form="automation-rule-form" type="submit">
              {submitting ? 'Saving...' : editingRule ? 'Save Changes' : 'Create Rule'}
            </button>
          </>
        }
        open={modalOpen}
        size="2xl"
        title={editingRule ? 'Edit Automation Rule' : 'Create Automation Rule'}
        onClose={closeModal}
      >
        <form id="automation-rule-form" noValidate onSubmit={handleSubmit}>
          {errors.actions ? (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-danger">{errors.actions}</div>
          ) : null}
          <RuleBuilder errors={errors} projects={projects} users={users} value={form} onChange={setForm} />
        </form>
      </Modal>
    </div>
  );
}

export default AutomationRulesPage;
