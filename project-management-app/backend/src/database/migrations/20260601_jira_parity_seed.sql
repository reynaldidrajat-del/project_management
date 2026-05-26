-- Migration: JIRA Parity Seed Data
-- Seeds system issue types with correct hierarchy and default workflow with 4 states
-- Requirements: 1.1, 2.1, 2.8
-- 
-- This migration ensures:
-- 1. System issue types exist with correct icons, colors, and hierarchy rules
-- 2. A global "Default Workflow" exists with To Do, In Progress, In Review, Done states
-- 3. Workflow transitions cover all required paths including reject and reopen
-- 4. Backward compatibility with existing bucket-based status system (Req 2.8)

-- ============================================================================
-- PART 1: Seed System Issue Types
-- Updates existing system issue types or inserts new ones with correct metadata
-- Hierarchy: Epic(0) > Story(1) > Task/Bug(2) > Subtask(3)
-- ============================================================================

-- Update existing system issue types to match required icons and colors
-- Using DO block to handle both insert and update scenarios idempotently
DO $$
BEGIN
  -- Epic - hierarchy_level: 0
  IF EXISTS (SELECT 1 FROM issue_types WHERE name = 'Epic' AND is_system = TRUE AND project_id IS NULL) THEN
    UPDATE issue_types SET
      icon = 'flash',
      color = '#6554C0',
      hierarchy_level = 0,
      allowed_parent_types = ARRAY[]::TEXT[],
      allowed_child_types = ARRAY['Story', 'Task', 'Bug']::TEXT[],
      updated_at = CURRENT_TIMESTAMP
    WHERE name = 'Epic' AND is_system = TRUE AND project_id IS NULL;
  ELSE
    INSERT INTO issue_types (name, icon, color, hierarchy_level, allowed_parent_types, allowed_child_types, is_system, project_id)
    VALUES ('Epic', 'flash', '#6554C0', 0, ARRAY[]::TEXT[], ARRAY['Story', 'Task', 'Bug']::TEXT[], TRUE, NULL);
  END IF;

  -- Story - hierarchy_level: 1
  IF EXISTS (SELECT 1 FROM issue_types WHERE name = 'Story' AND is_system = TRUE AND project_id IS NULL) THEN
    UPDATE issue_types SET
      icon = 'bookmark',
      color = '#36B37E',
      hierarchy_level = 1,
      allowed_parent_types = ARRAY['Epic']::TEXT[],
      allowed_child_types = ARRAY['Task', 'Subtask']::TEXT[],
      updated_at = CURRENT_TIMESTAMP
    WHERE name = 'Story' AND is_system = TRUE AND project_id IS NULL;
  ELSE
    INSERT INTO issue_types (name, icon, color, hierarchy_level, allowed_parent_types, allowed_child_types, is_system, project_id)
    VALUES ('Story', 'bookmark', '#36B37E', 1, ARRAY['Epic']::TEXT[], ARRAY['Task', 'Subtask']::TEXT[], TRUE, NULL);
  END IF;

  -- Task - hierarchy_level: 2
  IF EXISTS (SELECT 1 FROM issue_types WHERE name = 'Task' AND is_system = TRUE AND project_id IS NULL) THEN
    UPDATE issue_types SET
      icon = 'check-square',
      color = '#4C9AFF',
      hierarchy_level = 2,
      allowed_parent_types = ARRAY['Epic', 'Story']::TEXT[],
      allowed_child_types = ARRAY['Subtask']::TEXT[],
      updated_at = CURRENT_TIMESTAMP
    WHERE name = 'Task' AND is_system = TRUE AND project_id IS NULL;
  ELSE
    INSERT INTO issue_types (name, icon, color, hierarchy_level, allowed_parent_types, allowed_child_types, is_system, project_id)
    VALUES ('Task', 'check-square', '#4C9AFF', 2, ARRAY['Epic', 'Story']::TEXT[], ARRAY['Subtask']::TEXT[], TRUE, NULL);
  END IF;

  -- Bug - hierarchy_level: 2
  IF EXISTS (SELECT 1 FROM issue_types WHERE name = 'Bug' AND is_system = TRUE AND project_id IS NULL) THEN
    UPDATE issue_types SET
      icon = 'alert-circle',
      color = '#FF5630',
      hierarchy_level = 2,
      allowed_parent_types = ARRAY['Epic', 'Story']::TEXT[],
      allowed_child_types = ARRAY['Subtask']::TEXT[],
      updated_at = CURRENT_TIMESTAMP
    WHERE name = 'Bug' AND is_system = TRUE AND project_id IS NULL;
  ELSE
    INSERT INTO issue_types (name, icon, color, hierarchy_level, allowed_parent_types, allowed_child_types, is_system, project_id)
    VALUES ('Bug', 'alert-circle', '#FF5630', 2, ARRAY['Epic', 'Story']::TEXT[], ARRAY['Subtask']::TEXT[], TRUE, NULL);
  END IF;

  -- Subtask - hierarchy_level: 3
  IF EXISTS (SELECT 1 FROM issue_types WHERE name = 'Subtask' AND is_system = TRUE AND project_id IS NULL) THEN
    UPDATE issue_types SET
      icon = 'minus-square',
      color = '#6B778C',
      hierarchy_level = 3,
      allowed_parent_types = ARRAY['Story', 'Task', 'Bug']::TEXT[],
      allowed_child_types = ARRAY[]::TEXT[],
      updated_at = CURRENT_TIMESTAMP
    WHERE name = 'Subtask' AND is_system = TRUE AND project_id IS NULL;
  ELSE
    INSERT INTO issue_types (name, icon, color, hierarchy_level, allowed_parent_types, allowed_child_types, is_system, project_id)
    VALUES ('Subtask', 'minus-square', '#6B778C', 3, ARRAY['Story', 'Task', 'Bug']::TEXT[], ARRAY[]::TEXT[], TRUE, NULL);
  END IF;
