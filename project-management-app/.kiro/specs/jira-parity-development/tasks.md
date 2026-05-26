# Implementation Plan: JIRA Parity Development

## Overview

This implementation plan transforms the existing Microsoft Planner-style project management application into a JIRA-equivalent system. The plan covers issue types, workflows, sprints, roadmaps, automation, JQL, custom fields, and advanced reporting.

**Technology Stack:**
- Backend: Node.js, Express, PostgreSQL (pg driver)
- Frontend: React 18, Vite, Tailwind CSS, Zustand, Axios
- Real-time: Socket.io
- Testing: Jest, fast-check (property-based testing)

**Implementation Approach:**
- Extend existing `tasks` table to support issue types and workflows
- Add new tables for sprints, epics, workflows, custom fields, automation
- Maintain backward compatibility with existing board/list/Gantt views
- Implement incrementally with validation checkpoints

---

## Tasks

### Phase 1: Foundation — Database & Core Services

- [x] 1. Set up database schema extensions
  - [x] 1.1 Create migration files for JIRA parity tables
    - Create `backend/src/database/migrations/20260601_jira_parity_foundation.sql`
    - Add tables: `workflows`, `workflow_states`, `workflow_transitions`, `sprints`, `roadmaps`, `releases`, `epics`, `automation_rules`, `automation_logs`, `reports`, `saved_filters`
    - Add columns to `tasks` table: `issue_type_id`, `issue_key`, `story_points`, `epic_id`, `sprint_id`, `workflow_state_id`, `resolution`, `environment`, `affects_versions`, `fix_versions`, `components`
    - Create indexes on `issue_type_id`, `workflow_state_id`, `sprint_id`, `epic_id`, `issue_key`
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 7.1, 11.1, 22.1_

  - [x] 1.2 Create seed data for system issue types and default workflows
    - Insert predefined issue types: Task, Bug, Story, Epic, Subtask with hierarchy levels
    - Insert default workflow with states: To Do, In Progress, In Review, Done
    - Insert default workflow transitions between states
    - _Requirements: 1.1, 2.1, 2.8_

- [x] 2. Implement Issue Type System backend
  - [x] 2.1 Create issue type service
    - Create `backend/src/services/issueTypeService.js`
    - Implement `getIssueTypes(projectId)`, `createIssueType()`, `updateIssueType()`, `deleteIssueType()`
    - Implement `validateHierarchy(parentType, childType)` enforcing Epic > Story > Task/Bug > Subtask
    - Prevent deletion of issue types with existing issues
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [ ]* 2.2 Write property test for issue hierarchy validation
    - **Property 1: Issue Hierarchy Integrity**
    - Verify that for any valid parent-child relationship, `validateHierarchy()` returns true only when hierarchy rules are satisfied
    - **Validates: Requirements 1.1, 17.1**

  - [x] 2.3 Create issue type controller and routes
    - Create `backend/src/controllers/issueTypeController.js`
    - Create `backend/src/routes/issueTypeRoutes.js` with GET, POST, PUT, DELETE endpoints
    - Integrate with `authenticateRequest` and `permissionMiddleware`
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 2.4 Write unit tests for issue type service
    - Test CRUD operations with valid and invalid data
    - Test hierarchy validation for all type combinations
    - Test prevention of deleting issue types with existing issues
    - _Requirements: 1.1, 1.5_

- [x] 3. Implement Workflow Engine backend
  - [x] 3.1 Create workflow service
    - Create `backend/src/services/workflowService.js`
    - Implement workflow CRUD operations (create, read, update, delete)
    - Implement workflow state management (add, update, remove states)
    - Implement workflow transition management with conditions, validators, and post-functions
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Implement workflow transition execution
    - Implement `transitionIssue(issueId, transitionId, context)` with full validation
    - Evaluate transition conditions (permission, field_value, user_role)
    - Execute validators before transition
    - Execute post-functions after successful transition (update_field, send_notification, create_issue)
    - Log all workflow transitions to `activity_logs`
    - _Requirements: 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.3 Write property test for workflow state consistency
    - **Property 2: Workflow State Consistency**
    - Verify that after any valid transition, issue.workflow_state_id equals the transition's to_state_id
    - Verify that transition.from_state_id always differs from transition.to_state_id
    - **Validates: Requirements 2.1, 2.4**

  - [ ]* 3.4 Write unit tests for workflow service
    - Test state transition validation (valid and invalid transitions)
    - Test condition evaluation for all condition types
    - Test post-function execution
    - Test backward compatibility with bucket-based status
    - _Requirements: 2.1, 2.4, 2.8_

  - [x] 3.5 Create workflow controller and routes
    - Create `backend/src/controllers/workflowController.js`
    - Create `backend/src/routes/workflowRoutes.js`
    - Add endpoints for workflow CRUD, state management, transition execution
    - _Requirements: 2.1, 2.2_

- [x] 4. Implement Custom Fields Engine backend
  - [x] 4.1 Create custom field service
    - Create `backend/src/services/customFieldService.js`
    - Implement custom field CRUD operations
    - Support field types: text, number, date, select, multi_select, user, checkbox, url
    - Implement field value storage and retrieval per issue
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 Implement custom field validation
    - Validate field values according to field type constraints
    - Support required field validation on issue create/update
    - Implement default value handling
    - Associate custom fields with specific issue types
    - _Requirements: 7.5, 7.6_

  - [ ]* 4.3 Write property test for custom field validation
    - **Property 7: Custom Field Validation**
    - Verify that all stored custom field values pass validation for their field type
    - Verify required fields always have values for applicable issues
    - **Validates: Requirements 7.5, 7.6**

  - [ ]* 4.4 Write unit tests for custom field service
    - Test all field type validations
    - Test required field enforcement
    - Test association with issue types
    - _Requirements: 7.1, 7.5_

  - [x] 4.5 Create custom field controller and routes
    - Create `backend/src/controllers/customFieldController.js`
    - Create `backend/src/routes/customFieldRoutes.js`
    - Add endpoints for field CRUD and value management
    - _Requirements: 7.1, 7.4, 7.7_

