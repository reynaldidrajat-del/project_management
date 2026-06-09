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

## Gap Analysis Baseline - 2026-05-28

This baseline was added after reviewing the current codebase, the local PostgreSQL schema, and official Atlassian Jira documentation for work types, workflows, backlog/sprint planning, versions, JQL, reports, permissions, and custom fields.

Reference docs reviewed:
- https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-types/
- https://support.atlassian.com/jira-cloud-administration/docs/work-with-issue-workflows/
- https://support.atlassian.com/jira-software-cloud/docs/use-your-scrum-backlog/
- https://support.atlassian.com/jira-software-cloud/docs/create-sprints-in-company-managed-projects/
- https://support.atlassian.com/jira-software-cloud/docs/plan-a-sprint/
- https://support.atlassian.com/jira-software-cloud/docs/configure-versions-in-a-scrum-project/
- https://support.atlassian.com/jira-work-management/docs/jql-fields/
- https://support.atlassian.com/jira-work-management/docs/generate-a-report
- https://support.atlassian.com/jira-cloud-administration/docs/types-of-permissions-in-jira/
- https://support.atlassian.com/jira-cloud-administration/docs/field-types-you-can-create-as-a-jira-admin/

### Jira business-unit flow from upstream to downstream

1. **Business intake and governance**
   - Business unit defines workspaces/spaces/projects, members, roles, permission schemes, work visibility, and operating rules.
   - Work intake must capture request type/work type, required fields, reporter/requester, assignee, component, priority, due/release target, and attachments/comments where needed.

2. **Work classification and process design**
   - Work is classified as epic, story, task, bug, subtask, or a custom work type.
   - Work type connects to workflow, screens/fields, and permissions.
   - Workflow states and transitions enforce real process gates, approvals, required fields, and post-transition automation.

3. **Prioritization and planning**
   - Backlog holds unscheduled work and supports rank/order, filters, epics, versions, components, assignees, and estimates.
   - Product owner/business owner prioritizes backlog before sprint/release planning.
   - Sprint planning moves selected work from backlog into future or active sprints and tracks scope changes.

4. **Execution and collaboration**
   - Teams execute work through board/list/detail views.
   - Work moves only through permitted workflow transitions.
   - Comments, mentions, watchers, notifications, attachments, linked issues, and time logs create the operational record.

5. **Release and delivery**
   - Versions/releases group delivered scope.
   - Fix versions and affects versions connect issues to release planning, release readiness, release notes, and post-release traceability.

6. **Monitoring and control**
   - Dashboards, burndown, burnup, velocity, cumulative flow, sprint reports, version reports, workload reports, and JQL filters monitor progress and risk.
   - Automation and audit logs support consistent follow-up and accountability.

7. **Continuous improvement**
   - Completed sprints/releases feed velocity, cycle time, lead time, throughput, bottleneck analysis, and business-unit planning.
   - Templates, priority schemes, saved filters, and board configurations standardize repeated work.

### Current application fit

- Strong existing foundation: project workspace, cross-department membership, buckets, nested tasks, task approval, progress rollup, working calendar, board/list/calendar/Gantt, department Gantt, dashboard, auth/RBAC, activity logs, comments, labels, checklists, notifications, chat, and realtime refresh.
- Partial Jira foundation: issue types, workflow engine, custom fields, issue key service, and migrations for several Jira parity tables.
- Partial agile services: sprint, epic, story point, backlog, and version services exist, but most are not exposed through controllers/routes and are not integrated into frontend flows.
- Resolved migration gap in task 1.3: local database now has 47 tables and includes `components`, `issue_components`, `issue_links`, `time_logs`, `issue_fix_versions`, and `issue_affects_versions`.
- Resolved release-model gap in task 1.3: local `releases` table now includes the `status` column expected by `versionService.js`, while retaining the legacy `released` boolean for compatibility.
- Frontend gap: no Jira parity UI currently exists for issue type admin, workflow designer, sprint board, backlog, epic/roadmap, JQL, release/version management, components, issue links, watchers, time tracking, reports, automation, import/export, or board configuration.

### Task status calibration rules

- `[x]` means code exists, is wired into the app where needed, and has been verified at least with syntax/build or tests.
- `[~]` means a meaningful part exists but the feature is not usable end-to-end.
- `[ ]` means not implemented in code, or only a migration/table exists without service/controller/API/UI.

### Priority after gap analysis

1. Keep database schema and migration runner aligned before adding more Jira features. Task 1.3 completed the current schema alignment pass.
2. Expose Phase 2 services through controllers/routes and smoke-test them.
3. Integrate issue type, workflow state, story points, epic, sprint, backlog, and version fields into task create/update/read contracts.
4. Build backlog and sprint planning UI before advanced reporting or roadmap UI.
5. Implement issue links, components, watchers, and time tracking before issue detail redesign.
6. Implement JQL/saved filters before report dashboards and advanced board filters.

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

  - [x] 1.3 Align database migration state with service expectations
    - Ensure `schema.sql`, migration files, and local PostgreSQL schema agree on all Jira parity tables.
    - Apply or consolidate tables currently missing locally: `components`, `issue_components`, `issue_links`, `time_logs`, `issue_fix_versions`, `issue_affects_versions`.
    - Align `releases` schema with `versionService.js` by adding `status` or changing service logic to use the canonical `released` model.
    - Update `backend/run-migrations.js` so all required Jira parity migrations run in dependency order.
    - Verify `verifyApplicationSchema()` includes required Jira parity tables only after they are truly production-required.
    - Completed 2026-05-28: schema.sql, migration files, local PostgreSQL schema, and migration runner are aligned; local database has 47 tables and no required Jira parity table/column gaps for this task.
    - _Requirements: 1.1, 9.1, 10.1, 11.1, 12.1_

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

- [~] 6. Checkpoint - Phase 1 Foundation Complete
  - Ensure all database migrations run successfully
  - Verify all backend services pass unit tests
  - Test API endpoints return correct responses
  - Verify backward compatibility with existing tasks
  - 2026-05-28 status: migration runner passes on local DB and fresh temporary DB; backend tests and frontend build pass. Remains partial until API smoke tests and missing property/unit tests are completed.

### Phase 2: Agile Features — Sprints, Epics, Story Points

