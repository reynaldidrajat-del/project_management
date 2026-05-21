BEGIN;

WITH RECURSIVE descendant_dates AS (
  SELECT
    parent.id AS parent_id,
    child.id AS child_id,
    child.end_date
  FROM tasks parent
  INNER JOIN tasks child ON child.parent_task_id = parent.id

  UNION ALL

  SELECT
    descendant_dates.parent_id,
    child.id AS child_id,
    child.end_date
  FROM descendant_dates
  INNER JOIN tasks child ON child.parent_task_id = descendant_dates.child_id
),
parent_end_rollups AS (
  SELECT
    parent_id,
    MAX(end_date) FILTER (WHERE end_date IS NOT NULL) AS max_child_end_date
  FROM descendant_dates
  GROUP BY parent_id
),
updated_parent_tasks AS (
  UPDATE tasks parent
  SET
    end_date = parent_end_rollups.max_child_end_date,
    duration_days = calculate_duration_days_sql(parent.start_date, parent_end_rollups.max_child_end_date),
    work_days = calculate_work_days_sql(parent.start_date, parent_end_rollups.max_child_end_date)
  FROM parent_end_rollups
  WHERE parent.id = parent_end_rollups.parent_id
    AND parent_end_rollups.max_child_end_date IS NOT NULL
    AND (parent.end_date IS NULL OR parent.end_date < parent_end_rollups.max_child_end_date)
  RETURNING parent.id
)
SELECT COUNT(*) AS updated_parent_task_count
FROM updated_parent_tasks;

COMMIT;
