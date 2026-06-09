import { Plus, Trash2, WandSparkles } from 'lucide-react';

import FormField from '../shared/FormField';

export const automationTriggerOptions = [
  { value: 'issue_created', label: 'Issue Created' },
  { value: 'issue_updated', label: 'Issue Updated' },
  { value: 'issue_transitioned', label: 'Issue Transitioned' },
  { value: 'comment_created', label: 'Comment Created' },
  { value: 'work_logged', label: 'Work Logged' },
  { value: 'sprint_started', label: 'Sprint Started' },
  { value: 'sprint_completed', label: 'Sprint Completed' },
  { value: 'version_released', label: 'Version Released' },
];

export const automationFieldOptions = [
  { value: 'assignee_id', label: 'Assignee' },
  { value: 'bucket_id', label: 'Bucket' },
  { value: 'description', label: 'Description' },
  { value: 'end_date', label: 'End Date' },
  { value: 'epic_id', label: 'Epic' },
  { value: 'priority', label: 'Priority' },
  { value: 'progress', label: 'Progress' },
  { value: 'resolution', label: 'Resolution' },
  { value: 'sprint_id', label: 'Sprint' },
  { value: 'start_date', label: 'Start Date' },
  { value: 'status', label: 'Status' },
  { value: 'story_points', label: 'Story Points' },
  { value: 'title', label: 'Title' },
  { value: 'workflow_state_id', label: 'Workflow State' },
];

const conditionTypeOptions = [
  { value: 'field_value', label: 'Field Value' },
  { value: 'issue_type', label: 'Issue Type' },
  { value: 'user_role', label: 'User Role' },
  { value: 'custom_jql', label: 'Custom JQL' },
];