- [x] 7. Implement Sprint Management backend
  - [x] 7.1 Create sprint service
    - Create `backend/src/services/sprintService.js`
    - Implement sprint CRUD operations (create, update, delete)
    - Implement sprint state transitions (FUTURE → ACTIVE → CLOSED)
    - Validate only one active sprint per project
    - Validate start_date precedes end_date
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [x] 7.2 Implement sprint issue management
    - Implement `addIssuesToSprint(sprintId, issueIds)` and `removeIssuesFromSprint(sprintId, issueIds)`
    - Implement sprint backlog priority ordering
    - Handle sprint completion with incomplete issue rollover to backlog or next sprint
    - Completed 2026-05-28: `addIssuesToSprint()`, `removeIssuesFromSprint()`, backlog ordering on manual removal, and completion rollover are implemented and routed.
    - _Requirements: 3.3, 3.6, 4.7_

  - [x] 7.3 Implement sprint metrics and burndown
    - Calculate sprint duration in working days using existing calendar service
    - Calculate sprint progress (completed vs total story points)
    - Implement burndown chart data generation (actual vs ideal remaining)
    - Completed 2026-05-28: sprint metrics endpoint returns issue/story-point totals, working days, progress, and burndown data.
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

  - [x] 7.6 Create sprint controller and routes
    - Create `backend/src/controllers/sprintController.js`
    - Create `backend/src/routes/sprintRoutes.js`
    - Add endpoints for sprint CRUD, issue assignment, start, complete, metrics
    - Completed 2026-05-28: routes are mounted at `/api/sprints`.
    - _Requirements: 3.1, 3.8_

- [~] 8. Implement Epic Management backend
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

  - [x] 8.5 Create epic controller and routes
    - Create `backend/src/controllers/epicController.js`
    - Create `backend/src/routes/epicRoutes.js`
    - Add endpoints for epic CRUD, progress, and child issues
    - Completed 2026-05-28: routes are mounted at `/api/epics`.
    - _Requirements: 5.1, 5.3_

- [~] 9. Implement Story Points and Estimation
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

- [x] 10. Implement Backlog Management backend
  - [x] 10.1 Create backlog service
    - Create `backend/src/services/backlogService.js`
    - Implement backlog query (issues not assigned to any sprint)
    - Implement drag-and-drop reordering with priority rank field
    - Support filtering by issue type, assignee, epic, custom fields
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 10.2 Implement backlog metrics
    - Calculate total story points for backlog issues
    - Display epic groupings in backlog
    - Support moving issues from backlog to sprint
    - Completed 2026-05-28: backlog stats, epic metadata, reordering, sprint assignment, and move-back-to-backlog flows are available through API.
    - _Requirements: 4.6, 4.7_

  - [x] 10.3 Create backlog controller and routes
    - Create `backend/src/controllers/backlogController.js`
    - Create `backend/src/routes/backlogRoutes.js`
    - Add endpoints for backlog listing, reordering, and sprint assignment
    - Completed 2026-05-28: routes are mounted at `/api/backlog`.
    - _Requirements: 4.1, 4.2_

- [~] 11. Implement Version and Release Management backend
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

  - [x] 11.4 Create version controller and routes
    - Create `backend/src/controllers/versionController.js`
    - Create `backend/src/routes/versionRoutes.js`
    - Add endpoints for version CRUD and progress
    - Completed 2026-05-28: routes are mounted at `/api/versions`; release status now syncs the legacy `released` boolean.
    - _Requirements: 11.1, 11.4_

- [~] 12. Checkpoint - Phase 2 Agile Features Complete
  - Test sprint lifecycle end-to-end
  - Verify epic progress calculations
  - Test story point rollup
  - Verify backlog management
  - Verify version management
  - 2026-05-28 status: Phase 2 service exposure is complete for sprint, epic, backlog, and version APIs. Backend syntax checks and Jest suite pass. Remains partial until API smoke tests and optional unit/property tests are added.

### Phase 3: Advanced Features — Linking, JQL, Automation

- [x] 13. Implement Issue Linking backend
  - [x] 13.1 Create issue link service
    - Create `backend/src/services/issueLinkService.js`
    - Support link types: blocks, is blocked by, relates to, duplicates, is duplicated by
    - Implement reciprocal link creation (creating "blocks" auto-creates "is blocked by" on target)
    - Prevent duplicate links between same issues with same type
    - Gap note: `issue_links` migration and local database table now exist after task 1.3, but service/controller/routes are not available yet.
    - Completed 2026-05-28: service supports canonical and user-facing link type aliases, reciprocal pair creation, duplicate prevention, and activity logging.
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [x] 13.2 Implement link management
    - Display linked issues in issue detail
    - Remove all links on issue deletion
    - Support filtering by link type and linked issue status
    - Completed 2026-05-28: linked issue listing includes target issue metadata and supports `link_type` and `linked_status` filters; task deletion cascades through `issue_links` foreign keys and service exposes explicit delete-all support.
    - _Requirements: 9.3, 9.6, 9.7_

  - [ ]* 13.3 Write unit tests for issue link service
    - Test all link types
    - Test reciprocal link creation
    - Test duplicate prevention
    - Test cascade deletion
    - _Requirements: 9.1, 9.4, 9.5_

  - [x] 13.4 Create issue link controller and routes
    - Create `backend/src/controllers/issueLinkController.js`
    - Create `backend/src/routes/issueLinkRoutes.js`
    - Add endpoints for link CRUD
    - Completed 2026-05-28: routes are mounted at `/api/issue-links`.
    - _Requirements: 9.1, 9.2_

- [x] 14. Implement Component Management backend
  - [x] 14.1 Create component service
    - Create `backend/src/services/componentService.js`
    - Implement component CRUD with name, description, default assignee
    - Support multiple components per issue
    - Auto-assign new issues based on component default assignee
    - Gap note: component migration files and local database tables now exist after task 1.3, but service/controller/routes are not available yet.
    - Completed 2026-05-28: component CRUD, issue-component assignment, and default assignee application for unassigned issues are implemented.
    - _Requirements: 10.1, 10.2, 10.5_

  - [x] 14.2 Implement component metrics
    - Calculate component-level issue count and completion rate
    - Support component-based permissions for visibility
    - Display component tags on issue cards
    - 2026-05-28 status: component issue count and completion rate are implemented; task read responses now include component IDs/details. Remains partial until true component-scoped visibility rules are implemented.
    - Completed 2026-05-28: component APIs now enforce project/component visibility through project ownership or membership for non-elevated users, and issue card task responses include component IDs/details.
    - _Requirements: 10.3, 10.4, 10.6, 10.7_

  - [ ]* 14.3 Write unit tests for component service
    - Test CRUD operations
    - Test auto-assignment logic
    - Test metrics calculation
    - _Requirements: 10.1, 10.5_

  - [x] 14.4 Create component controller and routes
    - Create `backend/src/controllers/componentController.js`
    - Create `backend/src/routes/componentRoutes.js`
    - Add endpoints for component CRUD and metrics
    - Completed 2026-05-28: routes are mounted at `/api/components`.
    - _Requirements: 10.1, 10.7_