- [x] 5. Implement Issue Key Generation
  - [x] 5.1 Create issue key service
    - Create `backend/src/services/issueKeyService.js`
    - Implement `generateIssueKey(projectKey, sequence)` returning format `{PROJECT_KEY}-{NUMBER}`
    - Implement auto-increment sequence per project
    - Ensure uniqueness constraint on issue_key column
    - _Requirements: 1.6_

  - [ ]* 5.2 Write property test for issue key uniqueness
    - **Property 5: Issue Key Uniqueness**
    - Verify that generated issue keys are unique within a project
    - Verify all keys match pattern `{PROJECT_KEY}-{NUMBER}`
    - **Validates: Requirements 1.6**

- [x] 6. Checkpoint - Phase 1 Foundation Complete
  - Ensure all database migrations run successfully
  - Verify all backend services pass unit tests
  - Test API endpoints return correct responses
  - Verify backward compatibility with existing tasks

### Phase 2: Agile Features — Sprints, Epics, Story Points

- [ ] 7. Implement Sprint Management backend
  - [x] 7.1 Create sprint service
    - Create `backend/src/services/sprintService.js`
    - Implement sprint CRUD operations (create, update, delete)
    - Implement sprint state transitions (FUTURE → ACTIVE → CLOSED)
    - Validate only one active sprint per project
    - Validate start_date precedes end_date
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [~] 7.2 Implement sprint issue management
    - Implement `addIssuesToSprint(sprintId, issueIds)` and `removeIssuesFromSprint(sprintId, issueIds)`
    - Implement sprint backlog priority ordering
    - Handle sprint completion with incomplete issue rollover to backlog or next sprint
    - _Requirements: 3.3, 3.6, 4.7_

  - [~] 7.3 Implement sprint metrics and burndown
    - Calculate sprint duration in working days using existing calendar service
    - Calculate sprint progress (completed vs total story points)
    - Implement burndown chart data generation (actual vs ideal remaining)
    - _Requirements: 3.7, 3.8, 16.1, 16.2, 16.3, 16.4_

  - [ ]* 7.4 Write property test for sprint integrity
    - **Property 3: Sprint Integrity**
    - Verify that at most one sprint per project can be in ACTIVE state
    - Verify that issue.sprint_id always references a sprint in the same project
    - **Validates: Requirements 3.5**

  - [ ]* 7.5 Write unit tests for sprint service
    - Test sprint lifecycle (create, start, complete)
    - Test single active sprint enforcement
    - Test burndown calculation accuracy
    - Test issue rollover on sprint completion
    - _Requirements: 3.1, 3.5, 3.6, 16.1_

  - [~] 7.6 Create sprint controller and routes
    - Create `backend/src/controllers/sprintController.js`
    - Create `backend/src/routes/sprintRoutes.js`
    - Add endpoints for sprint CRUD, issue assignment, start, complete, metrics
    - _Requirements: 3.1, 3.8_

- [ ] 8. Implement Epic Management backend
  - [x] 8.1 Create epic service
    - Create `backend/src/services/epicService.js`
    - Implement epic CRUD operations
    - Implement epic progress calculation (story points-based or count-based fallback)
    - Prevent circular epic relationships
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [~] 8.2 Implement epic-issue relationships
    - Allow linking issues to parent epic
    - Validate only Stories, Tasks, Bugs can be linked to epics (not other Epics or Subtasks)
    - Validate epic completion (all children resolved or moved)
    - _Requirements: 5.2, 5.4, 5.5, 5.7_

  - [ ]* 8.3 Write property test for epic progress
    - **Property 4: Epic Relationships**
    - Verify that `calculateEpicProgress(epicId)` always returns value in [0, 100]
    - Verify that only issues with epic_id referencing an Epic-type issue are valid
    - **Validates: Requirements 5.3, 5.6**

  - [ ]* 8.4 Write unit tests for epic service
    - Test epic progress calculation with story points
    - Test epic progress calculation with count-based fallback
    - Test circular relationship prevention
    - Test completion validation
    - _Requirements: 5.3, 5.6_

  - [~] 8.5 Create epic controller and routes
    - Create `backend/src/controllers/epicController.js`
    - Create `backend/src/routes/epicRoutes.js`
    - Add endpoints for epic CRUD, progress, and child issues
    - _Requirements: 5.1, 5.3_

- [ ] 9. Implement Story Points and Estimation
  - [x] 9.1 Extend task model with story points
    - Add story_points column validation (non-negative number)
    - Support Fibonacci sequence suggestions (1, 2, 3, 5, 8, 13, 21)
    - Calculate totals for sprints, epics, and backlogs
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [~] 9.2 Implement story point rollup logic
    - Sum child story points for parent totals
    - Exclude completed issues from remaining work calculations
    - Display story point totals in sprint headers and epic cards
    - _Requirements: 6.5, 6.6, 6.7_

