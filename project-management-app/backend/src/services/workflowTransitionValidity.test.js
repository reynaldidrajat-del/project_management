jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('./activityService', () => ({
  logActivity: jest.fn(),
}));

jest.mock('./automationService', () => ({
  triggerAutomation: jest.fn(),
}));

jest.mock('./dashboardMetricsService', () => ({
  emitDashboardMetricsUpdated: jest.fn(),
}));

jest.mock('./realtimeService', () => ({
  emitToProject: jest.fn(),
  emitToProjectOrWorkspace: jest.fn(),
  emitToTask: jest.fn(),
}));

const { canTransitionIssue } = require('./workflowService');

describe('workflow transition validity property', () => {
  it('allows a transition only when the issue is in the source state and conditions pass', () => {
    const stateIds = [1, 2, 3, 4, 5];
    const conditionResults = [
      { passed: true },
      { message: 'Condition failed.', passed: false },
    ];

    stateIds.forEach((issueStateId) => {
      stateIds.forEach((fromStateId) => {
        stateIds.forEach((toStateId) => {
          conditionResults.forEach((conditionResult) => {
            const issue = { id: 99, workflow_state_id: issueStateId };
            const transition = {
              from_state_id: fromStateId,
              id: 12,
              to_state_id: toStateId,
            };
            const expected = issueStateId === fromStateId && conditionResult.passed;

            expect(canTransitionIssue(issue, transition, conditionResult)).toBe(expected);
          });
        });
      });
    });
  });

  it('rejects missing issue or transition values', () => {
    expect(canTransitionIssue(null, { from_state_id: 1 })).toBe(false);
    expect(canTransitionIssue({ workflow_state_id: 1 }, null)).toBe(false);
  });
});