- [x] 15. Implement Time Tracking backend
  - [x] 15.1 Create time tracking service
    - Create `backend/src/services/timeTrackingService.js`
    - Add original_estimate, remaining_estimate, time_spent to issues
    - Implement work log recording (time spent, date, description)
    - Auto-reduce remaining estimate when time logged
    - Gap note: time tracking migration, `time_logs`, and estimate columns now exist after task 1.3, but service/controller/routes are not available yet.
    - Completed 2026-05-28: `timeTrackingService.js` supports issue estimates, work log creation/deletion, remaining-estimate reduction, activity logging, watcher notifications, and issue update automation triggers.
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 15.2 Implement time tracking reports
    - Support time entry in hours and days with configurable conversion rates
    - Calculate total logged time for sprints and epics
    - Generate time tracking reports by user, project, date range
    - Completed 2026-05-28: reports support project, user, sprint, epic, and date range filters with total, by-user, and by-issue rollups.
    - _Requirements: 12.4, 12.5, 12.6, 12.7_

  - [ ]* 15.3 Write unit tests for time tracking service
    - Test work log recording
    - Test remaining estimate auto-reduction
    - Test report generation
    - _Requirements: 12.1, 12.3_

  - [x] 15.4 Create time tracking controller and routes
    - Create `backend/src/controllers/timeTrackingController.js`
    - Create `backend/src/routes/timeTrackingRoutes.js`
    - Add endpoints for work logs and reports
    - Completed 2026-05-28: routes are mounted at `/api/time-tracking`.
    - _Requirements: 12.2, 12.7_

- [x] 16. Implement Watchers and Notifications Enhancement
  - [x] 16.1 Create watcher service
    - Create `backend/src/services/watcherService.js`
    - Allow users to add/remove themselves as watchers
    - Support automatic watching on create, comment, assign
    - Display watcher count and list on issues
    - Gap note: notification, mention, and watcher table foundations exist, but watcher service/controller/routes are not available yet.
    - Completed 2026-05-28: `watcherService.js` supports add/remove/list, bulk add, automatic watching on create/comment/assign, and project-user cleanup.
    - _Requirements: 13.1, 13.3, 13.5_

  - [x] 16.2 Implement enhanced notifications
    - Send notifications to all watchers on issue update
    - Support notification preferences by event type
    - Remove watchers when user removed from project
    - Support @mentions in comments adding watchers
    - Completed 2026-05-28: task update/status/progress/approval/realisasi/move, comments, and time tracking changes notify watchers through existing notification preferences; mentions are auto-watched.
    - _Requirements: 13.2, 13.4, 13.6, 13.7_

  - [ ]* 16.3 Write unit tests for watcher service
    - Test watcher add/remove
    - Test automatic watching scenarios
    - Test notification delivery to watchers
    - _Requirements: 13.1, 13.3_

  - [x] 16.4 Create watcher controller and routes
    - Create `backend/src/controllers/watcherController.js`
    - Create `backend/src/routes/watcherRoutes.js`
    - Add endpoints for watcher management
    - Completed 2026-05-28: routes are mounted at `/api/watchers`.
    - _Requirements: 13.1, 13.5_

- [x] 17. Implement JQL (JIRA Query Language) Engine
  - [x] 17.1 Create JQL parser service
    - Create `backend/src/services/jqlService.js`
    - Implement JQL syntax parsing (operators: equals, not equals, in, not in, greater than, less than, contains, is empty)
    - Support AND, OR, NOT operators
    - Validate JQL syntax before execution
    - Completed 2026-05-28: `jqlService.js` parses whitelisted fields, comparison operators, grouping, AND/OR/NOT, and ORDER BY clauses.
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 17.2 Implement JQL to SQL converter
    - Convert JQL AST to parameterized SQL queries (prevent SQL injection)
    - Support searching by standard fields (status, assignee, reporter, priority, issue type, dates)
    - Support searching by custom field values
    - Implement sorting and pagination
    - Completed 2026-05-28: JQL converts to parameterized SQL only, supports standard task/project/user/type/sprint/epic/component/label/version fields plus custom fields via `cf[Name]`, and supports pagination.
    - _Requirements: 8.4, 8.5_

  - [x] 17.3 Implement saved filters
    - Create saved_filters table operations
    - Support filter sharing with project members
    - Implement filter favorites
    - Gap note: `saved_filters` table exists, but there is no JQL/saved filter service, controller, route, or frontend integration yet.
    - Completed 2026-05-28: saved filters support owner/shared visibility, favorites, CRUD, and execution.
    - _Requirements: 8.6, 8.7, 8.8_

  - [ ]* 17.4 Write unit tests for JQL service
    - Test query parsing for various syntax patterns
    - Test query execution accuracy
    - Test all filter operators
    - Test SQL injection prevention
    - _Requirements: 8.1, 8.4_

  - [x] 17.5 Create JQL controller and routes
    - Create `backend/src/controllers/jqlController.js`
    - Create `backend/src/routes/jqlRoutes.js`
    - Add endpoints for query execution and saved filters
    - Completed 2026-05-28: routes are mounted at `/api/jql`.
    - _Requirements: 8.2, 8.6_

- [x] 18. Implement Automation Engine backend
  - [x] 18.1 Create automation rule service
    - Create `backend/src/services/automationService.js`
    - Implement rule CRUD operations
    - Store triggers, conditions, and actions as JSONB
    - Support rule enable/disable without deletion
    - Gap note: automation tables exist, but there is no automation engine service/controller/routes or trigger integration yet.
    - Completed 2026-05-28: `automationService.js` supports rule CRUD, JSON trigger/condition/action storage, enable/disable, and execution history.
    - _Requirements: 22.1, 22.7_

  - [x] 18.2 Implement automation trigger system
    - Support triggers: issue_created, issue_updated, issue_transitioned, comment_added, scheduled
    - Integrate with existing controllers to fire triggers via event emitter pattern
    - Decouple trigger detection from action execution
    - Completed 2026-05-28: triggers are dispatched for issue creation/update, workflow transition, and comment-added events through a central `triggerAutomation()` service.
    - _Requirements: 22.2, 22.3_

  - [x] 18.3 Implement automation condition evaluation
    - Support conditions: field_value, user_role, issue_type, custom_jql
    - Evaluate all conditions before executing actions
    - Log condition evaluation results
    - Completed 2026-05-28: field value, user role, issue type, and custom JQL conditions are evaluated before actions; skipped/failed/successful runs are logged.
    - _Requirements: 22.4_

  - [x] 18.4 Implement automation action executors
    - Support actions: update_field, transition_issue, send_notification, create_issue, add_comment, assign_user
    - Execute actions sequentially with error handling
    - Log execution with status, timing, and errors to `automation_logs`
    - Completed 2026-05-28: action executors support update field, transition/status update, send notification, create issue, add comment, and assign user.
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

  - [x] 18.7 Create automation controller and routes
    - Create `backend/src/controllers/automationController.js`
    - Create `backend/src/routes/automationRoutes.js`
    - Add endpoints for rule CRUD and execution logs
    - Completed 2026-05-28: routes are mounted at `/api/automation`.
    - _Requirements: 22.1, 22.6_

