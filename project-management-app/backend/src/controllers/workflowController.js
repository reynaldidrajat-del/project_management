const {
  createDefaultWorkflow,
  createWorkflow,
  createWorkflowState,
  createWorkflowTransition,
  deleteWorkflow,
  deleteWorkflowState,
  deleteWorkflowTransition,
  getAvailableTransitions,
  getWorkflowById,
  getWorkflowStates,
  getWorkflowTransitions,
  getWorkflows,
  transitionIssue,
  updateWorkflow,
  updateWorkflowState,
  updateWorkflowTransition,
} = require('../services/workflowService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  user_role: req.user?.role,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

/**
 * List all workflows
 */
const listWorkflows = asyncHandler(async (req, res) => {
  const projectId = req.query.project_id || null;
  const workflows = await getWorkflows(projectId);
  sendSuccess(res, workflows);
});

/**
 * Get a single workflow
 */
const getWorkflow = asyncHandler(async (req, res) => {
  const workflow = await getWorkflowById(req.params.id);

  if (!workflow) {
    return sendError(res, 'Workflow not found.', 'Workflow not found.', 404);
  }

  return sendSuccess(res, workflow);
});

/**
 * Get workflow with all states and transitions
 */
const getWorkflowDetails = asyncHandler(async (req, res) => {
  const workflow = await getWorkflowById(req.params.id);

  if (!workflow) {
    return sendError(res, 'Workflow not found.', 'Workflow not found.', 404);
  }

  const [states, transitions] = await Promise.all([
    getWorkflowStates(req.params.id),
    getWorkflowTransitions(req.params.id),
  ]);

  return sendSuccess(res, {
    ...workflow,
    states,
    transitions,
  });
});

/**
 * Create a new workflow
 */
const createWorkflowController = asyncHandler(async (req, res) => {
  const workflow = await createWorkflow(req.body, getRequestActivityContext(req));
  sendSuccess(res, workflow, 'Workflow created successfully.', 201);
});

/**
 * Update a workflow
 */
const updateWorkflowController = asyncHandler(async (req, res) => {
  const workflow = await updateWorkflow(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, workflow, 'Workflow updated successfully.');
});

/**
 * Delete a workflow
 */
const deleteWorkflowController = asyncHandler(async (req, res) => {
  await deleteWorkflow(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, null, 'Workflow deleted successfully.');
});

/**
 * Get all states for a workflow
 */
const listWorkflowStates = asyncHandler(async (req, res) => {
  const states = await getWorkflowStates(req.params.workflowId);
  sendSuccess(res, states);
});

/**
 * Create a workflow state
 */
const createWorkflowStateController = asyncHandler(async (req, res) => {
  const state = await createWorkflowState(req.params.workflowId, req.body, getRequestActivityContext(req));
  sendSuccess(res, state, 'State created successfully.', 201);
});

/**
 * Update a workflow state
 */
const updateWorkflowStateController = asyncHandler(async (req, res) => {
  const state = await updateWorkflowState(req.params.stateId, req.body, getRequestActivityContext(req));
  sendSuccess(res, state, 'State updated successfully.');
});

/**
 * Delete a workflow state
 */
const deleteWorkflowStateController = asyncHandler(async (req, res) => {
  await deleteWorkflowState(req.params.stateId, getRequestActivityContext(req));
  sendSuccess(res, null, 'State deleted successfully.');
});

/**
 * Get all transitions for a workflow
 */
const listWorkflowTransitions = asyncHandler(async (req, res) => {
  const transitions = await getWorkflowTransitions(req.params.workflowId);
  sendSuccess(res, transitions);
});

/**
 * Create a workflow transition
 */
const createWorkflowTransitionController = asyncHandler(async (req, res) => {
  const transition = await createWorkflowTransition(req.params.workflowId, req.body, getRequestActivityContext(req));
  sendSuccess(res, transition, 'Transition created successfully.', 201);
});

/**
 * Update a workflow transition
 */
const updateWorkflowTransitionController = asyncHandler(async (req, res) => {
  const transition = await updateWorkflowTransition(req.params.transitionId, req.body, getRequestActivityContext(req));
  sendSuccess(res, transition, 'Transition updated successfully.');
});

/**
 * Delete a workflow transition
 */
const deleteWorkflowTransitionController = asyncHandler(async (req, res) => {
  await deleteWorkflowTransition(req.params.transitionId, getRequestActivityContext(req));
  sendSuccess(res, null, 'Transition deleted successfully.');
});

/**
 * Get available transitions for an issue
 */
const listAvailableTransitions = asyncHandler(async (req, res) => {
  const transitions = await getAvailableTransitions(req.params.issueId);
  sendSuccess(res, transitions);
});

/**
 * Transition an issue to a new state
 */
const executeTransition = asyncHandler(async (req, res) => {
  const issue = await transitionIssue(
    req.params.issueId,
    req.params.transitionId,
    req.body,
    getRequestActivityContext(req)
  );
  sendSuccess(res, issue, 'Issue transitioned successfully.');
});

/**
 * Create default workflow for a project
 */
const createDefault = asyncHandler(async (req, res) => {
  const workflow = await createDefaultWorkflow(req.params.projectId, getRequestActivityContext(req));
  sendSuccess(res, workflow, 'Default workflow created successfully.', 201);
});

module.exports = {
  createDefault,
  createWorkflow: createWorkflowController,
  createWorkflowState: createWorkflowStateController,
  createWorkflowTransition: createWorkflowTransitionController,
  deleteWorkflow: deleteWorkflowController,
  deleteWorkflowState: deleteWorkflowStateController,
  deleteWorkflowTransition: deleteWorkflowTransitionController,
  executeTransition,
  getAvailableTransitions: listAvailableTransitions,
  getWorkflow,
  getWorkflowDetails,
  listWorkflowStates,
  listWorkflowTransitions,
  listWorkflows,
  updateWorkflow: updateWorkflowController,
  updateWorkflowState: updateWorkflowStateController,
  updateWorkflowTransition: updateWorkflowTransitionController,
};