- [ ] 10. Implement Backlog Management backend
  - [x] 10.1 Create backlog service
    - Create `backend/src/services/backlogService.js`
    - Implement backlog query (issues not assigned to any sprint)
    - Implement drag-and-drop reordering with priority rank field
    - Support filtering by issue type, assignee, epic, custom fields
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [~] 10.2 Implement backlog metrics
    - Calculate total story points for backlog issues
    - Display epic groupings in backlog
    - Support moving issues from backlog to sprint
    - _Requirements: 4.6, 4.7_

  - [~] 10.3 Create backlog controller and routes
    - Create `backend/src/controllers/backlogController.js`
    - Create `backend/src/routes/backlogRoutes.js`
    - Add endpoints for backlog listing, reordering, and sprint assignment
    - _Requirements: 4.1, 4.2_

- [ ] 11. Implement Version and Release Management backend
  - [x] 11.1 Create version/release service
    - Create `backend/src/services/versionService.js`
    - Implement version CRUD with status (unreleased, released, archived)
    - Support fix_version and affects_version on issues
    - Calculate version progress (completed vs total issues)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [~] 11.2 Implement version tracking
    - Send notifications on release date
    - Prevent deletion of versions with assigned issues
    - Support version comparison reports
    - _Requirements: 11.5, 11.6, 11.7_

  - [ ]* 11.3 Write unit tests for version service
    - Test version lifecycle
    - Test issue version assignment
    - Test progress calculation
    - Test deletion prevention
    - _Requirements: 11.1, 11.4, 11.7_

  - [~] 11.4 Create version controller and routes
    - Create `backend/src/controllers/versionController.js`
    - Create `backend/src/routes/versionRoutes.js`
    - Add endpoints for version CRUD and progress
    - _Requirements: 11.1, 11.4_

- [~] 12. Checkpoint - Phase 2 Agile Features Complete
  - Test sprint lifecycle end-to-end
  - Verify epic progress calculations
  - Test story point rollup
  - Verify backlog management
  - Verify version management

### Phase 3: Advanced Features — Linking, JQL, Automation

- [ ] 13. Implement Issue Linking backend
  - [~] 13.1 Create issue link service
    - Create `backend/src/services/issueLinkService.js`
    - Support link types: blocks, is blocked by, relates to, duplicates, is duplicated by
    - Implement reciprocal link creation (creating "blocks" auto-creates "is blocked by" on target)
    - Prevent duplicate links between same issues with same type
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [~] 13.2 Implement link management
    - Display linked issues in issue detail
    - Remove all links on issue deletion
    - Support filtering by link type and linked issue status
    - _Requirements: 9.3, 9.6, 9.7_

  - [ ]* 13.3 Write unit tests for issue link service
    - Test all link types
    - Test reciprocal link creation
    - Test duplicate prevention
    - Test cascade deletion
    - _Requirements: 9.1, 9.4, 9.5_

  - [~] 13.4 Create issue link controller and routes
    - Create `backend/src/controllers/issueLinkController.js`
    - Create `backend/src/routes/issueLinkRoutes.js`
    - Add endpoints for link CRUD
    - _Requirements: 9.1, 9.2_

- [ ] 14. Implement Component Management backend
  - [~] 14.1 Create component service
    - Create `backend/src/services/componentService.js`
    - Implement component CRUD with name, description, default assignee
    - Support multiple components per issue
    - Auto-assign new issues based on component default assignee
    - _Requirements: 10.1, 10.2, 10.5_

  - [~] 14.2 Implement component metrics
    - Calculate component-level issue count and completion rate
    - Support component-based permissions for visibility
    - Display component tags on issue cards
    - _Requirements: 10.3, 10.4, 10.6, 10.7_

  - [ ]* 14.3 Write unit tests for component service
    - Test CRUD operations
    - Test auto-assignment logic
    - Test metrics calculation
    - _Requirements: 10.1, 10.5_

  - [~] 14.4 Create component controller and routes
    - Create `backend/src/controllers/componentController.js`
    - Create `backend/src/routes/componentRoutes.js`
    - Add endpoints for component CRUD and metrics
    - _Requirements: 10.1, 10.7_

- [ ] 15. Implement Time Tracking backend
  - [~] 15.1 Create time tracking service
    - Create `backend/src/services/timeTrackingService.js`
    - Add original_estimate, remaining_estimate, time_spent to issues
    - Implement work log recording (time spent, date, description)
    - Auto-reduce remaining estimate when time logged
    - _Requirements: 12.1, 12.2, 12.3_

  - [~] 15.2 Implement time tracking reports
    - Support time entry in hours and days with configurable conversion rates
    - Calculate total logged time for sprints and epics
    - Generate time tracking reports by user, project, date range
    - _Requirements: 12.4, 12.5, 12.6, 12.7_

  - [ ]* 15.3 Write unit tests for time tracking service
    - Test work log recording
    - Test remaining estimate auto-reduction
    - Test report generation
    - _Requirements: 12.1, 12.3_

  - [~] 15.4 Create time tracking controller and routes
    - Create `backend/src/controllers/timeTrackingController.js`
    - Create `backend/src/routes/timeTrackingRoutes.js`
    - Add endpoints for work logs and reports
    - _Requirements: 12.2, 12.7_