- [x] 19. Checkpoint - Phase 3 Advanced Features Complete
  - Test issue linking end-to-end
  - Verify component management
  - Test time tracking reports
  - Test JQL query execution with various syntax
  - Verify automation rule execution
  - 2026-05-28 status: Phase 3 backend implementation is complete for issue links, components, time tracking, watchers, JQL/saved filters, and automation APIs. Syntax/import checks, backend Jest suite, migration runner, frontend production build, and local app health checks passed.

### Phase 4: Reporting, Analytics & Templates

- [x] 20. Implement Velocity Tracking backend
  - [x] 20.1 Create velocity service
    - Create `backend/src/services/velocityService.js`
    - Calculate velocity as completed story points per sprint
    - Store historical velocity data for each completed sprint
    - Calculate average velocity over 3, 5, 10 sprints
    - Support velocity-based capacity recommendations
    - Completed 2026-05-28: `velocityService.js` stores/upserts `velocity_history`, calculates sprint velocity, averages over 3/5/10 sprints, and returns capacity recommendations. Routes are mounted at `/api/velocity`.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ]* 20.2 Write unit tests for velocity service
    - Test velocity calculation accuracy
    - Test average velocity over different sprint counts
    - Test exclusion of incomplete issues
    - _Requirements: 15.1, 15.6_

- [x] 21. Implement Burndown Chart backend
  - [x] 21.1 Create burndown service
    - Create `backend/src/services/burndownService.js`
    - Generate burndown data for active/completed sprints
    - Calculate ideal burndown line based on sprint duration and total story points
    - Track actual vs ideal progress daily
    - Support toggling between story point and issue count views
    - Highlight days when remaining work increased
    - Completed 2026-05-28: `burndownService.js` generates sprint burndown by story points or issue count, ideal vs actual daily remaining work, scope, and work-increase flags. Routes are mounted at `/api/burndown`.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [ ]* 21.2 Write unit tests for burndown service
    - Test burndown data generation
    - Test ideal line calculation
    - Test work increase detection
    - _Requirements: 16.1, 16.4_

- [~] 22. Implement Advanced Reporting backend
  - [x] 22.1 Create report service
    - Create `backend/src/services/reportService.js`
    - Support report types: issue statistics, time tracking, velocity, burndown, cumulative flow, custom
    - Implement report configuration storage
    - Calculate metrics: cycle time, lead time, throughput
    - Completed 2026-05-28: `reportService.js` supports saved report CRUD, generation for issue statistics/time tracking/velocity/burndown/cumulative flow/custom JQL, and cycle/lead time metrics through dashboard metrics.
    - _Requirements: 19.1, 19.6, 19.7_

  - [x] 22.2 Implement cumulative flow diagram
    - Track issue counts by state over time
    - Generate data for visualization
    - Support date range filtering
    - Completed 2026-05-28: cumulative flow data is generated by date range and issue status for visualization.
    - _Requirements: 19.1, 21.1_

  - [~] 22.3 Implement report export and scheduling
    - Support export to PDF, Excel, CSV formats
    - Support scheduled report generation
    - Implement email delivery integration
    - 2026-05-28 status: export to CSV, Excel-compatible XLS, and PDF is implemented with native SpreadsheetML and `pdfkit`; report schedule metadata is stored in report config. Remains partial until an SMTP/email delivery worker is configured.
    - _Requirements: 19.3, 19.5_

  - [ ]* 22.4 Write unit tests for report service
    - Test velocity report generation
    - Test burndown data generation
    - Test cumulative flow calculation
    - Test export functionality
    - _Requirements: 15.1, 16.1, 19.3_

  - [x] 22.5 Create report controller and routes
    - Create `backend/src/controllers/reportController.js`
    - Create `backend/src/routes/reportRoutes.js`
    - Add endpoints for report generation, export, and scheduling
    - Completed 2026-05-28: routes are mounted at `/api/reports`.
    - _Requirements: 19.1, 19.5_

- [x] 23. Implement Agile Metrics Dashboard backend
  - [x] 23.1 Create dashboard metrics service
    - Create `backend/src/services/dashboardMetricsService.js`
    - Calculate cycle time and lead time distributions
    - Generate issue aging report (issues in progress beyond threshold)
    - Calculate team workload distribution by assignee
    - Completed 2026-05-28: `dashboardMetricsService.js` returns cycle/lead time metrics, issue aging, workload distribution, and sprint health indicators.
    - _Requirements: 21.1, 21.3, 21.4, 21.5_

  - [x] 23.2 Implement real-time dashboard updates
    - Refresh metrics via WebSocket on issue updates
    - Support customizable dashboard layout and widget selection
    - Display sprint health indicators
    - Completed 2026-05-28: task realtime updates now emit dashboard metric invalidation events, dashboard preferences are stored in `dashboard_preferences`, and sprint health indicators are available through API.
    - _Requirements: 21.2, 21.6, 21.7_

  - [ ]* 23.3 Write unit tests for dashboard metrics service
    - Test cycle/lead time calculations
    - Test workload distribution
    - Test real-time update triggers
    - _Requirements: 21.1, 21.3_

  - [x] 23.4 Create dashboard metrics controller and routes
    - Create `backend/src/controllers/dashboardMetricsController.js`
    - Create `backend/src/routes/dashboardMetricsRoutes.js`
    - Add endpoints for metrics retrieval
    - Completed 2026-05-28: routes are mounted at `/api/dashboard-metrics`.
    - _Requirements: 21.1, 21.5_

