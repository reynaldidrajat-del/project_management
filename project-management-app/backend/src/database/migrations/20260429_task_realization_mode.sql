ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS realization_mode VARCHAR(20);

UPDATE tasks
SET realization_mode = 'normal'
WHERE actual_start_date IS NOT NULL
  AND realization_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_realization_mode_allowed'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_realization_mode_allowed
      CHECK (realization_mode IS NULL OR realization_mode IN ('normal', 'manual'));
  END IF;
END;
$$;