- [ ] 16. Implement Watchers and Notifications Enhancement
  - [~] 16.1 Create watcher service
    - Create `backend/src/services/watcherService.js`
    - Allow users to add/remove themselves as watchers
    - Support automatic watching on create, comment, assign
    - Display watcher count and list on issues
    - _Requirements: 13.1, 13.3, 13.5_

  - [~] 16.2 Implement enhanced notifications
    - Send notifications to all watchers on issue update
    - Support notification preferences by event type
    - Remove watchers when user removed from project
    - Support @mentions in comments adding watchers
    - _Requirements: 13.2, 13.4, 13.6, 13.7_

  - [ ]* 16.3 Write unit tests for watcher service
    - Test watcher add/remove
    - Test automatic watching scenarios
    - Test notification delivery to watchers
    - _Requirements: 13.1, 13.3_

  - [~] 16.4 Create watcher controller and routes
    - Create `backend/src/controllers/watcherController.js`
    - Create `backend/src/routes/watcherRoutes.js`
    - Add endpoints for watcher management
    - _Requirements: 13.1, 13.5_

- [ ] 17. Implement JQL (JIRA Query Language) Engine
  - [~] 17.1 Create JQL parser service
    - Create `backend/src/services/jqlService.js`
    - Implement JQL syntax parsing (operators: equals, not equals, in, not in, greater than, less than, contains, is empty)
    - Support AND, OR, NOT operators
    - Validate JQL syntax before execution
    - _Requirements: 8.1, 8.2, 8.3_

  - [~] 17.2 Implement JQL to SQL converter
    - Convert JQL AST to parameterized SQL queries (prevent SQL injection)
    - Support searching by standard fields (status, assignee, reporter, priority, issue type, dates)
    - Support searching by custom field values
    - Implement sorting and pagination
    - _Requirements: 8.4, 8.5_

  - [~] 17.3 Implement saved filters
    - Create saved_filters table operations
    - Support filter sharing with project members
    - Implement filter favorites
    - _Requirements: 8.6, 8.7, 8.8_

  - [ ]* 17.4 Write unit tests for JQL service
    - Test query parsing for various syntax patterns
    - Test query execution accuracy
    - Test all filter operators
    - Test SQL injection prevention
    - _Requirements: 8.1, 8.4_

  - [~] 17.5 Create JQL controller and routes
    - Create `backend/src/controllers/jqlController.js`
    - Create `backend/src/routes/jqlRoutes.js`
    - Add endpoints for query execution and saved filters
    - _Requirements: 8.2, 8.6_

- [ ] 18. Implement Automation Engine backend
  - [~] 18.1 Create automation rule service
    - Create `backend/src/services/automationService.js`
    - Implement rule CRUD operations
    - Store triggers, conditions, and actions as JSONB
    - Support rule enable/disable without deletion
    - _Requirements: 22.1, 22.7_

  - [~] 18.2 Implement automation trigger system
    - Support triggers: issue_created, issue_updated, issue_transitioned, comment_added, scheduled
    - Integrate with existing controllers to fire triggers via event emitter pattern
    - Decouple trigger detection from action execution
    - _Requirements: 22.2, 22.3_

  - [~] 18.3 Implement automation condition evaluation
    - Support conditions: field_value, user_role, issue_type, custom_jql
    - Evaluate all conditions before executing actions
    - Log condition evaluation results
    - _Requirements: 22.4_

  - [~] 18.4 Implement automation action executors
    - Support actions: update_field, transition_issue, send_notification, create_issue, add_comment, assign_user
    - Execute actions sequentially with error handling
    - Log execution with status, timing, and errors to `automation_logs`
    - _Requirements: 22.5, 22.6_

  - [ ]* 18.5 Write property test for automation rule execution
    - **Property 6: Automation Rule Execution**
    - Verify that enabled rules with matching triggers and passing conditions always execute their actions
    - Verify that disabled rules never execute actions
    - **Validates: Requirements 22.1, 22.2, 22.7**

  - [ ]* 18.6 Write unit tests for automation service
    - Test trigger matching
    - Test condition evaluation for all condition types
    - Test action execution
    - Test error handling and logging
    - _Requirements: 22.1, 22.4_

  - [~] 18.7 Create automation controller and routes
    - Create `backend/src/controllers/automationController.js`
    - Create `backend/src/routes/automationRoutes.js`
    - Add endpoints for rule CRUD and execution logs
    - _Requirements: 22.1, 22.6_

- [~] 19. Checkpoint - Phase 3 Advanced Features Complete
  - Test issue linking end-to-end
  - Verify component management
  - Test time tracking reports
  - Test JQL query execution with various syntax
  - Verify automation rule execution

### Phase 4: Reporting, Analytics & Templates

- [ ] 20. Implement Velocity Tracking backend
  - [~] 20.1 Create velocity service
    - Create `backend/src/services/velocityService.js`
    - Calculate velocity as completed story points per sprint
    - Store historical velocity data for each completed sprint
    - Calculate average velocity over 3, 5, 10 sprints
    - Support velocity-based capacity recommendations
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ]* 20.2 Write unit tests for velocity service
    - Test velocity calculation accuracy
    - Test average velocity over different sprint counts
    - Test exclusion of incomplete issues
    - _Requirements: 15.1, 15.6_

- [ ] 21. Implement Burndown Chart backend
  - [~] 21.1 Create burndown service
    - Create `backend/src/services/burndownService.js`
    - Generate burndown data for active/completed sprints
    - Calculate ideal burndown line based on sprint duration and total story points
    - Track actual vs ideal progress daily
    - Support toggling between story point and issue count views
    - Highlight days when remaining work increased
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [ ]* 21.2 Write unit tests for burndown service
    - Test burndown data generation
    - Test ideal line calculation
    - Test work increase detection
    - _Requirements: 16.1, 16.4_

