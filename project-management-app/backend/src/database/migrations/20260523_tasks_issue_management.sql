-- Migration: Extend tasks table for Jira parity issue management
-- Requirements: 1.6, 6.1, 5.2, 3.1
-- Task: 1.3 - Add columns: issue_type_id, issue_key, story_points, epic_id, sprint_id, 
--       workflow_state_id, resolution, environment, affects_versions, fix_versions, components

-- ============================================================================
-- Add columns for issue type management
-- ============================================================================

-- Add issue_type_id column (references issue_types table from task 1.1)
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS issue_type_id INTEGER;

-- Add issue_key column for unique issue identifier (e.g., 'PROJ-123')
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS issue_key VARCHAR(50);

-- Add story_points column for estimation
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS story_points INTEGER;

-- ============================================================================
-- Add columns for epic and sprint relationships
-- ============================================================================

-- Add epic_id column (references epics table from task 1.5)
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS epic_id INTEGER;

-- Add sprint_id column (references sprints table from task 1.4)
-- Note: sprint_id may already exist if task 1.4 migration ran first
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS sprint_id INTEGER;

-- ============================================================================
-- Add columns for workflow management
-- ============================================================================

-- Add workflow_state_id column (references workflow_states table from task 1.2)
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS workflow_state_id INTEGER;

-- ============================================================================
-- Add columns for issue resolution and environment
-- ============================================================================

-- Add resolution column for tracking issue resolution
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS resolution VARCHAR(100);

-- Add environment column for bug tracking
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS environment TEXT;

-- ============================================================================
-- Add columns for version tracking
-- ============================================================================

-- Add affects_versions column as array of version names
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS affects_versions TEXT[];

-- Add fix_versions column as array of version names
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS fix_versions TEXT[];

-- ============================================================================
-- Add column for component assignment
-- ============================================================================

-- Add components column as array of component names
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS components TEXT[];

-- ============================================================================
-- Add foreign key constraints (only if referenced tables exist)
-- ============================================================================

-- Add foreign key constraint for issue_type_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issue_types') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'tasks_issue_type_id_fkey' 
      AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks 
        ADD CONSTRAINT tasks_issue_type_id_fkey 
        FOREIGN KEY (issue_type_id) REFERENCES issue_types(id) ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;

-- Add foreign key constraint for epic_id
-- Note: epics table has issue_id that references tasks, creating a circular reference
-- This is intentional - epic_id on a task links it to an epic
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'epics') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'tasks_epic_id_fkey' 
      AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks 
        ADD CONSTRAINT tasks_epic_id_fkey 
        FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;

-- Add foreign key constraint for sprint_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sprints') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'tasks_sprint_id_fkey' 
      AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks 
        ADD CONSTRAINT tasks_sprint_id_fkey 
        FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;

-- Add foreign key constraint for workflow_state_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_states') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'tasks_workflow_state_id_fkey' 
      AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks 
        ADD CONSTRAINT tasks_workflow_state_id_fkey 
        FOREIGN KEY (workflow_state_id) REFERENCES workflow_states(id) ON DELETE SET NULL;
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- Add check constraints for data validation
-- ============================================================================

-- Add check constraint for story_points to be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tasks_story_points_non_negative' 
    AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks 
      ADD CONSTRAINT tasks_story_points_non_negative 
      CHECK (story_points IS NULL OR story_points >= 0);
  END IF;
END;
$$;

-- ============================================================================
-- Create indexes for efficient querying
-- ============================================================================

-- Index for issue_type_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_issue_type_id ON tasks(issue_type_id);

-- Unique index for issue_key (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_issue_key ON tasks(issue_key) WHERE issue_key IS NOT NULL;

-- Index for epic_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);

-- Index for sprint_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);

-- Index for workflow_state_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_state_id ON tasks(workflow_state_id);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN tasks.issue_type_id IS 'References issue_types.id - type classification (Epic, Story, Task, Bug, Subtask)';
COMMENT ON COLUMN tasks.issue_key IS 'Unique issue identifier in format {PROJECT_KEY}-{NUMBER} (e.g., PROJ-123)';
COMMENT ON COLUMN tasks.story_points IS 'Estimation value using Fibonacci sequence (1, 2, 3, 5, 8, 13, 21)';
COMMENT ON COLUMN tasks.epic_id IS 'References epics.id - parent epic for Stories, Tasks, and Bugs';
COMMENT ON COLUMN tasks.sprint_id IS 'References sprints.id - sprint assignment for Agile workflow';
COMMENT ON COLUMN tasks.workflow_state_id IS 'References workflow_states.id - current state in workflow';
COMMENT ON COLUMN tasks.resolution IS 'Resolution status when issue is completed (e.g., Fixed, Wont Fix, Duplicate)';
COMMENT ON COLUMN tasks.environment IS 'Environment where bug was observed (e.g., Production, Staging, Development)';
COMMENT ON COLUMN tasks.affects_versions IS 'Array of version names where this issue is known to occur';
COMMENT ON COLUMN tasks.fix_versions IS 'Array of version names where this issue is planned to be fixed';
COMMENT ON COLUMN tasks.components IS 'Array of component names this issue is associated with';

