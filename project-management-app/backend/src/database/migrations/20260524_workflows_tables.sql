-- Migration: Workflows Tables
-- Creates workflow engine tables for Jira parity
-- Requirements: 2.1, 2.2

-- ============================================================================
-- Workflows Table
-- Stores workflow definitions that can be project-specific or global
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one default workflow per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_default_per_project
  ON workflows(project_id)
  WHERE is_default = TRUE AND project_id IS NOT NULL;

-- Index for looking up workflows by project
CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id);

-- ============================================================================
-- Workflow States Table
-- Stores the states (statuses) within each workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_states (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('TODO', 'IN_PROGRESS', 'DONE')),
  color VARCHAR(30),
  sort_order INTEGER DEFAULT 0,
  is_initial BOOLEAN DEFAULT FALSE,
  is_final BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure only one initial state per workflow
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_states_initial_per_workflow
  ON workflow_states(workflow_id)
  WHERE is_initial = TRUE;

-- Index for ordering states within a workflow
CREATE INDEX IF NOT EXISTS idx_workflow_states_workflow_id ON workflow_states(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_states_sort_order ON workflow_states(workflow_id, sort_order);

-- ============================================================================
-- Workflow Transitions Table
-- Stores allowed transitions between states with conditions, validators, and post-functions
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_transitions (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  from_state_id INTEGER NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
  to_state_id INTEGER NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
  conditions JSONB DEFAULT '[]'::JSONB,
  validators JSONB DEFAULT '[]'::JSONB,
  post_functions JSONB DEFAULT '[]'::JSONB,
  screen_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding transitions from a specific state
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_from_state ON workflow_transitions(from_state_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_to_state ON workflow_transitions(to_state_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_workflow_id ON workflow_transitions(workflow_id);

-- ============================================================================
-- Add updated_at trigger for new tables
-- ============================================================================
DO $$
BEGIN
  -- Workflows trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflows_updated_at'
  ) THEN
    CREATE TRIGGER trg_workflows_updated_at
      BEFORE UPDATE ON workflows
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Workflow states trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflow_states_updated_at'
  ) THEN
    CREATE TRIGGER trg_workflow_states_updated_at
      BEFORE UPDATE ON workflow_states
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Workflow transitions trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflow_transitions_updated_at'
  ) THEN
    CREATE TRIGGER trg_workflow_transitions_updated_at
      BEFORE UPDATE ON workflow_transitions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- ============================================================================
-- Create default workflow for each existing project
-- ============================================================================
DO $$
DECLARE
  proj RECORD;
  workflow_id_val INTEGER;
  todo_state_id INTEGER;
  in_progress_state_id INTEGER;
  done_state_id INTEGER;
BEGIN
  -- Iterate over all existing projects
  FOR proj IN SELECT id FROM projects LOOP
    -- Check if project already has a default workflow
    IF NOT EXISTS (
      SELECT 1 FROM workflows WHERE project_id = proj.id AND is_default = TRUE
    ) THEN
      -- Create default workflow for the project
      INSERT INTO workflows (name, description, project_id, is_default)
      VALUES (
        'Default Workflow',
        'Standard workflow with To Do, In Progress, and Done states',
        proj.id,
        TRUE
      )
      RETURNING id INTO workflow_id_val;

      -- Create To Do state (initial)
      INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
      VALUES (
        workflow_id_val,
        'To Do',
        'TODO',
        'slate',
        1,
        TRUE,
        FALSE
      )
      RETURNING id INTO todo_state_id;

      -- Create In Progress state
      INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
      VALUES (
        workflow_id_val,
        'In Progress',
        'IN_PROGRESS',
        'blue',
        2,
        FALSE,
        FALSE
      )
      RETURNING id INTO in_progress_state_id;

      -- Create Done state (final)
      INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
      VALUES (
        workflow_id_val,
        'Done',
        'DONE',
        'green',
        3,
        FALSE,
        TRUE
      )
      RETURNING id INTO done_state_id;

      -- Create transition: To Do -> In Progress
      INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
      VALUES (
        workflow_id_val,
        'Start Progress',
        todo_state_id,
        in_progress_state_id,
        1
      );

      -- Create transition: In Progress -> Done
      INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
      VALUES (
        workflow_id_val,
        'Complete',
        in_progress_state_id,
        done_state_id,
        2
      );

      -- Create transition: In Progress -> To Do (back to backlog)
      INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
      VALUES (
        workflow_id_val,
        'Stop Progress',
        in_progress_state_id,
        todo_state_id,
        3
      );

      -- Create transition: Done -> In Progress (reopen)
      INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
      VALUES (
        workflow_id_val,
        'Reopen',
        done_state_id,
        in_progress_state_id,
        4
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- Create a global default workflow for new projects (project_id = NULL)
-- ============================================================================
DO $$
DECLARE
  workflow_id_val INTEGER;
  todo_state_id INTEGER;
  in_progress_state_id INTEGER;
  done_state_id INTEGER;
BEGIN
  -- Check if global default workflow exists
  IF NOT EXISTS (
    SELECT 1 FROM workflows WHERE project_id IS NULL AND is_default = TRUE
  ) THEN
    -- Create global default workflow
    INSERT INTO workflows (name, description, project_id, is_default)
    VALUES (
      'System Default Workflow',
      'Default workflow template for new projects with standard states',
      NULL,
      TRUE
    )
    RETURNING id INTO workflow_id_val;

    -- Create To Do state (initial)
    INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
    VALUES (
      workflow_id_val,
      'To Do',
      'TODO',
      'slate',
      1,
      TRUE,
      FALSE
    )
    RETURNING id INTO todo_state_id;

    -- Create In Progress state
    INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
    VALUES (
      workflow_id_val,
      'In Progress',
      'IN_PROGRESS',
      'blue',
      2,
      FALSE,
      FALSE
    )
    RETURNING id INTO in_progress_state_id;

    -- Create Done state (final)
    INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
    VALUES (
      workflow_id_val,
      'Done',
      'DONE',
      'green',
      3,
      FALSE,
      TRUE
    )
    RETURNING id INTO done_state_id;

    -- Create transition: To Do -> In Progress
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (
      workflow_id_val,
      'Start Progress',
      todo_state_id,
      in_progress_state_id,
      1
    );

    -- Create transition: In Progress -> Done
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (
      workflow_id_val,
      'Complete',
      in_progress_state_id,
      done_state_id,
      2
    );

    -- Create transition: In Progress -> To Do
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (
      workflow_id_val,
      'Stop Progress',
      in_progress_state_id,
      todo_state_id,
      3
    );

    -- Create transition: Done -> In Progress
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (
      workflow_id_val,
      'Reopen',
      done_state_id,
      in_progress_state_id,
      4
    );
  END IF;
END;
$$;