- [ ] 22. Implement Advanced Reporting backend
  - [~] 22.1 Create report service
    - Create `backend/src/services/reportService.js`
    - Support report types: issue statistics, time tracking, velocity, burndown, cumulative flow, custom
    - Implement report configuration storage
    - Calculate metrics: cycle time, lead time, throughput
    - _Requirements: 19.1, 19.6, 19.7_

  - [~] 22.2 Implement cumulative flow diagram
    - Track issue counts by state over time
    - Generate data for visualization
    - Support date range filtering
    - _Requirements: 19.1, 21.1_

  - [~] 22.3 Implement report export and scheduling
    - Support export to PDF, Excel, CSV formats
    - Support scheduled report generation
    - Implement email delivery integration
    - _Requirements: 19.3, 19.5_

  - [ ]* 22.4 Write unit tests for report service
    - Test velocity report generation
    - Test burndown data generation
    - Test cumulative flow calculation
    - Test export functionality
    - _Requirements: 15.1, 16.1, 19.3_

  - [~] 22.5 Create report controller and routes
    - Create `backend/src/controllers/reportController.js`
    - Create `backend/src/routes/reportRoutes.js`
    - Add endpoints for report generation, export, and scheduling
    - _Requirements: 19.1, 19.5_

- [ ] 23. Implement Agile Metrics Dashboard backend
  - [~] 23.1 Create dashboard metrics service
    - Create `backend/src/services/dashboardMetricsService.js`
    - Calculate cycle time and lead time distributions
    - Generate issue aging report (issues in progress beyond threshold)
    - Calculate team workload distribution by assignee
    - _Requirements: 21.1, 21.3, 21.4, 21.5_

  - [~] 23.2 Implement real-time dashboard updates
    - Refresh metrics via WebSocket on issue updates
    - Support customizable dashboard layout and widget selection
    - Display sprint health indicators
    - _Requirements: 21.2, 21.6, 21.7_

  - [ ]* 23.3 Write unit tests for dashboard metrics service
    - Test cycle/lead time calculations
    - Test workload distribution
    - Test real-time update triggers
    - _Requirements: 21.1, 21.3_

  - [~] 23.4 Create dashboard metrics controller and routes
    - Create `backend/src/controllers/dashboardMetricsController.js`
    - Create `backend/src/routes/dashboardMetricsRoutes.js`
    - Add endpoints for metrics retrieval
    - _Requirements: 21.1, 21.5_

- [ ] 24. Implement Issue Templates backend
  - [~] 24.1 Create template service
    - Create `backend/src/services/templateService.js`
    - Store templates with predefined field values
    - Support templates with predefined subtasks and checklists
    - Support template sharing across projects
    - _Requirements: 23.1, 23.2, 23.6, 23.7_

  - [~] 24.2 Implement template application
    - Apply template values during issue creation
    - Allow modification before creating
    - Support template selection in creation flow
    - _Requirements: 23.3, 23.4, 23.5_

  - [ ]* 24.3 Write unit tests for template service
    - Test CRUD operations
    - Test template application with subtasks
    - Test cross-project sharing
    - _Requirements: 23.1, 23.4_

  - [~] 24.4 Create template controller and routes
    - Create `backend/src/controllers/templateController.js`
    - Create `backend/src/routes/templateRoutes.js`
    - Add endpoints for template CRUD and application
    - _Requirements: 23.1, 23.3_

- [ ] 25. Implement Priority Schemes backend
  - [~] 25.1 Create priority scheme service
    - Create `backend/src/services/prioritySchemeService.js`
    - Support custom priority levels with name, icon, color
    - Assign priority schemes to projects
    - Support default priority selection for new issues
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

  - [~] 25.2 Implement priority integration
    - Display priority indicators in all views
    - Support filtering and sorting by priority
    - Maintain backward compatibility with existing priority system
    - _Requirements: 24.5, 24.6, 24.7_

  - [ ]* 25.3 Write unit tests for priority scheme service
    - Test CRUD operations
    - Test project assignment
    - Test backward compatibility
    - _Requirements: 24.1, 24.7_

  - [~] 25.4 Create priority scheme controller and routes
    - Create `backend/src/controllers/prioritySchemeController.js`
    - Create `backend/src/routes/prioritySchemeRoutes.js`
    - Add endpoints for scheme CRUD
    - _Requirements: 24.1, 24.3_

- [ ] 26. Implement Issue Hierarchy and Subtasks Enhancement
  - [~] 26.1 Enhance subtask creation and management
    - Enforce subtask must have parent issue
    - Display subtasks in tree structure under parent issues
    - Calculate parent issue progress based on completed subtasks
    - Inherit epic and sprint assignments from parent to subtasks
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [~] 26.2 Implement issue type conversion
    - Support converting regular issue to subtask and vice versa
    - Validate hierarchy on conversion
    - Maintain compatibility with existing nested task functionality
    - _Requirements: 17.6, 17.7_

  - [ ]* 26.3 Write unit tests for hierarchy logic
    - Test subtask creation constraints
    - Test progress calculation from subtasks
    - Test inheritance rules
    - Test type conversion
    - _Requirements: 17.1, 17.4, 17.6_

- [~] 27. Checkpoint - Phase 4 Reporting & Templates Complete
  - Test velocity and burndown reports
  - Verify dashboard metrics calculations
  - Test template creation and application
  - Verify priority schemes
  - Test subtask hierarchy

### Phase 5: Frontend Implementation

