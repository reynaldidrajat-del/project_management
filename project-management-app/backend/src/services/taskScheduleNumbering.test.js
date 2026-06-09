jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('./activityService', () => ({
  logActivity: jest.fn(),
}));

const { query } = require('../config/db');
const {
  addScheduleIssueKeys,
  buildTaskTree,
  formatScheduleIssueKey,
} = require('./taskService');

describe('task schedule numbering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats schedule issue keys as project code plus a padded sequence', () => {
    expect(formatScheduleIssueKey('AO', 3)).toBe('AO03');
    expect(formatScheduleIssueKey('asset', 12)).toBe('ASSET12');
  });

  it('adds hierarchical schedule issue keys for child and grandchild tasks', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: 14,
          issue_key: 'AO-1',
          project_id: 1,
          project_key: 'AO',
          project_name: 'Aset Operasional',
          parent_task_id: null,
          start_date: '2026-01-01',
          sort_order: 0,
        },
        {
          id: 10,
          issue_key: 'AO-2',
          project_id: 1,
          project_key: 'AO',
          project_name: 'Aset Operasional',
          parent_task_id: null,
          start_date: '2026-01-02',
          sort_order: 0,
        },
        {
          id: 11,
          issue_key: 'AO-3',
          project_id: 1,
          project_key: 'AO',
          project_name: 'Aset Operasional',
          parent_task_id: 10,
          start_date: '2026-01-03',
          sort_order: 0,
        },
        {
          id: 12,
          issue_key: 'AO-4',
          project_id: 1,
          project_key: 'AO',
          project_name: 'Aset Operasional',
          parent_task_id: 11,
          start_date: '2026-01-04',
          sort_order: 0,
        },
        {
          id: 13,
          issue_key: 'AO-5',
          project_id: 1,
          project_key: 'AO',
          project_name: 'Aset Operasional',
          parent_task_id: 10,
          start_date: '2026-01-05',
          sort_order: 0,
        },
      ],
    });

    const tasks = await addScheduleIssueKeys([
      { id: 10, issue_key: 'AO-2', project_id: 1, project_key: 'AO', project_name: 'Aset Operasional' },
      { id: 11, issue_key: 'AO-3', project_id: 1, project_key: 'AO', project_name: 'Aset Operasional', parent_task_id: 10 },
      { id: 12, issue_key: 'AO-4', project_id: 1, project_key: 'AO', project_name: 'Aset Operasional', parent_task_id: 11 },
      { id: 13, issue_key: 'AO-5', project_id: 1, project_key: 'AO', project_name: 'Aset Operasional', parent_task_id: 10 },
    ]);

    expect(tasks.map((task) => task.schedule_issue_key)).toEqual(['AO02', 'AO02.1', 'AO02.1.1', 'AO02.2']);
    expect(tasks.map((task) => task.schedule_hierarchy_path)).toEqual(['2', '2.1', '2.1.1', '2.2']);
    expect(tasks.map((task) => task.schedule_sequence_number)).toEqual([2, 3, 4, 5]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('parent_task_id'), [[1], [10, 11, 12, 13]]);
  });

  it('sorts root tasks and child tasks by start date before sort order', () => {
    const tree = buildTaskTree([
      { id: 1, project_id: 1, project_name: 'A', project_start_date: '2026-01-01', sort_order: 0, start_date: '2026-01-02' },
      { id: 2, project_id: 1, project_name: 'A', project_start_date: '2026-01-01', sort_order: 99, start_date: '2026-01-01' },
      { id: 3, parent_task_id: 1, project_id: 1, project_name: 'A', project_start_date: '2026-01-01', sort_order: 10, start_date: '2026-01-04' },
      { id: 4, parent_task_id: 1, project_id: 1, project_name: 'A', project_start_date: '2026-01-01', sort_order: 99, start_date: '2026-01-03' },
    ]);

    expect(tree.map((task) => task.id)).toEqual([2, 1]);
    expect(tree[1].children.map((task) => task.id)).toEqual([4, 3]);
  });
});
