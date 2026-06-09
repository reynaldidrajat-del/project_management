const { z } = require('zod');
const { executeBulkOperation } = require('../services/bulkOperationsService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');
const { parseSchema } = require('../utils/zodUtils');

const positiveInteger = z.coerce.number().int().positive();
const nullablePositiveInteger = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.number().int().positive().nullable(),
);

const issueIdsSchema = z.union([
  z.array(positiveInteger).min(1, 'Pilih minimal satu issue.'),
  positiveInteger.transform((value) => [value]),
]);

const bulkOperationSchema = z.object({
  action: z.enum(['status', 'assignee', 'sprint', 'delete']),
  assignee_id: nullablePositiveInteger.optional(),
  assignee_ids: z.array(positiveInteger).optional(),
  assigneeId: nullablePositiveInteger.optional(),
  assigneeIds: z.array(positiveInteger).optional(),
  issue_ids: issueIdsSchema.optional(),
  issueIds: issueIdsSchema.optional(),
  sprint_id: nullablePositiveInteger.optional(),
  sprintId: nullablePositiveInteger.optional(),
  status: z.string().trim().optional(),
  task_ids: issueIdsSchema.optional(),
  taskIds: issueIdsSchema.optional(),
}).refine(
  (payload) => payload.issue_ids || payload.issueIds || payload.task_ids || payload.taskIds,
  'Pilih minimal satu issue.',
);

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user: req.user,
  user_agent: req.headers['user-agent'],
});

const execute = asyncHandler(async (req, res) => {
  const payload = parseSchema(bulkOperationSchema, req.body || {});
  const result = await executeBulkOperation(payload, getRequestActivityContext(req));

  sendSuccess(res, result, 'Bulk operation berhasil diproses.');
});

const executeWithAction = (action) =>
  asyncHandler(async (req, res) => {
    const payload = parseSchema(bulkOperationSchema, {
      ...(req.body || {}),
      action,
    });
    const result = await executeBulkOperation(payload, getRequestActivityContext(req));

    sendSuccess(res, result, 'Bulk operation berhasil diproses.');
  });

module.exports = {
  execute,
  executeAssigneeChange: executeWithAction('assignee'),
  executeDelete: executeWithAction('delete'),
  executeSprintAssignment: executeWithAction('sprint'),
  executeStatusChange: executeWithAction('status'),
};