END;
$$;

-- ============================================================================
-- PART 2: Seed Default Workflow with 4 States
-- Creates a global "Default Workflow" with To Do, In Progress, In Review, Done
-- This extends the existing 3-state workflow to include a review step
-- Maintains backward compatibility with bucket-based status (Req 2.8):
--   - TODO category maps to existing "Not Started" / bucket initial state
--   - IN_PROGRESS category maps to existing "In Progress" bucket state
--   - DONE category maps to existing "Completed" bucket state
-- ============================================================================

DO $$
DECLARE
  v_workflow_id INTEGER;
  v_todo_id INTEGER;
  v_in_progress_id INTEGER;
  v_in_review_id INTEGER;
  v_done_id INTEGER;
BEGIN
  -- Check if "Default Workflow" already exists as a global workflow
  SELECT id INTO v_workflow_id
  FROM workflows
  WHERE name = 'Default Workflow' AND project_id IS NULL AND is_default = TRUE;

  -- If it doesn't exist, create it
  IF v_workflow_id IS NULL THEN
    INSERT INTO workflows (name, description, project_id, is_default)
    VALUES (
      'Default Workflow',
      'Standard 4-state workflow with To Do, In Progress, In Review, and Done states. Supports code review process with reject and reopen transitions.',
      NULL,
      TRUE
    )
    RETURNING id INTO v_workflow_id;

    -- Create workflow states
    -- State 1: To Do (initial state, TODO category)
    INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
    VALUES (v_workflow_id, 'To Do', 'TODO', '#6B778C', 1, TRUE, FALSE)
    RETURNING id INTO v_todo_id;

    -- State 2: In Progress (IN_PROGRESS category)
    INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
    VALUES (v_workflow_id, 'In Progress', 'IN_PROGRESS', '#0052CC', 2, FALSE, FALSE)
    RETURNING id INTO v_in_progress_id;

    -- State 3: In Review (IN_PROGRESS category - still active work)
    INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
    VALUES (v_workflow_id, 'In Review', 'IN_PROGRESS', '#FF991F', 3, FALSE, FALSE)
    RETURNING id INTO v_in_review_id;

    -- State 4: Done (final state, DONE category)
    INSERT INTO workflow_states (workflow_id, name, category, color, sort_order, is_initial, is_final)
    VALUES (v_workflow_id, 'Done', 'DONE', '#36B37E', 4, FALSE, TRUE)
    RETURNING id INTO v_done_id;

    -- ========================================================================
    -- Create workflow transitions
    -- ========================================================================

    -- Transition 1: To Do → In Progress (start work)
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (v_workflow_id, 'Start Progress', v_todo_id, v_in_progress_id, 1);

    -- Transition 2: In Progress → In Review (submit for review)
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (v_workflow_id, 'Submit for Review', v_in_progress_id, v_in_review_id, 2);

    -- Transition 3: In Review → Done (approve)
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (v_workflow_id, 'Approve', v_in_review_id, v_done_id, 3);

    -- Transition 4: In Review → In Progress (reject - send back for rework)
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (v_workflow_id, 'Reject', v_in_review_id, v_in_progress_id, 4);

    -- Transition 5: In Progress → To Do (reopen - move back to backlog)
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (v_workflow_id, 'Reopen', v_in_progress_id, v_todo_id, 5);

    -- Transition 6: Done → To Do (reopen - reopen completed issue)
    INSERT INTO workflow_transitions (workflow_id, name, from_state_id, to_state_id, sort_order)
    VALUES (v_workflow_id, 'Reopen', v_done_id, v_todo_id, 6);

    RAISE NOTICE 'Created Default Workflow (id: %) with 4 states and 6 transitions', v_workflow_id;
  ELSE
    RAISE NOTICE 'Default Workflow already exists (id: %), skipping creation', v_workflow_id;
  END IF;

  -- ========================================================================
  -- Link system issue types to the Default Workflow
  -- ========================================================================
  UPDATE issue_types
  SET default_workflow_id = v_workflow_id
  WHERE is_system = TRUE
    AND project_id IS NULL
    AND (default_workflow_id IS NULL OR default_workflow_id != v_workflow_id);

END;
$$;

-- ============================================================================
-- PART 3: Backward Compatibility Mapping (Requirement 2.8)
-- Document the mapping between workflow states and existing bucket statuses
-- This ensures the existing board view continues to work alongside workflows
-- ============================================================================
COMMENT ON TABLE workflows IS 'Workflow definitions. Global workflows (project_id IS NULL) serve as templates. The Default Workflow provides backward-compatible status mapping: TODO=Not Started, IN_PROGRESS=In Progress/In Review, DONE=Completed.';