- [ ] 28. Implement Issue Type Management UI
  - [~] 28.1 Create issue type API service and hooks
    - Create `frontend/src/logic/services/issueTypeApi.js`
    - Create `frontend/src/logic/hooks/useIssueTypes.js` with React Query hooks
    - Implement API calls for CRUD operations
    - _Requirements: 1.2, 1.3, 1.4_

  - [~] 28.2 Create Issue Type Admin Page
    - Create `frontend/src/pages/IssueTypesPage.jsx`
    - Display issue types list with icons, colors, hierarchy levels
    - Support create, edit, delete operations
    - Show issue count per type
    - _Requirements: 1.1, 1.2, 1.7_

  - [~] 28.3 Integrate issue types in issue creation
    - Add issue type selector to `TaskFormModal.jsx`
    - Display issue type icons in Board, List, Gantt views
    - Update issue creation flow to require type selection
    - _Requirements: 1.6, 1.7_

- [ ] 29. Implement Workflow Management UI
  - [~] 29.1 Create workflow API service and hooks
    - Create `frontend/src/logic/services/workflowApi.js`
    - Create `frontend/src/logic/hooks/useWorkflows.js`
    - Implement API calls for workflows, states, transitions
    - _Requirements: 2.1, 2.2_

  - [~] 29.2 Create Workflow Designer Page
    - Create `frontend/src/pages/WorkflowDesignerPage.jsx`
    - Visual workflow editor with drag-and-drop states
    - Configure transitions with conditions and validators
    - Preview workflow diagram
    - _Requirements: 2.1, 2.2, 2.3_

  - [~] 29.3 Integrate workflows in issue transitions
    - Update `TaskDetailModal.jsx` with workflow transition buttons
    - Display available transitions based on current state
    - Show transition screens for required field updates
    - _Requirements: 2.4, 2.5, 2.6_

- [ ] 30. Implement Sprint Board UI
  - [~] 30.1 Create sprint API service and hooks
    - Create `frontend/src/logic/services/sprintApi.js`
    - Create `frontend/src/logic/hooks/useSprints.js`
    - _Requirements: 3.1, 3.8_

  - [~] 30.2 Create Sprint Board Page
    - Create `frontend/src/pages/SprintBoardPage.jsx`
    - Display active sprint with Kanban columns mapped to workflow states
    - Support swimlanes by assignee, epic, or custom field
    - Drag-and-drop issues between columns using dnd-kit
    - _Requirements: 3.1, 14.1, 14.4_

  - [~] 30.3 Create Backlog Management Page
    - Create `frontend/src/pages/BacklogPage.jsx`
    - Display backlog issues with drag-and-drop ordering
    - Show epic groupings and story point totals
    - Support filtering by issue type, assignee, epic
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [~] 30.4 Create Sprint Planning Modal
    - Create sprint creation/edit modal
    - Support drag-and-drop issues from backlog to sprint
    - Display sprint progress and story point totals
    - _Requirements: 3.1, 3.3, 3.8_

- [ ] 31. Implement Epic and Roadmap UI
  - [~] 31.1 Create epic API service and hooks
    - Create `frontend/src/logic/services/epicApi.js`
    - Create `frontend/src/logic/hooks/useEpics.js`
    - _Requirements: 5.1, 5.3_

  - [~] 31.2 Create Roadmap View Page
    - Create `frontend/src/pages/RoadmapPage.jsx`
    - Display epics and versions on timeline
    - Show epic progress bars
    - Support drag-and-drop rescheduling
    - Support zoom levels (quarters, months, weeks)
    - Display dependencies between epics as connecting lines
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7_

  - [~] 31.3 Integrate epics in issue views
    - Add epic selector to issue creation/edit
    - Display epic progress bars in backlog and board
    - Support filtering by epic
    - _Requirements: 5.2, 5.4, 5.5_

- [ ] 32. Implement Advanced Search and JQL UI
  - [~] 32.1 Create JQL search component
    - Create `frontend/src/components/search/JQLSearchBar.jsx`
    - Provide JQL input with syntax highlighting
    - Display query results with pagination
    - _Requirements: 8.1, 8.2_

  - [~] 32.2 Create Saved Filters UI
    - Create `frontend/src/components/search/SavedFiltersPanel.jsx`
    - Support filter save, share, delete operations
    - Display favorite filters
    - _Requirements: 8.6, 8.7, 8.8_

- [ ] 33. Implement Issue Detail Modal Enhancement
  - [~] 33.1 Redesign issue detail modal
    - Update `frontend/src/components/task/TaskDetailModal.jsx`
    - Add JIRA-style layout with sidebar for metadata
    - Display issue type, status, priority prominently
    - Add linked issues section
    - Add custom fields section
    - _Requirements: 9.3, 1.7, 7.4, 24.5_

  - [~] 33.2 Add time tracking UI
    - Add time tracking panel to issue detail
    - Display original/remaining estimate and time spent
    - Support work log entry with date and description
    - _Requirements: 12.4, 12.2_

  - [~] 33.3 Add watchers panel
    - Display watcher count and list
    - Add/remove self as watcher
    - _Requirements: 13.1, 13.5_

- [ ] 34. Implement Board Configuration UI
  - [~] 34.1 Create Board Configuration Page
    - Create `frontend/src/pages/BoardConfigurationPage.jsx`
    - Configure column mappings to workflow statuses
    - Set up swimlanes by assignee, epic, or custom field
    - Configure quick filters
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [~] 34.2 Implement card display configuration
    - Configure displayed fields on cards
    - Set card colors based on priority or issue type
    - Apply configuration immediately to board
    - _Requirements: 14.6, 14.7_

