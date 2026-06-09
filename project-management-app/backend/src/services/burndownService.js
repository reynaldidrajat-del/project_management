const { query } = require('../config/db');
const { getCalendarExceptionMap } = require('./calendarService');
const { eachDateInclusive, formatDateKey } = require('../utils/dateUtils');
const { isWorkingDay } = require('../utils/workdayUtils');

const normalizePositiveInteger = (value, fieldName = 'ID') => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const normalizeMode = (mode) => (mode === 'issue_count' ? 'issue_count' : 'story_points');

const getSprintForBurndown = async (sprintId) => {
  const result = await query(
    `
    SELECT
      id,
      project_id,
      name,
      start_date,
      end_date,
      state,
      completed_at,
      created_at
    FROM sprints
    WHERE id = $1
    `,
    [sprintId],
  );

  if (!result.rows[0]) {
    throw new Error('Sprint not found.');
  }

  return result.rows[0];
};

const getSprintIssuesForBurndown = async (sprintId) => {
  const result = await query(
    `
    SELECT
      t.id,
      COALESCE(t.story_points, 0)::INTEGER AS story_points,
      t.status,
      t.created_at,
      t.updated_at,
      t.completed_at,
      COALESCE(ws.is_final, FALSE) AS is_final
    FROM tasks t
    LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
    WHERE t.sprint_id = $1
    `,
    [sprintId],
  );

  return result.rows;
};

const getIssueWeight = (issue, mode, hasStoryPoints) => {
  if (mode === 'issue_count' || !hasStoryPoints) {
    return 1;
  }

  return Number(issue.story_points || 0);
};

const getCompletionDate = (issue) => {
  if (!(issue.status === 'Done' || issue.is_final)) {
    return null;
  }

  return issue.completed_at || issue.updated_at || null;
};

const getBurndownData = async (sprintId, options = {}) => {
  const normalizedSprintId = normalizePositiveInteger(sprintId, 'Sprint ID');
  const sprint = await getSprintForBurndown(normalizedSprintId);
  const issues = await getSprintIssuesForBurndown(normalizedSprintId);
  const mode = normalizeMode(options.mode);
  const hasStoryPoints = issues.some((issue) => Number(issue.story_points || 0) > 0);
  const effectiveMode = mode === 'story_points' && hasStoryPoints ? 'story_points' : 'issue_count';
  const sprintStartDate = formatDateKey(sprint.start_date) || formatDateKey(sprint.created_at) || formatDateKey(new Date());
  const sprintEndDate = formatDateKey(sprint.end_date) || formatDateKey(sprint.completed_at) || formatDateKey(new Date());
  const exceptionByDate = await getCalendarExceptionMap();
  const workingDates = eachDateInclusive(sprintStartDate, sprintEndDate)
    .filter((date) => isWorkingDay(date, exceptionByDate))
    .map((date) => formatDateKey(date));
  const dateKeys = workingDates.length ? workingDates : [sprintStartDate];
  const totalScope = issues.reduce((sum, issue) => sum + getIssueWeight(issue, effectiveMode, hasStoryPoints), 0);
  let previousRemaining = null;

  const points = dateKeys.map((dateKey, index) => {
    const dateEnd = new Date(`${dateKey}T23:59:59`);
    const currentScope = issues
      .filter((issue) => !issue.created_at || new Date(issue.created_at) <= dateEnd)
      .reduce((sum, issue) => sum + getIssueWeight(issue, effectiveMode, hasStoryPoints), 0);
    const completedByDate = issues
      .filter((issue) => {
        const completionDate = getCompletionDate(issue);
        return completionDate ? new Date(completionDate) <= dateEnd : false;
      })
      .reduce((sum, issue) => sum + getIssueWeight(issue, effectiveMode, hasStoryPoints), 0);
    const idealRemaining = dateKeys.length <= 1
      ? 0
      : Math.max(0, Math.round(totalScope - ((totalScope / (dateKeys.length - 1)) * index)));
    const actualRemaining = Math.max(0, currentScope - completedByDate);
    const scopeChange = Math.max(0, currentScope - totalScope);
    const workIncreased = previousRemaining !== null && actualRemaining > previousRemaining;

    previousRemaining = actualRemaining;

    return {
      actual_remaining: actualRemaining,
      completed: completedByDate,
      date: dateKey,
      ideal_remaining: idealRemaining,
      scope: currentScope,
      scope_change,
      work_increased: workIncreased,
    };
  });

  return {
    mode: effectiveMode,
    points,
    sprint: {
      id: sprint.id,
      name: sprint.name,
      project_id: sprint.project_id,
      state: sprint.state,
    },
    sprint_id: normalizedSprintId,
    total_scope: totalScope,
  };
};

module.exports = {
  getBurndownData,
};