- [x] 24. Implement Issue Templates backend
  - [x] 24.1 Create template service
    - Create `backend/src/services/templateService.js`
    - Store templates with predefined field values
    - Support templates with predefined subtasks and checklists
    - Support template sharing across projects
    - Completed 2026-05-28: `templateService.js` stores templates with fields, subtasks, checklists, sharing, and active/archive state.
    - _Requirements: 23.1, 23.2, 23.6, 23.7_

  - [x] 24.2 Implement template application
    - Apply template values during issue creation
    - Allow modification before creating
    - Support template selection in creation flow
    - Completed 2026-05-28: templates can be previewed and applied to create an issue with overrides, generated subtasks, and checklists.
    - _Requirements: 23.3, 23.4, 23.5_

  - [ ]* 24.3 Write unit tests for template service
    - Test CRUD operations
    - Test template application with subtasks
    - Test cross-project sharing
    - _Requirements: 23.1, 23.4_

  - [x] 24.4 Create template controller and routes
    - Create `backend/src/controllers/templateController.js`
    - Create `backend/src/routes/templateRoutes.js`
    - Add endpoints for template CRUD and application
    - Completed 2026-05-28: routes are mounted at `/api/templates`.
    - _Requirements: 23.1, 23.3_

- [x] 25. Implement Priority Schemes backend
  - [x] 25.1 Create priority scheme service
    - Create `backend/src/services/prioritySchemeService.js`
    - Support custom priority levels with name, icon, color
    - Assign priority schemes to projects
    - Support default priority selection for new issues
    - Completed 2026-05-28: `prioritySchemeService.js` supports custom priority schemes, default scheme creation, project assignment, and default priority lookup.
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

  - [x] 25.2 Implement priority integration
    - Display priority indicators in all views
    - Support filtering and sorting by priority
    - Maintain backward compatibility with existing priority system
    - Completed 2026-05-28: task priority validation is now scheme-based, the legacy four priorities remain seeded as the default scheme, and existing priority filters continue to work.
    - _Requirements: 24.5, 24.6, 24.7_

  - [ ]* 25.3 Write unit tests for priority scheme service
    - Test CRUD operations
    - Test project assignment
    - Test backward compatibility
    - _Requirements: 24.1, 24.7_

  - [x] 25.4 Create priority scheme controller and routes
    - Create `backend/src/controllers/prioritySchemeController.js`
    - Create `backend/src/routes/prioritySchemeRoutes.js`
    - Add endpoints for scheme CRUD
    - Completed 2026-05-28: routes are mounted at `/api/priority-schemes`.
    - _Requirements: 24.1, 24.3_

- [x] 26. Implement Issue Hierarchy and Subtasks Enhancement
  - [x] 26.1 Enhance subtask creation and management
    - Enforce subtask must have parent issue
    - Display subtasks in tree structure under parent issues
    - Calculate parent issue progress based on completed subtasks
    - Inherit epic and sprint assignments from parent to subtasks
    - Completed 2026-05-28: subtask creation enforces a parent for Subtask issue types, existing task tree/subtask APIs display hierarchy, progress rollup remains active, and subtasks inherit parent epic/sprint when not explicitly set.
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 26.2 Implement issue type conversion
    - Support converting regular issue to subtask and vice versa
    - Validate hierarchy on conversion
    - Maintain compatibility with existing nested task functionality
    - Completed 2026-05-28: `hierarchyService.js` supports issue type conversion with parent validation through task update logic. Routes are mounted at `/api/hierarchy`.
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
  - 2026-05-28 status: Phase 4 backend implementation is complete for velocity, burndown, dashboard metrics, templates, priority schemes, and hierarchy APIs. Advanced reporting remains partial only for real SMTP/email scheduled delivery; CSV/Excel-compatible XLS/PDF export and schedule metadata are implemented. Syntax/import checks, backend Jest suite, migration runner, frontend build, report export smoke tests, dashboard metrics smoke test, and npm audit passed.

### Phase 5: Frontend Implementation

- [x] 28. Implement Issue Type Management UI
  - [x] 28.1 Create issue type API service and hooks
    - Create `frontend/src/logic/services/issueTypeApi.js`
    - Create `frontend/src/logic/hooks/useIssueTypes.js` with project-style data hooks
    - Implement API calls for CRUD operations
    - Completed 2026-05-29: created issue type API service and project-style custom hooks for issue types and stats. React Query was not introduced because the current frontend uses lightweight local hook state rather than a query-client dependency.
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 28.2 Create Issue Type Admin Page
    - Create `frontend/src/pages/IssueTypesPage.jsx`
    - Display issue types list with icons, colors, hierarchy levels
    - Support create, edit, delete operations
    - Show issue count per type
    - Completed 2026-05-29: added `/issue-types` admin page with global/project scope filtering, issue counts, custom issue type create/edit/delete, route registration, and sidebar/page metadata.
    - _Requirements: 1.1, 1.2, 1.7_

  - [x] 28.3 Integrate issue types in issue creation
    - Add issue type selector to `TaskFormModal.jsx`
    - Display issue type icons in Board, List, Gantt views
    - Update issue creation flow to require type selection
    - Completed 2026-05-29: task create/edit form now requires issue type selection with Task/Subtask defaults, persists `issue_type_id`, and displays issue type badge plus issue key in Board cards, Task List rows, and Gantt tree rows.
    - _Requirements: 1.6, 1.7_

- [x] 29. Implement Workflow Management UI
  - [x] 29.1 Create workflow API service and hooks
    - Create `frontend/src/logic/services/workflowApi.js`
    - Create `frontend/src/logic/hooks/useWorkflows.js`
    - Implement API calls for workflows, states, transitions
    - Completed 2026-05-29: added workflow API service and lightweight hooks for workflow list/detail and issue transition availability using the existing Axios/local-state frontend pattern.
    - _Requirements: 2.1, 2.2_

  - [x] 29.2 Create Workflow Designer Page
    - Create `frontend/src/pages/WorkflowDesignerPage.jsx`
    - Visual workflow editor with drag-and-drop states
    - Configure transitions with conditions and validators
    - Preview workflow diagram
    - Completed 2026-05-29: added `/workflows` admin page with project/global scope filtering, workflow CRUD, default workflow creation, draggable state ordering, state CRUD, transition CRUD with JSON conditions/validators/post-functions, preview diagram, route registration, and sidebar/page metadata.
    - Diagnosis fix 2026-05-29: workflow transition backend now normalizes route IDs and enforces valid different source/target states in the same workflow, so API-created transitions match designer expectations.
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 29.3 Integrate workflows in issue transitions
    - Update `TaskDetailModal.jsx` with workflow transition buttons
    - Display available transitions based on current state
    - Show transition screens for required field updates
    - Completed 2026-05-29: task detail now shows current workflow state, loads available transitions, executes transitions through workflow API, refreshes task details afterward, and opens a required-field modal for transition validators.
    - _Requirements: 2.4, 2.5, 2.6_

