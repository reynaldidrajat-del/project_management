ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS actual_start_date DATE,
  ADD COLUMN IF NOT EXISTS actual_end_date DATE,
  ADD COLUMN IF NOT EXISTS actual_duration_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_work_days INTEGER DEFAULT 0;

UPDATE tasks
SET
  actual_duration_days = COALESCE(actual_duration_days, 0),
  actual_work_days = COALESCE(actual_work_days, 0);

ALTER TABLE tasks
  ALTER COLUMN actual_duration_days SET DEFAULT 0,
  ALTER COLUMN actual_work_days SET DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_actual_dates_order'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_actual_dates_order
      CHECK (actual_start_date IS NULL OR actual_end_date IS NULL OR actual_start_date <= actual_end_date);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tasks_actual_dates ON tasks(actual_start_date, actual_end_date);