const operatorOptions = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does Not Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'in', label: 'In' },
  { value: 'not_in', label: 'Not In' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

const statusOptions = ['Not Started', 'In Progress', 'Waiting Review', 'Done', 'Overdue'];

const priorityOptions = ['Lowest', 'Low', 'Medium', 'High', 'Highest', 'Critical'];

const actionTypeOptions = [
  { value: 'update_field', label: 'Update Field' },
  { value: 'transition_issue', label: 'Transition Issue' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'create_issue', label: 'Create Issue' },
  { value: 'add_comment', label: 'Add Comment' },
  { value: 'assign_user', label: 'Assign User' },
];

const recipientOptions = [
  { value: 'assignee', label: 'Assignee' },
  { value: 'reporter', label: 'Reporter' },
  { value: 'watchers', label: 'Watchers' },
];

const defaultRule = {
  actions: [],
  conditions: [],
  description: '',
  is_enabled: true,
  name: '',
  project_id: '',
  trigger: { type: 'issue_created' },
};

const ruleTemplates = [
  {
    description: 'Move newly assigned work into progress.',
    label: 'Start Assigned Issue',
    value: {
      actions: [{ type: 'transition_issue', status: 'In Progress' }],
      conditions: [{ type: 'field_value', field: 'assignee_id', operator: 'is_not_empty', value: '' }],
      description: 'Move an issue to In Progress when it has an assignee.',
      name: 'Start assigned issue',
      trigger: { type: 'issue_updated' },
    },
  },
  {
    description: 'Close work when progress reaches 100.',
    label: 'Close Completed Issue',
    value: {
      actions: [{ type: 'transition_issue', status: 'Done' }],
      conditions: [{ type: 'field_value', field: 'progress', operator: 'equals', value: '100' }],
      description: 'Move an issue to Done when progress is complete.',
      name: 'Close completed issue',
      trigger: { type: 'issue_updated' },
    },
  },
  {
    description: 'Notify issue watchers after comments.',
    label: 'Notify Watchers',
    value: {
      actions: [
        {
          type: 'send_notification',
          body: 'A new comment was added to the issue.',
          recipients: ['watchers'],
          title: 'New issue comment',
        },
      ],
      conditions: [],
      description: 'Notify watchers when a comment is added.',
      name: 'Notify watchers on comment',
      trigger: { type: 'comment_created' },
    },
  },
  {
    description: 'Create a follow-up task after done transition.',
    label: 'Create Follow-Up',
    value: {
      actions: [
        {
          type: 'create_issue',
          description: 'Created by automation after the source issue moved to Done.',
          priority: 'Medium',
          status: 'Not Started',
          title: 'Follow-up task',
        },
      ],
      conditions: [{ type: 'field_value', field: 'status', operator: 'equals', value: 'Done' }],
      description: 'Create a follow-up issue when work reaches Done.',
      name: 'Create follow-up after done',
      trigger: { type: 'issue_transitioned' },
    },
  },
];

const createCondition = (type = 'field_value') => {
  if (type === 'custom_jql') {
    return { type, jql: 'status != Done' };
  }

  if (type === 'issue_type') {
    return { type, operator: 'equals', value: 'Bug' };
  }

  if (type === 'user_role') {
    return { type, operator: 'equals', value: 'admin' };
  }

  return { type, field: 'status', operator: 'equals', value: 'Not Started' };
};

const createAction = (type = 'update_field') => {
  if (type === 'transition_issue') {
    return { type, status: 'In Progress' };
  }

  if (type === 'send_notification') {
    return {
      type,
      body: 'Automation rule executed.',
      recipients: ['assignee'],
      title: 'Automation notification',
      user_ids: [],
    };
  }

  if (type === 'create_issue') {
    return {
      type,
      description: '',
      priority: 'Medium',
      status: 'Not Started',
      title: 'Follow-up task',
    };
  }

  if (type === 'add_comment') {
    return { type, comment: 'Updated by automation.' };
  }

  if (type === 'assign_user') {
    return { type, user_ids: [] };
  }

  return { type, field: 'status', value: 'In Progress' };
};

const normalizeRule = (value) => ({
  ...defaultRule,
  ...value,
  actions: Array.isArray(value?.actions) && value.actions.length ? value.actions : [createAction()],
  conditions: Array.isArray(value?.conditions) ? value.conditions : [],
  trigger: typeof value?.trigger === 'string' ? { type: value.trigger } : { type: 'issue_created', ...(value?.trigger || {}) },
});

const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const getTriggerLabel = (type) => automationTriggerOptions.find((option) => option.value === type)?.label || type;

function OptionCheckbox({ checked, label, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text-dark">
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function RuleBuilder({ errors = {}, projects = [], users = [], value, onChange }) {
  const rule = normalizeRule(value);

  const patchRule = (patch) => {
    onChange({ ...rule, ...patch });
  };

  const updateField = (field, nextValue) => {
    patchRule({ [field]: nextValue });
  };

  const updateTrigger = (field, nextValue) => {
    patchRule({ trigger: { ...rule.trigger, [field]: nextValue } });
  };

  const applyTemplate = (template) => {
    patchRule({
      ...template.value,
      is_enabled: rule.is_enabled,
      project_id: rule.project_id,
    });
  };

  const updateCondition = (index, patch) => {
    updateField(
      'conditions',
      rule.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, ...patch } : condition,
      ),
    );
  };

  const setConditionType = (index, type) => {
    updateField(
      'conditions',
      rule.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? createCondition(type) : condition,
      ),
    );
  };

  const removeCondition = (index) => {
    updateField(
      'conditions',
      rule.conditions.filter((_condition, conditionIndex) => conditionIndex !== index),
    );
  };

  const updateAction = (index, patch) => {
    updateField(
      'actions',
      rule.actions.map((action, actionIndex) => (actionIndex === index ? { ...action, ...patch } : action)),
    );
  };

  const setActionType = (index, type) => {
    updateField(
      'actions',
      rule.actions.map((action, actionIndex) => (actionIndex === index ? createAction(type) : action)),
    );
  };

  const removeAction = (index) => {
    const nextActions = rule.actions.filter((_action, actionIndex) => actionIndex !== index);
    updateField('actions', nextActions.length ? nextActions : [createAction()]);
  };

  const toggleActionArrayValue = (index, field, option, checked) => {
    const action = rule.actions[index] || {};
    const currentValues = new Set(toArray(action[field]).map(String));

    if (checked) {
      currentValues.add(String(option));
    } else {
      currentValues.delete(String(option));
    }

    updateAction(index, { [field]: Array.from(currentValues) });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-slate-50 p-4">
        <div className="mb-3 flex items-start gap-2">
          <WandSparkles className="mt-1 h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-text-dark">Rule Templates</h3>
            <p className="text-xs text-text-muted">Use a template as a starting point, then adjust trigger, conditions, and actions.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ruleTemplates.map((template) => (
            <button
              key={template.label}
              className="rounded-lg border border-border bg-white p-3 text-left transition hover:border-primary/50 hover:bg-blue-50"
              type="button"
              onClick={() => applyTemplate(template)}
            >
              <span className="block text-sm font-bold text-text-dark">{template.label}</span>
              <span className="mt-1 block text-xs text-text-muted">{template.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <FormField error={errors.name} htmlFor="automation-rule-name" label="Rule Name" required>
          <input
            className={`field mt-1 ${errors.name ? 'field-error' : ''}`}
            id="automation-rule-name"
            value={rule.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </FormField>
        <FormField htmlFor="automation-rule-project" label="Project Scope">
          <select
            className="field mt-1"
            id="automation-rule-project"
            value={rule.project_id || ''}
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
        <FormField className="md:col-span-2" htmlFor="automation-rule-description" label="Description">
          <textarea
            className="field mt-1 min-h-20 resize-y"
            id="automation-rule-description"
            value={rule.description || ''}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </FormField>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-text-dark">
          <input
            checked={Boolean(rule.is_enabled)}
            type="checkbox"
            onChange={(event) => updateField('is_enabled', event.target.checked)}
          />
          <span>Enabled</span>
        </label>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-text-dark">Trigger</h3>
            <p className="text-xs text-text-muted">Run this rule when {getTriggerLabel(rule.trigger.type)} happens.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField error={errors.trigger} htmlFor="automation-rule-trigger" label="Event" required>
            <select
              className={`field mt-1 ${errors.trigger ? 'field-error' : ''}`}
              id="automation-rule-trigger"
              value={rule.trigger.type || ''}
              onChange={(event) => updateTrigger('type', event.target.value)}
            >
              {automationTriggerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-text-dark">Conditions</h3>
            <p className="text-xs text-text-muted">All conditions must pass. Leave empty to always run for the trigger.</p>
          </div>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => updateField('conditions', [...rule.conditions, createCondition()])}
          >
            <Plus className="h-4 w-4" />
            Condition
          </button>
        </div>

        {rule.conditions.length ? (
          <div className="space-y-3">
            {rule.conditions.map((condition, index) => (
              <div key={`condition-${index}`} className="rounded-lg border border-border bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-text-dark">Condition {index + 1}</p>
                  <button className="btn-secondary px-2 py-1 text-danger" type="button" onClick={() => removeCondition(index)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <FormField htmlFor={`automation-condition-type-${index}`} label="Type">
                    <select
                      className="field mt-1"
                      id={`automation-condition-type-${index}`}
                      value={condition.type || 'field_value'}
                      onChange={(event) => setConditionType(index, event.target.value)}
                    >
                      {conditionTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  {condition.type === 'custom_jql' ? (
                    <FormField className="md:col-span-2" htmlFor={`automation-condition-jql-${index}`} label="JQL">
                      <textarea
                        className="field mt-1 min-h-20 resize-y font-mono"
                        id={`automation-condition-jql-${index}`}
                        value={condition.jql || ''}
                        onChange={(event) => updateCondition(index, { jql: event.target.value })}
                      />
                    </FormField>
                  ) : (
                    <>
                      {condition.type === 'field_value' || !condition.type ? (
                        <FormField htmlFor={`automation-condition-field-${index}`} label="Field">
                          <select
                            className="field mt-1"
                            id={`automation-condition-field-${index}`}
                            value={condition.field || 'status'}
                            onChange={(event) => updateCondition(index, { field: event.target.value })}
                          >
                            {automationFieldOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </FormField>
                      ) : null}
                      <FormField htmlFor={`automation-condition-operator-${index}`} label="Operator">
                        <select
                          className="field mt-1"
                          id={`automation-condition-operator-${index}`}
                          value={condition.operator || 'equals'}
                          onChange={(event) => updateCondition(index, { operator: event.target.value })}
                        >
                          {operatorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      {condition.operator === 'is_empty' || condition.operator === 'is_not_empty' ? null : (
                        <FormField htmlFor={`automation-condition-value-${index}`} label="Value">
                          <input
                            className="field mt-1"
                            id={`automation-condition-value-${index}`}
                            value={condition.value || ''}
                            onChange={(event) => updateCondition(index, { value: event.target.value })}
                          />
                        </FormField>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No conditions. This rule runs whenever the trigger matches.</div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-text-dark">Actions</h3>
            <p className="text-xs text-text-muted">Actions run in order after the trigger and conditions match.</p>
          </div>
          <button className="btn-secondary" type="button" onClick={() => updateField('actions', [...rule.actions, createAction()])}>
            <Plus className="h-4 w-4" />
            Action
          </button>
        </div>

        <div className="space-y-3">
          {rule.actions.map((action, index) => (
            <div key={`action-${index}`} className="rounded-lg border border-border bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-text-dark">Action {index + 1}</p>
                <button
                  className="btn-secondary px-2 py-1 text-danger"
                  disabled={rule.actions.length <= 1}
                  type="button"
                  onClick={() => removeAction(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <FormField htmlFor={`automation-action-type-${index}`} label="Type">
                  <select
                    className="field mt-1"
                    id={`automation-action-type-${index}`}
                    value={action.type || 'update_field'}
                    onChange={(event) => setActionType(index, event.target.value)}
                  >
                    {actionTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                {action.type === 'update_field' || !action.type ? (
                  <>
                    <FormField htmlFor={`automation-action-field-${index}`} label="Field">
                      <select
                        className="field mt-1"
                        id={`automation-action-field-${index}`}
                        value={action.field || 'status'}
                        onChange={(event) => updateAction(index, { field: event.target.value })}
                      >
                        {automationFieldOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField htmlFor={`automation-action-value-${index}`} label="Value">
                      <input
                        className="field mt-1"
                        id={`automation-action-value-${index}`}
                        value={action.value || ''}
                        onChange={(event) => updateAction(index, { value: event.target.value })}
                      />
                    </FormField>
                  </>
                ) : null}

                {action.type === 'transition_issue' ? (
                  <>
                    <FormField htmlFor={`automation-action-status-${index}`} label="Status">
                      <select
                        className="field mt-1"
                        id={`automation-action-status-${index}`}
                        value={action.status || 'In Progress'}
                        onChange={(event) => updateAction(index, { status: event.target.value })}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField htmlFor={`automation-action-transition-${index}`} label="Transition ID">
                      <input
                        className="field mt-1"
                        id={`automation-action-transition-${index}`}
                        placeholder="Optional"
                        value={action.transition_id || ''}
                        onChange={(event) => updateAction(index, { transition_id: event.target.value })}
                      />
                    </FormField>
                  </>
                ) : null}

                {action.type === 'send_notification' ? (
                  <>
                    <FormField className="md:col-span-2" htmlFor={`automation-action-title-${index}`} label="Title">
                      <input
                        className="field mt-1"
                        id={`automation-action-title-${index}`}
                        value={action.title || ''}
                        onChange={(event) => updateAction(index, { title: event.target.value })}
                      />
                    </FormField>
                    <FormField className="md:col-span-3" htmlFor={`automation-action-body-${index}`} label="Message">
                      <textarea
                        className="field mt-1 min-h-20 resize-y"
                        id={`automation-action-body-${index}`}
                        value={action.body || ''}
                        onChange={(event) => updateAction(index, { body: event.target.value })}
                      />
                    </FormField>
                    <div className="md:col-span-3">
                      <p className="label">Dynamic Recipients</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {recipientOptions.map((recipient) => (
                          <OptionCheckbox
                            key={recipient.value}
                            checked={toArray(action.recipients).map(String).includes(recipient.value)}
                            label={recipient.label}
                            onChange={(checked) => toggleActionArrayValue(index, 'recipients', recipient.value, checked)}
                          />
                        ))}
                      </div>
                    </div>
                    {users.length ? (
                      <div className="md:col-span-3">
                        <p className="label">Specific Users</p>
                        <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
                          {users.map((user) => (
                            <OptionCheckbox
                              key={user.id}
                              checked={toArray(action.user_ids).map(String).includes(String(user.id))}
                              label={user.name || user.email || `User ${user.id}`}
                              onChange={(checked) => toggleActionArrayValue(index, 'user_ids', user.id, checked)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {action.type === 'create_issue' ? (
                  <>
                    <FormField className="md:col-span-2" htmlFor={`automation-action-title-${index}`} label="Title">
                      <input
                        className="field mt-1"
                        id={`automation-action-title-${index}`}
                        value={action.title || ''}
                        onChange={(event) => updateAction(index, { title: event.target.value })}
                      />
                    </FormField>
                    <FormField htmlFor={`automation-action-priority-${index}`} label="Priority">
                      <select
                        className="field mt-1"
                        id={`automation-action-priority-${index}`}
                        value={action.priority || 'Medium'}
                        onChange={(event) => updateAction(index, { priority: event.target.value })}
                      >
                        {priorityOptions.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField htmlFor={`automation-action-created-status-${index}`} label="Status">
                      <select
                        className="field mt-1"
                        id={`automation-action-created-status-${index}`}
                        value={action.status || 'Not Started'}
                        onChange={(event) => updateAction(index, { status: event.target.value })}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField className="md:col-span-3" htmlFor={`automation-action-description-${index}`} label="Description">
                      <textarea
                        className="field mt-1 min-h-20 resize-y"
                        id={`automation-action-description-${index}`}
                        value={action.description || ''}
                        onChange={(event) => updateAction(index, { description: event.target.value })}
                      />
                    </FormField>
                  </>
                ) : null}

                {action.type === 'add_comment' ? (
                  <FormField className="md:col-span-2" htmlFor={`automation-action-comment-${index}`} label="Comment">
                    <textarea
                      className="field mt-1 min-h-20 resize-y"
                      id={`automation-action-comment-${index}`}
                      value={action.comment || ''}
                      onChange={(event) => updateAction(index, { comment: event.target.value })}
                    />
                  </FormField>
                ) : null}

                {action.type === 'assign_user' && users.length ? (
                  <div className="md:col-span-2">
                    <p className="label">Users</p>
                    <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">
                      {users.map((user) => (
                        <OptionCheckbox
                          key={user.id}
                          checked={toArray(action.user_ids).map(String).includes(String(user.id))}
                          label={user.name || user.email || `User ${user.id}`}
                          onChange={(checked) => toggleActionArrayValue(index, 'user_ids', user.id, checked)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {action.type === 'assign_user' && !users.length ? (
                  <div className="md:col-span-2 rounded-lg border border-dashed border-border bg-white p-3 text-sm font-semibold text-text-muted">
                    User list is unavailable.
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default RuleBuilder;