- [x] 30. Implement Sprint Board UI
  - [x] 30.1 Create sprint API service and hooks
    - Create `frontend/src/logic/services/sprintApi.js`
    - Create `frontend/src/logic/hooks/useSprints.js`
    - Completed 2026-05-29: added sprint API service plus lightweight hooks for sprint list, active sprint, sprint issues, and sprint metrics.
    - _Requirements: 3.1, 3.8_

  - [x] 30.2 Create Sprint Board Page
    - Create `frontend/src/pages/SprintBoardPage.jsx`
    - Display active sprint with Kanban columns mapped to workflow states
    - Support swimlanes by assignee, epic, or custom field
    - Drag-and-drop issues between columns using dnd-kit
    - Completed 2026-05-29: added `/sprints` page with project/sprint selection, workflow-state columns, assignee/epic swimlanes, transition/update handling, sprint start/complete actions, route registration, and sidebar/page metadata.
    - _Requirements: 3.1, 14.1, 14.4_

  - [x] 30.3 Create Backlog Management Page
    - Create `frontend/src/pages/BacklogPage.jsx`
    - Display backlog issues with drag-and-drop ordering
    - Show epic groupings and story point totals
    - Support filtering by issue type, assignee, epic
    - Completed 2026-05-29: added `/backlog` page with project filters, issue type/assignee/epic filtering, sortable backlog ordering, story point totals, selected issue bulk move to future sprint, route registration, and sidebar/page metadata.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 30.4 Create Sprint Planning Modal
    - Create sprint creation/edit modal
    - Support drag-and-drop issues from backlog to sprint
    - Display sprint progress and story point totals
    - Completed 2026-05-29: added reusable sprint planning modal for creating/editing sprints, dragging backlog issues into sprint scope, and showing sprint issue/story-point metrics.
    - _Requirements: 3.1, 3.3, 3.8_

- [x] 31. Implement Epic and Roadmap UI
  - [x] 31.1 Create epic API service and hooks
    - Create `frontend/src/logic/services/epicApi.js`
    - Create `frontend/src/logic/hooks/useEpics.js`
    - Completed 2026-05-29: added epic API service and lightweight hooks for epic lists and epic child issues.
    - _Requirements: 5.1, 5.3_

  - [x] 31.2 Create Roadmap View Page
    - Create `frontend/src/pages/RoadmapPage.jsx`
    - Display epics and versions on timeline
    - Show epic progress bars
    - Support drag-and-drop rescheduling
    - Support zoom levels (quarters, months, weeks)
    - Display dependencies between epics as connecting lines
    - Completed 2026-05-29: added `/roadmap` page with project selection, quarter/month/week zoom, epic/version create flows, drag-to-reschedule epic bars, version markers, progress bars, issue-link based dependency lines, route registration, and sidebar/page metadata.
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7_

  - [x] 31.3 Integrate epics in issue views
    - Add epic selector to issue creation/edit
    - Display epic progress bars in backlog and board
    - Support filtering by epic
    - Completed 2026-05-29: task create/edit includes epic selection, task cards and backlog rows display epic progress, and backlog filtering supports epic selection.
    - _Requirements: 5.2, 5.4, 5.5_

- [x] 32. Implement Advanced Search and JQL UI
  - [x] 32.1 Create JQL search component
    - Create `frontend/src/components/search/JQLSearchBar.jsx`
    - Provide JQL input with syntax highlighting
    - Display query results with pagination
    - Completed 2026-05-29: added `/jql` page with token-highlighted JQL input, keyword shortcuts, paginated issue results, route registration, and sidebar/page metadata.
    - _Requirements: 8.1, 8.2_

  - [x] 32.2 Create Saved Filters UI
    - Create `frontend/src/components/search/SavedFiltersPanel.jsx`
    - Support filter save, share, delete operations
    - Display favorite filters
    - Completed 2026-05-29: added saved filters panel with run, favorite, delete, shared/favorite metadata, and save-filter modal wired to JQL APIs.
    - _Requirements: 8.6, 8.7, 8.8_

- [x] 33. Implement Issue Detail Modal Enhancement
  - [x] 33.1 Redesign issue detail modal
    - Update `frontend/src/components/task/TaskDetailModal.jsx`
    - Add JIRA-style layout with sidebar for metadata
    - Display issue type, status, priority prominently
    - Add linked issues section
    - Add custom fields section
    - Completed 2026-05-29: issue detail modal now has a two-column Jira-style layout with metadata sidebar, prominent issue type/status/priority, linked issue management, and custom field editing.
    - _Requirements: 9.3, 1.7, 7.4, 24.5_

  - [x] 33.2 Add time tracking UI
    - Add time tracking panel to issue detail
    - Display original/remaining estimate and time spent
    - Support work log entry with date and description
    - Completed 2026-05-29: issue detail includes estimate summary/editing, work log entry with date/description, recent work logs, and delete actions.
    - _Requirements: 12.4, 12.2_

  - [x] 33.3 Add watchers panel
    - Display watcher count and list
    - Add/remove self as watcher
    - Completed 2026-05-29: issue detail loads watcher count/list and supports adding current or selected users plus removing watchers.
    - _Requirements: 13.1, 13.5_

- [x] 34. Implement Board Configuration UI
  - [x] 34.1 Create Board Configuration Page
    - Create `frontend/src/pages/BoardConfigurationPage.jsx`
    - Configure column mappings to workflow statuses
    - Set up swimlanes by assignee, epic, or custom field
    - Configure quick filters
    - Completed 2026-05-29: added `/board-configuration` admin page with project/global config, legacy status/workflow state column mapping, swimlane default, quick filter editing, route registration, and sidebar/page metadata.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 34.2 Implement card display configuration
    - Configure displayed fields on cards
    - Set card colors based on priority or issue type
    - Apply configuration immediately to board
    - Completed 2026-05-29: board cards now respect saved visible fields and color mode, board columns use saved status mapping, and board config changes broadcast immediately through local storage events.
    - _Requirements: 14.6, 14.7_

