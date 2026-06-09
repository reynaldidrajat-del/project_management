jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

jest.mock('./activityService', () => ({
  logActivity: jest.fn(),
}));

const { query } = require('../config/db');
const { getProjectById, getProjects } = require('./projectService');

describe('projectService visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it('does not scope admin project lists', async () => {
    await getProjects({}, { user: { id: 1, role: 'admin' } });

    expect(query).toHaveBeenCalledWith(expect.not.stringContaining('project_access_member'), []);
  });

  it('scopes non-admin project lists to owner or project member', async () => {
    await getProjects({}, { user: { id: 7, role: 'member' } });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('project_access_member.project_id = p.id'),
      [7],
    );
    expect(query.mock.calls[0][0]).toContain('p.owner_id = $1');
  });

  it('keeps existing project filters and appends the user visibility parameter', async () => {
    await getProjects({ status: 'Active' }, { user: { id: 7, role: 'viewer' } });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('p.status = $1'), ['Active', 7]);
    expect(query.mock.calls[0][0]).toContain('p.owner_id = $2');
  });

  it('scopes project detail reads for non-admin users', async () => {
    await getProjectById(12, { user: { id: 7, role: 'member' } });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('p.id = $1'),
      [12, 7],
    );
    expect(query.mock.calls[0][0]).toContain('project_access_member.user_id = $2');
  });
});