- [ ] 35. Implement Reports Dashboard UI
  - [~] 35.1 Create Reports Page
    - Create `frontend/src/pages/ReportsPage.jsx`
    - Display report types with cards
    - Support report configuration modal
    - _Requirements: 19.1, 19.4_

  - [~] 35.2 Implement burndown chart component
    - Create `frontend/src/components/reports/BurndownChart.jsx`
    - Use recharts for visualization
    - Display ideal vs actual lines
    - _Requirements: 16.4, 16.7_

  - [~] 35.3 Implement velocity chart component
    - Create `frontend/src/components/reports/VelocityChart.jsx`
    - Display sprint velocity bars
    - Show average velocity line
    - _Requirements: 15.3, 15.7_

  - [~] 35.4 Implement export functionality
    - Add export buttons to reports
    - Support PDF, Excel, CSV formats
    - _Requirements: 19.3_

- [ ] 36. Implement Automation Rules UI
  - [~] 36.1 Create Automation Rules Page
    - Create `frontend/src/pages/AutomationRulesPage.jsx`
    - Display rules list with enable/disable toggle
    - Show execution count and last run time
    - _Requirements: 22.1, 22.7_

  - [~] 36.2 Create Rule Builder Component
    - Create `frontend/src/components/automation/RuleBuilder.jsx`
    - Visual builder for triggers, conditions, actions
    - Support rule templates for common patterns
    - _Requirements: 22.1, 22.3, 22.4, 22.5_

- [ ] 37. Implement Bulk Operations UI
  - [~] 37.1 Add bulk selection to Board and List views
    - Enable multi-select checkboxes in List and Board views
    - Display bulk action menu on selection
    - _Requirements: 18.1, 18.2_

  - [~] 37.2 Implement bulk operation dialogs
    - Bulk status change dialog
    - Bulk assignee change dialog
    - Bulk sprint assignment dialog
    - Display progress indicator during operations
    - Display summary of successful and failed operations
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7_

- [ ] 38. Implement Import/Export UI
  - [~] 38.1 Create Import Issues Page
    - Create `frontend/src/pages/ImportIssuesPage.jsx`
    - Support CSV and JSON upload
    - Display field mapping interface
    - Show import preview and validation errors
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [~] 38.2 Create Export Issues functionality
    - Add export menu to issue views
    - Support CSV, JSON, Excel formats
    - Export filtered sets or all issues
    - _Requirements: 20.5, 20.6, 20.7_

- [~] 39. Checkpoint - Phase 5 Frontend Complete
  - Test all UI pages and components
  - Verify API integrations work correctly
  - Test responsive design
  - Verify accessibility compliance

### Phase 6: Integration, Performance & Polish

- [ ] 40. Implement Real-time Updates Enhancement
  - [~] 40.1 Enhance Socket.io integration for new features
    - Emit events for issue type, workflow, sprint changes
    - Broadcast automation rule executions
    - Real-time dashboard metrics updates
    - Use Socket.IO rooms for project-specific broadcasts
    - _Requirements: 21.7, 14.7_

  - [~] 40.2 Implement optimistic UI updates
    - Update UI optimistically on issue transitions
    - Handle rollback on error
    - Show sync status indicator
    - _Requirements: 2.4, 3.3_

- [ ] 41. Implement Bulk Operations backend
  - [~] 41.1 Create bulk operations service
    - Create `backend/src/services/bulkOperationsService.js`
    - Support bulk status change, assignee change, sprint assignment, deletion
    - Validate permissions for each issue in bulk
    - Log bulk operations in activity logs
    - _Requirements: 18.1, 18.3, 18.4, 18.7_

  - [ ]* 41.2 Write unit tests for bulk operations
    - Test permission validation per issue
    - Test partial success/failure handling
    - Test activity logging
    - _Requirements: 18.4, 18.6_

  - [~] 41.3 Create bulk operations controller and routes
    - Create `backend/src/controllers/bulkOperationsController.js`
    - Create `backend/src/routes/bulkOperationsRoutes.js`
    - Add endpoints for bulk operations
    - _Requirements: 18.1, 18.3_

- [ ] 42. Implement Import/Export backend
  - [~] 42.1 Create import/export service
    - Create `backend/src/services/importExportService.js`
    - Support importing issues from CSV and JSON formats
    - Validate required fields and data types during import
    - Support field mapping during import
    - _Requirements: 20.1, 20.2, 20.3_

  - [~] 42.2 Implement export functionality
    - Support exporting to CSV, JSON, Excel formats
    - Include all standard and custom fields in export
    - Support exporting filtered issue sets
    - _Requirements: 20.5, 20.6, 20.7_

  - [ ]* 42.3 Write unit tests for import/export
    - Test CSV parsing and validation
    - Test field mapping
    - Test export format generation
    - _Requirements: 20.1, 20.5_

  - [~] 42.4 Create import/export controller and routes
    - Create `backend/src/controllers/importExportController.js`
    - Create `backend/src/routes/importExportRoutes.js`
    - Add endpoints for import preview, execute, and export
    - _Requirements: 20.1, 20.4, 20.5_

- [ ] 43. Implement Performance Optimizations
  - [~] 43.1 Add database query optimizations
    - Create composite indexes for frequent queries (project_id + issue_type_id + status)
    - Add full-text search index on issue title and description
    - Optimize JQL to SQL conversion for large datasets
    - Implement database connection pooling tuning
    - _Requirements: 8.2, 19.1_

  - [~] 43.2 Implement frontend performance enhancements
    - Add virtual scrolling for large issue lists (backlog, search results)
    - Lazy load issue details and comments
    - Implement React Query caching strategies with appropriate TTLs
    - _Requirements: 4.1, 19.4_

