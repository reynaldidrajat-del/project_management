const {
  createAutomationRule,
  deleteAutomationRule,
  getRuleById,
  listAutomationLogs,
  listAutomationRules,
  setAutomationRuleEnabled,
  triggerAutomation,
  updateAutomationRule,
} = require('../services/automationService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_role: req.user?.role || req.headers['x-user-role'] || null,
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const listRules = asyncHandler(async (req, res) => {
  const rules = await listAutomationRules(req.query);
  sendSuccess(res, rules);
});

const getRule = asyncHandler(async (req, res) => {
  const rule = await getRuleById(req.params.id);

  if (!rule) {
    return sendError(res, 'Automation rule not found.', 'Automation rule not found.', 404);
  }

  return sendSuccess(res, rule);
});

const createRule = asyncHandler(async (req, res) => {
  const rule = await createAutomationRule(req.body, getRequestActivityContext(req));
  sendSuccess(res, rule, 'Automation rule created successfully.', 201);
});

const updateRule = asyncHandler(async (req, res) => {
  const rule = await updateAutomationRule(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, rule, 'Automation rule updated successfully.');
});

const enableRule = asyncHandler(async (req, res) => {
  const rule = await setAutomationRuleEnabled(req.params.id, true, getRequestActivityContext(req));
  sendSuccess(res, rule, 'Automation rule enabled successfully.');
});

const disableRule = asyncHandler(async (req, res) => {
  const rule = await setAutomationRuleEnabled(req.params.id, false, getRequestActivityContext(req));
  sendSuccess(res, rule, 'Automation rule disabled successfully.');
});

const deleteRule = asyncHandler(async (req, res) => {
  const result = await deleteAutomationRule(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, result, 'Automation rule deleted successfully.');
});

const listLogs = asyncHandler(async (req, res) => {
  const logs = await listAutomationLogs({ ...req.query, rule_id: req.params.id || req.query.rule_id });
  sendSuccess(res, logs);
});

const trigger = asyncHandler(async (req, res) => {
  const eventType = req.body.event_type || req.body.eventType || req.body.trigger;

  if (!eventType) {
    return sendError(res, 'Automation event type is required.', 'Validation failed.', 400);
  }

  const result = await triggerAutomation(
    eventType,
    req.body.issue_id || req.body.issueId || null,
    req.body.payload || {},
    getRequestActivityContext(req),
  );

  return sendSuccess(res, result, 'Automation trigger executed successfully.');
});

module.exports = {
  createRule,
  deleteRule,
  disableRule,
  enableRule,
  getRule,
  listLogs,
  listRules,
  trigger,
  updateRule,
};
