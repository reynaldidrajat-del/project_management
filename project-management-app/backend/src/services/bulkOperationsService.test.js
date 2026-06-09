jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('./activityService', () => ({
  logActivity: jest.fn(),
}));

jest.mock('./permissionService', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('./taskService', () => ({
  VALID_STATUSES: ['Not Started', 'In Progress', 'Waiting Review', 'Done', 'Overdue'],
  deleteTask: jest.fn(),
  getTaskById: jest.fn(),
  updateTask: jest.fn(),
  updateTaskStatus: jest.fn(),
}));

const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { hasPermission } = require('./permissionService');
const {
  getTaskById,
  updateTask,
  updateTaskStatus,
} = require('./taskService');
const { executeBulkOperation } = require('./bulkOperationsService');

const memberUser = { id: 7, role: 'member' };

const mockIssueQuery = (rows) => {
  query.mockImplementation(async (sql) => {
    if (String(sql).includes('FROM tasks t')) {
      return { rows };
    }

    return { rows: [] };
  });
};

describe('bulkOperationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    logActivity.mockResolvedValue({});
  });

  it('processes allowed issues and reports per-issue permission failures', async () => {
    mockIssueQuery([
      {
        id: 10,
        is_project_member: true,
        project_id: 3,
        project_owner_id: 99,
        title: 'Allowed issue',
      },
      {
        id: 11,
        is_project_member: false,
        project_id: 4,
        project_owner_id: 99,
        title: 'Blocked issue',
      },
    ]);
    updateTaskStatus.mockResolvedValue({ id: 10, status: 'Done' });

    const result = await executeBulkOperation(
      { action: 'status', issue_ids: [10, 11], status: 'Done' },
      { actor_user_id: memberUser.id, user: memberUser },
    );

    expect(updateTaskStatus).toHaveBeenCalledTimes(1);
    expect(updateTaskStatus).toHaveBeenCalledWith(10, 'Done', expect.objectContaining({ actor_user_id: 7 }));
    expect(result.succeeded_count).toBe(1);
    expect(result.failed_count).toBe(1);
    expect(result.failures[0]).toMatchObject({ issue_id: 11, success: false });
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'bulk_operation.status',
      metadata: expect.objectContaining({ failed_count: 1, succeeded_count: 1 }),
    }));
  });

  it('continues when a requested issue does not exist', async () => {
    mockIssueQuery([
      {
        id: 10,
        is_project_member: true,
        project_id: 3,
        project_owner_id: 99,
        title: 'Existing issue',
      },
    ]);
    updateTaskStatus.mockResolvedValue({ id: 10, status: 'In Progress' });

    const result = await executeBulkOperation(
      { action: 'status', issue_ids: [10, 999], status: 'In Progress' },
      { actor_user_id: memberUser.id, user: memberUser },
    );

    expect(result.succeeded_count).toBe(1);
    expect(result.failed_count).toBe(1);
    expect(result.failures[0]).toMatchObject({ issue_id: 999, reason: 'Issue tidak ditemukan.' });
  });

  it('validates assignees and applies assignee changes with partial results', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM users')) {
        return { rows: [{ id: 2 }, { id: 3 }] };
      }

      if (String(sql).includes('FROM tasks t')) {
        return {
          rows: [
            {
              id: 10,
              is_project_member: true,
              project_id: 3,
              project_owner_id: 99,
              title: 'Allowed issue',
            },
          ],
        };
      }

      return { rows: [] };
    });
    updateTask.mockResolvedValue({ assignee_ids: [2, 3], id: 10 });

    const result = await executeBulkOperation(
      { action: 'assignee', assignee_ids: [2, 3], issue_ids: [10] },
      { actor_user_id: memberUser.id, user: memberUser },
    );

    expect(updateTask).toHaveBeenCalledWith(
      10,
      { assignee_id: 2, assignee_ids: [2, 3] },
      expect.objectContaining({ actor_user_id: 7 }),
    );
    expect(getTaskById).not.toHaveBeenCalled();
    expect(result.succeeded_count).toBe(1);
  });

  it('fails all requested issues when the user lacks the base bulk permission', async () => {
    hasPermission.mockResolvedValue(false);
    mockIssueQuery([
      {
        id: 10,
        is_project_member: true,
        project_id: 3,
        project_owner_id: 99,
        title: 'Allowed issue',
      },
    ]);

    const result = await executeBulkOperation(
      { action: 'status', issue_ids: [10], status: 'Done' },
      { actor_user_id: memberUser.id, user: memberUser },
    );

    expect(updateTaskStatus).not.toHaveBeenCalled();
    expect(result.succeeded_count).toBe(0);
    expect(result.failed_count).toBe(1);
  });
});
