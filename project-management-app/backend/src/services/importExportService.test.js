jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('./activityService', () => ({
  logActivity: jest.fn(),
}));

jest.mock('./permissionService', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('./jqlService', () => ({
  buildJqlQuery: jest.fn(() => ({
    orderSql: 't.updated_at DESC, t.id DESC',
    parameters: [],
    whereSql: 't.deleted_at IS NULL',
  })),
}));

jest.mock('./taskService', () => ({
  VALID_PRIORITIES: ['Low', 'Medium', 'High', 'Urgent'],
  VALID_STATUSES: ['Not Started', 'In Progress', 'Waiting Review', 'Done', 'Overdue'],
  createTask: jest.fn(),
}));

const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { hasPermission } = require('./permissionService');
const { createTask } = require('./taskService');
const {
  buildImportPreview,
  executeIssueImport,
  exportIssues,
  parseCsv,
} = require('./importExportService');

describe('importExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    logActivity.mockResolvedValue({});
  });

  it('parses quoted CSV values', () => {
    const parsed = parseCsv('title,description\r\n"Fix, login","Line ""one"""');

    expect(parsed.headers).toEqual(['title', 'description']);
    expect(parsed.rows).toEqual([
      {
        description: 'Line "one"',
        title: 'Fix, login',
      },
    ]);
  });

  it('builds an import preview with mapped fields and validation errors', async () => {
    const preview = await buildImportPreview({
      content: 'Summary,Project,Type,Status\nMapped title,1,2,Done\n,1,2,Done',
      field_mapping: {
        issue_type_id: 'Type',
        project_id: 'Project',
        status: 'Status',
        title: 'Summary',
      },
      format: 'csv',
    });

    expect(preview.total_rows).toBe(2);
    expect(preview.accepted_count).toBe(1);
    expect(preview.rejected_count).toBe(1);
    expect(preview.rows[0].payload).toMatchObject({
      issue_type_id: 2,
      project_id: 1,
      status: 'Done',
      title: 'Mapped title',
    });
    expect(preview.rows[1].errors).toContain('Title wajib diisi.');
  });

  it('imports valid rows and stores mapped custom field values', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM custom_fields')) {
        return {
          rows: [{ field_type: 'text', id: 5, is_required: false, name: 'Risk', options: [] }],
        };
      }

      if (String(sql).includes('INSERT INTO custom_field_values')) {
        return { rows: [{ custom_field_id: 5, id: 9, value: 'High' }] };
      }

      return { rows: [] };
    });
    createTask.mockResolvedValue({ id: 44, project_id: 1, title: 'Imported issue' });

    const result = await executeIssueImport(
      {
        content: 'Summary,Project,Type,Risk Column\nImported issue,1,2,High',
        field_mapping: {
          'custom.Risk': 'Risk Column',
          issue_type_id: 'Type',
          project_id: 'Project',
          title: 'Summary',
        },
        format: 'csv',
      },
      { actor_user_id: 7, user: { id: 7, role: 'manager' } },
    );

    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ issue_type_id: 2, project_id: 1, title: 'Imported issue' }),
      expect.objectContaining({ actor_user_id: 7 }),
    );
    expect(result.succeeded_count).toBe(1);
    expect(result.successes[0].custom_field_values).toEqual([{ custom_field_id: 5, id: 9, value: 'High' }]);
  });

  it('exports custom fields while hiding sensitive fields from non-privileged users', async () => {
    hasPermission
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    query.mockResolvedValue({
      rows: [
        {
          assignee_names: 'Ari',
          custom_fields: { Risk: 'High' },
          environment: 'Production secret',
          issue_key: 'OPS-1',
          priority: 'High',
          project_key: 'OPS',
          project_name: 'Operations',
          status: 'In Progress',
          title: 'Investigate alert',
        },
      ],
    });

    const result = await exportIssues(
      { format: 'csv', project_id: 1 },
      { actor_user_id: 7, user: { id: 7, role: 'member' } },
    );

    expect(result.content).toContain('Custom: Risk');
    expect(result.content).toContain('High');
    expect(result.content).not.toContain('Environment');
    expect(result.content).not.toContain('Production secret');
    expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'issue_export.execute' }));
  });
});
