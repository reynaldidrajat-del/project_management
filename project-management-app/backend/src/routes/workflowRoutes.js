const express = require('express');
const router = express.Router();
const {
  createDefault,
  createWorkflow,
  createWorkflowState,
  createWorkflowTransition,
  deleteWorkflow,
  deleteWorkflowState,
  deleteWorkflowTransition,
  executeTransition,
  getAvailableTransitions,
  getWorkflow,
  getWorkflowDetails,
  listWorkflowStates,
  listWorkflowTransitions,
  listWorkflows,
  updateWorkflow,
  updateWorkflowState,
  updateWorkflowTransition,
} = require('../controllers/workflowController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/permissionMiddleware');

// All routes require authentication
router.use(authenticateRequest);

// Workflow routes
/**
 * @route GET /api/workflows
 * @desc List all workflows
 * @query {number} project_id - Filter by project ID
 */
router.get('/', listWorkflows);

/**
 * @route GET /api/workflows/:id
 * @desc Get a single workflow
 */
router.get('/:id', getWorkflow);

/**
 * @route GET /api/workflows/:id/details
 * @desc Get workflow with all states and transitions
 */
router.get('/:id/details', getWorkflowDetails);

/**
 * @route POST /api/workflows
 * @desc Create a new workflow
 */
router.post('/', checkPermission('manage_workflows'), createWorkflow);

/**
 * @route PUT /api/workflows/:id
 * @desc Update a workflow
 */
router.put('/:id', checkPermission('manage_workflows'), updateWorkflow);

/**
 * @route DELETE /api/workflows/:id
 * @desc Delete a workflow
 */
router.delete('/:id', checkPermission('manage_workflows'), deleteWorkflow);

/**
 * @route POST /api/workflows/default/:projectId
 * @desc Create default workflow for a project
 */
router.post('/default/:projectId', checkPermission('manage_workflows'), createDefault);

// Workflow states routes
/**
 * @route GET /api/workflows/:workflowId/states
 * @desc Get all states for a workflow
 */
router.get('/:workflowId/states', listWorkflowStates);

/**
 * @route POST /api/workflows/:workflowId/states
 * @desc Create a workflow state
 */
router.post('/:workflowId/states', checkPermission('manage_workflows'), createWorkflowState);

/**
 * @route PUT /api/workflows/states/:stateId
 * @desc Update a workflow state
 */
router.put('/states/:stateId', checkPermission('manage_workflows'), updateWorkflowState);

/**
 * @route DELETE /api/workflows/states/:stateId
 * @desc Delete a workflow state
 */
router.delete('/states/:stateId', checkPermission('manage_workflows'), deleteWorkflowState);

// Workflow transitions routes
/**
 * @route GET /api/workflows/:workflowId/transitions
 * @desc Get all transitions for a workflow
 */
router.get('/:workflowId/transitions', listWorkflowTransitions);

/**
 * @route POST /api/workflows/:workflowId/transitions
 * @desc Create a workflow transition
 */
router.post('/:workflowId/transitions', checkPermission('manage_workflows'), createWorkflowTransition);

/**
 * @route PUT /api/workflows/transitions/:transitionId
 * @desc Update a workflow transition
 */
router.put('/transitions/:transitionId', checkPermission('manage_workflows'), updateWorkflowTransition);

/**
 * @route DELETE /api/workflows/transitions/:transitionId
 * @desc Delete a workflow transition
 */
router.delete('/transitions/:transitionId', checkPermission('manage_workflows'), deleteWorkflowTransition);

// Issue transition routes
/**
 * @route GET /api/workflows/issues/:issueId/transitions
 * @desc Get available transitions for an issue
 */
router.get('/issues/:issueId/transitions', getAvailableTransitions);

/**
 * @route POST /api/workflows/issues/:issueId/transitions/:transitionId
 * @desc Execute a transition on an issue
 */
router.post('/issues/:issueId/transitions/:transitionId', checkPermission('execute_workflows'), executeTransition);

module.exports = router;