- [ ] 44. Implement Security Enhancements
  - [~] 44.1 Add API rate limiting and security headers
    - Install and configure `express-rate-limit` per user/IP
    - Install and configure `helmet` for security headers
    - Ensure JWT token validation on every request
    - _Requirements: 22.1, 8.2_

  - [~] 44.2 Implement field-level security
    - Control field visibility based on user permissions
    - Audit all workflow transitions with actor information
    - Validate inputs using Zod schemas for all new endpoints
    - _Requirements: 2.3, 22.6, 10.6_

- [ ] 45. Implement Workflow Transition Validation (Property 8)
  - [ ]* 45.1 Write property test for workflow transition validity
    - **Property 8: Workflow Transition Validity**
    - Verify that `can_transition(issue, transition)` is true only when transition.from_state_id equals issue.workflow_state_id AND all conditions pass
    - **Validates: Requirements 2.4, 2.3**

- [ ] 46. Final Integration Testing
  - [~] 46.1 End-to-end issue lifecycle testing
    - Create Epic → Create Stories → Create Tasks → Transition workflow → Complete
    - Verify all relationships maintained throughout lifecycle
    - Verify progress calculations accurate at each step
    - _Requirements: 1.1, 2.1, 5.1, 17.1_

  - [~] 46.2 Sprint workflow integration testing
    - Create sprint → Add issues → Start → Update issues → Generate burndown → Complete
    - Verify sprint state transitions
    - Verify issue rollover to next sprint
    - Verify velocity calculation after completion
    - _Requirements: 3.1, 15.1, 16.1_

  - [~] 46.3 Automation rule integration testing
    - Create rule → Trigger event → Verify conditions → Verify actions executed
    - Test multiple rules triggered by same event
    - Test error handling and logging
    - _Requirements: 22.1, 22.3, 22.4, 22.5_

- [~] 47. Final Checkpoint - All Phases Complete
  - Ensure all tests pass, ask the user if questions arise.
  - All unit tests passing
  - All property-based tests passing
  - All integration tests passing
  - Performance benchmarks met (< 500ms API response, < 2s page load)
  - Security audit complete


---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses JavaScript (Node.js/Express backend, React frontend) — all code should follow existing project conventions

### Implementation Priority

**Critical Path (Must Complete First):**
1. Database schema extensions (Task 1)
2. Issue Type System (Task 2)
3. Workflow Engine (Task 3)
4. Sprint Management (Task 7)

**High Priority:**
- Epic Management (Task 8)
- Story Points (Task 9)
- JQL Engine (Task 17)
- Frontend Sprint Board (Task 30)

**Medium Priority:**
- Automation Engine (Task 18)
- Reports (Tasks 20-22)
- Issue Detail Enhancements (Task 33)

**Lower Priority (Can Defer):**
- Issue Templates (Task 24)
- Priority Schemes (Task 25)
- Import/Export (Tasks 38, 42)

### Dependencies

- Phase 2 depends on Phase 1 (schema and core services)
- Phase 3 depends on Phase 1 (core services available)
- Phase 4 depends on Phase 2 (sprint/epic data for reports)
- Phase 5 depends on Phase 1-4 (backend APIs must exist)
- Phase 6 depends on all previous phases

### Testing Strategy

- Unit tests use Jest with mock database
- Property-based tests use fast-check library
- Integration tests use test database with seeds
- E2E tests can use Playwright
- All tests run with `npm test` or `npx jest`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "3.4", "3.5", "4.2", "4.3", "4.4", "4.5", "5.2"] },
    { "id": 3, "tasks": ["7.1", "8.1", "9.1", "10.1", "11.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "8.2", "8.3", "8.4", "8.5", "9.2", "10.2", "10.3", "11.2", "11.3", "11.4"] },
    { "id": 5, "tasks": ["13.1", "14.1", "15.1", "16.1", "17.1", "18.1"] },
    { "id": 6, "tasks": ["13.2", "13.3", "13.4", "14.2", "14.3", "14.4", "15.2", "15.3", "15.4", "16.2", "16.3", "16.4", "17.2", "17.3", "17.4", "17.5", "18.2", "18.3", "18.4", "18.5", "18.6", "18.7"] },
    { "id": 7, "tasks": ["20.1", "20.2", "21.1", "21.2", "22.1", "22.2", "22.3", "22.4", "22.5", "23.1", "23.2", "23.3", "23.4", "24.1", "24.2", "24.3", "24.4", "25.1", "25.2", "25.3", "25.4", "26.1", "26.2", "26.3"] },
    { "id": 8, "tasks": ["28.1", "29.1", "30.1", "31.1", "32.1"] },
    { "id": 9, "tasks": ["28.2", "28.3", "29.2", "29.3", "30.2", "30.3", "30.4", "31.2", "31.3", "32.2", "33.1", "33.2", "33.3", "34.1", "34.2"] },
    { "id": 10, "tasks": ["35.1", "35.2", "35.3", "35.4", "36.1", "36.2", "37.1", "37.2", "38.1", "38.2"] },
    { "id": 11, "tasks": ["40.1", "40.2", "41.1", "41.2", "41.3", "42.1", "42.2", "42.3", "42.4", "43.1", "43.2", "44.1", "44.2", "45.1"] },
    { "id": 12, "tasks": ["46.1", "46.2", "46.3"] }
  ]
}
```