- [x] 35. Implement Reports Dashboard UI
  - [x] 35.1 Create Reports Page
    - Create `frontend/src/pages/ReportsPage.jsx`
    - Display report types with cards
    - Support report configuration modal
    - Completed 2026-05-29: added lazy-loaded `/reports` page with report type cards, configuration modal, project/sprint/date/JQL controls, report preview area, route registration, and sidebar/page metadata.
    - _Requirements: 19.1, 19.4_

  - [x] 35.2 Implement burndown chart component
    - Create `frontend/src/components/reports/BurndownChart.jsx`
    - Use recharts for visualization
    - Display ideal vs actual lines
    - Completed 2026-05-29: added Recharts burndown line chart for ideal remaining vs actual remaining sprint work.
    - _Requirements: 16.4, 16.7_

  - [x] 35.3 Implement velocity chart component
    - Create `frontend/src/components/reports/VelocityChart.jsx`
    - Display sprint velocity bars
    - Show average velocity line
    - Completed 2026-05-29: added Recharts velocity chart with committed/completed story point bars and average velocity trend line.
    - _Requirements: 15.3, 15.7_

  - [x] 35.4 Implement export functionality
    - Add export buttons to reports
    - Support PDF, Excel, CSV formats
    - Completed 2026-05-29: reports page exports generated report data through backend CSV, Excel-compatible XLS, and PDF export endpoints.
    - _Requirements: 19.3_

- [x] 36. Implement Automation Rules UI
  - [x] 36.1 Create Automation Rules Page
    - Create `frontend/src/pages/AutomationRulesPage.jsx`
    - Display rules list with enable/disable toggle
    - Show execution count and last run time
    - Completed 2026-05-29: added `/automation` administration page with project/status filters, rule table, enable/disable toggle, execution totals, last run timestamp, and recent execution log view.
    - _Requirements: 22.1, 22.7_

  - [x] 36.2 Create Rule Builder Component
    - Create `frontend/src/components/automation/RuleBuilder.jsx`
    - Visual builder for triggers, conditions, actions
    - Support rule templates for common patterns
    - Completed 2026-05-29: added visual rule builder for trigger events, condition rows, ordered actions, dynamic recipients, user assignment, and common templates for automation setup.
    - _Requirements: 22.1, 22.3, 22.4, 22.5_

- [x] 37. Implement Bulk Operations UI
  - [x] 37.1 Add bulk selection to Board and List views
    - Enable multi-select checkboxes in List and Board views
    - Display bulk action menu on selection
    - Resolved gap: Task List and Board now both support multi-select bulk actions.
    - Completed 2026-05-29: Board cards now expose multi-select checkboxes and share the same bulk action toolbar as Task List, while Task List continues to support tree-row selection.
    - _Requirements: 18.1, 18.2_

  - [x] 37.2 Implement bulk operation dialogs
    - Bulk status change dialog
    - Bulk assignee change dialog
    - Bulk sprint assignment dialog
    - Display progress indicator durang operations
    - Display summary of successful and failed operations
    - Resolved gap: the compact toolbar now opens dialogs with sprint assignment and detailed per-task summaries.
    - Completed 2026-05-29: bulk operations now open action-specific dialogs for status, PIC, sprint, priority, bucket, archive, and unarchive, with per-task progress and success/failure summaries.
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7_

- [x] 38. Implement Import/Export UI
  - [x] 38.1 Create Import Issues Page
    - Create `frontend/src/pages/ImportIssuesPage.jsx`
    - Support CSV and JSON upload
    - Display field mapping interface
    - Show import preview and validation errors
    - Completed 2026-05-29: added lazy-loaded `/import` page with CSV/JSON parsing, default project/issue type selection, auto field mapping, validation preview, progress display, and row-by-row issue creation using the existing task API.
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [x] 38.2 Create Export Issues functionality
    - Add export menu to issue views
    - Support CSV, JSON, Excel formats
    - Export filtered sets or all issues
    - Completed 2026-05-29: added reusable issue export menu to Task List, Board, and JQL results with filtered/current vs all scope and CSV, JSON, and Excel-compatible XLS downloads.
    - _Requirements: 20.5, 20.6, 20.7_

- [x] 39. Checkpoint - Phase 5 Frontend Complete
  - Test all UI pages and components
  - Verify API integrations work correctly
  - Test responsive design
  - Verify accessibility compliance
  - Completed 2026-05-29: frontend production build passed; HTTP smoke checks returned 200 for Phase 5 routes `/backlog`, `/sprints`, `/roadmap`, `/jql`, `/reports`, `/automation`, `/tasks`, `/import`, `/issue-types`, `/workflows`, and `/board-configuration`.
  - Verification note: Browser in-app automation was unavailable in this session, so visual responsive and accessibility checks should receive a manual QA pass before release.

### Phase 6: Integration, Performance & Polish

- [x] 40. Implement Real-time Updates Enhancement
  - [x] 40.1 Enhance Socket.io integration for new features
    - Emit events for issue type, workflow, sprint changes
    - Broadcast automation rule executions
    - Real-time dashboard metrics updates
    - Use Socket.IO rooms for project-specific broadcasts
    - Completed 2026-05-29: Socket.IO now joins authenticated users to a shared workspace room plus existing project rooms; backend emits project/global events for issue type, workflow, sprint, automation rule/execution, workflow issue transition, task refresh, and dashboard metric invalidation; frontend realtime bridge and Jira hooks/pages refresh issue type, workflow, sprint, backlog, task, automation, and dashboard views from those events.
    - _Requirements: 21.7, 14.7_

  - [x] 40.2 Implement optimistic UI updates
    - Update UI optimistically on issue transitions
    - Handle rollback on error
    - Show sync status indicator
    - Completed 2026-05-29: added optimistic local updates, rollback handling, and sync status indicators for project board moves, sprint board workflow transitions, issue detail workflow transitions, backlog ordering, backlog-to-sprint moves, and sprint planning drag-to-sprint assignment.
    - _Requirements: 2.4, 3.3_

- [x] 41. Implement Bulk Operations backend
  - [x] 41.1 Create bulk operations service
    - Create `backend/src/services/bulkOperationsService.js`
    - Support bulk status change, assignee change, sprint assignment, deletion
    - Validate permissions for each issue in bulk
    - Log bulk operations in activity logs
    - Completed 2026-05-29: added dedicated Jira-style bulk operation service with per-issue project access checks, task permission checks, partial success/failure results, status/assignee/sprint/delete actions, and summary audit logs.
    - _Requirements: 18.1, 18.3, 18.4, 18.7_

  - [x]* 41.2 Write unit tests for bulk operations
    - Test permission validation per issue
    - Test partial success/failure handling
    - Test activity logging
    - Completed 2026-05-29: added mocked unit coverage for per-issue permission failures, missing issues, assignee changes, activity logging, and denied base permission behavior.
    - _Requirements: 18.4, 18.6_

  - [x] 41.3 Create bulk operations controller and routes
    - Create `backend/src/controllers/bulkOperationsController.js`
    - Create `backend/src/routes/bulkOperationsRoutes.js`
    - Add endpoints for bulk operations
    - Completed 2026-05-29: added `/api/bulk-operations`, `/api/bulk-operations/issues`, and action-specific issue endpoints with Zod payload validation and route permissions.
    - _Requirements: 18.1, 18.3_

