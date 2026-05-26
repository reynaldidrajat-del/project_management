const {
  FIBONACCI_SEQUENCE,
  validateStoryPoints,
  setStoryPoints,
  getSprintStoryPoints,
  getEpicStoryPoints,
  getBacklogStoryPoints,
} = require('./storyPointService');

// Mock the database query function
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../config/db');

describe('storyPointService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FIBONACCI_SEQUENCE', () => {
    it('should contain the standard Fibonacci values for estimation', () => {
      expect(FIBONACCI_SEQUENCE).toEqual([1, 2, 3, 5, 8, 13, 21]);
    });

    it('should be an array of 7 elements', () => {
      expect(FIBONACCI_SEQUENCE).toHaveLength(7);
    });
  });

  describe('validateStoryPoints', () => {
    it('should accept null as valid', () => {
      expect(validateStoryPoints(null)).toEqual({ valid: true });
    });

    it('should accept undefined as valid', () => {
      expect(validateStoryPoints(undefined)).toEqual({ valid: true });
    });

    it('should accept 0 as valid', () => {
      expect(validateStoryPoints(0)).toEqual({ valid: true });
    });

    it('should accept positive integers as valid', () => {
      expect(validateStoryPoints(1)).toEqual({ valid: true });
      expect(validateStoryPoints(5)).toEqual({ valid: true });
      expect(validateStoryPoints(13)).toEqual({ valid: true });
      expect(validateStoryPoints(100)).toEqual({ valid: true });
    });

    it('should reject negative numbers', () => {
      const result = validateStoryPoints(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject floating point numbers', () => {
      const result = validateStoryPoints(3.5);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject strings', () => {
      const result = validateStoryPoints('5');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject NaN', () => {
      const result = validateStoryPoints(NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('setStoryPoints', () => {
    it('should update story points on an existing issue', async () => {
      query.mockResolvedValue({
        rowCount: 1,
        rows: [{ id: 1, title: 'Test Task', story_points: 5 }],
      });

      const result = await setStoryPoints(1, 5);
      expect(result).toEqual({ id: 1, title: 'Test Task', story_points: 5 });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tasks'),
        [5, 1]
      );
    });

    it('should allow setting story points to null', async () => {
      query.mockResolvedValue({
        rowCount: 1,
        rows: [{ id: 1, title: 'Test Task', story_points: null }],
      });

      const result = await setStoryPoints(1, null);
      expect(result.story_points).toBeNull();
    });

    it('should throw error for non-existent issue', async () => {
      query.mockResolvedValue({ rowCount: 0, rows: [] });

      await expect(setStoryPoints(999, 5)).rejects.toThrow('Issue not found.');
    });

    it('should throw error for invalid story points', async () => {
      await expect(setStoryPoints(1, -1)).rejects.toThrow(
        'Story points must be a non-negative integer.'
      );
    });

    it('should throw error for non-integer story points', async () => {
      await expect(setStoryPoints(1, 2.5)).rejects.toThrow(
        'Story points must be a non-negative integer.'
      );
    });
  });

  describe('getSprintStoryPoints', () => {
    it('should return total, completed, and remaining story points', async () => {
      query.mockResolvedValue({
        rows: [{ total: 21, completed: 8 }],
      });

      const result = await getSprintStoryPoints(1);
      expect(result).toEqual({ total: 21, completed: 8, remaining: 13 });
    });

    it('should return zeros when sprint has no issues with story points', async () => {
      query.mockResolvedValue({
        rows: [{ total: 0, completed: 0 }],
      });

      const result = await getSprintStoryPoints(1);
      expect(result).toEqual({ total: 0, completed: 0, remaining: 0 });
    });

    it('should query by sprint_id', async () => {
      query.mockResolvedValue({
        rows: [{ total: 10, completed: 3 }],
      });

      await getSprintStoryPoints(42);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('sprint_id = $1'),
        [42]
      );
    });
  });

  describe('getEpicStoryPoints', () => {
    it('should return total, completed, and remaining story points', async () => {
      query.mockResolvedValue({
        rows: [{ total: 34, completed: 13 }],
      });

      const result = await getEpicStoryPoints(5);
      expect(result).toEqual({ total: 34, completed: 13, remaining: 21 });
    });

    it('should return zeros when epic has no issues with story points', async () => {
      query.mockResolvedValue({
        rows: [{ total: 0, completed: 0 }],
      });

      const result = await getEpicStoryPoints(5);
      expect(result).toEqual({ total: 0, completed: 0, remaining: 0 });
    });

    it('should query by epic_id', async () => {
      query.mockResolvedValue({
        rows: [{ total: 0, completed: 0 }],
      });

      await getEpicStoryPoints(7);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('epic_id = $1'),
        [7]
      );
    });
  });

  describe('getBacklogStoryPoints', () => {
    it('should return total, completed, and remaining story points for unassigned issues', async () => {
      query.mockResolvedValue({
        rows: [{ total: 55, completed: 21 }],
      });

      const result = await getBacklogStoryPoints(10);
      expect(result).toEqual({ total: 55, completed: 21, remaining: 34 });
    });

    it('should return zeros when backlog has no issues with story points', async () => {
      query.mockResolvedValue({
        rows: [{ total: 0, completed: 0 }],
      });

      const result = await getBacklogStoryPoints(10);
      expect(result).toEqual({ total: 0, completed: 0, remaining: 0 });
    });

    it('should query by project_id and sprint_id IS NULL', async () => {
      query.mockResolvedValue({
        rows: [{ total: 0, completed: 0 }],
      });

      await getBacklogStoryPoints(3);
      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(/project_id = \$1[\s\S]*sprint_id IS NULL/),
        [3]
      );
    });
  });
});