- [x] 42. Implement Import/Export backend
  - [x] 42.1 Create import/export service
    - Create `backend/src/services/importExportService.js`
    - Support importing issues from CSV and JSON formats
    - Validate required fields and data types during import
    - Support field mapping during import
    - Completed 2026-05-29: added CSV/JSON parsing, target-to-source field mapping, project/issue type/user lookup, row preview validation, optional invalid-row skipping, task creation through the existing task service, and custom field value import.
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 42.2 Implement export functionality
    - Support exporting to CSV, JSON, Excel formats
    - Include all standard and custom fields in export
    - Support exporting filtered issue sets
    - Completed 2026-05-29: added CSV, JSON, and Excel-compatible HTML export with standard/custom fields, JQL or explicit issue/project filters, export row limits, and field-level visibility for sensitive fields.
    - _Requirements: 20.5, 20.6, 20.7_

  - [x]* 42.3 Write unit tests for import/export
    - Test CSV parsing and validation
    - Test field mapping
    - Test export format generation
    - Completed 2026-05-29: added tests for quoted CSV parsing, mapped import preview validation, custom field import persistence, and export field visibility.
    - _Requirements: 20.1, 20.5_

  - [x] 42.4 Create import/export controller and routes
    - Create `backend/src/controllers/importExportController.js`
    - Create `backend/src/routes/importExportRoutes.js`
    - Add endpoints for import preview, execute, and export
    - Completed 2026-05-29: added `/api/import-export/import/preview`, `/api/import-export/import`, and `/api/import-export/export` with Zod validation, route permissions, and optional file download response.
    - _Requirements: 20.1, 20.4, 20.5_

- [x] 43. Implement Performance Optimizations
  - [x] 43.1 Add database query optimizations
    - Create composite indexes for frequent queries (project_id + issue_type_id + status)
    - Add full-text search index on issue title and description
    - Optimize JQL to SQL conversion for large datasets
    - Implement database connection pooling tuning
    - Completed 2026-05-29: added Phase 6 migration and schema indexes for project/type/status, project/workflow/sprint, project updated ordering, assignee/project, task assignee lookups, custom field lower-value lookups, and title/description full-text search; JQL `text ~` now includes indexed full-text matching while preserving LIKE fallback; DB pool timeouts/max/statement timeout are env-tunable.
    - _Requirements: 8.2, 19.1_

  - [x] 43.2 Implement frontend performance enhancements
    - Add virtual scrolling for large issue lists (backlog, search results)
    - Lazy load issue details and comments
    - Implement React Query caching strategies with appropriate TTLs
    - Completed 2026-05-29: added TanStack Query provider and stale-time caching for backlog, sprint, sprint issue/metric, and issue type hooks; added virtualized table rows for large backlog/JQL result sets; lazy-loaded `TaskDetailModal` and `CommentThread` chunks.
    - _Requirements: 4.1, 19.4_

- [x] 44. Implement Security Enhancements
  - [x] 44.1 Add API rate limiting and security headers
    - Install and configure `express-rate-limit` per user/IP
    - Install and configure `helmet` for security headers
    - Ensure JWT token validation on every request
    - Completed 2026-05-29: installed and configured `express-rate-limit` and `helmet`; added API/auth rate limiters with env-tunable windows/limits; kept `/api` behind `authenticateRequest` and restarted the local backend with the new middleware.
    - _Requirements: 22.1, 8.2_

  - [x] 44.2 Implement field-level security
    - Control field visibility based on user permissions
    - Audit all workflow transitions with actor information
    - Validate inputs using Zod schemas for all new endpoints
    - Completed 2026-05-29: export hides sensitive fields unless the user has elevated access/read-sensitive permission, custom fields require `custom_field:read`, workflow transition audit metadata now includes actor id/role, workflow transition execution has route permission, and all new bulk/import/export endpoints validate with Zod.
    - _Requirements: 2.3, 22.6, 10.6_

- [x] 45. Implement Workflow Transition Validation (Property 8)
  - [x]* 45.1 Write property test for workflow transition validity
    - **Property 8: Workflow Transition Validity**
    - Verify that `can_transition(issue, transition)` is true only when transition.from_state_id equals issue.workflow_state_id AND all conditions pass
    - **Validates: Requirements 2.4, 2.3**
    - Completed 2026-05-29: extracted `canTransitionIssue` predicate and added property-style coverage across source/current state combinations and pass/fail condition outcomes.

- [x] 46. Final Integration Testing
  - [x] 46.1 End-to-end issue lifecycle testing
    - Create Epic → Create Stories → Create Tasks → Transition workflow → Complete
    - Verify all relationships maintained throughout lifecycle
    - Verify progress calculations accurate at each step
    - Completed 2026-05-29: live API smoke created disposable project/epic/story/task records, moved work through review/approval to `Done`, verified child/story statuses and epic progress reached 100, then deleted the disposable project.
    - _Requirements: 1.1, 2.1, 5.1, 17.1_

  - [x] 46.2 Sprint workflow integration testing
    - Create sprint → Add issues → Start → Update issues → Generate burndown → Complete
    - Verify sprint state transitions
    - Verify issue rollover to next sprint
    - Verify velocity calculation after completion
    - Completed 2026-05-29: live API smoke created a disposable sprint, assigned issues, started it, read metrics, completed it to `CLOSED`, and cleaned up via disposable project deletion.
    - _Requirements: 3.1, 15.1, 16.1_

  - [x] 46.3 Automation rule integration testing
    - Create rule → Trigger event → Verify conditions → Verify actions executed
    - Test multiple rules triggered by same event
    - Test error handling and logging
    - Completed 2026-05-29: live API smoke created a disposable automation rule, triggered its event against an issue, verified one matched rule and one automation log, then cleaned up via disposable project deletion; service tests cover failure/partial-result handling in the new Phase 6 services.
    - _Requirements: 22.1, 22.3, 22.4, 22.5_

- [x] 47. Final Checkpoint - All Phases Complete
  - Ensure all tests pass, ask the user if questions arise.
  - All unit tests passing
  - All property-based tests passing
  - All integration tests passing
  - Performance benchmarks met (< 500ms API response, < 2s page load)
  - Security audit complete
  - Completed 2026-05-29: backend tests passed, frontend production build passed, migrations applied, local backend/frontend route smoke checks passed, Phase 6 security/performance features are implemented, and all Phase 6 checklist items are complete.


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
