PROJECT MANAGEMENT PLANNER GANTT - TECHNICAL HANDOFF AND CHANGE LOG
====================================================================

Purpose of this file
--------------------
This file is the technical handoff log for this project. Any future agent or developer working on this application must read this file before making changes.

Important rule for future work:
- Every meaningful application change must be recorded in this file.
- Record the date, files changed, reason for change, behavior impact, database impact, verification performed, and any known risks.
- Do not rely only on chat history. This file should remain the source of truth for what has been done.

Project location
----------------
Root:
  c:\laragon\www\Project Management\project-management-app

Main app folders:
  backend/
  frontend/

Existing docs:
  README.md   - user-facing setup instructions
  readme.txt  - technical handoff, detailed implementation notes, and change log


High-level product concept
--------------------------
This is a full-stack Project Management application based on a Microsoft Planner-style workflow.

Core product direction:
- Daily users manage work through a Planner-like Board View.
- The same task data is reused by List/Table View.
- The same task data is reused by Gantt View.
- Gantt Chart is the final monitoring output for management.
- Projects are cross-department workspaces. A project is not owned by exactly one department.
- Department-level monitoring is derived from users/PICs in that department and the tasks/projects they are involved in.
- Gantt is available at two levels:
  1. Project-level Gantt
  2. Department-level Gantt combining all projects in one department

The system is intentionally not a generic task manager. The data model and flows are built around this concept:
  Planner-style task board -> normalized task data -> automatic project/department Gantt timeline.


Tech stack implemented
----------------------
Frontend:
- React 18
- Vite
- React Router
- Tailwind CSS
- Axios
- dnd-kit for Board drag and drop
- date-fns for date formatting and Gantt date calculations
- Zustand for lightweight client UI state

Backend:
- Node.js
- Express
- PostgreSQL using pg
- CORS
- dotenv
- REST API

Database:
- PostgreSQL
- SQL schema file:
  backend/src/database/schema.sql
- SQL seed file:
  backend/src/database/seed.sql


Actual database configuration
-----------------------------
The backend uses:
  backend/.env

Current working configuration:
  PORT=5000
  DB_HOST=127.0.0.1
  DB_PORT=5433
  DB_USER=postgres
  DB_PASSWORD=admin
  DB_NAME=project_management
  FRONTEND_URL=http://localhost:5173

Equivalent PostgreSQL application JDBC URL:
  jdbc:postgresql://127.0.0.1:5433/project_management

Important:
- jdbc:postgresql://127.0.0.1:5433/postgres connects to the PostgreSQL maintenance database named postgres, not the application database.
- Application tables are in database project_management, schema public.
- The user account table is named users, not user.
- Login password hashes are stored in users.password_hash.
- The Super Admin account is stored in users with role=super_admin.

Important database credential note:
- The user later stated:
    database: project_management
    user=postgre
    password=admin
- Direct pg connection tests showed:
    postgre/admin  -> failed
    pstgres/admin  -> failed
    postgres/admin -> success
- Therefore backend/.env was updated to DB_USER=postgres so the app can actually connect to the local PostgreSQL instance.
- If the local database role changes later, update backend/.env and restart backend.


How to run
----------
Backend:
  cd backend
  npm install
  npm run dev

Frontend:
  cd frontend
  npm install
  npm run dev

Default URLs:
  Backend:  http://localhost:5000
  Frontend: http://localhost:5173

When the app was last run by Codex:
- Frontend responded with HTTP 200 on http://localhost:5173
- Backend root responded successfully on http://localhost:5000
- Dashboard summary API responded successfully after schema and seed were executed


Database setup performed
------------------------
Schema executed:
  backend/src/database/schema.sql

Seed executed:
  backend/src/database/seed.sql

The seed script uses TRUNCATE ... RESTART IDENTITY CASCADE. Do not run seed.sql in a database containing user production data unless a reset is intended.

Seed data inserted:
- Departments:
  HR
  IT
  Management

- Users:
  Super Admin
  Rey
  Ardi
  Fandra
  Olin
  HR

- Project:
  Timeline E-KPI

- Buckets:
  Perencanaan
  Pekerjaan
  Development App e-KPI
  Testing
  Deployment

- Tasks:
  23 sample tasks based on Timeline E-KPI

- Calendar exceptions:
  2025-01-01 holiday Tahun Baru
  2025-03-31 holiday Contoh Libur Nasional
  2025-02-01 working_day Contoh Hari Masuk Pengganti

Last verified dashboard summary after seed:
  total_projects: 1
  active_projects: 1
  total_tasks: 23
  done_tasks: 20
  overdue_tasks: 3
  average_progress: 99


Backend implementation details
------------------------------
Backend folder:
  backend/src

Main entry:
  backend/src/server.js

Database connection:
  backend/src/config/db.js

Response helpers:
  backend/src/utils/responseUtils.js

All backend responses use this shape:

Success:
  {
    "success": true,
    "message": "Data berhasil diproses",
    "data": ...
  }

Error:
  {
    "success": false,
    "message": "Pesan error",
    "error": ...
  }

Implemented backend routes:
  /api/auth
  /api/departments
  /api/locations
  /api/users
  /api/projects
  /api/buckets
  /api/tasks
  /api/calendar
  /api/gantt
  /api/dashboard

Controllers implemented:
  backend/src/controllers/authController.js
  backend/src/controllers/departmentController.js
  backend/src/controllers/locationController.js
  backend/src/controllers/userController.js
  backend/src/controllers/projectController.js
  backend/src/controllers/bucketController.js
  backend/src/controllers/taskController.js
  backend/src/controllers/calendarController.js
  backend/src/controllers/ganttController.js
  backend/src/controllers/dashboardController.js

Routes implemented:
  backend/src/routes/authRoutes.js
  backend/src/routes/departmentRoutes.js
  backend/src/routes/locationRoutes.js
  backend/src/routes/userRoutes.js
  backend/src/routes/projectRoutes.js
  backend/src/routes/bucketRoutes.js
  backend/src/routes/taskRoutes.js
  backend/src/routes/calendarRoutes.js
  backend/src/routes/ganttRoutes.js
  backend/src/routes/dashboardRoutes.js

Services implemented:
  backend/src/services/authService.js
  backend/src/services/taskService.js
  backend/src/services/projectService.js
  backend/src/services/calendarService.js
  backend/src/services/ganttService.js
  backend/src/services/dashboardService.js

Utilities implemented:
  backend/src/utils/dateUtils.js
  backend/src/utils/workdayUtils.js
  backend/src/utils/responseUtils.js


Backend business logic
----------------------
Task nesting:
- tasks.parent_task_id supports unlimited nested subtasks conceptually.
- parent_task_id NULL means root/main task.
- parent_task_id with a value means the task is a child/subtask of another task.
- Backend validates that a task cannot become its own parent.
- Backend validates that a parent task must be inside the same project.
- Backend prevents assigning a descendant as the parent to avoid recursive cycles.

Task progress:
- Leaf task without children can use manual progress.
- Parent task progress is calculated from the average progress of its direct children.
- Calculation is recursive:
  child with children gets calculated first, then parent uses child progress.
- Project progress is calculated from average progress of root tasks in the project.
- After task create/update/delete/move/parent-change/progress-change/status-change, backend recalculates task and project progress.

Task status:
- Allowed task statuses:
  Not Started
  In Progress
  Waiting Review
  Done
  Overdue
- When a task is marked Done or progress is set to 100, backend stores it as 99% Waiting Review.
- Done 100% is reserved for approval by the task lead or super_admin.
- When a task end_date is past, progress is below 100, and stored status is not Done or Waiting Review, read queries expose effective status as Overdue.
- User can still choose manual status, but Overdue is calculated logically in reads and completion still enters Waiting Review first.

Task approval:
- /api/tasks/:id/approve approves a task that is already Waiting Review.
- Normal approval requires the logged-in approver to match task lead_id.
- super_admin can approve any Waiting Review task, even if the task has no lead_id.
- Parent task approval remains blocked until every direct subtask is already Done 100%.

Priority:
- Allowed priorities:
  Low
  Medium
  High
  Urgent

Project status:
- Allowed project statuses:
  Planning
  Active
  On Hold
  Completed
  Cancelled

Working calendar:
- Default working days are Monday to Friday.
- Saturday and Sunday are non-working days by default.
- calendar_exceptions modifies this:
  type=holiday means date is not a working day even if Monday-Friday.
  type=working_day means date is a working day even if weekend.
- Backend calculates:
  duration_days: inclusive calendar day count between start_date and end_date.
  work_days: inclusive working day count according to calendar exceptions.
- If start_date or end_date is null, both metrics are 0.
- When a calendar exception is created/updated/deleted, all task date metrics are recalculated.

Gantt API:
- /api/gantt/tasks returns all task tree data for Gantt.
- /api/gantt/projects/:projectId returns task tree data for one project.
- /api/gantt/departments/:departmentId returns department metadata, department users, projects involving those users, and task tree data assigned to users in the selected department.
- Gantt rows include project, department, bucket, parent, level, assignee, lead, dates, duration, work_days, progress, status, priority, and children.

Dashboard API:
- /api/dashboard/summary returns:
  total_projects
  active_projects
  completed_projects
  total_tasks
  not_started_tasks
  in_progress_tasks
  waiting_review_tasks
  done_tasks
  overdue_tasks
  average_progress
  tasks_due_this_week
  projects_by_department
  tasks_by_status
  overdue_by_department


Database schema details
-----------------------
Tables created in schema.sql:
  departments
  locations
  users
  projects
  project_members
  buckets
  tasks
  task_comments
  task_attachments
  activity_logs
  calendar_exceptions

Authentication/user fields:
- users.password_hash stores a hash for local app login. It is not returned by normal user APIs.
- users.location_id links each user to locations.id as the user's business unit.
- Existing and new users use the default password modern888 until a password reset/change feature is added.
- Super admin user:
  name: Super Admin
  email: superadmin@project-management.local
  role: super_admin
- Role super_admin can approve any Waiting Review task, including tasks where the user is not the task lead.

Important constraints:
- project_members has UNIQUE(project_id, user_id) so the same user cannot be duplicated in one project.
- tasks.status check constraint:
  Not Started, In Progress, Waiting Review, Done, Overdue
- tasks.priority check constraint:
  Low, Medium, High, Urgent
- projects.status check constraint:
  Planning, Active, On Hold, Completed, Cancelled
- calendar_exceptions.type check constraint:
  holiday, working_day
- tasks.progress and projects.progress constrained to 0..100
- tasks.parent_task_id has ON DELETE CASCADE so deleting a parent deletes descendants.

Important indexes:
- users.department_id
- users.location_id
- projects.owner_id
- project_members.project_id
- project_members.user_id
- buckets.project_id
- tasks.project_id
- tasks.bucket_id
- tasks.parent_task_id
- tasks.assignee_id
- tasks.status
- tasks.start_date/end_date
- calendar_exceptions.exception_date

SQL helper functions:
- calculate_duration_days_sql(start_value DATE, end_value DATE)
- calculate_work_days_sql(start_value DATE, end_value DATE)

Trigger:
- set_updated_at() trigger updates updated_at on departments, users, projects, buckets, tasks, and calendar_exceptions.


Frontend implementation details
-------------------------------
Frontend folder:
  frontend/src

Main entry:
  frontend/src/main.jsx

App shell:
  frontend/src/app/App.jsx
  frontend/src/app/router.jsx

Layout:
  frontend/src/components/layout/MainLayout.jsx
  frontend/src/components/layout/Sidebar.jsx
  frontend/src/components/layout/Topbar.jsx

Pages implemented:
  frontend/src/pages/LoginPage.jsx
  frontend/src/pages/DashboardPage.jsx
  frontend/src/pages/ProjectsPage.jsx
  frontend/src/pages/LocationsPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/pages/BoardPage.jsx
  frontend/src/pages/TaskListPage.jsx
  frontend/src/pages/GanttPage.jsx
  frontend/src/pages/DepartmentGanttPage.jsx
  frontend/src/pages/TeamPage.jsx
  frontend/src/pages/CalendarSettingsPage.jsx
  frontend/src/pages/SettingsPage.jsx

API service wrappers:
  frontend/src/logic/services/api.js
  frontend/src/logic/services/authApi.js
  frontend/src/logic/services/locationApi.js
  frontend/src/logic/services/projectApi.js
  frontend/src/logic/services/taskApi.js
  frontend/src/logic/services/departmentApi.js
  frontend/src/logic/services/userApi.js
  frontend/src/logic/services/calendarApi.js
  frontend/src/logic/services/ganttApi.js
  frontend/src/logic/services/dashboardApi.js

Hooks:
  frontend/src/logic/hooks/useProjects.js
  frontend/src/logic/hooks/useTasks.js
  frontend/src/logic/hooks/useDepartments.js
  frontend/src/logic/hooks/useLocations.js
  frontend/src/logic/hooks/useUsers.js
  frontend/src/logic/hooks/useCalendar.js

Stores:
  frontend/src/store/projectStore.js
  frontend/src/store/taskStore.js
  frontend/src/store/uiStore.js

Helpers:
  frontend/src/logic/helpers/dateHelper.js
  frontend/src/logic/helpers/ganttHelper.js
  frontend/src/logic/helpers/taskTreeHelper.js
  frontend/src/logic/helpers/statusHelper.js

Constants:
  frontend/src/logic/constants/status.js
  frontend/src/logic/constants/priority.js
  frontend/src/logic/constants/colors.js


Frontend feature implementation
-------------------------------
Login:
- The app now requires login before showing the main layout.
- /login accepts either user name or email from the Team/user master data.
- Current default password for all existing and newly created users is modern888.
- Successful login stores the sanitized user in browser localStorage and sets currentUserId for approval context.
- Topbar shows the logged-in user and role, plus Logout.
- The previous Active User selector was removed from the topbar so approval follows the logged-in user.
- Login screen intentionally does not display default password or super admin credentials.
- Login form includes a password visibility toggle and a local generic error message.

Lokasi / Business Unit:
- Locations are master data for business units where users work.
- Backend route:
  /api/locations
- Frontend page:
  /locations
- users.location_id stores each user's business unit.
- Team page can assign a user to a location.
- Deleting a location sets related users.location_id to null.
- Projects can be filtered by location. The filter matches users involved as project members, task PICs through task_assignees, or legacy tasks.assignee_id.
- Task List and global Gantt can be filtered by location.
- If department and location filters are both provided, task/project filtering requires the same involved user to match both department and location.
- Department Gantt supports filtering one department by one business unit and returns users, projects, Gantt rows, and a task list for that combined scope.

Dashboard:
- Uses /api/dashboard/summary.
- Shows summary cards for projects, tasks, done tasks, overdue tasks, average progress, and tasks due this week.
- Shows project progress list.
- Shows task status summary.
- Shows projects by department and overdue by department.

Projects:
- Shows project cards.
- Supports project status filter.
- Supports create/edit/delete project via ProjectFormModal.
- Project card links to detail page.

Project detail:
- Shows ProjectHeader.
- Has tabs:
  Board
  List
  Gantt
  Activity
- Board tab uses same task tree and buckets.
- List tab uses TaskTree.
- Gantt tab uses GanttChart.
- Activity tab currently displays a placeholder note. Database table activity_logs already exists.

Project membership:
- Project creation does not ask for one department.
- ProjectFormModal uses owner and Project Members.
- Project Members can include users from multiple departments.
- Backend stores involvement in project_members.
- Owner is automatically included as a project member.
- Task assignees are automatically upserted into project_members when tasks are created or updated.
- Department labels shown on project cards/headers are derived from involved member departments, not from projects.department_id.

Board:
- Component:
  frontend/src/components/board/BoardView.jsx
- Supports groupBy status and groupBy bucket.
- Uses dnd-kit DndContext.
- If grouped by status, dropping task into a status column calls:
  PATCH /api/tasks/:id/move with { status }
- If grouped by bucket, dropping task into a bucket column calls:
  PATCH /api/tasks/:id/move with { bucket_id }
- Changes are persisted to PostgreSQL through backend API.
- Board columns scroll vertically and board scrolls horizontally.

Bucket management:
- Component:
  frontend/src/components/project/BucketManager.jsx
- Added to:
  ProjectDetailPage.jsx
  BoardPage.jsx
- Allows create/edit/delete project buckets.
- Deleting bucket sets related task bucket_id to null by schema ON DELETE SET NULL.

Task form:
- Component:
  frontend/src/components/task/TaskFormModal.jsx
- Fields:
  title
  description
  project
  bucket
  parent_task_id
  assignee
  lead_name
  start_date
  end_date
  progress
  status
  priority
- If creating a subtask from a parent, parent_task_id is prefilled.
- If editing a task that has children, progress input is disabled because backend calculates parent progress.

Task detail:
- Component:
  frontend/src/components/task/TaskDetailModal.jsx
- Shows project/bucket/status/priority/PIC/lead/date/duration/work_days/progress/subtasks.
- Can update progress for leaf task.
- Can edit task.
- Can delete task.
- Can add subtask.

Task list:
- Component:
  frontend/src/components/task/TaskTree.jsx
- Shows nested task rows with expand/collapse.
- Columns:
  Task
  Project
  Bucket
  PIC
  Start
  End
  Duration
  Work Days
  Progress
  Status
  Priority
  Actions

Gantt:
- Custom Gantt implementation.
- Components:
  frontend/src/components/gantt/GanttChart.jsx
  frontend/src/components/gantt/GanttRow.jsx
  frontend/src/components/gantt/GanttTreeRow.jsx
  frontend/src/components/gantt/GanttTimelineHeader.jsx
  frontend/src/components/gantt/GanttFilters.jsx
- Does not use an external Gantt library.
- Uses CSS/HTML rows and absolute-positioned bars.
- Supports week and month view modes.
- Timeline range is calculated from min start_date and max end_date.
- Left task column is sticky.
- Timeline is horizontally scrollable.
- Parent rows can collapse/expand.
- Department Gantt groups rows by project, but the underlying rows are tasks assigned to users in the selected department.
- Department Gantt also shows users in the selected department and the projects they are involved in.
- Gantt bar color is based on status.
- Progress is displayed inside the bar.
- Clicking a Gantt bar opens TaskDetailModal.

Team:
- Supports create/edit/delete users.
- Users are used as login accounts, PIC/assignee, lead approver, project owner, project members, and location/business-unit ownership.
- New users default to password modern888.
- Role options include super_admin, admin, member, and viewer.
- Each user can be assigned to one lokasi/business unit.

Calendar settings:
- Supports create/edit/delete calendar exceptions.
- Shows explanation of default Monday-Friday calendar.
- Uses calendar exception type:
  holiday
  working_day
- Backend recalculates task date metrics after exception changes.

Settings:
- Supports department create/edit/delete.
- Links to Team page for users.
- Notes that buckets are project-specific.
- Notes import Excel is intentionally not implemented yet.


Styling and UI direction
------------------------
Tailwind config:
  frontend/tailwind.config.js

Main CSS:
  frontend/src/styles/index.css

Visual direction:
- Modern, compact, professional dashboard.
- Dominant blue and white palette.
- Sidebar on left.
- Topbar on top.
- Cards are white, rounded-xl, subtle border/shadow.
- Background is light slate/blue gradient.

Important colors:
  Primary Blue: #2563EB
  Dark Blue:    #1E3A8A
  Light Blue:   #DBEAFE
  Background:   #F8FAFC
  Border:       #E2E8F0
  Text Dark:    #0F172A
  Text Muted:   #64748B
  Success:      #16A34A
  Warning:      #F59E0B
  Danger:       #DC2626


Verification already performed
------------------------------
Backend dependency install:
  cd backend
  npm install
Result:
  success
  0 vulnerabilities reported by npm audit output

Frontend dependency install:
  cd frontend
  npm install
Result:
  success
  0 vulnerabilities reported by npm audit output

Frontend production build:
  cd frontend
  npm run build
Result:
  success

Backend syntax check:
  node --check for all backend src/*.js files recursively
Result:
  success

Backend smoke test:
  GET http://localhost:5000/
Result:
  success true, API running

Frontend smoke test:
  GET http://localhost:5173/
Result:
  HTTP 200 OK

Database API smoke test after schema and seed:
  GET http://localhost:5000/api/dashboard/summary
Result:
  success true with seeded dashboard data


Known limitations and next work
-------------------------------
Authentication:
- Login exists and is required by the frontend, but there is no token/session middleware yet.
- The frontend stores the sanitized logged-in user in localStorage.
- Backend approval validates approver_user_id/X-User-Id against users.id and role, but most CRUD endpoints are still not protected by a real authenticated session.
- All user passwords are currently initialized to modern888; add password change/reset before production use.

Activity:
- activity_logs table exists.
- ProjectDetail Activity tab currently has placeholder UI.
- No full activity API/UI has been implemented yet.

Task comments and attachments:
- Tables exist:
  task_comments
  task_attachments
- No UI/API has been implemented yet beyond schema.

Excel import:
- Not implemented by request.
- Schema is prepared to support future import mapping.

Task dependency:
- Not implemented by request.
- No dependency_task_id exists.

Testing:
- No automated unit/integration test framework was added.
- Current verification is build/syntax/smoke testing.

TypeScript:
- The original user rules mention Next.js/TypeScript standards, but the requested stack for this project was React + Vite with JSX.
- The implementation follows the requested React + Vite structure with .jsx/.js files.
- If the project is later migrated to TypeScript, start by typing API payloads, task/project/domain models, and service responses.


Important operational notes
---------------------------
Running seed.sql:
- seed.sql truncates all application tables and resets IDs.
- Only run seed.sql when resetting sample data is acceptable.

Backend restart:
- .env changes require backend restart.
- If database connection fails, test credentials directly with pg before changing code.

Frontend API base:
  frontend/.env
  VITE_API_BASE_URL=http://localhost:5000/api

Backend CORS:
  backend/.env
  FRONTEND_URL=http://localhost:5173

Generated folders:
- node_modules/ should not be committed.
- frontend/dist/ should not be committed.
- .gitignore exists at project root to ignore node_modules and dist.


Change log
----------

2026-04-30 - Autofill subtask start date from parent sequence
Files changed:
  frontend/src/components/task/TaskFormModal.jsx
  readme.txt

What changed:
- Added create-subtask default start date logic in TaskFormModal.
- When creating a subtask under a parent with existing children, Start Date is automatically filled from the end_date of the last child task in that parent.
- When creating the first subtask under a parent, Start Date is automatically filled from the parent task start_date.
- Start Date remains editable by the user after autofill.
- Updated the Add Subtask modal header description to include the selected parent task title, parent Start Date, and parent End Date.
- Added a Start Date hint explaining whether the autofill came from the previous subtask end date or the parent start date.

Reason:
- User requested easier subtask creation from Task List by pre-filling the next subtask start date from the previous task sequence.
- User requested the Add Subtask header to show parent task date context.

Behavior impact:
- Frontend-only usability change.
- No backend, database, API contract, task date validation, or task creation payload shape changed.
- Existing backend validation still accepts edited user-provided dates and rejects end_date earlier than start_date.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.

Known risks:
- Autofill uses the currently loaded parent.children list sorted by sort_order/id. If future custom row ordering is added, this helper should be aligned with that ordering.

2026-04-30 - Roll up parent task end dates from children
Files changed:
  backend/src/services/taskService.js
  backend/src/database/migrations/20260430_parent_task_end_date_rollup.sql
  readme.txt

What changed:
- Updated backend task rollup logic so parent tasks automatically extend end_date when any child or descendant task has a later end_date.
- Parent duration_days and work_days are recalculated when the parent end_date is extended.
- Kept the rule conservative: parent end_date is extended to cover the latest child/descendant end date, but an already-longer parent end_date is not shortened.
- Added an idempotent SQL migration to fix existing database rows where parent end_date was shorter than descendant end_date.

Reason:
- User reported Task List parent/child inconsistencies where some child tasks ended later than their parent task.
- Parent dates feed the same task data used by Gantt, so the database value must be corrected rather than only adjusting frontend display.

Behavior impact:
- Creating or updating a child task with a later end_date now updates ancestor parent end_date through backend recalculation.
- Existing inconsistent parent rows were corrected in the database.
- Gantt receives corrected parent end_date through the existing task/Gantt APIs.
- No API payload shape changes.

Verification:
- Detected existing parent/date mismatches before migration.
- Executed migration:
  backend/src/database/migrations/20260430_parent_task_end_date_rollup.sql
- Verified remaining parent end-date mismatches:
  remaining_mismatches=0
- Verified corrected sample parent rows:
  Perencanaan: end_date 2026-01-13
  Create ETL Sales Hospitality & Industrial: end_date 2026-03-11
  Crosscheck data sales industrial dan hospitality: end_date 2026-03-11
- Ran backend service smoke test:
  Created temporary parent and child tasks.
  Confirmed parent end_date changed from 2026-01-02 to 2026-01-10 after child creation.
  Deleted temporary tasks.
  Result: success, leftover_smoke_tasks=0.
- Ran HTTP API smoke test through /api/tasks:
  Created temporary parent and child tasks.
  Confirmed parent end_date changed from 2026-02-02 to 2026-02-12 after child creation.
  Deleted temporary tasks.
  Result: success, leftover smoke tasks=0.
- Ran backend syntax check:
  node --check for backend/src/**/*.js
  Result: success.
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  GET http://localhost:5000/api/gantt/tasks
  GET http://localhost:5173/tasks
  Result: HTTP 200.

Known risks:
- The rollup intentionally does not shorten a parent end_date that is already later than all children, to avoid removing manually planned buffer dates without an explicit override field.

2026-04-30 - Add project dates to Quick Resume
Files changed:
  frontend/src/components/gantt/GanttQuickResume.jsx
  frontend/src/components/gantt/GanttChart.jsx
  readme.txt

What changed:
- Added a Project schedule panel in the Quick Resume modal.
- Quick Resume now displays project Start Date and End Date from project-level dates.
- Project dates are collected from Gantt project groups when available, with fallback to task payload fields:
  project_start_date
  project_end_date
- For multi-project Gantt or Department Gantt, the displayed project date range uses the earliest project start date and latest project end date across the visible projects.

Reason:
- User requested Start Date and End Date from the project to be shown in Quick Resume.

Behavior impact:
- Visual/frontend-only change.
- No backend, database, or API contract changes.
- Timeline progress calculations still use the currently displayed task plan dates; the new fields are informational project schedule dates.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Browser visual QA should still be done after hard refresh because no screenshot automation is configured.

2026-04-30 - Add Quick Resume mandays and remove date cards
Files changed:
  frontend/src/components/gantt/GanttQuickResume.jsx
  readme.txt

What changed:
- Removed Quick Resume date cards:
  Tanggal mulai
  Hari ini
  Target akhir
- Added a Mandays stat to Quick Resume.
- Mandays are calculated from leaf tasks only to avoid double-counting parent task aggregates.
- Mandays use task work_days when available, falling back to duration_days only when work_days is not available.

Reason:
- User requested removing project date cards and asked whether mandays can be calculated and displayed.

Behavior impact:
- Quick Resume remains based on the tasks currently displayed in Gantt.
- Parent bucket/task rows no longer inflate mandays because only leaf tasks are counted.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/gantt
  GET http://localhost:5000/api/gantt/tasks
  Result: HTTP 200.

Known risks:
- Mandays are calculated as working-day effort per leaf task and do not multiply by number of PIC users.

2026-04-30 - Color progress bars by completion
Files changed:
  frontend/src/logic/helpers/statusHelper.js
  frontend/src/components/task/TaskTree.jsx
  frontend/src/components/task/TaskCard.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/components/project/ProjectCard.jsx
  frontend/src/components/project/ProjectHeader.jsx
  frontend/src/components/dashboard/ProjectProgressCard.jsx
  frontend/src/pages/DepartmentGanttPage.jsx
  readme.txt

What changed:
- Added getProgressBarClass helper.
- Progress bars now use green when status is Done or progress is 100.
- Progress bars use blue when progress is not complete.
- Applied this to Task List, task cards, task detail, project cards, project header, dashboard project progress, and department project progress.

Reason:
- User requested different progress bar colors: green for done and blue for not done.

Behavior impact:
- Visual-only change.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  GET http://localhost:5173/projects
  Result: HTTP 200.

Known risks:
- Browser hard refresh is needed to clear stale bundled CSS/JS.

2026-04-30 - Add E-KPI bucket parent tasks
Files changed:
  backend/src/database/migrations/20260430_ekpi_bucket_parent_tasks.sql
  backend/src/database/migrations/20260430_ams_bucket_parent_tasks.sql
  readme.txt

What changed:
- Added a SQL migration scoped only to project:
  Timeline E-KPI
- Created or reused parent tasks named exactly like each current E-KPI bucket:
  Perencanaan
  Pekerjaan
  Development App e-KPI
- Moved existing root tasks inside each bucket to become children of the matching bucket parent task.
- Preserved existing deeper task hierarchy under its current parent.
- Corrected bucket parent date-range logic in both E-KPI and AMS bucket-parent migrations so parent date range uses all bucket tasks except the bucket parent itself.

Reason:
- User requested the same bucket-parent hierarchy pattern for E-KPI that was applied to AMS.

Behavior impact:
- E-KPI Task List/Gantt now shows bucket-level parent rows first.
- Existing E-KPI task dates, progress, status, assignees, and deeper subtasks are preserved.
- Only E-KPI project data was changed by the new migration.
- No schema or API contract changes.

Verification:
- Executed migration:
  backend/src/database/migrations/20260430_ekpi_bucket_parent_tasks.sql
  Result: success.
- Verified parent bucket task summary:
  Perencanaan: 6 direct children.
  Pekerjaan: 4 direct children.
  Development App e-KPI: 3 direct children.
- Verified API:
  GET /api/gantt/projects/1
  Result: root rows are the three current E-KPI bucket parent tasks.
- Smoke checked:
  GET http://localhost:5000/api/tasks?project_id=1&tree=true
  GET http://localhost:5173/tasks
  Result: HTTP 200.

Known risks:
- Current database only has three E-KPI buckets at verification time. Earlier handoff notes mentioned Testing and Deployment, but those buckets are no longer present in the current database state.

2026-04-30 - Add AMS bucket parent tasks
Files changed:
  backend/src/database/migrations/20260430_ams_bucket_parent_tasks.sql
  readme.txt

What changed:
- Added a SQL migration scoped only to project:
  AMS (Asset Management System)
- Created parent tasks named exactly like each AMS bucket:
  Perencanaan
  Database
  Pembuatan Front End
  Pembuatan Back-end
  Testing & QC
- Moved existing root tasks inside each bucket to become children of the matching bucket parent task.
- Preserved existing deeper subtasks under their current parent tasks.
- Calculated each bucket parent task date range from the min start_date and max end_date of tasks in that bucket.
- Copied bucket task assignees into the parent bucket task's task_assignees relation.
- Made the migration idempotent by reusing existing root parent tasks when title matches the bucket name.

Reason:
- User requested AMS task hierarchy to use bucket-named parent tasks, so tasks like "Penggalian Kebutuhan" become children of "Perencanaan".

Behavior impact:
- AMS Gantt/Task List now shows bucket-level parent rows first.
- Existing AMS task dates, status, progress, assignees, and subtasks are preserved.
- Only AMS project data was changed.
- No schema or API contract changes.

Verification:
- Executed migration:
  backend/src/database/migrations/20260430_ams_bucket_parent_tasks.sql
  Result: success.
- Verified parent bucket task summary:
  Perencanaan: 4 direct children.
  Database: 6 direct children.
  Pembuatan Front End: 6 direct children.
  Pembuatan Back-end: 6 direct children.
  Testing & QC: 2 direct children.
- Verified API:
  GET /api/gantt/projects/8
  Result: root rows are the five AMS bucket parent tasks.
- Smoke checked:
  GET http://localhost:5173/tasks
  GET http://localhost:5000/api/tasks?project_id=8&tree=true
  Result: HTTP 200.

Known risks:
- Parent task progress is set to 100 during migration because all existing AMS bucket tasks are currently done.
- Parent task date ranges are derived from all current bucket tasks, including existing subtasks.

2026-04-30 - Render Task List action menu through portal
Files changed:
  frontend/src/components/task/TaskTree.jsx
  readme.txt

What changed:
- Rendered the Task List split-button menu through React createPortal into document.body.
- Kept fixed viewport positioning based on the split-button location.
- Strengthened menu shadow while keeping z-index at the top application layer.

Reason:
- User reported the menu was still visually below sticky "Mulai" buttons due to table/sticky stacking contexts.

Behavior impact:
- The action menu now exits the table DOM hierarchy and should render above sticky columns and row buttons.
- Existing menu actions are unchanged.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  Result: HTTP 200.

Known risks:
- Browser hard refresh is required to remove stale bundled JS.

2026-04-30 - Hide Task List realization mode badge and raise action menu layer
Files changed:
  frontend/src/components/task/TaskTree.jsx
  readme.txt

What changed:
- Removed the realization mode badge such as "Normal" from Task List rows.
- Kept realization mode visibility in task detail where detailed context is appropriate.
- Raised the Task List split-button menu z-index to render above other page/table layers.

Reason:
- User requested the "Normal" label to be hidden from Task List and only visible in detail, and requested the dropdown layer to be above all other UI.

Behavior impact:
- Task List rows are cleaner and more compact.
- Split-button menus should appear above sticky columns and table content.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  Result: HTTP 200.

Known risks:
- Browser hard refresh is needed to clear stale bundled UI.

2026-04-30 - Add Task List split-button actions
Files changed:
  frontend/src/components/task/TaskTree.jsx
  readme.txt

What changed:
- Replaced the wide compact action bar with a split-button pattern similar to the user's reference.
- The main button shows the primary realization action:
  Mulai
  Selesai
  Done
- The adjacent arrow button opens a fixed-position menu with:
  Manual realization
  Add subtask
  Edit task
  Delete task
- The menu is positioned from the split-button bounds and avoids viewport edges.
- The menu closes on outside click or Escape.
- Reduced the sticky Actions column width again because secondary actions are now inside the menu.

Reason:
- User requested an action layout like the provided reference: one main action button plus an arrow menu for remaining actions.

Behavior impact:
- The Task List Actions column is compact again while preserving all actions.
- Existing task behavior and API calls are unchanged.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  Result: HTTP 200.

Known risks:
- Manual browser click testing is still recommended after hard refresh.

2026-04-30 - Replace Task List dropdown with compact action bar
Files changed:
  frontend/src/components/task/TaskTree.jsx
  readme.txt

What changed:
- Removed the Task List row action dropdown implementation.
- Replaced it with a stable compact action bar inside the sticky Actions column.
- Actions now show as compact buttons:
  Mulai/Selesai/Done
  Manual
  Sub
  Edit
  Del
- Increased Task List minimum table width and Actions column width so buttons do not overlap other columns.

Reason:
- User reported the dropdown approach was not reliable and requested another idea to fit the task row actions.

Behavior impact:
- All existing task actions remain directly available without overlays or dropdown clipping.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  Result: HTTP 200.

Known risks:
- Actions column is wider than the dropdown version, but this is intentional to avoid unreliable overlay behavior.

2026-04-30 - Stabilize Task List row action menu
Files changed:
  frontend/src/components/task/TaskTree.jsx
  frontend/src/styles/index.css
  readme.txt

What changed:
- Replaced fixed-position row action menu behavior with a simpler absolute menu anchored inside the action cell.
- Removed scroll listeners that could immediately close the menu on upper rows.
- Added a table-scroll-visible utility so Task List dropdowns can render vertically outside the table row without being clipped.

Reason:
- User reported top-row action menus still appeared as a clipped fragment while lower-row menus opened.

Behavior impact:
- Row action menus should open consistently for top and bottom records.
- Existing actions are unchanged.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  Result: HTTP 200.

Known risks:
- Final manual click verification is still needed after hard refresh in the browser.

2026-04-30 - Fix Task List dropdown clipping
Files changed:
  frontend/src/components/task/TaskTree.jsx
  readme.txt

What changed:
- Changed the Task List row action dropdown from absolute positioning inside the table cell to fixed viewport positioning.
- Calculated dropdown position from the action button bounds so it opens beside the clicked row.
- Kept outside-click close behavior and added viewport edge handling so the menu opens upward when there is not enough space below.

Reason:
- User reported clicking the row action button only showed a clipped line/menu fragment because the dropdown was being cut by the table scroll container.

Behavior impact:
- Action dropdown should now appear fully above the table and remain clickable.
- Existing dropdown actions are unchanged.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  Result: HTTP 200.

Known risks:
- Final click testing should be done in the browser after hard refresh.

2026-04-30 - Fix Task List action column overlap
Files changed:
  frontend/src/components/task/TaskTree.jsx
  readme.txt

What changed:
- Increased the Task List table minimum width to give Progress, Priority, and Actions enough space.
- Added explicit minimum widths for Duration, Work Days, Progress, Priority, and Actions cells.
- Increased sticky Actions column width.
- Hid realization mode badges until wider screens so action controls do not collide.
- Shortened dropdown menu labels and width.
- Added scroll-to-close behavior for open row dropdown menus.

Reason:
- User reported the Task List UI was still overlapping around the Progress/Priority/Actions area.

Behavior impact:
- The right-side action controls should no longer overlap the Progress and Priority columns.
- Dropdown menus close during scroll, preventing floating menus from staying out of context.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  Result: HTTP 200.

Known risks:
- Final visual QA should still be done manually after hard refresh on the target browser.

2026-04-30 - Compact professional Task List UI
Files changed:
  frontend/src/pages/TaskListPage.jsx
  frontend/src/components/task/TaskTree.jsx
  frontend/src/styles/index.css
  readme.txt

What changed:
- Reworked Task List table into a denser operational layout.
- Merged Project/Bucket context into the Task column subtitle to reduce horizontal width.
- Combined progress and status into one compact progress column.
- Removed always-visible Manual/Subtask/Edit/Delete buttons from each row.
- Added one primary realization button per row:
  Mulai
  Selesai
  Done badge when realization is complete.
- Added a compact dropdown action button per row with:
  Realisasi manual
  Add subtask
  Edit task
  Delete task
- Added outside-click handling to close open row action menus.
- Made the Actions column sticky on the right for easier repeated operations.
- Added an Open Gantt shortcut in the Task List page header.
- Added Task List-specific table density styles.

Reason:
- User requested a more compact and professional Task List page with fewer visible buttons and secondary actions hidden behind a dropdown.

Behavior impact:
- Existing task actions are preserved and routed through the same handlers/API calls.
- No backend, database, or API contract changes.
- The row UI is more compact and easier to scan.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Smoke checked:
  GET http://localhost:5173/tasks
  Result: HTTP 200.
- Smoke checked:
  GET http://localhost:5000/api/tasks?tree=true
  Result: HTTP 200.

Known risks:
- Final visual QA should be done in the browser across narrow and wide screens after hard refresh.

2026-04-30 - Sort Gantt projects by project start date
Files changed:
  backend/src/services/taskService.js
  frontend/src/components/gantt/GanttChart.jsx
  readme.txt

What changed:
- Added project_start_date and project_end_date to task API responses.
- Changed backend task ordering to sort by project start_date ascending, then project name, then task sort order.
- Updated task tree root sorting so grouped Gantt rows preserve project start-date order instead of task sort_order only.
- Updated frontend Gantt project grouping to sort project groups by project start_date ascending with project name fallback.

Reason:
- User requested the Gantt menu to show projects from the earliest project start date to the latest project start date.

Behavior impact:
- All-project Gantt now displays project groups in chronological project order:
  LMS Fase 1, Timeline E-KPI, AMS.
- Single-project Gantt task ordering remains based on task sort_order within the project.
- API responses now include project_start_date/project_end_date as additive fields.

Verification:
- Ran backend syntax check:
  node --check src/services/taskService.js
  Result: success.
- Verified:
  GET /api/gantt/tasks
  Result order: LMS Fase 1 (2023-11-01), Timeline E-KPI (2024-09-20), AMS (2026-01-05).
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Projects without start_date sort last and then by project name.

2026-04-30 - Update LMS Fase 1 PIC and lead assignments
Files changed:
  backend/src/database/migrations/20260430_update_lms_phase_1_assignments.sql
  readme.txt

What changed:
- Added an idempotent SQL migration to update LMS Fase 1 task assignments.
- Set all Documentation tasks to:
  Lead: Rey
  PIC: Rey
- Set all Programming tasks to:
  Lead: Kevin
  PIC: Kevin
- Set all User Interface tasks to:
  Lead: Fandra
  PIC: Fandra and Olin
- Added Rey, Kevin, Fandra, and Olin as LMS Fase 1 project members while preserving the existing owner role for Tamara Tan.

Reason:
- User requested specific LMS Fase 1 Lead and PIC ownership by workstream.

Behavior impact:
- LMS Fase 1 now appears in Department Gantt for departments connected to Rey, Kevin, Fandra, Olin, and Tamara Tan through membership/PIC ownership.
- Task lead and multi-PIC display now reflects the requested assignments in Gantt, Task List, Board, and task detail.
- Project dates, task dates, progress, and completion status are unchanged.

Verification:
- Executed migration:
  backend/src/database/migrations/20260430_update_lms_phase_1_assignments.sql
  Result: success.
- Database assignment check:
  Documentation: 10 tasks, Lead Rey, PIC Rey.
  User Interface: 8 tasks, Lead Fandra, PIC Fandra and Olin.
  Programming: 9 tasks, Lead Kevin, PIC Kevin.
- Verified project Gantt API:
  GET /api/gantt/projects/9
  Root rows returned Documentation/Rey/Rey, User Interface/Fandra/Fandra+Olin, Programming/Kevin/Kevin.
- Verified project members API:
  GET /api/projects/9
  Members include Rey, Kevin, Fandra, Olin, and owner Tamara Tan.
- Smoke checked frontend:
  GET http://localhost:5173/
  Result: HTTP 200.

Known risks:
- User Interface tasks have Fandra as primary assignee because legacy single assignee_id must store one primary PIC, while task_assignees stores both Fandra and Olin.

2026-04-30 - Import LMS Fase 1 timeline from past Excel
Files changed:
  backend/src/database/migrations/20260430_import_lms_phase_1.sql
  readme.txt

What changed:
- Added an idempotent SQL migration to import timeline data from:
  project_timeline_past/LMS fase 1.xlsx
- Created or reused Human Capital department.
- Created or reused user Tamara Tan and assigned the user to Human Capital when no department existed.
- Created project:
  LMS Fase 1
  Status: Completed
  Progress: 100
  Start: 2023-11-01
  End: 2024-08-05
- Added Tamara Tan as project owner/member.
- Created 3 buckets:
  Documentation
  User Interface
  Programming
- Imported 27 tasks total:
  3 root WBS phase tasks
  24 child timeline tasks
- Assigned all imported LMS tasks to Tamara Tan because the Excel file has project lead Tamara Tan but no per-task PIC/Lead values.
- Calculated duration_days and work_days using existing database helper functions.
- Marked all imported tasks as Done with 100 progress because the Excel % DONE values for valid LMS timeline tasks were complete.

Reason:
- User requested adding the LMS Fase 1 historical project timeline into the application and matching it to the current database structure.

Behavior impact:
- LMS Fase 1 now appears in Projects, Gantt, Task List, Dashboard, and Human Capital Department Gantt.
- Human Capital now includes LMS Fase 1 because Tamara Tan is mapped to Human Capital as owner/PIC.
- Existing projects and unrelated data are unchanged.
- Re-running the migration replaces only the LMS Fase 1 project by exact name to avoid duplicate imports.

Verification:
- Executed migration:
  backend/src/database/migrations/20260430_import_lms_phase_1.sql
  Result: success.
- Database import summary:
  project = LMS Fase 1
  buckets = 3
  tasks = 27
  members = 1
- Verified project API:
  GET /api/projects
  Result: LMS Fase 1 returned with owner/member Tamara Tan, department Human Capital.
- Verified project Gantt API:
  GET /api/gantt/projects/9
  Result: root rows Documentation:9, User Interface:7, Programming:8.
- Verified Human Capital Department Gantt API:
  GET /api/gantt/departments/7
  Result: LMS Fase 1 is included.
- Smoke checked:
  GET http://localhost:5000/
  GET http://localhost:5173/
  Result: HTTP 200.

Known risks:
- The Excel file does not provide per-task PIC values, so all LMS tasks are assigned to project lead Tamara Tan.
- The Excel source uses some original spelling such as "Project Backgrouund" and "Business Pocess & Requrement Scope"; these were preserved to avoid changing source data meaning.
- The root bucket name "Programming" normalizes the source typo "Progamming"; the original typo is kept in the root task description.
- No actual_start_date/actual_end_date values were imported because the Excel source provides planned timeline dates only.

2026-04-30 - Fix Department Gantt project involvement rules
Files changed:
  backend/src/services/taskService.js
  backend/src/services/projectService.js
  backend/src/services/ganttService.js
  backend/src/services/dashboardService.js
  frontend/src/components/gantt/GanttChart.jsx
  frontend/src/pages/DepartmentGanttPage.jsx
  readme.txt

What changed:
- Stopped automatically adding task Lead users into project_members during task create/update.
- Kept automatic project_members upsert for task PIC/assignee users.
- Removed lead_id-only department involvement from project department filters, Department Gantt project queries, and dashboard projects-by-department counts.
- Updated Department Gantt to pass backend project involvement rows into GanttChart.
- Updated grouped Gantt rendering so project group rows can appear even when the department has no task rows yet for that project.
- Cleaned one stale lead-only membership row:
  HR / Human Capital was removed from AMS project_members because HR had no PIC task in AMS and was not the project owner.

Reason:
- User reported Human Capital showing 2 projects when it should show 1.
- Audit showed Human Capital was connected to AMS through lead/member side effects rather than PIC task responsibility.
- User also reported Legal projects not appearing after adding a Legal user to a project. Department Gantt needed to show membership-only project rows even before Legal has assigned tasks.

Behavior impact:
- Department project counts now use explicit project_members and PIC task assignments, not task Lead alone.
- Task Lead remains visible on tasks, but no longer creates department project involvement by itself.
- A project member from Legal should now appear as a project row in Department Gantt even if no Legal task has been assigned yet.
- Human Capital now reports only Timeline E-KPI in the local database.
- No schema changes were required; existing PK/FK and unique constraints already support the corrected behavior.

Database audit:
- departments.id, users.id, projects.id, project_members.id, tasks.id, and task_assignees.id are primary keys.
- users.department_id references departments.id.
- projects.owner_id references users.id.
- project_members.project_id references projects.id.
- project_members.user_id references users.id.
- project_members has UNIQUE(project_id, user_id), preventing duplicate project membership rows.
- tasks.project_id references projects.id.
- tasks.assignee_id and tasks.lead_id reference users.id.
- task_assignees.task_id references tasks.id.
- task_assignees.user_id references users.id.
- task_assignees has UNIQUE(task_id, user_id), preventing duplicate PIC rows.

Verification:
- Ran backend syntax checks:
  node --check src/services/taskService.js
  node --check src/services/projectService.js
  node --check src/services/ganttService.js
  node --check src/services/dashboardService.js
  Result: success.
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Verified Department Gantt API:
  GET /api/gantt/departments/7
  Result: Human Capital projects = Timeline E-KPI.
- Verified dashboard summary:
  Human Capital total_projects = 1.
  Legal total_projects = 0 because the current database has Legal user but no persisted Legal project_members/task_assignees/lead rows.
- Verified with rollback transaction:
  Temporarily inserting Legal into AMS project_members makes Legal total_projects = 1, then the transaction was rolled back.

Known risks:
- Existing projects must be edited and saved with Legal checked in Project Members for Legal to appear persistently.
- Department Gantt task rows still require task PIC assignment; membership-only projects show as project group rows without child tasks until tasks are assigned.

2026-04-30 - Add Indonesia 2026 national holiday import
Files changed:
  backend/src/services/calendarService.js
  backend/src/controllers/calendarController.js
  backend/src/routes/calendarRoutes.js
  frontend/src/logic/services/calendarApi.js
  frontend/src/pages/CalendarSettingsPage.jsx
  readme.txt

What changed:
- Added a backend import endpoint:
  POST /api/calendar/indonesia-holidays/2026
- Added 17 Indonesia 2026 national holidays as holiday calendar exceptions.
- Used idempotent upsert by exception_date so importing again updates existing holiday rows instead of creating duplicates.
- Recalculated all task plan and actual date metrics after import.
- Added an "Import Libur Indonesia 2026" button on the Calendar Settings page.
- Added an Indonesia 2026 info tile explaining that imported national holidays are excluded from work days.

Reason:
- User requested Indonesia holidays in the Calendar menu so those dates are not counted as work days.

Behavior impact:
- Imported dates are stored with type=holiday in calendar_exceptions.
- Work-day calculations now exclude these holiday dates in addition to weekends.
- Existing manual calendar exception create/edit/delete behavior is unchanged.
- Database data changed by importing 17 holiday rows into the local database.

Verification:
- Ran backend syntax checks:
  node --check src/services/calendarService.js
  node --check src/controllers/calendarController.js
  node --check src/routes/calendarRoutes.js
  Result: success.
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Called:
  POST http://localhost:5000/api/calendar/indonesia-holidays/2026
  Result: success, total=17.

Known risks:
- The import currently includes national holidays only, not optional cuti bersama/collective leave days.
- Future years need a separate official holiday list before they can be imported safely.

2026-04-30 - Fix Gantt sticky boundary clipping
Files changed:
  frontend/src/components/gantt/GanttChart.jsx
  readme.txt

What changed:
- Removed the right-side shadow from the sticky Task/PIC column because it visually covered timeline bars near the sticky boundary.
- Calculated explicit timeline content height from header height plus rendered row count.
- Moved the Today marker after timeline rows and rendered it with explicit full timeline height so row backgrounds cannot cover the marker line.

Reason:
- User reported remaining clipped UI at the sticky column boundary and a partially hidden Today marker line.

Behavior impact:
- Timeline bars near the left sticky boundary should no longer look cut by a white overlay.
- Today marker should render continuously through the full visible timeline content.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Browser visual QA is still recommended after hard refresh because no screenshot automation is configured.

2026-04-30 - Prevent clipped Gantt week labels and Today marker
Files changed:
  frontend/src/logic/helpers/ganttHelper.js
  frontend/src/components/gantt/GanttChart.jsx
  frontend/src/components/gantt/GanttTimelineHeader.jsx
  readme.txt

What changed:
- Changed week timeline labels into controlled two-line labels with week date range on the first line and year on the second line.
- Increased the Gantt timeline header height and matched the sticky Task/PIC header height to keep rows aligned.
- Raised the Today marker above the timeline header and centered/right-aligned its label depending on available timeline space.

Reason:
- User reported that the Gantt timeline header UI and Today marker label were visually clipped.

Behavior impact:
- Gantt week labels should remain readable without vertical clipping.
- Today marker label should remain visible inside the chart instead of being cut off.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Browser visual QA is still recommended after hard refresh because no screenshot automation is configured.

2026-04-30 - Fix Gantt date alignment and task modal layering
Files changed:
  frontend/src/logic/helpers/ganttHelper.js
  frontend/src/components/gantt/GanttChart.jsx
  frontend/src/components/gantt/GanttRow.jsx
  frontend/src/components/shared/Modal.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  readme.txt

What changed:
- Updated weekly Gantt timeline headers to show a date range for each week instead of only the week start date.
- Added a shared timeline date-offset helper and used it for the Today marker so marker positioning uses the same unit-width calculation as task bars.
- Updated Gantt bar positioning to receive the configured timeline unit width instead of relying on a hard-coded width.
- Fixed GanttRow sizing so each row fills the rendered timeline width while bar calculations stay based on one timeline unit.
- Updated Today marker label to include the actual current date.
- Raised shared modal and task detail modal z-index above sticky Gantt columns and floating timeline controls.

Reason:
- User reported that Gantt task bars and the Today marker looked misaligned with the displayed dates.
- User reported that opening a task from a Gantt progress bar caused the popup to be covered by the sticky Gantt sidebar.

Behavior impact:
- Gantt week view now makes the date bucket explicit, for example "27 Apr - 03 May 2026", while the Today marker shows the exact date inside that week.
- Plan and actual bars continue using the same task dates and API data, but their pixel placement now uses the same unit-width source as the timeline.
- Task detail popups opened from Gantt bars should appear above the Gantt sticky sidebar.
- No backend, database, or API contract changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Final visual alignment should still be checked manually in the browser after a hard refresh because no screenshot automation is configured.

2026-04-30 - Quick Resume project scope and completed task stat
Files changed:
  frontend/src/components/gantt/GanttQuickResume.jsx
  frontend/src/components/gantt/GanttChart.jsx
  frontend/src/pages/GanttPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/pages/DepartmentGanttPage.jsx
  readme.txt

What changed:
- Added a Project label inside the Quick Resume modal so users can see whether the summary is for All projects, a selected project filter such as AMS, a project-detail Gantt, or department projects.
- Passed the active project scope from Gantt pages into GanttChart and GanttQuickResume.
- Replaced the bottom Quick Resume stat "Tanpa tanggal lengkap" with "Task completed" using the completed task count.

Reason:
- Quick Resume needed to clearly match the currently selected Gantt project filter.
- The task group/stat requested by the user should show completed tasks instead of tasks with incomplete dates.

Behavior impact:
- No backend, database, or API contract changes.
- Quick Resume continues to summarize the same task data currently loaded in the Gantt.
- The modal now displays the active project scope and shows completed task count in the bottom stat row.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Visual verification should still be done manually in the browser after Vite hot reload or hard refresh.

2026-04-29 - Initial full-stack application scaffold
Files/folders added:
  backend/
  frontend/
  README.md
  .gitignore

What changed:
- Created Express backend with PostgreSQL connection.
- Created React/Vite frontend with Tailwind.
- Created database schema and seed files.
- Installed backend and frontend dependencies.

Reason:
- Build MVP for Planner-style Project Management app with automatic Gantt Chart output.

Behavior impact:
- Application can run locally with backend on port 5000 and frontend on port 5173.
- Data is persisted to PostgreSQL.

Verification:
- npm install backend successful.
- npm install frontend successful.
- frontend build successful.
- backend syntax check successful.


2026-04-29 - Backend API and business logic implementation
Files added:
  backend/src/server.js
  backend/src/config/db.js
  backend/src/controllers/*.js
  backend/src/routes/*.js
  backend/src/services/*.js
  backend/src/utils/*.js

What changed:
- Implemented department, user, project, bucket, task, calendar, gantt, and dashboard APIs.
- Implemented consistent response format.
- Implemented nested task tree support.
- Implemented progress recalculation for parent tasks and projects.
- Implemented working day calculation using calendar exceptions.
- Implemented Gantt-ready data endpoints.

Reason:
- Provide REST API backend for all frontend views and ensure single task data source.

Behavior impact:
- Frontend can fetch and mutate data through REST APIs.
- Task progress/project progress automatically update after task mutations.
- Gantt can render project and department timelines from the same task records.

Verification:
- node --check completed successfully for backend files.
- Backend root endpoint responded successfully.


2026-04-29 - Database schema and seed
Files added:
  backend/src/database/schema.sql
  backend/src/database/seed.sql

What changed:
- Created tables for departments, users, projects, buckets, tasks, comments, attachments, activity logs, and calendar exceptions.
- Added constraints for valid status, priority, and exception type.
- Added indexes for common query fields.
- Added updated_at trigger.
- Added SQL helper functions for duration and working days.
- Added Timeline E-KPI seed data with nested subtasks.

Reason:
- Provide persistent PostgreSQL data model for Planner-style Board/List/Gantt workflow.

Behavior impact:
- Application data is stored in PostgreSQL.
- Seed data provides immediate example project timeline.

Verification:
- schema.sql executed successfully.
- seed.sql executed successfully.
- Dashboard summary returned seeded data.


2026-04-29 - Frontend application implementation
Files added:
  frontend/src/app/*
  frontend/src/pages/*
  frontend/src/components/*
  frontend/src/logic/*
  frontend/src/store/*
  frontend/src/styles/index.css
  frontend/tailwind.config.js
  frontend/vite.config.js
  frontend/postcss.config.js
  frontend/index.html

What changed:
- Implemented app shell, routes, sidebar, topbar.
- Implemented dashboard page.
- Implemented projects page and project detail page.
- Implemented Board View with status/bucket grouping.
- Implemented drag and drop task movement with dnd-kit.
- Implemented Task List tree.
- Implemented custom Gantt Chart.
- Implemented Department Gantt.
- Implemented Team page.
- Implemented Calendar Settings page.
- Implemented Settings page.
- Implemented reusable forms, cards, task detail modal, Gantt rows, and bucket manager.

Reason:
- Provide complete MVP UI for project/task management and Gantt monitoring.

Behavior impact:
- Users can manage projects, buckets, tasks, subtasks, users, departments, and calendar exceptions.
- Board, List, and Gantt views reuse the same backend task data.

Verification:
- npm run build in frontend completed successfully.
- Frontend responded HTTP 200 on localhost:5173.


2026-04-29 - Runtime database credential correction
Files changed:
  backend/.env

What changed:
- DB_USER was changed to postgres.

Reason:
- Direct pg credential test showed local PostgreSQL rejects postgre/admin and pstgres/admin.
- Direct pg credential test showed local PostgreSQL accepts postgres/admin for database project_management.

Behavior impact:
- Backend can connect to PostgreSQL and API endpoints can query seeded data.

Verification:
- GET /api/dashboard/summary succeeded after schema and seed were run.


2026-04-29 - readme.txt technical handoff file added
Files added:
  readme.txt

What changed:
- Added this detailed technical handoff and change log.
- Added explicit instruction that future application changes must be documented here.

Reason:
- User requested a technical file so another agent can immediately understand the project and continue safely.

Behavior impact:
- No runtime behavior change.

Verification:
- File created in project root.


2026-04-29 - CRUD edit refresh and stale detail state fix
Files changed:
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/pages/BoardPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/pages/GanttPage.jsx
  readme.txt

What changed:
- Audited CRUD update paths for department, user, project, bucket, task, calendar exception, board move, task progress, and task parent.
- Confirmed backend API update endpoints persist data correctly using temporary CRUD smoke-test records.
- Fixed stale task detail modal state:
  TaskDetailModal now keeps a local currentTask state synced from selectedTask.
  After task edit, progress update, or subtask create, the modal updates currentTask immediately.
  This prevents the UI from still showing old task data after a successful edit.
- Added immediate progress state update after PATCH /tasks/:id/progress.
- Added immediate current task merge after PUT /tasks/:id.
- Added local child append after creating a subtask from TaskDetailModal.
- Subtask rows inside TaskDetailModal can now be opened in the same modal by clicking the subtask.
- BoardPage now refreshes both task data and project header data after task changes.
- ProjectDetailPage now refreshes both task data and project header data after task changes.
- GanttPage now refreshes project header data after Gantt task edits when viewing a project-level Gantt.
- Bucket changes in BoardPage and ProjectDetailPage now refresh both bucket data and task data, so renamed/deleted buckets do not leave stale task bucket labels/grouping.

Reason:
- User reported that edited data did not appear to change, while delete worked.
- Backend CRUD was verified to be correct, so the issue was isolated to frontend stale state/refetch behavior.
- TaskDetailModal previously kept showing the originally selected task object after successful edit/progress update because parent data refetch did not replace the selectedTask object inside the open modal.
- Project headers could also show stale progress after task mutations because only tasks were refreshed, not the project record.
- Bucket edits/deletes could leave task grouping or labels stale because only bucket data was refreshed.

Behavior impact:
- Editing a task from Board, Project Detail, or Gantt now updates the open detail modal immediately.
- Task progress edits now show the new value immediately in the modal.
- Adding a subtask from TaskDetailModal shows the new subtask immediately.
- Project progress/header data is more consistent after task updates.
- Bucket rename/delete behavior is more consistent because task data is refreshed after bucket changes.
- No backend API contract changed.
- No database schema changed.

Verification:
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Ran backend syntax check:
  Get-ChildItem -Path src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran API CRUD smoke test against running backend for:
  department create/update/delete
  user create/update/delete
  project create/update/delete
  bucket create/update/delete
  task create/update/delete
  task move patch
  task progress patch
  task parent patch
  calendar exception create/update/delete
  Result: all update assertions passed and temporary records were deleted.

Known risks:
- No browser automation was run. The fix was validated by code inspection, build, and API smoke tests.
- If a future edit form is added, it must explicitly refresh or update local selected object state after save.


2026-04-29 - Allow manual Done to Overdue task status change
Files changed:
  backend/src/services/taskService.js
  frontend/src/components/task/TaskFormModal.jsx
  readme.txt

What changed:
- Replaced the old backend status normalization behavior that always forced status to Done when progress was 100 during task create/update.
- Added backend manual task state normalization:
  If requested status is Done, progress is set to 100 and status is Done.
  If requested status is not Done and progress is already 100, progress is adjusted below completion so the selected status can persist.
  If requested status is Overdue, In Progress, or Waiting Review from a 100% task, progress becomes 99.
  If requested status is Not Started from a 100% task, progress becomes 0.
- Applied this normalization to:
  POST /api/tasks
  PUT /api/tasks/:id
  PATCH /api/tasks/:id/status
  PATCH /api/tasks/:id/move
- Kept PATCH /api/tasks/:id/progress behavior:
  progress 100 still sets status Done.
  lowering progress from Done changes status to Not Started or In Progress.
- Updated TaskFormModal frontend behavior:
  Selecting Done sets progress to 100.
  Selecting Overdue/In Progress/Waiting Review while progress is 100 sets progress to 99.
  Selecting Not Started while progress is 100 sets progress to 0.
  Typing progress 100 sets status to Done.
  Lowering progress while status is Done changes status to Not Started or In Progress.

Reason:
- User reported that changing a task from Done to Overdue did not change anything.
- Root cause:
  The backend PUT task path received status=Overdue but progress remained 100.
  Old resolveStatus logic converted every progress=100 update back to Done.
  Therefore the edit appeared to save but the returned/stored status stayed Done.
- The new behavior preserves the business rule that Done means 100% complete, while still allowing manual status changes away from Done.

Behavior impact:
- A user can now edit a Done task and set it to Overdue.
- A Done task moved to Overdue through Board status grouping also persists correctly.
- A manual non-Done status cannot remain at 100% progress; the system adjusts progress to a non-complete value to keep status/progress consistent.
- Parent tasks with subtasks may still be recalculated from child progress. If all children are 100%, parent progress/status can be recalculated back to Done because parent progress is automatic by design.
- No database schema changed.

Verification:
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Ran backend syntax check:
  Get-ChildItem -Path src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Restarted backend so updated status logic was active.
- Ran focused API smoke test:
  Created temporary department, user, project, bucket, and task.
  Created task as Done with progress 100.
  PUT /api/tasks/:id with status Overdue and progress 100.
  Verified raw_status=Overdue, status=Overdue, progress=99.
  PATCH /api/tasks/:id/status to Done.
  Verified raw_status=Done, progress=100.
  PATCH /api/tasks/:id/status to Overdue.
  Verified raw_status=Overdue, progress=99.
  Deleted all temporary smoke-test records.

Known risks:
- Browser automation was not run; verification was done through build, syntax check, and direct API smoke test.
- If user attempts to set a parent task with fully completed children to Overdue, recursive parent progress recalculation can still restore that parent to Done. To make parent manual status override permanent, a new explicit override field would be needed.


2026-04-29 - Cross-department projects and department Gantt by user involvement
Files changed:
  backend/src/database/schema.sql
  backend/src/database/seed.sql
  backend/src/database/migrations/20260429_cross_department_projects.sql
  backend/src/services/projectService.js
  backend/src/services/taskService.js
  backend/src/services/dashboardService.js
  backend/src/services/ganttService.js
  frontend/src/components/project/ProjectFormModal.jsx
  frontend/src/components/project/ProjectCard.jsx
  frontend/src/components/project/ProjectHeader.jsx
  frontend/src/components/dashboard/ProjectProgressCard.jsx
  frontend/src/components/task/TaskFilters.jsx
  frontend/src/components/task/TaskFormModal.jsx
  frontend/src/components/gantt/GanttFilters.jsx
  frontend/src/components/gantt/GanttTreeRow.jsx
  frontend/src/pages/ProjectsPage.jsx
  frontend/src/pages/DashboardPage.jsx
  frontend/src/pages/DepartmentGanttPage.jsx
  readme.txt

What changed:
- Changed the project model from "project belongs to one department" to "project is a cross-department workspace".
- Added database table project_members:
  id
  project_id
  user_id
  role
  created_at
  updated_at
  UNIQUE(project_id, user_id)
- Added migration:
  backend/src/database/migrations/20260429_cross_department_projects.sql
- Migration behavior:
  Creates project_members.
  Migrates existing project owners into project_members as owner.
  Migrates existing task assignees into project_members as member.
  Drops legacy projects.department_id.
  Adds project_members indexes and updated_at trigger.
- Updated schema.sql for fresh installs:
  projects no longer has department_id.
  project_members is part of the base schema.
- Updated seed.sql:
  Timeline E-KPI is no longer inserted with project department_id.
  Timeline E-KPI project members are Rey, Ardi, Fandra, Olin, and HR.
- Updated projectService:
  Project create/update no longer writes department_id.
  Project create/update accepts member_ids.
  Owner is automatically included as a project member.
  Project select returns members, departments, department_names, owner_department_id, owner_department_name, and member_count.
  getProjects?department_id now filters by project member department or task assignee department.
- Updated taskService:
  Task rows now expose department_id/department_name from assignee user department.
  Task department filter now means assignee department, not project department.
  Creating/updating a task automatically upserts the assignee into project_members.
- Updated dashboardService:
  projects_by_department now counts distinct projects involving users in each department through project_members or task assignees.
  overdue_by_department now counts overdue tasks by assignee user's department.
- Updated ganttService:
  /api/gantt/departments/:departmentId now returns an object:
    department
    users
    projects
    tasks
  Department Gantt task rows are tasks assigned to users in the selected department.
  Department Gantt project list is based on project_members or task assignee involvement.
- Updated ProjectFormModal:
  Removed Department field.
  Added Project Members multi-select.
  Owner selection automatically includes owner in member_ids.
- Updated project UI:
  Project cards/header show involved teams and member count instead of a single department.
  Dashboard project progress cards show involved departments.
- Updated DepartmentGanttPage:
  Shows selected department users.
  Shows projects involving those users.
  Renders Gantt from tasks assigned to users in that department.
- Updated labels:
  Task/Gantt filters now say "All assignee departments".
- Replaced a few non-ASCII UI symbols with ASCII equivalents in touched components.

Reason:
- User clarified that project creation should not attach a project to a single department because projects can be collaborations across multiple departments.
- Department Gantt should answer:
  Which users are in this department?
  Which projects are those users involved in?
  What timeline/tasks form the Gantt for that department?
- The previous model used projects.department_id, which incorrectly treated each project as belonging to exactly one department.

Behavior impact:
- New projects are no longer tied to one department.
- Project collaboration is modeled by project_members and task assignees.
- Department Gantt is now based on user department involvement.
- A task assigned to a user in Department A appears in Department A Gantt, even when the project also involves Departments B/C.
- A task assigned to another department's user does not appear in Department A Gantt.
- Dashboard "Projects by Department" now means involved projects by department, not owned projects by department.
- Existing seeded/current projects were migrated so owners and task assignees become project members.
- Database schema changed. Existing DB migration was executed successfully.

Verification:
- Executed migration:
  backend/src/database/migrations/20260429_cross_department_projects.sql
  Result: success.
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Ran backend syntax check:
  Get-ChildItem -Path src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Restarted backend so new queries were active.
- Checked API endpoints:
  GET /api/projects
  GET /api/dashboard/summary
  GET /api/gantt/departments/:departmentId
  Result: success.
- Ran cross-department smoke test:
  Created two temporary departments.
  Created one user in each department.
  Created one project with both users as project members.
  Verified project.department_id is null.
  Verified project exposes two involved departments.
  Created one task for each department user.
  Verified Department A Gantt includes only Department A user's task.
  Verified Department A Gantt excludes Department B user's task.
  Verified project filter by department uses member/task involvement.
  Verified dashboard involved-project counts include both departments.
  Deleted all temporary smoke-test records.

Known risks:
- Existing project records no longer have projects.department_id. Any future code must not rely on that column.
- Department Gantt currently filters task rows by assignee_id user's department. Tasks with only lead_name text and no assignee_id cannot be correlated to a department.
- Parent task context can be limited if only a child task is assigned to the selected department and the parent is assigned to a different department. The current implementation prioritizes department-user task ownership over full cross-department task ancestry.
- If a project member has no assigned tasks, they still appear in Department Gantt user/project involvement summary, but no Gantt row appears for that user until a task is assigned.


2026-04-29 - Show year in Gantt timeline header
Files changed:
  frontend/src/logic/helpers/ganttHelper.js
  frontend/src/components/gantt/GanttChart.jsx
  readme.txt

What changed:
- Weekly Gantt timeline header now uses date format:
  dd MMM yyyy
- Monthly Gantt timeline header already used:
  MMM yyyy
- GanttChart now shows a timeline range strip above the chart:
  dd MMM yyyy - dd MMM yyyy
- The range strip also shows whether the chart is in Weekly view or Monthly view.

Reason:
- User reported that the Gantt Chart should show the year.
- This is important because project timelines can cross year boundaries, and labels like "08 Jan" are ambiguous.

Behavior impact:
- Gantt headers and chart range now always provide year context.
- No backend behavior changed.
- No database schema changed.

Verification:
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.

Known risks:
- No browser automation was run. Change is presentation-only and validated by build.


2026-04-29 - Standardize create/edit forms and validate CRUD contracts
Files changed:
  frontend/src/components/shared/Modal.jsx
  frontend/src/components/shared/FormField.jsx
  frontend/src/styles/index.css
  frontend/src/logic/constants/roles.js
  frontend/src/components/project/ProjectFormModal.jsx
  frontend/src/components/task/TaskFormModal.jsx
  frontend/src/components/project/BucketManager.jsx
  frontend/src/components/calendar/CalendarExceptionForm.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/pages/CalendarSettingsPage.jsx
  frontend/src/pages/TeamPage.jsx
  frontend/src/pages/SettingsPage.jsx
  readme.txt

What changed:
- Added shared Modal component for consistent create/edit dialogs.
- Added shared FormField component for consistent label, hint, required marker, and inline error rendering.
- Added shared CSS classes:
  .field-error
  .form-hint
  .form-error
- Converted Bucket create/edit from inline form into modal flow.
- Converted Calendar Exception create/edit from inline form into modal flow.
- Converted Team/User create/edit from inline form into modal flow.
- Converted Department create/edit from inline form into modal flow.
- Refactored ProjectFormModal to use shared Modal/FormField.
- Refactored TaskFormModal to use shared Modal/FormField.
- Added client-side validation for required business fields before calling API:
  project.name
  task.title
  task.project_id
  bucket.name
  calendar_exceptions.exception_date
  calendar_exceptions.name
  users.name
  departments.name
- Added client-side date range validation for project and task forms:
  end_date must not be earlier than start_date.
- Added basic email format validation in Team/User form when email is filled.
- Added USER_ROLES constant:
  admin
  member
  viewer
- Replaced the previous free-text role input with a role dropdown.
- Kept compatibility with existing custom role values by rendering the existing value as an option if it is not part of USER_ROLES.
- Replaced Project member native multi-select with checkbox list so cross-department member selection is clearer.
- Preserved owner auto-membership behavior in Project form.
- Added noValidate to standardized forms so validation UI is controlled by the application instead of inconsistent browser validation bubbles.
- Cleared field-level errors when the user edits the related field.
- Replaced non-ASCII close glyph in TaskDetailModal with ASCII x for consistency with the rest of the codebase.

Best-practice references applied:
- GOV.UK Design System guidance: show field-level error near the field, keep entered values after validation errors, and use clear fix-oriented error messages.
- Atlassian Design System forms guidance: use visible labels, mark required fields, provide helper text, and use validation feedback close to the field.
- Material Design text field guidance: use persistent labels/helper text and display error feedback below the relevant field.

Database/API contract check:
- No database schema change was required.
- No backend route shape changed.
- Payload compatibility was preserved:
  POST/PUT /api/projects still receives name, description, owner_id, member_ids, start_date, end_date, status.
  POST/PUT /api/tasks still receives title, description, project_id, bucket_id, parent_task_id, assignee_id, lead_name, start_date, end_date, progress, status, priority.
  POST/PUT /api/buckets still receives project_id, name, sort_order.
  POST/PUT /api/users still receives name, email, role, department_id.
  POST/PUT /api/departments still receives name.
  POST/PUT /api/calendar/exceptions still receives exception_date, type, name, description.

Reason:
- User reported that form input behavior was random and not aligned with expected create/edit standards.
- The application needed consistent create/edit UX across all menus without breaking database integration.
- Relational fields should not be free-text when the database expects known IDs or constrained values.
- Inline master-data edit forms were easy to miss and inconsistent with the existing task/project modal flow.

Behavior impact:
- Create/edit actions for project, task, bucket, user, department, and calendar exception now use consistent modal dialogs.
- User role is now selected from a dropdown instead of typed manually.
- Project member selection is now explicit checkbox selection and remains compatible with project_members.
- Invalid required fields and invalid date ranges are blocked client-side before API calls.
- Backend remains the source of truth for final validation and persistence.
- Existing saved data remains compatible.
- No schema migration is needed.

Verification:
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Ran REST API CRUD smoke test against running backend and PostgreSQL:
  Created, updated, and deleted a temporary department.
  Created, updated, and deleted a temporary user.
  Created, updated, and deleted a temporary cross-department-capable project with member_ids.
  Created, updated, and deleted a temporary bucket.
  Created, updated, and deleted a temporary task.
  Created, updated, and deleted a temporary nested subtask.
  Created, updated, and deleted a temporary calendar exception.
  Result: success.
  Stamp: form_smoke_20260429120115_7278

Known risks:
- No browser automation was run; UI modal interaction was validated through build and API contract smoke test, not Playwright/Cypress.
- Modal focus trapping is not yet implemented. Current modal supports dialog role, Escape close, explicit close, cancel, and save actions.
- Backend still accepts arbitrary user.role strings because the database column is VARCHAR and there is no server-side role enum. Frontend now standardizes the choices but preserves existing custom values.
- Client-side validation intentionally mirrors only safe obvious checks. Backend remains responsible for final business validation.


2026-04-29 - Quick Resume popup and plan-vs-actual realization workflow
Files changed:
  backend/src/database/schema.sql
  backend/src/database/migrations/20260429_task_actual_realization.sql
  backend/src/database/migrations/20260429_task_realization_mode.sql
  backend/src/services/calendarService.js
  backend/src/services/taskService.js
  backend/src/controllers/taskController.js
  backend/src/routes/taskRoutes.js
  frontend/src/components/shared/Modal.jsx
  frontend/src/components/gantt/GanttChart.jsx
  frontend/src/components/gantt/GanttQuickResume.jsx
  frontend/src/components/gantt/GanttRow.jsx
  frontend/src/components/gantt/GanttTimelineHeader.jsx
  frontend/src/components/gantt/GanttTreeRow.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/components/task/TaskRealizationManualModal.jsx
  frontend/src/components/task/TaskTree.jsx
  frontend/src/logic/helpers/ganttHelper.js
  frontend/src/logic/helpers/realizationHelper.js
  frontend/src/logic/services/taskApi.js
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/pages/TaskListPage.jsx
  frontend/src/styles/index.css
  readme.txt

What changed:
- Added Quick Resume as a button in the Gantt header instead of an always-visible inline panel.
- Quick Resume opens a modal with overall Gantt summary:
  start date, today, target end, elapsed timeline, weighted task progress, completed task percentage, active/overdue/upcoming/waiting review counts, current focus tasks, and next tasks.
- Added animated filling bars for Quick Resume progress indicators with reduced-motion support.
- Added database fields for actual realization tracking:
  actual_start_date
  actual_end_date
  actual_duration_days
  actual_work_days
  realization_mode
- Added migration for actual realization date fields:
  backend/src/database/migrations/20260429_task_actual_realization.sql
- Added migration for realization mode:
  backend/src/database/migrations/20260429_task_realization_mode.sql
- Added backend endpoint:
  PATCH /api/tasks/:id/realization
- Added normal realization actions:
  action=start sets actual_start_date to today and marks realization_mode as normal.
  action=finish sets actual_end_date to today, calculates actual duration/work days, marks realization_mode as normal, and completes the task.
- Added manual realization action:
  action=manual accepts actual_start_date and actual_end_date from the user, calculates actual metrics, marks realization_mode as manual, and completes the task.
- Added activity log entries for realization start, finish, and manual input.
- Added normal realization controls in TaskDetailModal:
  Mulai Realisasi
  Selesaikan Realisasi
- Added manual realization modal for delayed input of actual start/finish dates.
- Added Manual realization action to Task List rows and project detail list rows.
- Added Normal/Manual realization labels in task detail, task list rows, and actual Gantt bar labels.
- Updated Gantt date range calculation to include plan dates and actual dates, including ongoing actual realization that ends at today for display.
- Updated Gantt row rendering to show plan and actual in the same row:
  Plan baseline is displayed as a thin passive baseline.
  Actual ongoing is displayed as the primary execution bar.
  Actual done is displayed as a completed execution bar.
  Manual actual is displayed with a distinct amber bar.
- Added a Today marker line in Gantt timeline when today is inside the visible range.
- Updated the Gantt legend to distinguish:
  Plan baseline
  Actual ongoing
  Actual done
  Manual actual
- Adjusted Gantt header/row heights so the sticky Task/PIC column aligns with the timeline rows.

Reason:
- The project workflow needs to preserve planned schedule dates separately from actual execution dates.
- Users need a normal one-click realization flow for on-time updates.
- Users also need a manual realization flow for cases where actual dates are entered late.
- Management needs Gantt output that clearly compares planned schedule versus actual execution.
- Quick Resume should be available on demand as a summary popup, not permanently occupying chart space.

Behavior impact:
- Existing start_date/end_date remain the planned schedule.
- Existing task progress/status behavior is preserved for normal create/edit flows.
- New actual_* fields store realization data and do not overwrite planned dates.
- When finishing realization, task progress becomes 100 and status becomes Done.
- Manual realization also completes the task because both actual start and actual finish are supplied.
- Gantt now shows plan-vs-actual rather than only a single task bar.
- Manual actual entries are visually distinguishable from normal actual entries.
- Department Gantt automatically receives the same Quick Resume and plan-vs-actual behavior because both use GanttChart.

Best-practice references applied:
- Microsoft Project baseline/tracking concepts: planned/baseline dates should remain available for comparison with actual schedule.
- TeamGantt baseline guidance: baseline should be visually distinct and used as a reference against current timeline.
- Atlassian project baseline guidance: baseline acts as a fixed reference point for measuring schedule deviation.
- Planned-vs-actual Gantt chart examples: plan and actual should be comparable in the same timeline row without losing readability.

Database/API contract check:
- Database schema changed through additive migrations only.
- Existing task create/update payloads remain compatible.
- New endpoint added:
  PATCH /api/tasks/:id/realization
- New realization payload examples:
  { "action": "start" }
  { "action": "finish" }
  { "action": "manual", "actual_start_date": "2026-04-01", "actual_end_date": "2026-04-05" }
- Calendar work-day recalculation now updates both plan date metrics and actual date metrics.
- Existing Gantt endpoints continue returning the same task tree plus additional actual realization fields.

Verification:
- Applied database migration:
  backend/src/database/migrations/20260429_task_actual_realization.sql
  Result: success.
- Applied database migration:
  backend/src/database/migrations/20260429_task_realization_mode.sql
  Result: success.
- Ran backend syntax checks:
  node --check backend/src/services/taskService.js
  node --check backend/src/controllers/taskController.js
  node --check backend/src/routes/taskRoutes.js
  node --check backend/src/services/calendarService.js
  Result: success.
- Restarted backend on:
  http://localhost:5000
- Verified realization route is active:
  PATCH /api/tasks/0/realization returns "Task tidak ditemukan." for an invalid task id, which confirms the route is now matched instead of returning "Endpoint tidak ditemukan."
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Existing tasks do not have actual dates until users run normal or manual realization.
- Manual realization currently completes the task immediately because it captures both actual start and actual finish.
- Gantt visual verification was performed through implementation and build, not automated browser screenshot testing.
- The backend process must be restarted after route changes; otherwise a stale server process can still return "Endpoint tidak ditemukan."
- The frontend dev page may require hard refresh after HMR or backend restart if an old browser tab keeps stale bundled code.


2026-04-29 - Fix Gantt sticky column layering and floating timeline scrollbar
Files changed:
  frontend/src/components/gantt/GanttChart.jsx
  frontend/src/components/gantt/GanttRow.jsx
  frontend/src/components/gantt/GanttTreeRow.jsx
  frontend/src/styles/index.css
  readme.txt

What changed:
- Strengthened the sticky Task/PIC column layering with a higher z-index, solid row background, and right-side shadow.
- Set timeline content to a lower stacking context so plan/actual bars do not visually bleed over task labels while horizontally scrolling.
- Added explicit z-index ordering for plan baseline and actual bars.
- Added a floating horizontal timeline scrollbar below the Gantt viewport.
- Synchronized the floating scrollbar with the main chart scrollLeft in both directions.
- Added custom scrollbar styling for the floating timeline scrollbar.
- Added bottom padding to the main Gantt scroll area so the floating scrollbar does not cover the last visible row.

Reason:
- User reported that Gantt UI became visually broken when scrolling horizontally; timeline bars overlapped the sticky Task/PIC column.
- User also requested a floating horizontal scrollbar so timeline navigation does not require scrolling to the bottom of a long chart.

Behavior impact:
- The Task/PIC column should remain visually readable while horizontal timeline scrolling is used.
- The timeline can be scrolled horizontally from the floating scrollbar at the bottom of the chart card.
- Existing Gantt data, collapse behavior, Quick Resume modal, and task click behavior are unchanged.

Best-practice references applied:
- TeamGantt baseline guidance: baseline bars should be visually distinct from the active timeline and support quick comparison.
- Microsoft Project Tracking Gantt guidance: baseline/current schedule bars should be readable in the same row, with clear visual separation.
- General Gantt usability principle: timeline navigation should stay accessible when the task list is long.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Native browser horizontal scrollbar may still appear depending on platform/browser; the new floating scrollbar is the intended always-accessible control.
- No Playwright/Cypress screenshot test was run for sticky layering; verification was via code review and production build.


2026-04-29 - Hide duplicate native Gantt horizontal scrollbar
Files changed:
  frontend/src/components/gantt/GanttChart.jsx
  readme.txt

What changed:
- Changed the main Gantt scroll container from combined overflow auto to vertical-only native scrolling.
- The main container now uses overflow-x hidden and overflow-y auto.
- The floating timeline scrollbar remains the single horizontal timeline control.
- Programmatic scrollLeft synchronization between the floating scrollbar and the main timeline remains in place.

Reason:
- User reported two horizontal scrollbars after the floating timeline scrollbar was added.
- The duplicate was caused by keeping the browser-native horizontal scrollbar on the main Gantt container while also rendering the floating scrollbar.

Behavior impact:
- Users should see one horizontal scrollbar for the Gantt timeline.
- Vertical scrolling inside the Gantt chart remains available.
- Horizontal timeline movement is controlled by the floating scrollbar.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- No browser screenshot automation was run; visual verification should be done in the browser after hard refresh.


2026-04-29 - Professional UI/UX system enhancement across menus
Files changed:
  frontend/src/styles/index.css
  frontend/src/components/layout/Sidebar.jsx
  frontend/src/components/layout/Topbar.jsx
  frontend/src/components/layout/MainLayout.jsx
  frontend/src/components/shared/Modal.jsx
  frontend/src/components/dashboard/SummaryCard.jsx
  frontend/src/components/dashboard/ProjectProgressCard.jsx
  frontend/src/components/dashboard/TaskStatusChart.jsx
  frontend/src/components/project/ProjectCard.jsx
  frontend/src/components/project/ProjectHeader.jsx
  frontend/src/components/project/BucketManager.jsx
  frontend/src/components/task/TaskFilters.jsx
  frontend/src/components/task/TaskTree.jsx
  frontend/src/components/task/TaskCard.jsx
  frontend/src/components/board/BoardView.jsx
  frontend/src/components/board/BoardGroupSwitcher.jsx
  frontend/src/components/board/BoardColumn.jsx
  frontend/src/components/gantt/GanttChart.jsx
  frontend/src/components/gantt/GanttFilters.jsx
  frontend/src/components/calendar/CalendarExceptionTable.jsx
  frontend/src/pages/DashboardPage.jsx
  frontend/src/pages/ProjectsPage.jsx
  frontend/src/pages/TaskListPage.jsx
  frontend/src/pages/GanttPage.jsx
  frontend/src/pages/DepartmentGanttPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/pages/BoardPage.jsx
  frontend/src/pages/TeamPage.jsx
  frontend/src/pages/CalendarSettingsPage.jsx
  frontend/src/pages/SettingsPage.jsx
  readme.txt

What changed:
- Added shared UI utility classes for page shells, page headers, toolbars, metric cards, info tiles, progress bars, table shells, empty states, segmented controls, and action rows.
- Reworked the application shell:
  sidebar width, brand area, active nav state, compact nav initials, and root-only Dashboard active state.
- Reworked the topbar with a more professional product context label, constrained content width, and subtle shadow.
- Constrained main content to a max width so wide monitors remain readable.
- Standardized success toast styling to green and error toast styling to red.
- Reworked all page headers across Dashboard, Projects, Task List, Gantt, Department Gantt, Team, Calendar, Settings, Board, and Project Detail routes.
- Standardized filter areas as toolbar surfaces.
- Standardized Team, Task List, and Calendar Exception tables using shared table shell and data table styles.
- Reworked dashboard metric cards, project progress cards, task status chart, project cards, project header, bucket manager, board group switcher, board columns, task cards, and Gantt empty state to align with the shared UI system.
- Reworked shared Modal layout with a cleaner header, content scroll area, footer surface, and stronger overlay treatment.
- Removed the visually heavy project gradient header in favor of a cleaner operational project summary surface.

Reason:
- User requested a professional UI/UX enhancement across the whole website and specifically asked that the implementation be applied to all menus so no page looks inconsistent.
- The previous UI had repeated one-off layouts and inconsistent page headers, table styling, toolbar styling, and modal presentation.

Best-practice references applied:
- Nielsen Norman Group visual design principles: stronger visual hierarchy, restrained scale, contrast, and consistent grouping.
- Nielsen Norman Group menu design checklist: visible left navigation for applications, concise labels, and current-location cues.
- Material Design navigation guidance: desktop productivity applications can use persistent left navigation with clear selection state.
- Material Design data table guidance: enterprise data tables should use clear headers, row structure, hover/readability affordances, and tools around the table surface.
- Atlassian grid/layout guidance: consistent margins, gutters, and content constraints improve scanning on content-dense product pages.
- Atlassian form guidance: keep forms and controls simple, logically grouped, and not visually overloaded.

Behavior impact:
- Presentation only. No database schema, backend API, or business workflow changed.
- All existing project, task, board, Gantt, department Gantt, team, calendar, and settings actions remain routed through the same handlers and API services.
- Frontend dev server remained reachable at http://localhost:5173/.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Checked frontend dev server:
  GET http://localhost:5173/
  Result: HTTP 200.
- Ran source scans to confirm all page components now use page-shell and that shared table/toolbar patterns are applied across menus.

Known risks:
- No browser screenshot automation was run because this project does not currently include Playwright/Cypress.
- Final visual QA should still be done manually in the browser across common viewport sizes after a hard refresh.
- The mobile layout still relies on the existing simplified topbar links rather than a full mobile navigation drawer.


2026-04-29 - Task lead dropdown and multi-PIC assignment
Files changed:
  backend/src/database/schema.sql
  backend/src/database/seed.sql
  backend/src/database/migrations/20260429_task_multi_pic_lead_user.sql
  backend/src/services/taskService.js
  backend/src/services/projectService.js
  backend/src/services/ganttService.js
  backend/src/services/dashboardService.js
  frontend/src/components/task/TaskFormModal.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/components/task/TaskTree.jsx
  frontend/src/components/task/TaskCard.jsx
  frontend/src/components/task/TaskFilters.jsx
  frontend/src/components/gantt/GanttTreeRow.jsx
  frontend/src/components/gantt/GanttQuickResume.jsx
  frontend/src/components/gantt/GanttFilters.jsx
  frontend/src/logic/helpers/taskPeopleHelper.js
  readme.txt

What changed:
- Added tasks.lead_id as a user-based lead reference while preserving legacy tasks.lead_name for backward compatibility.
- Added task_assignees as a many-to-many task-to-user relation so one task can have more than one PIC.
- Added migration 20260429_task_multi_pic_lead_user.sql to create the new schema, backfill task_assignees from existing tasks.assignee_id, backfill lead_id from matching lead_name/user name, and upsert project_members for assigned PIC and lead users.
- Updated seed.sql so fresh seed data also backfills task_assignees and lead_id.
- Updated task API reads to return:
  assignee_ids
  assignees
  assignee_names
  lead_id
  lead_name from the linked user when available.
- Kept legacy assignee_id and assignee_name in task API responses as the primary PIC for compatibility with existing UI and filters.
- Updated task create/update to accept assignee_ids for multi-PIC and lead_id for lead dropdown selection.
- Updated task create/update to keep tasks.assignee_id synchronized to the first selected PIC as a legacy primary PIC.
- Updated project, dashboard, and department Gantt queries to use task_assignees for department/PIC involvement while preserving fallback behavior for existing assignee_id rows.
- Updated Task Form so PIC is selected from Team data using a multi-select dropdown and Lead is selected from Team data using a dropdown.
- Updated Task List, Task Detail, Board task cards, Gantt tree labels, and quick resume task preview to display multiple PIC names and lead names correctly.
- Updated task and Gantt filter labels from assignee department to PIC department.

Reason:
- User requested Lead and PIC fields to come from Team/User master data rather than free text.
- User requested PIC to support selecting more than one person per task.
- The previous single tasks.assignee_id column could not correctly represent multiple PIC users without a separate relation table.

Behavior impact:
- Task Lead is now a dropdown backed by users.id.
- Task PIC now supports multiple users through task_assignees.
- Existing single-PIC tasks remain compatible because migration backfills task_assignees from tasks.assignee_id.
- Existing lead_name values remain compatible because migration maps matching user names to lead_id and the API still returns lead_name.
- Department Gantt and dashboard PIC/department counts now read multi-PIC assignment data.
- Project involvement automatically includes selected PIC and lead users when tasks are created or updated.
- Database schema changed additively; no existing task/project payload shape was removed.

Verification:
- Applied database migration:
  backend/src/database/migrations/20260429_task_multi_pic_lead_user.sql
  Result: success.
- Migration backfill check:
  task_assignee_rows: 25
  tasks_with_pic: 25
  tasks_with_lead: 24
- Restarted backend on http://localhost:5000 so the running API loaded the new task service.
- Verified GET /api/tasks returns assignee_ids, assignees, assignee_names, lead_id, and lead_name.
- Ran REST API CRUD smoke test:
  Created a temporary task with two PIC users.
  Updated the same task to a different two-PIC combination and a different lead user.
  Fetched the task and confirmed assignees and lead were returned correctly.
  Deleted the temporary task.
  Result: success.
- Verified no temporary smoke task remained in database:
  smoke_tasks: 0
- Ran backend syntax check:
  node --check for backend/src/**/*.js
  Result: success.
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Checked frontend dev server:
  GET http://localhost:5173/
  Result: HTTP 200.

Known risks:
- The UI uses an in-form dropdown with checkboxes for multi-PIC selection; final browser QA should confirm the dropdown height and overlay feel right in the task modal.
- Existing tasks with lead_name values that do not exactly match a user name will keep lead_name display but will not get lead_id until edited.
- tasks.assignee_id remains as a legacy primary PIC field for compatibility. New multi-PIC logic should use task_assignees and assignee_ids going forward.


2026-04-29 - Inline small edit button on Task List rows
Files changed:
  frontend/src/components/task/TaskTree.jsx
  readme.txt

What changed:
- Added a compact Edit button directly beside each task title in TaskTree rows.
- Kept the existing Edit button in the Actions column so the previous workflow remains available.
- Made long task titles truncate inside the task column so the inline Edit button stays visible and the row layout remains stable.

Reason:
- User requested a small edit task button while staying on the Task List page.
- The Actions column can require horizontal scrolling after task columns expanded for PIC and Lead, so inline edit access improves usability.

Behavior impact:
- Users can open the existing task edit modal from the task title column.
- No database, backend API, or task business logic changed.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- No browser screenshot automation was run; final visual spacing should be checked manually in the Task List table.


2026-05-07 - Add explanatory comments across source code
Files changed:
  backend/src/config/db.js
  backend/src/controllers/*.js
  backend/src/routes/*.js
  backend/src/services/*.js
  backend/src/utils/*.js
  backend/src/server.js
  frontend/src/app/*.jsx
  frontend/src/components/**/*.jsx
  frontend/src/logic/constants/*.js
  frontend/src/logic/helpers/*.js
  frontend/src/logic/hooks/*.js
  frontend/src/logic/services/*.js
  frontend/src/pages/*.jsx
  frontend/src/store/*.js
  frontend/src/main.jsx
  readme.txt

What changed:
- Added Indonesian explanatory comments above named functions, exported helpers, hooks, services, controllers, route handlers, Zustand stores, and major UI components.
- Added comments for important inner functions such as modal submit handlers, form validators, drag-and-drop handlers, Gantt calculation helpers, task tree helpers, and backend rollup logic.
- Kept comments descriptive for non-technical readers, explaining what each block does in plain language.
- Did not change SQL schema, API payload shape, component props, database queries, or business logic.

Reason:
- User requested comments for all code/functions so people unfamiliar with the codebase can understand the purpose of each functional block.

Behavior impact:
- Runtime behavior is intended to stay exactly the same.
- No database, API contract, validation rule, or UI workflow was intentionally changed.

Verification:
- Ran backend syntax check for every backend/src/*.js file:
  cd backend
  Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.

Known risks:
- Comments improve readability but do not replace full architecture documentation.
- Very small inline JSX callbacks are not individually documented when their behavior is already explained by the surrounding handler/component comment.


2026-05-12 - Add owner and date filters to Projects menu
Files changed:
  backend/src/services/projectService.js
  frontend/src/pages/ProjectsPage.jsx
  readme.txt

What changed:
- Added centralized filter state on the Projects page for status, owner, start date, and end date.
- Added an owner dropdown sourced from Team/users data on the Projects toolbar.
- Added start date and end date filter inputs on the Projects toolbar.
- Added a Reset Filters button that appears only when at least one filter is active.
- Updated the empty state message so filtered results show "Tidak ada project yang sesuai filter." instead of the generic empty-project message.
- Extended GET /api/projects query handling to support owner_id, start_date, and end_date.
- Project owner filtering uses projects.owner_id.
- Project date filtering uses range-overlap logic aligned with task/Gantt filters:
  start_date keeps projects whose end_date is empty or on/after the selected start date.
  end_date keeps projects whose start_date is empty or on/before the selected end date.

Reason:
- User requested owner and start/end date filters on the initial Projects menu view.

Behavior impact:
- Users can now filter the Projects list by owner and project date range directly from the Projects page.
- Existing status filter, project create/edit/delete behavior, and project cards remain unchanged.
- API behavior is additive; existing GET /api/projects callers without the new query parameters continue to receive the same result shape.
- No database schema changes were made.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Ran backend syntax check for every backend/src/*.js file:
  cd backend
  Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Verified filtered Projects API on the running local backend:
  GET http://localhost:5000/api/projects?owner_id=1&start_date=2026-01-01&end_date=2026-12-31
  Result: success true, returned filtered project data.
- Verified frontend dev server:
  GET http://localhost:5173/
  Result: HTTP 200.

Known risks:
- No browser screenshot automation was run; final visual QA should confirm toolbar spacing on smaller screens.
- Backend does not add extra query-date validation beyond parameterized SQL because the frontend date inputs emit valid YYYY-MM-DD values.


2026-05-12 - Add helpdesk overdue Firebase revalidation subtasks
Files changed:
  readme.txt

Database records changed:
  Created tasks:
    264
    265
    266
    267
    268
    269
    270
    271
    272
    273
    274
    275
    276
    277
    278

What changed:
- Added 15 subtasks under task id 263:
  Implementasi overdue ticket helpdesk notifikasi, update revalidasi Firebase token berbasis device.
- Parent project:
  id 18, Pengembangan ITHUB - Approval.
- Subtasks were created from the user-provided implementation checklist covering overdue helpdesk ticket endpoint, route, controller, schema validation, service, repository queries, SLA weekend handling, completed-ticket exclusion, Firebase token revalidation by device, mobile login lookup/create, and invalid token cleanup.
- Subtask dates were distributed evenly across the parent task date range 2026-05-01 through 2026-07-31.
- Created subtask durations:
  two subtasks use 7 calendar days and thirteen subtasks use 6 calendar days, totaling the same 92 calendar days as the parent task.
- All subtasks use:
  parent_task_id 263
  project_id 18
  assignee Ardi, user id 2
  status Not Started as stored raw status
  progress 0
  priority Medium
  sequential sort_order 1 through 15

Reason:
- User requested the provided list to become subtasks under the parent task "Implementasi overdue ticket helpdesk notifikasi, update revalidasi Firebase token" with balanced durations.

Behavior impact:
- Project task structure now contains the requested implementation breakdown.
- The task list and Gantt view will show these items as children of task id 263.
- No source code, API contract, or database schema was changed.
- Because the application calculates effective Overdue status from the current date, the first subtask may display as Overdue when viewed after its end date even though the raw stored status is Not Started.

Verification:
- Created subtasks through:
  POST http://localhost:5000/api/tasks
  Result: success for task ids 264 through 278.
- Verified subtask list:
  GET http://localhost:5000/api/tasks/263/subtasks
  Result: 15 subtasks returned with parent_task_id 263, sequential sort_order, Ardi as assignee, and balanced dates from 2026-05-01 to 2026-07-31.
- Verified parent task:
  GET http://localhost:5000/api/tasks/263
  Result: parent task remains project_id 18, start_date 2026-05-01, end_date 2026-07-31, duration_days 92, work_days 61, progress 0, status In Progress.

Known risks:
- Dates were balanced by calendar-day coverage across the parent task range. Work-day counts vary slightly because weekends and calendar rules affect each subtask differently.
- No browser visual QA was run after creating the records; API verification confirms the data exists.


2026-05-19 - Add VM critical backup and restore subtasks
Files changed:
  readme.txt

What changed:
- Added 7 subtasks under task id 279:
  Implementasi Backup dan Restore Virtual Machine (VM) Critical pada Infrastruktur VMware vCenter Menggunakan Veeam Backup & Replication 12 Community Edition yang diinstall pada Windows Server 2016.
- Parent project:
  id 26, Pengembangan Karyawan.
- Subtasks were created from the user-provided backup and restore checklist:
  1. Server Veeam Backup & Replication berhasil diinstall dan dapat berjalan dengan normal.
  2. Veeam berhasil terkoneksi dengan VMware vCenter.
  3. Seluruh VM critical yang ditentukan berhasil masuk ke dalam job backup.
  4. Backup VM dapat berjalan otomatis sesuai jadwal yang ditentukan.
  5. File backup tersimpan dengan aman pada repository yang telah ditentukan.
  6. Proses restore VM ke Server On Premise berhasil dilakukan tanpa kendala.
  7. Retensi Backup sesuai dengan target.
- Subtask dates were distributed evenly across the parent task date range 2026-05-01 through 2026-08-01.
- Created subtask durations:
  two subtasks use 14 calendar days and five subtasks use 13 calendar days, totaling the same 93 calendar days as the parent task.
- All subtasks use:
  parent_task_id 279
  project_id 26
  assignee Tiar, user id 20
  lead Obet, user id 22
  status Not Started as stored raw status
  progress 0
  priority Medium
  sequential sort_order 1 through 7

Reason:
- User requested the provided Veeam backup and VM restore checklist to become subtasks under the implementation parent task, with dates balanced evenly.

Behavior impact:
- Project task structure now contains the requested VM critical backup and restore breakdown.
- The task list and Gantt view will show these items as children of task id 279.
- No source code, API contract, or database schema was changed.

Verification:
- Created subtasks through:
  POST http://localhost:5000/api/tasks
  Result: success for task ids 280 through 286.
- Verified subtask list:
  GET http://localhost:5000/api/tasks/279/subtasks
  Result: 7 subtasks returned with parent_task_id 279, sequential sort_order, Tiar as assignee, Obet as lead, and balanced dates from 2026-05-01 to 2026-08-01.
- Verified parent task:
  GET http://localhost:5000/api/tasks/279
  Result: parent task remains project_id 26, start_date 2026-05-01, end_date 2026-08-01, duration_days 93, work_days 61, progress 0, status Not Started.

Known risks:
- Dates were balanced by calendar-day coverage across the parent task range. Work-day counts vary slightly because weekends and calendar rules affect each subtask differently.
- Because the application calculates effective Overdue status from the current date, the first subtask displays as Overdue on 2026-05-19 even though the raw stored status is Not Started.
- No browser visual QA was run after creating the records; API verification confirms the data exists.


2026-05-19 - Add lead approval workflow for completed tasks
Files changed:
  backend/src/services/taskService.js
  backend/src/controllers/taskController.js
  backend/src/routes/taskRoutes.js
  backend/src/utils/responseUtils.js
  frontend/src/store/uiStore.js
  frontend/src/components/layout/Topbar.jsx
  frontend/src/logic/services/api.js
  frontend/src/logic/services/taskApi.js
  frontend/src/components/task/TaskFormModal.jsx
  frontend/src/components/task/TaskTree.jsx
  frontend/src/pages/TaskListPage.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/dist/index.html
  frontend/dist/assets/index-Ra2HgfPf.js
  frontend/dist/assets/index-ZKmnvj6D.css
  readme.txt

What changed:
- Changed task completion workflow so direct completion actions no longer write 100% Done immediately.
- When a task is marked Done, progress is set to 99 and raw status becomes Waiting Review.
- When a task is manually set to Waiting Review, progress is normalized to 99.
- When progress is set to 100 manually, backend stores it as 99 Waiting Review.
- When normal or manual realization is finished, backend stores actual realization dates but sets progress to 99 and status Waiting Review.
- Added PATCH /api/tasks/:id/approve to approve a task that is already Waiting Review.
- Approval requires approver_user_id or X-User-Id to match the task lead_id.
- Approval changes the task to 100% and Done.
- Parent tasks now roll up child completion into Waiting Review at 99% until the parent lead approves.
- Parent task approval is blocked until every direct subtask is already approved as 100% Done.
- Waiting Review tasks are no longer displayed as Overdue just because their end date has passed.
- Added active user selection in the topbar, stored locally in browser localStorage, so the frontend can decide whether the active user is the lead.
- Added Approve actions in task list and task detail views, shown only when the active user is the task lead.
- Updated frontend error parsing so API validation messages such as "Hanya lead task yang dapat melakukan approval." are shown instead of the generic error message.
- Updated generated frontend build output through npm run build.

Business process impact:
- Completion is now a two-step workflow:
  1. PIC or executor marks work as complete by status, progress, or realization finish.
  2. System moves the task to 99% Waiting Review.
  3. Only the task lead can approve it.
  4. After approval, the task becomes 100% Done.
- Project progress follows task progress automatically. A project whose root tasks are waiting approval will remain below 100 until the required lead approvals are completed.
- Historical tasks already stored as 100% Done were not mass-converted; this change applies to new completion actions after this update.

Reason:
- User requested completed project/task work to stop at 99% and enter waiting approval, with only the lead able to approve it to 100%.

Behavior impact:
- Direct Done status selection, direct Waiting Review status selection, drag to Done, manual progress 100, and realization finish now produce Waiting Review at 99%.
- The Done state is now reserved for successful lead approval.
- Users must select an active user in the topbar before approval buttons can appear for matching lead-owned tasks.
- API now rejects non-lead approval attempts with HTTP 400.
- No database schema change was required because existing status, progress, lead_id, and activity_logs fields support the workflow.

Verification:
- Ran backend syntax checks:
  node --check src/services/taskService.js
  node --check src/controllers/taskController.js
  node --check src/routes/taskRoutes.js
  node --check src/utils/responseUtils.js
- Ran frontend production build:
  npm run build
  Result: successful Vite build.
- Verified backend root:
  GET http://localhost:5000/
  Result: API running.
- Created temporary task id 287, then PATCH /api/tasks/287/progress with progress 100.
  Result: task became 99% Waiting Review.
- Tried approval on task id 287 with non-lead user id 20.
  Result: HTTP 400.
- Approved task id 287 with lead user id 22.
  Result: task became 100% Done.
- Deleted temporary task id 287.
- Created temporary task id 288 with status Done and progress 100.
  Result: task was created as 99% Waiting Review.
- Tried non-lead approval on task id 288.
  Result: HTTP 400 with error "Hanya lead task yang dapat melakukan approval."
- Deleted temporary task id 288.
- Created temporary task id 289 with status Waiting Review and progress 0.
  Result: task was normalized to 99% Waiting Review.
- Deleted temporary task id 289.

Known risks:
- The app still has no real authentication system. The backend enforces approval by approver_user_id/X-User-Id, and the frontend active user selector controls the UI, but this is not equivalent to authenticated identity.
- Existing 100% Done historical tasks were not changed to avoid rewriting prior project data without an explicit migration request.
- Browser visual QA was not run with a screenshot pass; functional API checks and production build passed.


2026-05-19 - Add login page and super admin access
Files changed:
  backend/src/database/schema.sql
  backend/src/database/seed.sql
  backend/src/database/migrations/20260519_user_login_super_admin.sql
  backend/src/services/authService.js
  backend/src/controllers/authController.js
  backend/src/routes/authRoutes.js
  backend/src/server.js
  backend/src/services/taskService.js
  backend/src/utils/responseUtils.js
  frontend/src/app/App.jsx
  frontend/src/pages/LoginPage.jsx
  frontend/src/store/uiStore.js
  frontend/src/logic/services/api.js
  frontend/src/logic/services/authApi.js
  frontend/src/logic/constants/roles.js
  frontend/src/components/layout/Topbar.jsx
  frontend/src/components/task/TaskTree.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/pages/TaskListPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/pages/TeamPage.jsx
  frontend/dist/index.html
  frontend/dist/assets/index-BPdpf7cc.js
  frontend/dist/assets/index-CFQ4-jRq.css
  readme.txt

What changed:
- Added password_hash to users with default hash for password modern888.
- Added migration 20260519_user_login_super_admin.sql to backfill password_hash for existing users and create/update the Super Admin user.
- Added Super Admin to seed data.
- Added /api/auth/login endpoint that accepts identifier and password, where identifier can be user name or email.
- Added authService with password hashing, password verification, and sanitized login response that excludes password_hash.
- Added LoginPage and frontend authApi service.
- Added local form error display on LoginPage so failed login messages are visible before the main layout loads.
- Updated App so unauthenticated users are redirected to /login before the main layout renders.
- Updated uiStore to persist the logged-in user in localStorage and keep currentUserId synchronized for approval context.
- Updated API client to send X-User-Id for the logged-in user.
- Replaced the previous topbar Active User selector with logged-in user display and Logout.
- Added super_admin role option in Team.
- Updated task approval authority so super_admin can approve any Waiting Review task, including tasks without matching lead_id.
- Updated Task List, Project Detail List, and Task Detail approval visibility so super_admin sees Approve actions.
- Added an approval handler to Project Detail List so inline Approve works from project task lists.
- Updated generated frontend build output through npm run build.

Reason:
- User requested a login page for the Project Management app using Team users as login accounts.
- User requested login by name or email.
- User requested all current passwords to be modern888.
- User requested a Super Admin user with full authority, including approve, add, and edit all tasks.

Behavior impact:
- Users must login before accessing the application UI.
- Any Team user can login with their name or email and password modern888.
- Super Admin can login with:
  name: Super Admin
  email: superadmin@project-management.local
  password: modern888
- Approval now follows the logged-in user instead of a manually selected active user.
- Normal users still follow lead-only approval behavior.
- Super Admin can approve any task that is in Waiting Review and can use existing add/edit task workflows.
- Parent task approval rules are preserved: parent approval is still blocked until direct subtasks are Done 100%.
- No existing project/task payload shape was removed.

Database impact:
- users.password_hash was added and backfilled.
- Existing users were initialized to the hash for modern888.
- A Super Admin user was inserted/updated in the users table.
- No task/project schema changes were made.

Verification:
- Ran backend syntax check:
  cd backend
  Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Applied database migration:
  backend/src/database/migrations/20260519_user_login_super_admin.sql
  Result: success.
- Verified Super Admin record:
  SELECT id, name, email, role FROM users WHERE role = 'super_admin'
  Result: id 23, Super Admin, superadmin@project-management.local, super_admin.
- Verified auth service login:
  identifier superadmin@project-management.local, password modern888
  identifier Rey, password modern888
  Result: success for both.
- Started backend and frontend dev servers.
- Verified backend root:
  GET http://localhost:5000/
  Result: success true, API running.
- Verified login API:
  POST http://localhost:5000/api/auth/login
  Body: {"identifier":"superadmin@project-management.local","password":"modern888"}
  Result: success true with sanitized Super Admin user data.
- Verified invalid login:
  POST http://localhost:5000/api/auth/login with wrong password
  Result: HTTP 401.
- Verified frontend login route:
  GET http://localhost:5173/login
  Result: HTTP 200.
- Verified Super Admin approval:
  Created temporary task id 290 with status Done/progress 100.
  Result after create: Waiting Review, progress 99.
  Approved task id 290 using X-User-Id 23.
  Result after approval: Done, progress 100.
  Deleted temporary task id 290.
- Verified no temporary smoke task remained:
  smoke_tasks: 0.

Known risks:
- This is an application login gate, not a full production authentication system with signed tokens, refresh tokens, server-side sessions, or route middleware on every API.
- Passwords are initialized to one shared default password. Add password change/reset and stronger password storage before production use.
- Team user names are not unique. If duplicate names exist, login by name uses the first matching user ordered by id; login by unique email is safer.
- Normal task/project create/edit endpoints are still broadly available through the API because the previous app had no endpoint-level permission model. Super Admin approval bypass was added without introducing broad behavior-breaking restrictions for non-super-admin users.
- Browser screenshot QA was not run; API checks and production build passed.


2026-05-19 - Enhance login page UI and remove credential hints
Files changed:
  frontend/src/pages/LoginPage.jsx
  frontend/dist/index.html
  frontend/dist/assets/index-CdH98dbl.js
  frontend/dist/assets/index-rxRd6zzj.css
  readme.txt

What changed:
- Redesigned the login page into a cleaner split layout with a product identity panel and focused login form.
- Removed the visible Default password segment from the login page.
- Removed the visible Super admin segment from the login page.
- Added a password visibility toggle to the password field.
- Kept labels outside fields and kept placeholder text secondary.
- Kept login failure messaging generic and visible inside the form.
- Updated login page spacing, typography, button sizing, and mobile layout.
- Updated generated frontend build output through npm run build.

Reason:
- User requested the login page UI to look better and asked to remove the password and super admin information from the page.
- UI direction was based on common login best practices:
  clear labeled inputs, focused form layout, no credential hints on the login screen, password visibility control, generic login error, and visible loading state.
- References checked:
  OWASP Authentication Cheat Sheet for generic authentication error guidance.
  Material Design text field guidance for visible labels and password visibility behavior.

Behavior impact:
- Login behavior and API contract did not change.
- Users still login with Team name/email and password.
- The page no longer exposes default password or super admin account information.
- Invalid login still shows a generic error without revealing whether the user name/email or password was wrong.
- No database or backend schema changes were made.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Ran backend syntax check:
  cd backend
  Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Verified frontend login route:
  GET http://localhost:5173/login
  Result: HTTP 200.

Known risks:
- No browser screenshot automation was run; final visual QA should confirm the page looks correct on target desktop and mobile screens.
- This remains a local-session frontend login gate; full production auth hardening is still listed as future work.


2026-05-19 - Harden database configuration and verify application schema
Files changed:
  backend/src/config/db.js
  backend/src/server.js
  readme.txt

What changed:
- Updated backend database configuration to load backend/.env through an absolute path, so the backend uses the same database config even if the process is started from a different working directory.
- Removed silent database config fallbacks from db.js and replaced them with explicit required environment variable validation.
- Added DB_PORT validation.
- Added PostgreSQL pool guardrails:
  connectionTimeoutMillis 5000
  idleTimeoutMillis 30000
  max pool size from DB_POOL_MAX or 10
- Added verifyDatabaseConnection() to confirm the active database matches DB_NAME.
- Added verifyApplicationSchema() to fail fast if core application tables are missing, users.password_hash is missing, or the Super Admin account is missing.
- Updated server startup so Express only starts listening after database connection and application schema validation pass.
- Restarted the backend so the new validation is active.

Reason:
- User reported not seeing password/super_admin in the checked database table and requested a complete database connection audit.
- The provided JDBC example used /postgres, while the requested application database is project_management. This can cause inspection of the wrong database.
- The previous db.js had development fallbacks that could hide a missing or misloaded .env; fail-fast configuration is safer for production-style operation.

Behavior impact:
- Backend now refuses to start if required DB_* env values are missing or invalid.
- Backend now refuses to start if it is connected to a database other than DB_NAME.
- Backend now refuses to start if the expected application schema/login migration is not present.
- Normal API behavior is unchanged when the database is configured correctly.

Database audit result:
- Confirmed backend .env points to:
  DB_HOST=127.0.0.1
  DB_PORT=5433
  DB_USER=postgres
  DB_PASSWORD=admin
  DB_NAME=project_management
- Confirmed direct PostgreSQL connection:
  database: project_management
  schema: public
  user: postgres
  server_addr: 127.0.0.1
  server_port: 5433
- Confirmed database project_management contains application tables:
  activity_logs, buckets, calendar_exceptions, departments, project_members, projects, task_assignees, task_attachments, task_comments, tasks, users
- Confirmed public.users has password_hash with NOT NULL and default hash.
- Confirmed public.users contains Super Admin:
  id 23
  name Super Admin
  email superadmin@project-management.local
  role super_admin
- Confirmed database postgres does not contain application table users. It only had app_users during the audit, so checking jdbc:postgresql://127.0.0.1:5433/postgres will not show project-management users.
- Confirmed table user singular does not exist; the application uses users plural.
- Confirmed no orphan rows for checked relationships:
  tasks.project_id
  tasks.assignee_id
  tasks.lead_id
  task_assignees.task_id
  task_assignees.user_id
  project_members.project_id
  project_members.user_id
- Confirmed no duplicate emails in users.

Verification:
- Ran backend syntax check:
  cd backend
  Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran database startup validation directly through db.js:
  verifyDatabaseConnection()
  verifyApplicationSchema()
  Result: success, connected to project_management@127.0.0.1:5433.
- Restarted backend on port 5000 after stopping the old backend process.
- Verified backend root:
  GET http://localhost:5000/
  Result: success true, API running.
- Verified login API after restart:
  POST http://localhost:5000/api/auth/login
  Body: {"identifier":"Super Admin","password":"modern888"}
  Result: success true with Super Admin user data.

Known risks:
- If a developer intentionally wants to inspect the application with a JDBC client, the URL must use /project_management, not /postgres.
- Startup schema validation is intentionally strict. A fresh empty database must have schema/migrations applied before the backend will start.
- Password hashes still use the current local-login implementation. A future production hardening pass should replace shared default passwords with user-specific onboarding/password reset and a stronger password-hashing strategy.


2026-05-19 - Add lokasi business unit master and cross-feature filters
Files changed:
  backend/src/database/schema.sql
  backend/src/database/seed.sql
  backend/src/database/migrations/20260519_locations_business_unit.sql
  backend/src/config/db.js
  backend/src/server.js
  backend/src/controllers/locationController.js
  backend/src/routes/locationRoutes.js
  backend/src/controllers/userController.js
  backend/src/services/authService.js
  backend/src/services/projectService.js
  backend/src/services/taskService.js
  backend/src/services/ganttService.js
  backend/src/controllers/ganttController.js
  frontend/src/app/router.jsx
  frontend/src/components/layout/Sidebar.jsx
  frontend/src/components/layout/Topbar.jsx
  frontend/src/pages/LocationsPage.jsx
  frontend/src/pages/TeamPage.jsx
  frontend/src/pages/SettingsPage.jsx
  frontend/src/pages/ProjectsPage.jsx
  frontend/src/pages/TaskListPage.jsx
  frontend/src/pages/GanttPage.jsx
  frontend/src/pages/DepartmentGanttPage.jsx
  frontend/src/components/project/ProjectCard.jsx
  frontend/src/components/project/ProjectHeader.jsx
  frontend/src/components/task/TaskFilters.jsx
  frontend/src/components/gantt/GanttFilters.jsx
  frontend/src/logic/services/locationApi.js
  frontend/src/logic/services/ganttApi.js
  frontend/src/logic/hooks/useLocations.js
  frontend/dist/index.html
  frontend/dist/assets/index-CDkD7An4.js
  frontend/dist/assets/index-D6sGeJ98.css
  readme.txt

What changed:
- Added locations table as a master data table for business units.
- Added users.location_id referencing locations.id with ON DELETE SET NULL.
- Added idx_users_location_id.
- Added locations to updated_at trigger setup and startup schema validation.
- Added migration 20260519_locations_business_unit.sql.
- Added backend /api/locations CRUD routes and controller.
- Extended user API responses and create/update payloads with location_id and location_name.
- Extended auth login response with location_id and location_name.
- Extended project query data with owner/member location fields, locations JSON, and location_names.
- Added location_id project filtering based on project members, task_assignees PIC data, and legacy assignee_id data.
- Extended task query data with assignee and lead location fields.
- Added location_id task filtering.
- When department_id and location_id are both used, project/task filters require the same involved user to match both department and location.
- Extended Department Gantt API with location_id query filtering and location metadata.
- Added /locations menu and page for creating/editing/deleting lokasi/business unit.
- Added location assignment to Team user forms and Team table.
- Added location filters to Projects, Task List, and global Gantt.
- Added location filter to Department Gantt.
- Added a read-only Task List table inside Department Gantt so users can inspect the exact tasks for department A in business unit B.
- Updated Project Card and Project Header to display location/business-unit names.
- Updated generated frontend build output through npm run build.

Reason:
- User requested a Lokasi menu that can be assigned to each user as the business unit where the user works.
- User requested Lokasi to filter which projects/tasks happen in a business unit.
- User requested Department Gantt to show task/project scope for a selected department and selected business unit combination.

Behavior impact:
- Existing users remain valid with location_id null until assigned.
- New and edited users can be assigned to one location/business unit.
- Location filtering derives project/task involvement from the users involved in project_members, task_assignees, or legacy tasks.assignee_id.
- Department Gantt can now answer "department A in business unit B has which projects/tasks?"
- Deleting a location does not delete users; users.location_id is set to null by the foreign key.
- No existing project/task payload shape was removed.

Database impact:
- New table:
  locations
- New column:
  users.location_id
- New index:
  idx_users_location_id
- Existing data was not force-assigned to a location to avoid inventing business-unit data.

Verification:
- Ran backend syntax check:
  cd backend
  Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Applied database migration:
  backend/src/database/migrations/20260519_locations_business_unit.sql
  Result: success.
- Verified schema:
  locations table exists.
  users.location_id exists.
- Restarted backend on http://localhost:5000.
- Verified locations endpoint:
  GET http://localhost:5000/api/locations
  Result: success true.
- Verified frontend locations route:
  GET http://localhost:5173/locations
  Result: HTTP 200.
- Ran API smoke test:
  Created temporary location "Smoke Business Unit ...".
  Temporarily assigned user Ardi to that location through PUT /api/users/:id.
  Verified updated user returned location_id and location_name.
  Verified GET /api/projects?location_id=<id> returned filtered projects.
  Verified GET /api/tasks?location_id=<id>&tree=true returned filtered tasks.
  Verified GET /api/gantt/departments/<departmentId>?location_id=<id> returned department, location, users, projects, and task rows for the combined filter.
  Restored Ardi's original location_id.
  Deleted the temporary location.
- Verified cleanup:
  smoke_locations: 0
  Ardi location_id restored to null.

Known risks:
- Existing users are not automatically assigned to a real business unit. Admin must create locations and assign users in Team.
- Location is currently one-to-one per user. If future business process needs one user to work across multiple business units, this should become a user_locations join table.
- Department Gantt task list is read-only. Task editing still happens through the existing task modal/Gantt click flow.
- No browser screenshot automation was run; API checks and production build passed.


2026-05-19 - Set Holding as default business unit for all users
Files changed:
  backend/src/database/seed.sql
  backend/src/database/migrations/20260519_holding_default_location.sql
  readme.txt

What changed:
- Added migration 20260519_holding_default_location.sql.
- The migration creates the Holding location if it does not exist.
- The migration normalizes an existing holding-like location name to Holding when found.
- The migration assigns every existing user to Holding through users.location_id.
- Updated seed.sql so fresh seeded databases create Holding and assign all seeded users, including Super Admin, to Holding.

Reason:
- User requested the current baseline business unit to be Holding and all users to be assigned to that business unit.

Behavior impact:
- All current users now show location_name Holding in Team and auth/user API responses.
- Business unit filters for project/task/Gantt can use Holding as the initial common location.
- Existing departments, roles, passwords, projects, tasks, and project memberships were not changed.

Database impact:
- Live database project_management was updated.
- locations now contains Holding.
- users.location_id for all existing users now points to Holding.

Verification:
- Applied migration through the backend pg connection using backend/.env.
- Verified database counts:
  Holding assigned_users: 16
  total_users: 16
  users_without_location: 0
- Verified locations API:
  GET http://localhost:5000/api/locations
  Result: success true with Holding.
- Verified users API:
  GET http://localhost:5000/api/users
  Result: success true and every returned user has location_name Holding.

Known risks:
- Holding is now the default baseline for all users. Future real business-unit separation must be handled by editing each user in Team or by adding a controlled migration/import for actual business unit assignments.


2026-05-19 - Add collapsible sidebar workspace toggle
Files changed:
  frontend/src/store/uiStore.js
  frontend/src/components/layout/MainLayout.jsx
  frontend/src/components/layout/Topbar.jsx
  frontend/dist/index.html
  frontend/dist/assets/index-BxTAgMRi.css
  frontend/dist/assets/index-BVKBOja7.js
  readme.txt

What changed:
- Added isSidebarHidden state to the UI store.
- Added localStorage persistence using project-management-sidebar-hidden so the sidebar display preference survives refresh.
- Added a desktop Topbar button to toggle between "Sembunyikan Sidebar" and "Tampilkan Sidebar".
- MainLayout now hides the Sidebar when the toggle is active.
- MainLayout and Topbar remove the 1600px max-width constraint while the sidebar is hidden so pages can use a wider workspace.
- Rebuilt frontend production assets.

Reason:
- User requested a button to hide the sidebar so pages can display with more horizontal space.

Behavior impact:
- Desktop users can hide or show the sidebar from the Topbar.
- The preference is local to the browser through localStorage.
- Mobile behavior remains unchanged because the sidebar was already hidden on small screens.
- No API, database, authentication, task, project, or Gantt business logic was changed.

Verification:
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Verified Vite dev server serves the updated Topbar module:
  GET http://localhost:5173/src/components/layout/Topbar.jsx
  Result: includes Sembunyikan Sidebar, Tampilkan Sidebar, and max-w-none.
- Verified Vite dev server serves the updated UI store module:
  GET http://localhost:5173/src/store/uiStore.js
  Result: includes project-management-sidebar-hidden, isSidebarHidden, and toggleSidebar.

Known risks:
- No browser screenshot automation was run for this UI-only change. Manual browser verification should confirm the workspace width on the user's target monitor size.


2026-05-19 - Enhance manual realization workflow
Files changed:
  backend/src/services/taskService.js
  backend/src/controllers/taskController.js
  frontend/src/components/task/TaskRealizationManualModal.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/components/task/TaskTree.jsx
  frontend/src/pages/TaskListPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/logic/services/taskApi.js
  frontend/dist/index.html
  frontend/dist/assets/index-BsygTczh.css
  frontend/dist/assets/index-CPNLynzc.js
  readme.txt

What changed:
- Reworked the manual realization modal into a richer form with task context, plan start/finish, actual date inputs, preview actual duration, start variance, and finish variance.
- Added a required Catatan Realisasi field with minimum length validation so late/manual input has an auditable reason.
- Manual realization form now validates required dates, invalid dates, finish-before-start, and future actual dates before submit.
- Manual realization no longer pre-fills plan dates when a task has no existing actual dates.
- Added loading state to prevent double submit.
- Disabled manual realization from task detail and row action menus when the task is a parent task or already Done.
- Frontend realization calls now include the logged-in user as actor_user_id and X-User-Id.
- Backend manual realization now requires actor_user_id/user_id, validates the actor user, requires a manual reason, rejects parent tasks, rejects approved Done tasks, and rejects future actual dates.
- Backend activity_logs entries for start, finish, and manual realization now store user_id when an actor is provided.
- Manual realization audit descriptions now include actor name and manual reason.
- Rebuilt frontend production assets.

Reason:
- Manual realization was too rough and allowed risky data entry without enough context, auditability, or guardrails.
- Best-practice schedule tracking separates planned dates from actual facts, avoids actual updates on summary/parent tasks, and treats completed work as reviewable before final approval.

Behavior impact:
- Manual realization remains a completion flow that sets actual dates, progress 99, and status Waiting Review.
- Users must provide a reason when using manual realization.
- Manual realization can only be submitted for leaf tasks that are not already approved Done.
- Parent task progress/date rollup behavior is protected from manual actual-date overrides.
- Existing normal realization start/finish behavior is preserved, with improved audit user logging when the frontend sends the actor.
- No database schema change was required.

Verification:
- Ran backend syntax check:
  cd backend
  Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran frontend production build:
  cd frontend
  npm.cmd run build
  Result: success.
- Ran service-layer smoke test with temporary tasks:
  Manual realization returned Waiting Review 99.
  activity_logs.user_id matched the actor user.
  Manual reason was stored in the activity description.
  Parent manual realization was rejected with "Realisasi manual hanya dapat diisi pada task tanpa subtask."
  Approved Done task manual overwrite was rejected with "Task yang sudah Done dan approved tidak dapat diubah melalui realisasi manual."
  Temporary smoke tasks were deleted.
- Verified cleanup:
  remaining_smoke_tasks: 0
- Restarted backend on http://localhost:5000 using npm run dev.
- Restarted frontend on http://localhost:5173 using npm run dev -- --host 0.0.0.0 --force.
- Verified backend root:
  GET http://localhost:5000/
  Result: success true.
- Verified Vite dev server serves updated frontend modules:
  GET http://localhost:5173/src/components/task/TaskRealizationManualModal.jsx
  Result: includes Catatan Realisasi, Actual Duration, Start Variance, and audit-trail text.
  GET http://localhost:5173/src/logic/services/taskApi.js
  Result: includes actor_user_id and X-User-Id.
- Ran live API smoke test:
  Created temporary task through POST /api/tasks.
  Updated manual realization through PATCH /api/tasks/:id/realization with actor_user_id and X-User-Id.
  Result: Waiting Review 99 and audit user_id stored.
  Deleted temporary task through DELETE /api/tasks/:id.
- Verified cleanup:
  remaining_api_smoke_tasks: 0

Known risks:
- There is still no dedicated rejection/request-correction workflow for lead review. A lead can approve, but cannot yet formally reject manual realization with a reason.
- There is still no task_realization_history table, so detailed before/after correction history is stored only in activity_logs descriptions.
- Frontend visual QA was verified through build and module checks, not automated browser screenshots.

2026-05-21 - Run local application services
Files changed:
  readme.txt

What changed:
- Started the backend API as a background Node process from backend/src/server.js.
- Started the frontend Vite dev server as a background Node process from frontend/node_modules/vite/bin/vite.js.
- Runtime output is redirected to backend-runtime.out.log, backend-runtime.err.log, frontend-runtime.out.log, and frontend-runtime.err.log.
- No application source code, API contract, database schema, or business logic was changed.

Reason:
- The application needed to be available locally for use and verification.
- Running both services enables the existing project management dashboard, project/task board, list views, and Gantt views to operate against the same PostgreSQL-backed API.

Behavior impact:
- Backend is available at http://127.0.0.1:5000.
- Frontend is available at http://127.0.0.1:5173.
- Existing functionality is preserved; this entry only records the local runtime startup.

Verification:
- Confirmed backend dashboard endpoint responds successfully:
  GET http://127.0.0.1:5000/api/dashboard/summary
  Result: HTTP 200.
- Confirmed frontend Vite server responds successfully:
  GET http://127.0.0.1:5173/
  Result: HTTP 200.
- Confirmed two Node processes are running for the backend and frontend.

Known risks:
- These are local background development processes, not production services.
- The backend still depends on PostgreSQL being available at the configured local connection.
- Browser-level visual verification was not performed during this run-only task.

2026-05-21 - Add professional development roadmap documentation
Files changed:
  pengembangan.txt
  readme.txt

What changed:
- Created pengembangan.txt as a detailed upstream-to-downstream development concept document.
- Documented public Cicle-inspired feature research and mapped it to the current Planner Gantt application.
- Added technical target architecture, database design, backend module plan, frontend module plan, API endpoint plan, dependency strategy, TypeScript migration strategy, testing strategy, rollout phases, business process changes, risks, and acceptance criteria.
- No application runtime source code, API implementation, database schema, or UI behavior was changed.

Reason:
- The project needs a formal technical roadmap before implementing Cicle-like professional collaboration features.
- The roadmap gives future development a structured sequence so core Planner, Gantt, department timeline, approval, and working calendar behavior can be preserved while collaboration modules are added safely.

Behavior impact:
- No runtime behavior impact.
- No database migration was executed.
- No dependency was installed.
- The new document acts as planning and implementation guidance only.

Verification:
- Confirmed pengembangan.txt did not exist before creation.
- Created documentation file in the project root.
- Appended this change log entry to readme.txt as required by the project instructions.

Known risks:
- The roadmap is based on public Cicle information available on 2026-05-21 and should be validated through hands-on product trial/demo before final feature parity decisions.
- Estimates are planning-level estimates and must be recalibrated after code-level design and implementation starts.

2026-05-21 - Implement Phase 1 auth, RBAC, session, and activity foundation
Files changed:
  backend/package.json
  backend/package-lock.json
  backend/src/config/db.js
  backend/src/controllers/activityController.js
  backend/src/controllers/authController.js
  backend/src/controllers/bucketController.js
  backend/src/controllers/calendarController.js
  backend/src/controllers/departmentController.js
  backend/src/controllers/locationController.js
  backend/src/controllers/projectController.js
  backend/src/controllers/taskController.js
  backend/src/controllers/userController.js
  backend/src/database/migrations/20260521_phase1_auth_rbac_activity.sql
  backend/src/database/schema.sql
  backend/src/database/seed.sql
  backend/src/middlewares/authMiddleware.js
  backend/src/middlewares/permissionMiddleware.js
  backend/src/routes/activityRoutes.js
  backend/src/routes/authRoutes.js
  backend/src/routes/bucketRoutes.js
  backend/src/routes/calendarRoutes.js
  backend/src/routes/departmentRoutes.js
  backend/src/routes/locationRoutes.js
  backend/src/routes/projectRoutes.js
  backend/src/routes/taskRoutes.js
  backend/src/routes/userRoutes.js
  backend/src/server.js
  backend/src/services/activityService.js
  backend/src/services/authService.js
  backend/src/services/permissionService.js
  backend/src/services/projectService.js
  backend/src/services/taskService.js
  backend/src/utils/responseUtils.js
  frontend/src/app/App.jsx
  frontend/src/components/activity/ProjectActivityFeed.jsx
  frontend/src/components/layout/Topbar.jsx
  frontend/src/logic/services/activityApi.js
  frontend/src/logic/services/api.js
  frontend/src/logic/services/authApi.js
  frontend/src/pages/LoginPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/store/uiStore.js
  frontend-runtime.out.log
  readme.txt

What changed:
- Added backend dependencies bcryptjs and zod.
- Added migration 20260521_phase1_auth_rbac_activity.sql for Phase 1 database foundation:
  auth_sessions, password_reset_tokens, role_permissions, users.is_active, users.last_login_at, invitation metadata, deleted_at, bcrypt default password hash, and richer activity_logs metadata.
- Updated schema.sql and seed.sql so fresh database setup includes Phase 1 auth/session/RBAC/activity structures and default role permissions.
- Reworked authService from local user-only login into token session login:
  login validates payload with zod, supports legacy sha256 password hash migration, hashes new passwords with bcryptjs, creates auth_sessions token, updates last_login_at, and records auth.login activity.
- Added /api/auth/me and /api/auth/logout.
- Added authMiddleware that validates Bearer token sessions before protected API routes.
- Protected all non-auth API routes with authentication from server.js.
- Added permissionService and permissionMiddleware with role_permissions support and safe fallback rules for super_admin, admin, manager, contributor, member, and viewer.
- Added mutation-level permission middleware to task, project, bucket, department, location, user, and calendar routes.
- Added activityService, activityController, and /api/activities endpoint for audit feed queries.
- Added audit logging for auth login/logout, project create/update/delete, task create/update/delete/status/progress/approval/realization/move/parent update, bucket create/update/delete, department create/update/delete, location create/update/delete, user create/update/delete, and calendar exception actions.
- Replaced the Project Detail Activity placeholder with a real ProjectActivityFeed that reads /api/activities?project_id=...
- Updated frontend login flow to store session token and authenticated user separately.
- Updated frontend API client to send Authorization: Bearer token, clear local auth storage on HTTP 401, and redirect expired/invalid sessions back to login.
- Updated logout button to call backend logout before clearing local session state.
- Updated App guard so old local user data without a valid token must login again.
- Restarted the frontend dev server, which refreshed frontend-runtime.out.log.

Reason:
- Phase 1 in pengembangan.txt requires security and governance before Cicle-like collaboration features are added.
- Session token auth, RBAC, and audit trail are required foundations for future comments, notification, chat, documents, check-in, and performance report modules.
- Activity must be visible in UI, not only stored in the database, so project stakeholders can audit who changed what.

Behavior impact:
- API behavior changed: all /api routes except /api/auth/login, /api/auth/me route protection, /api/auth/logout route protection, and root health endpoint now require a valid Bearer token.
- Login response shape changed from a raw user object to { user, token, expires_at }.
- Existing frontend login was updated to match the new response shape.
- Existing localStorage user sessions without token are no longer accepted and users must login again.
- Existing sha256 password hashes still work; after successful login they are migrated to bcryptjs.
- Mutation routes now check basic role permissions before controller logic.
- Task lead approval business logic is preserved: route permission allows the request, but taskService still enforces lead or super_admin approval rules.
- Database was migrated locally using the new Phase 1 migration.
- No task/project planning behavior, Gantt calculation, rollup progress logic, working calendar calculation, or approval semantics were intentionally changed.

Progress against pengembangan.txt:
- Fase 1 - Auth, Session, RBAC Dasar, dan Audit Log:
  Core implementation completed for session auth, Bearer token middleware, role permission table, route-level permission checks, activity service, activity endpoint, frontend token auth, logout, and project activity feed.
- Fase 1 items still pending:
  password reset flow UI/API, invitation acceptance flow, full project-scoped access policy, object-level permission, soft archive conversion for destructive deletes, dedicated session management UI, and deeper security hardening such as rate limiting and security headers.
- Fase 2 has not started.

Verification:
- Installed dependencies:
  cd backend
  npm install bcryptjs zod
- Applied migration through Node/pg because psql is not available in PATH:
  backend/src/database/migrations/20260521_phase1_auth_rbac_activity.sql
- Ran backend syntax check:
  Get-ChildItem -Recurse -Filter *.js src | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Ran backend production dependency audit:
  cd backend
  npm audit --omit=dev
  Result: found 0 vulnerabilities.
- Started temporary backend smoke server on http://127.0.0.1:5055 and verified:
  GET /api/dashboard/summary without token returns HTTP 401.
  POST /api/auth/login with superadmin@project-management.local returns HTTP 200 and a token.
  GET /api/dashboard/summary with Bearer token returns HTTP 200.
  GET /api/projects with Bearer token returns HTTP 200.
  POST /api/tasks with Bearer token creates a temporary smoke task.
  GET /api/activities?project_id=... returns activity rows.
  DELETE /api/tasks/:id removes the temporary smoke task.
  POST /api/auth/logout revokes the session.
- Stopped the temporary smoke backend process after verification.
- Restarted local development services with the updated Phase 1 code:
  Backend: http://127.0.0.1:5000
  Frontend: http://127.0.0.1:5173
- Verified updated runtime services:
  POST /api/auth/login on port 5000 returns HTTP 200 and token.
  GET /api/dashboard/summary with Bearer token returns HTTP 200.
  GET /api/activities?limit=3 with Bearer token returns HTTP 200.
  POST /api/auth/logout revokes the token session.
  GET http://127.0.0.1:5173/ returns HTTP 200.

Known risks:
- Existing browser sessions must login again because the old local user-only session format does not contain a Bearer token.
- Password reset and invitation flows are prepared structurally but not implemented as user-facing workflows yet.
- Permission checks are role-based and route-level; project-scoped and object-level authorization is still a Phase 1 follow-up.
- Delete routes still perform hard deletes for several resources; soft archive conversion remains pending.
- Activity logging is broad but not yet immutable or protected by a dedicated audit retention policy.
- Realtime notification/chat from later phases has not started.

2026-05-22 - Implement Phase 2 task labels, checklists, My Tasks, calendar view, and bulk actions
Files changed:
  backend/src/config/db.js
  backend/src/controllers/taskChecklistController.js
  backend/src/controllers/taskController.js
  backend/src/controllers/taskLabelController.js
  backend/src/database/migrations/20260522_phase2_task_labels_checklists.sql
  backend/src/database/schema.sql
  backend/src/database/seed.sql
  backend/src/routes/projectRoutes.js
  backend/src/routes/taskChecklistRoutes.js
  backend/src/routes/taskLabelRoutes.js
  backend/src/routes/taskRoutes.js
  backend/src/server.js
  backend/src/services/permissionService.js
  backend/src/services/taskChecklistService.js
  backend/src/services/taskLabelService.js
  backend/src/services/taskService.js
  frontend-runtime.out.log
  frontend/src/app/router.jsx
  frontend/src/components/layout/Sidebar.jsx
  frontend/src/components/layout/Topbar.jsx
  frontend/src/components/task/TaskBulkToolbar.jsx
  frontend/src/components/task/TaskCalendarView.jsx
  frontend/src/components/task/TaskCard.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/components/task/TaskFilters.jsx
  frontend/src/components/task/TaskFormModal.jsx
  frontend/src/components/task/TaskLabelManager.jsx
  frontend/src/components/task/TaskTree.jsx
  frontend/src/logic/helpers/taskLabelHelper.js
  frontend/src/logic/hooks/useTaskLabels.js
  frontend/src/logic/services/taskApi.js
  frontend/src/pages/BoardPage.jsx
  frontend/src/pages/MyTasksPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  frontend/src/pages/TaskCalendarPage.jsx
  frontend/src/pages/TaskListPage.jsx
  readme.txt

What changed:
- Added Phase 2 migration 20260522_phase2_task_labels_checklists.sql.
- Added task metadata columns for creator, archive state, delete metadata, completion/approval timestamps, and due reminder timestamp.
- Added bucket metadata columns for type, color, done bucket flag, move permission role, and archive state.
- Added task_labels, task_label_assignments, and task_checklists tables with indexes and updated_at triggers.
- Added role permissions for task_label and task_checklist resources.
- Updated schema.sql and seed.sql so fresh installs include Phase 2 structures and permission seeds.
- Added taskLabelService/controller/routes for listing, creating, updating, and deleting task labels.
- Added taskChecklistService/controller/routes for listing, creating, updating, and deleting task checklist items.
- Extended taskService task reads to include labels, label_ids, checklist_total, checklist_completed, creator/archive/completion/approval metadata.
- Extended task create/update to accept label_ids and keep label assignments synchronized with the task project.
- Added task filtering by label_id, search text, include_archived, and my_tasks=true for current login user.
- Added bulk task update endpoint POST /api/tasks/bulk-update for status, priority, bucket, archive, and unarchive actions.
- Added audit logging for task labels, task checklists, and task bulk actions.
- Added frontend task label API methods, checklist API methods, and bulk update API method.
- Added useTaskLabels hook and task label color helper.
- Added TaskLabelManager for creating and deleting labels in selected project context.
- Added label selector to TaskFormModal and label display in TaskCard and TaskDetailModal.
- Added checklist create/toggle/delete workflow in TaskDetailModal.
- Added TaskBulkToolbar and row selection support in TaskTree.
- Added MyTasksPage at /my-tasks.
- Added TaskCalendarPage at /tasks/calendar and TaskCalendarView for task due dates.
- Added Calendar tab in ProjectDetailPage.
- Updated Sidebar and Topbar navigation for My Tasks and Task Calendar.
- Restarted local frontend dev server, refreshing frontend-runtime.out.log.

Reason:
- Phase 2 in pengembangan.txt focuses on making daily work management more professional before deeper collaboration modules are built.
- Labels, checklist, My Tasks, calendar view, and bulk actions are foundational Cicle-like work management capabilities.
- The implementation preserves existing Board/List/Gantt task behavior while adding metadata and views around the same task source of truth.

Behavior impact:
- Task API responses now include label and checklist summary metadata.
- Task create/update payloads can include label_ids.
- Default task list queries exclude archived tasks unless include_archived=true is sent.
- Users now have /my-tasks for tasks where they are PIC or lead.
- Users now have /tasks/calendar for due-date calendar view.
- Project detail now has a Calendar tab.
- Bulk action can update selected task status, priority, bucket, archive state, or unarchive state.
- Checklist completion is tracked per task but does not currently alter task progress automatically.
- Labels are project-scoped; deleting a label removes its task assignments through cascade.
- Existing task progress rollup, Gantt, realization, approval, and working calendar behavior are preserved.

Progress against pengembangan.txt:
- Fase 2 - Work Management Lebih Profesional:
  Core implementation completed for task labels, task checklist, My Tasks, All Tasks filter improvements, calendar view, bulk actions, archive metadata, bucket metadata, task label/checklist API, and UI integration.
- Fase 2 items still pending:
  saved filters, column chooser, server-side pagination for very large task lists, per-bucket/list movement permission enforcement, richer checklist nesting UI, label editing UI, task export, and complete soft-archive replacement for existing delete workflows.
- Fase 3 has not started.

Verification:
- Applied migration through Node/pg:
  backend/src/database/migrations/20260522_phase2_task_labels_checklists.sql
- Ran backend syntax check:
  Get-ChildItem -Recurse -Filter *.js src | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Restarted local development services with Phase 2 code:
  Backend: http://127.0.0.1:5000
  Frontend: http://127.0.0.1:5173
- Ran live API smoke test:
  POST /api/auth/login returns HTTP 200 and token.
  GET /api/projects returns HTTP 200.
  POST /api/task-labels creates a temporary task label.
  POST /api/tasks creates a temporary task with label_ids.
  POST /api/tasks/:taskId/checklists creates a checklist item.
  PUT /api/task-checklists/:id marks the checklist item done.
  GET /api/tasks?label_id=... returns the temporary labeled task.
  GET /api/tasks?my_tasks=true returns HTTP 200.
  POST /api/tasks/bulk-update updates temporary task priority.
  GET /api/activities?project_id=... returns activity rows.
  DELETE /api/tasks/:id removes the temporary smoke task.
  DELETE /api/task-labels/:id removes the temporary smoke label.
  POST /api/auth/logout revokes the session.
- Verified frontend route:
  GET http://127.0.0.1:5173/tasks/calendar returns HTTP 200.

Known risks:
- Label creation/deletion UI is intentionally simple; label editing UI is not yet exposed even though the backend supports it.
- Checklist nesting exists in schema but the current UI only manages flat checklist items.
- Checklist completion is informational and does not update task progress automatically.
- Bulk archive exists, but existing delete buttons still use hard delete.
- Movement permission metadata exists on buckets, but enforcement is still pending.
- Task lists still fetch without server-side pagination, so very large datasets may need Phase 2 follow-up optimization.
- Calendar view groups tasks by end_date/due date and is not yet a full schedule/event module.

2026-05-22 - Enhance task calendar UI and UX
Files changed:
  frontend-runtime.out.log
  frontend/src/components/task/TaskCalendarView.jsx
  readme.txt

References researched:
  Microsoft Planner Calendar/Schedule view:
  https://support.microsoft.com/en-us/planner/training/use-schedule-view-in-microsoft-planner
  Asana Project Views and Calendar patterns:
  https://asana.com/features/project-management/project-views
  Asana calendar visual refresh and color coding:
  https://asana.com/inside-asana/asana-calendar-color-coding-task-creation
  Google Calendar view and navigation controls:
  https://support.google.com/calendar/answer/6110849?co=GENIE.Platform%3DDesktop&hl=en-GB

What changed:
- Rebuilt TaskCalendarView from a basic task calendar into a more professional scheduling workspace.
- Added month navigation with Today, previous month, next month, and current month label.
- Added a Month/Agenda segmented control so users can switch between visual calendar scanning and chronological task review.
- Added proper Monday-Sunday month grid alignment using start/end week boundaries.
- Added leading/trailing month days so the calendar layout stays stable and familiar.
- Added day selection behavior with a selected-day side agenda.
- Added highlighted today state and selected-day ring to reduce orientation friction.
- Added compact task chips inside each day cell with status/priority-driven color accents, progress percentage, and hover/focus states.
- Added due-date and priority-aware task ordering so urgent work appears before lower-priority work on the same date.
- Added visible task overflow handling with a +N more action to keep dense calendar days readable.
- Added summary tiles for this month workload, overdue tasks, unscheduled tasks, and busiest day.
- Added unscheduled task panel so tasks without dates remain visible instead of disappearing from calendar workflows.
- Added agenda mode for users who need a list-based due-date review instead of a dense month grid.
- Added responsive behavior: mobile collapses the month grid into stacked day rows while desktop keeps a true 7-column calendar.
- Updated month navigation so the selected-day agenda follows the selected month context.
- Preserved existing task click behavior by continuing to call onTaskClick for the existing TaskDetailModal.

Reason:
- User reported that several UI/UX areas still looked weak, specifically calendar.
- Microsoft Planner emphasizes calendar visibility for upcoming work, busy periods, schedule gaps, and unscheduled tasks.
- Asana emphasizes switching between project views, showing relevant task context on cards, using color to scan priority/context, and opening task details from calendar.
- Google Calendar establishes familiar navigation patterns such as Today and previous/next date controls.
- The enhancement keeps the current Phase 2 scope intact while making the calendar more usable for real daily planning.

Behavior impact:
- No backend, schema, or API contract changes.
- Calendar remains powered by the same task data returned by the current task query.
- Tasks with end_date are grouped by end_date; tasks without end_date but with start_date use start_date as fallback.
- Tasks without both start_date and end_date are now surfaced in the Unscheduled Tasks panel.
- Calendar user experience now supports workload scanning, overdue awareness, selected-day review, and agenda review.
- Existing task detail modal workflow is preserved.

Verification:
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Verified frontend route:
  GET http://127.0.0.1:5173/tasks/calendar returns HTTP 200.
- Checked frontend runtime error log:
  frontend-runtime.err.log is empty.
- Frontend dev server received Vite HMR updates while editing TaskCalendarView, refreshing frontend-runtime.out.log.

Known risks:
- Calendar does not yet support drag-and-drop date rescheduling like Microsoft Planner or Asana.
- Calendar does not yet support week/day/resource workload views.
- Inline task creation from a date cell is not yet implemented.
- Keyboard-first calendar navigation can still be improved in a later accessibility pass.
- Busiest day and overdue calculations are client-side and may need server-side aggregation if task volume becomes very large.

2026-05-22 - Implement Phase 3 task comments, mentions, read-by, and notification center
Files changed:
  backend-runtime.out.log
  backend/src/config/db.js
  backend/src/controllers/notificationController.js
  backend/src/controllers/taskCommentController.js
  backend/src/database/migrations/20260522_phase3_comments_notifications.sql
  backend/src/database/schema.sql
  backend/src/database/seed.sql
  backend/src/routes/notificationRoutes.js
  backend/src/routes/taskCommentRoutes.js
  backend/src/routes/taskRoutes.js
  backend/src/server.js
  backend/src/services/commentService.js
  backend/src/services/notificationService.js
  backend/src/services/permissionService.js
  backend/src/services/taskService.js
  frontend-runtime.out.log
  frontend/src/app/router.jsx
  frontend/src/components/layout/Sidebar.jsx
  frontend/src/components/layout/Topbar.jsx
  frontend/src/components/notification/NotificationBell.jsx
  frontend/src/components/task/CommentThread.jsx
  frontend/src/components/task/TaskDetailModal.jsx
  frontend/src/logic/services/commentApi.js
  frontend/src/logic/services/notificationApi.js
  frontend/src/pages/NotificationsPage.jsx
  readme.txt

What changed:
- Added Phase 3 migration 20260522_phase3_comments_notifications.sql.
- Enhanced task_comments with updated_at, deleted_at, and deleted_by so comments can be edited and soft-deleted.
- Added comment_mentions for explicit task comment mentions.
- Added generic read_receipts for read-by tracking, initially used by task comments.
- Added notifications for in-app notification center entries.
- Added notification_preferences as the future extension point for per-user notification preferences.
- Added indexes for task comments, mentions, read receipts, notifications, and notification preferences.
- Updated schema.sql and seed.sql so fresh database setup includes Phase 3 structures and permission seeds.
- Added role permissions and fallback permission rules for task_comment and notification resources.
- Updated verifyApplicationSchema() so backend startup validates Phase 3 tables.
- Added commentService for list/create/update/delete task comments, mention extraction, mention assignment, read receipts, activity logging, and notification creation.
- Added notificationService for creating notifications, fan-out to multiple users, unread count, listing notifications, mark-read, and mark-all-read.
- Added taskCommentController and taskCommentRoutes for comment update/delete/read endpoints.
- Added notificationController and notificationRoutes for notification center endpoints.
- Added task comment routes under /api/tasks/:taskId/comments.
- Updated server.js to register notification and task-comment routes.
- Updated taskService so task create/update assignment changes create task.assigned notifications.
- Updated taskService so Waiting Review transitions create task.waiting_review notifications for the task lead.
- Guarded Waiting Review notifications so normal edits to an already waiting task do not keep creating duplicate approval notifications.
- Updated taskService so approval creates task.approved notifications for task assignees.
- Added frontend commentApi and notificationApi service modules.
- Added CommentThread component inside TaskDetailModal with create, edit, delete, mention picker, read-by popover, and mark-read behavior.
- Added NotificationBell in Topbar with unread count polling.
- Added NotificationsPage at /notifications with All/Unread/Read filters, open project action, mark read, and mark all read.
- Added Notifications navigation to Sidebar and route title mapping in Topbar.
- Restarted backend runtime so Phase 3 routes are active.
- Frontend Vite HMR refreshed frontend-runtime.out.log while new components/routes were edited.

Reason:
- Fase 3 in pengembangan.txt focuses on turning task detail into a real work discussion space.
- Comments, mentions, read-by, and notifications reduce work communication scattered across WhatsApp or informal channels.
- Notification center is required before later realtime chat and live updates are introduced in Fase 4.
- The implementation keeps task/board/list/Gantt behavior intact while adding collaboration around existing task records.

Behavior impact:
- Users can now add comments directly inside TaskDetailModal.
- Users can mention teammates from the comment editor; mentioned users receive in-app notifications.
- Comment readers are tracked with read_receipts and visible through read-by detail in the UI.
- Comment edits and deletes are allowed for the comment owner and elevated roles.
- Deleted comments are soft-deleted and no longer shown in normal task comment lists.
- Users can open /notifications to review task comments, mentions, assignments, waiting review, and approval notifications.
- Topbar now shows an unread notification count.
- Task assignment, Waiting Review, and approval workflow now create in-app notifications.
- Existing activity log behavior is extended with task.comment.create, task.comment.update, and task.comment.delete.
- No existing task payload shape was intentionally broken.
- No realtime/socket behavior was added yet; notification count uses periodic polling.

Progress against pengembangan.txt:
- Fase 3 - Comment, Mention, Read By, Notification Center:
  Core implementation completed for task comments, mentions, read receipts, notification table/service, notification API, notification center UI, topbar unread indicator, task lifecycle notification hooks, and activity logging.
- Fase 3 items still pending:
  notification preferences UI, richer mention autocomplete/search, per-comment visibility observer, notification grouping/batching, object-level project access enforcement, unread indicators inside task list/card, dedicated inbox triage workflow, and realtime delivery.
- Fase 4 has not started.

Verification:
- Applied migration through Node/pg:
  backend/src/database/migrations/20260522_phase3_comments_notifications.sql
- Ran backend syntax check:
  Get-ChildItem -Recurse -Filter *.js src | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Restarted backend runtime:
  Backend: http://127.0.0.1:5000
- Re-ran backend syntax check and frontend production build after the duplicate Waiting Review notification guard:
  Result: success.
- Ran live API smoke test:
  POST /api/auth/login with superadmin@project-management.local returns HTTP 200 and token.
  GET /api/users returns HTTP 200.
  GET /api/tasks?tree=false&include_archived=true returns HTTP 200.
  POST /api/tasks/:taskId/comments creates a smoke comment with mention_user_ids.
  GET /api/tasks/:taskId/comments returns the created comment.
  POST /api/tasks/:taskId/comments/read creates read_receipts.
  POST /api/auth/login as mentioned user returns HTTP 200 and token.
  GET /api/notifications?status=unread for mentioned user returns the mention notification.
  PATCH /api/notifications/:id/read marks the notification read.
  DELETE /api/task-comments/:id soft-deletes the smoke comment.
  POST /api/auth/logout revokes both smoke sessions.
- After final backend restart, verified GET /api/notifications/unread-count with authenticated super admin returns HTTP 200 and unread_count 0.
- Smoke test summary:
  task_id 64, comment_id 2, mentioned user agam@modernland.co.id, comments_returned 1, read_receipts_updated 1, mention_notification_found true.
- Verified frontend routes:
  GET http://127.0.0.1:5173/notifications returns HTTP 200.
  GET http://127.0.0.1:5173/tasks returns HTTP 200.
- Checked runtime error logs:
  backend-runtime.err.log is empty.
  frontend-runtime.err.log is empty.

Known risks:
- Notification delivery is polling-based, not realtime.
- Notification rows are not grouped or deduplicated, so high activity can create many rows.
- Mention parsing from typed @text is basic; the reliable path is the explicit mention picker.
- Read-by is marked when the task comment thread loads, not when each individual comment becomes visible in viewport.
- Notification preferences are stored structurally but no user-facing settings UI exists yet.
- Comment attachment support is not included in this phase.
- Object-level project authorization is still broader role-based access from Phase 1, not fully project-scoped.

2026-05-22 - Improve task edit form UX and preserve approved task status
Files changed:
  backend-runtime.out.log
  backend/src/services/taskService.js
  frontend/src/components/task/TaskFormModal.jsx
  readme.txt

What changed:
- Reworked TaskFormModal layout from one flat two-column form into clearer sections:
  Task Detail, Structure, Schedule, Workflow, People, and Labels.
- Increased task form modal width to 2xl so edit forms from Task List have enough working space.
- Added a compact context summary at the top of the form showing mode, selected project, bucket, and lead.
- Replaced PIC dropdown with an inline selectable panel that includes selected PIC chips and search.
- Replaced label dropdown with an inline selectable panel that shows selected label chips and available labels.
- Cleared selected labels automatically when the user changes project, preventing stale cross-project label IDs.
- Removed Done from normal editable status choices unless the task is already approved Done, making the review workflow clearer.
- Added status helper text so Waiting Review and Done states are easier to understand.
- Kept parent task, project, bucket, PIC, lead, schedule, progress, status, priority, and labels payload behavior aligned with the previous form.
- Added backend resolveTaskStateForFullUpdate helper so editing a task that is already Done with progress 100 preserves Done instead of accidentally moving it back to Waiting Review.

Reason:
- User reported that the edit task form in Task List felt awkward.
- The old form mixed structure, ownership, dates, workflow, and labels in one flat grid, which made editing noisy and hard to scan.
- The old dropdown-based PIC/label selectors were cramped inside the modal and could feel unstable.
- Editing an already approved Done task through the full update path could unintentionally convert it back to Waiting Review because updateTask reused the manual completion state resolver.

Behavior impact:
- User-facing edit form is more structured and easier to scan.
- PIC and label selection now happen in visible panels instead of hidden dropdown menus.
- Done tasks can be edited for metadata/text fields without losing their approved Done status.
- Creating or editing a non-Done task to completion still follows the existing Waiting Review approval workflow.
- No schema or API route changes.

Verification:
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Ran backend syntax check:
  Get-ChildItem -Recurse -Filter *.js src | ForEach-Object { node --check $_.FullName }
  Result: success.
- Restarted backend runtime:
  Backend: http://127.0.0.1:5000
- Ran live API smoke test:
  Login as superadmin.
  Create temporary task in Waiting Review with superadmin as lead and PIC.
  Approve temporary task so raw_status becomes Done and progress becomes 100.
  Update temporary task title through PUT /api/tasks/:id.
  Confirm updated task remains raw_status Done and progress 100.
  Delete temporary smoke task.
  Logout.
- Verified frontend route:
  GET http://127.0.0.1:5173/tasks returns HTTP 200.
- Checked runtime error logs:
  backend-runtime.err.log is empty.
  frontend-runtime.err.log is empty.

Known risks:
- The form is still a modal; if task metadata keeps growing, a full-page edit experience may become more appropriate.
- Label creation still happens outside the edit modal through Task Labels manager.
- PIC and label panels are visible lists; very large user/label counts may need virtualization or server-side search later.

2026-05-22 - Group sidebar navigation into collapsible sections
Files changed:
  frontend/package.json
  frontend/package-lock.json
  frontend/src/components/layout/navigationConfig.js
  frontend/src/components/layout/Sidebar.jsx
  frontend/src/components/layout/Topbar.jsx
  readme.txt

What changed:
- Added a shared navigation configuration for sidebar groups and page metadata so sidebar and topbar no longer duplicate route labels.
- Reworked the sidebar into collapsible groups:
  Overview, Work Management, Collaboration, and Administration.
- Added per-group collapse state persisted in localStorage so the user keeps their preferred sidebar layout across reloads.
- Added lucide-react icons for sidebar groups, menu items, and the sidebar toggle button.
- Updated the topbar to show the current section label based on the active route and replaced the text-based sidebar toggle with an icon button.
- Kept all routes, access flow, and business behavior unchanged.

Reason:
- The sidebar had too many flat menu entries, which made navigation feel crowded and harder to scan.
- Grouping related menus reduces cognitive load and makes it clearer where users should go for work, collaboration, or administration tasks.
- Centralizing navigation metadata also makes future menu updates safer and easier to maintain.

Behavior impact:
- No backend, database, API, or permission changes.
- Sidebar navigation is now visually grouped and collapsible.
- The active workspace section is more visible in the topbar.
- The selected collapse state survives browser reloads on the same device.

Verification:
- Ran frontend dependency install:
  cd frontend
  npm install lucide-react
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.

Known risks:
- Any future route additions should be registered in the shared navigation config so sidebar grouping and topbar titles stay aligned.
- Very small screens still rely on the existing mobile navigation shortcuts, since the full sidebar remains desktop-only.

2026-05-22 - Replace notification shortcut label with bell icon
Files changed:
  frontend/src/components/notification/NotificationBell.jsx
  readme.txt

What changed:
- Replaced the notification shortcut text marker with a lucide-react Bell icon.
- Kept the unread count badge and notification link behavior unchanged.
- Added an accessible aria-label to the notification shortcut.

Reason:
- The previous single-letter marker was unclear and did not visually read as a notification control.
- A bell icon is a more familiar and faster-to-scan affordance for the notification center.

Behavior impact:
- No backend, database, API, or routing changes.
- The button now communicates its function more clearly in the topbar.
- Notification unread badge and navigation behavior remain the same.

Verification:
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.

Known risks:
- None beyond the existing notification polling behavior.

2026-05-22 - Move task label master management to Projects page
Files changed:
  frontend/src/components/task/TaskLabelManager.jsx
  frontend/src/pages/MyTasksPage.jsx
  frontend/src/pages/ProjectsPage.jsx
  frontend/src/pages/TaskListPage.jsx
  readme.txt

What changed:
- Removed the TaskLabelManager panel from TaskListPage so Task List is focused on task execution, filtering, and bulk actions.
- Removed the unused showLabelManager prop from MyTasksPage usage.
- Added a Master Task Labels panel to ProjectsPage.
- Added a project selector inside ProjectsPage label management so labels remain managed per project.
- Kept the master label project selector independent from the visible project card filters, so labels can be managed for any project from the Projects menu.
- Updated TaskLabelManager so it can render as embedded content without creating a nested card.

Reason:
- User requested master label creation to move out of Task List and into the Projects menu.
- Labels are project-scoped metadata, so Projects is a clearer ownership location than the task execution list.
- Keeping Task List focused on operational task work reduces UI noise and avoids confusing master-data management with daily execution.

Behavior impact:
- No backend, database, API, permission, task, or label contract changes.
- Users now create and delete task labels from Projects.
- Task List still uses labels for filtering and task forms, but no longer exposes master label creation.
- Existing label assignments and project-scoped label behavior are preserved.

Verification:
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.

Known risks:
- ProjectsPage now makes a separate project-list request for the master label selector so label management is not constrained by portfolio filters.

2026-05-22 - Add initial performance report module
Files changed:
  backend/src/controllers/performanceController.js
  backend/src/routes/performanceRoutes.js
  backend/src/server.js
  backend/src/services/performanceService.js
  frontend/src/app/router.jsx
  frontend/src/components/layout/navigationConfig.js
  frontend/src/logic/services/performanceApi.js
  frontend/src/pages/PerformancePage.jsx
  readme.txt

What changed:
- Added backend performance report endpoints under /api/performance:
  GET /api/performance/users
  GET /api/performance/users/:userId
  GET /api/performance/departments
  GET /api/performance/bottlenecks
  GET /api/performance/export
- Added performanceService to aggregate assigned tasks per user from task_assignees and legacy tasks.assignee_id without double-counting the same user-task pair.
- Added period, department, and project filters for backend performance calculations.
- Added transparent score calculation using base score, completed bonus, healthy in-progress bonus, overdue penalty, stale penalty, and no-due-date penalty.
- Added rating output:
  Bagus for score >= 80.
  Cukup for score >= 60 and < 80.
  Kurang for score < 60.
  No Data when the user has no assigned task in the selected period.
- Added automatic recommendations for high overdue, not-started, waiting-review, stale, and no-due-date ratios.
- Added bottleneck detection for overdue, stale in-progress, waiting-review, and no-deadline tasks.
- Added CSV export for the user performance list.
- Added frontend Performance Report page at /performance with period filter, department filter, summary metrics, user table, user detail, score formula breakdown, category task drill-down, department summary, top bottleneck list, and CSV export.
- Added Performance menu item to the Work Management sidebar group and page metadata.

Reason:
- The roadmap identifies performance report as a high-value management feature after task execution, approval, activity, comments, notifications, labels, and checklist data are available.
- Management needs a transparent per-user report that converts existing task data into score, rating, recommendations, and bottleneck visibility without manual recap.
- The score formula intentionally shows raw counts and components so the rating is not treated as a hidden or punitive black box.

Behavior impact:
- No existing task, project, Gantt, comment, notification, approval, or label behavior changed.
- Authenticated users with read permission can access the new performance endpoints through the existing permission middleware.
- Performance report includes active users; users without task data are shown as No Data instead of being penalized.
- A task assigned through both task_assignees and the legacy assignee_id column is counted once for that user.
- Bottleneck and overdue calculations use the selected report end date as the report cutoff.
- CSV export returns text/csv instead of the standard JSON response wrapper by design.

Verification:
- Ran backend syntax checks:
  cd backend
  node --check src/services/performanceService.js
  node --check src/controllers/performanceController.js
  node --check src/routes/performanceRoutes.js
  node --check src/server.js
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
- Ran performance service database validation:
  cd backend
  node -e "...getPerformanceUsers and getPerformanceBottlenecks..."
  Result: {"users":16,"total_tasks":29,"bottlenecks":3}
- Ran department, user detail, and CSV validation:
  cd backend
  node -e "...getDepartmentPerformance, getUserPerformance, getPerformanceExport..."
  Result: {"departments":7,"user":"Rey","csv_bytes":2507}
- Restarted backend on:
  http://localhost:5000
- Tested authenticated HTTP endpoint:
  POST http://localhost:5000/api/auth/login
  GET http://localhost:5000/api/performance/users
  GET http://localhost:5000/api/performance/bottlenecks?limit=2
  Result: users=16, total_tasks=29, bottlenecks=2.
- Tested frontend route:
  GET http://localhost:5173/performance
  Result: HTTP 200.

Known risks:
- The first version calculates report data live from task tables; very large datasets may later need materialized snapshots or indexed reporting tables.
- The formula is intentionally simple and should be reviewed with business stakeholders before being used as a formal HR evaluation.
- Export is CSV only; Excel/PDF export remains future work.

2026-05-22 - Implement Phase 4 realtime update and project chat
Files changed:
  backend/package.json
  backend/package-lock.json
  backend/src/config/db.js
  backend/src/controllers/chatController.js
  backend/src/database/migrations/20260522_phase4_realtime_chat.sql
  backend/src/database/schema.sql
  backend/src/database/seed.sql
  backend/src/routes/chatRoutes.js
  backend/src/server.js
  backend/src/services/chatService.js
  backend/src/services/commentService.js
  backend/src/services/notificationService.js
  backend/src/services/permissionService.js
  backend/src/services/realtimeService.js
  backend/src/services/taskService.js
  frontend/package.json
  frontend/package-lock.json
  frontend-runtime.out.log
  frontend/src/app/App.jsx
  frontend/src/components/chat/ChatRoomList.jsx
  frontend/src/components/chat/ChatWindow.jsx
  frontend/src/components/chat/ProjectChatTab.jsx
  frontend/src/components/notification/NotificationBell.jsx
  frontend/src/components/realtime/RealtimeBridge.jsx
  frontend/src/components/task/CommentThread.jsx
  frontend/src/logic/hooks/useTasks.js
  frontend/src/logic/services/chatApi.js
  frontend/src/logic/services/realtimeApi.js
  frontend/src/pages/NotificationsPage.jsx
  frontend/src/pages/ProjectDetailPage.jsx
  readme.txt

What changed:
- Reviewed readme.txt and pengembangan.txt before implementation.
- Confirmed current roadmap status:
  Fase 1 core implementation already completed for auth, session, RBAC, and activity audit.
  Fase 2 core implementation already completed for My Tasks, task labels, checklists, calendar view, and bulk actions.
  Fase 3 core implementation already completed for comments, mentions, read-by, notifications, and notification center.
  Fase 4 had not started before this change.
  Fase 7 initial performance report had already been added earlier, out of roadmap order, and was left intact because it does not change old behavior.
- Added backend dependency socket.io.
- Added frontend dependency socket.io-client.
- Added Phase 4 migration 20260522_phase4_realtime_chat.sql.
- Added chat_rooms, chat_room_members, and chat_messages tables.
- Added chat read receipt support using existing read_receipts with object_type = chat_message.
- Added indexes, project-chat uniqueness, updated_at trigger, and chat role permissions.
- Updated schema.sql and seed.sql so fresh database setup includes Phase 4 chat structures and permissions.
- Updated verifyApplicationSchema so backend startup validates chat tables.
- Changed backend server startup from Express app.listen to an HTTP server shared by Express and Socket.IO.
- Added realtimeService with socket auth using the existing Bearer session token.
- Socket connections now join user:<id>, department:<id>, project:<id>, and chat:<roomId> rooms where the user has access.
- Added socket join handlers for project:join, task:join, and chat:join.
- Added chatService, chatController, and chatRoutes under /api/chat:
  GET /api/chat/rooms
  POST /api/chat/rooms
  GET /api/chat/rooms/:roomId/messages
  POST /api/chat/rooms/:roomId/messages
  POST /api/chat/rooms/:roomId/read
  PATCH /api/chat/messages/:id
  DELETE /api/chat/messages/:id
  POST /api/chat/messages/:id/read
- Project chat room is created automatically when the project chat tab is opened.
- Project chat members are synchronized from project owner, project_members, task assignees, task lead, task creator, and the current user.
- Chat message creation logs activity, marks the sender read, creates chat.message notifications for other members, and emits chat.message.created.
- Chat read receipt updates emit chat.message.read.
- Notification creation now emits notification.created to the target user room.
- Task comment creation now emits comment.created to project and task rooms.
- Task comment read updates now emit comment.read.
- Task create/update/status/progress/realization/approval/parent/bulk changes now emit task.updated.
- Task board move now emits task.moved.
- Added frontend realtimeApi singleton for Socket.IO client connection.
- Added RealtimeBridge so authenticated users connect once after login and dispatch realtime:* browser events.
- NotificationBell now refreshes unread count immediately on notification.created while keeping polling fallback.
- NotificationsPage now refreshes immediately on notification.created.
- CommentThread now joins the active task socket room and refreshes on comment.created/comment.read events.
- useTasks and useProjectTasks now refresh on task.updated/task.moved events.
- Added Chat tab in ProjectDetailPage.
- Added ProjectChatTab, ChatRoomList, and ChatWindow components for project chat, message composer, read-by summary, delete action, and realtime refresh.

Reason:
- Fase 4 in pengembangan.txt requires realtime update and project chat after comment, notification, auth, permission, and audit foundations are available.
- Realtime delivery reduces manual refresh for board movement, task updates, comments, notifications, and chat.
- Project chat gives each project a focused coordination channel without replacing task as the source of truth.

Behavior impact:
- Existing REST API behavior remains available; Socket.IO is additive.
- Existing polling notification behavior remains as fallback.
- Opening a project Chat tab can create a project chat room if one does not exist.
- Sending chat messages creates in-app notifications for other room members.
- Users connected through Socket.IO receive realtime events for notification, comment, task, and chat changes.
- Project board/list data can refresh automatically when another user moves or updates tasks.
- Chat messages are soft-deleted when deleted.
- No Gantt calculation, task progress rollup, approval, label, checklist, project, or performance report behavior was intentionally changed.

Progress against pengembangan.txt:
- Fase 4 - Realtime Update dan Project Chat:
  Core implementation completed for Socket.IO dependency, HTTP server wiring, socket auth, socket rooms, chat tables, chat service/routes, project chat UI, realtime notification events, realtime comment events, realtime task update/move events, realtime chat message events, and chat read receipts.
- Fase 4 items still pending:
  private chat, department/company chat UI, message edit UI, richer member management UI, typing indicators, online presence, unread indicators inside sidebar/project cards, attachment/media support, and multi-browser manual verification with two real logged-in users.

Verification:
- Installed backend dependency:
  cd backend
  npm install socket.io
- Installed frontend dependency:
  cd frontend
  npm install socket.io-client
- Ran backend syntax check:
  cd backend
  Get-ChildItem -Recurse -Filter *.js src | ForEach-Object { node --check $_.FullName }
  Result: success.
- Ran frontend production build:
  cd frontend
  npm run build
  Result: success.
  Note: Vite warns that one generated chunk is larger than 500 kB after minification.
- Applied migration through Node/pg:
  backend/src/database/migrations/20260522_phase4_realtime_chat.sql
  Result: phase4 migration applied.
- Restarted backend runtime:
  Backend: http://localhost:5000
- Restarted frontend runtime:
  Frontend: http://localhost:5173
- Ran backend production dependency audit:
  cd backend
  npm audit --omit=dev
  Result: found 0 vulnerabilities.
- Ran frontend production dependency audit:
  cd frontend
  npm audit --omit=dev
  Result: found 0 vulnerabilities.
- Ran live chat REST smoke test:
  POST /api/auth/login returns HTTP 200 and token.
  GET /api/projects returns project list.
  POST /api/chat/rooms creates or returns project chat room.
  POST /api/chat/rooms/:roomId/messages creates a chat message.
  GET /api/chat/rooms/:roomId/messages returns the message.
  POST /api/chat/rooms/:roomId/read creates chat read receipts.
  Result: project_id=26, room_id=1, message_id=1, messages=1, read_updated=1.
- Ran Socket.IO auth smoke test:
  Connect with login token.
  Server emits realtime.connected.
  chat:join for room 1 returns success.
- Ran Socket.IO event smoke test:
  Connect with login token.
  Join chat room 1.
  POST a chat message via REST.
  Client receives chat.message.created.
  Result: {"room_id":1,"message_id":2}
- Tested frontend project route:
  GET http://localhost:5173/projects/26
  Result: HTTP 200.

Known risks:
- Realtime smoke test was automated with one authenticated user; full acceptance still needs two browser sessions with two users.
- Project chat membership is synchronized from current project/task participation, but there is no manual member management UI yet.
- Chat messages currently support text only; attachments/media are future work.
- Socket.IO adds runtime state; production deployment will need sticky sessions or a Socket.IO adapter if scaled beyond one Node process.
- The frontend bundle is now above Vite's default chunk warning threshold; code splitting should be considered during production hardening.


Required future change log format
---------------------------------
When changing this project, append a new entry under "Change log" using this structure:

YYYY-MM-DD - Short change title
Files changed:
  path/to/file

What changed:
- Specific technical changes.

Reason:
- Why the change was needed.

Behavior impact:
- Runtime or user-facing impact.
- Data/API/schema impact if any.

Verification:
- Commands run.
- Endpoints tested.
- Manual checks performed.

Known risks:
- Any limitations, untested paths, or follow-up work.


2026-05-22 - Temporary public Cloudflare tunnel for remote access
Files changed:
  frontend/vite.config.js
  readme.txt

Files created or generated:
  .tools/cloudflared.exe
  cloudflared-backend.err.log
  cloudflared-frontend.err.log
  frontend-runtime.out.log

What changed:
- Downloaded portable Cloudflare Tunnel binary to `.tools/cloudflared.exe`.
- Started a temporary Cloudflare quick tunnel from the public internet to the local backend:
  https://percentage-reasoning-officially-cheque.trycloudflare.com -> http://localhost:5000
- Started a temporary Cloudflare quick tunnel from the public internet to the local frontend:
  https://assets-something-journal-ellis.trycloudflare.com -> http://localhost:5173
- Restarted backend with:
  FRONTEND_URL=https://assets-something-journal-ellis.trycloudflare.com
- Restarted frontend with:
  VITE_API_BASE_URL=https://percentage-reasoning-officially-cheque.trycloudflare.com/api
  VITE_SOCKET_URL=https://percentage-reasoning-officially-cheque.trycloudflare.com
- Updated Vite dev server config to listen on `0.0.0.0`, use port `5173`, and allow `.trycloudflare.com` hosts.

Reason:
- The application needed a temporary public link so a remote user outside the local network can access the frontend and send updates to the local backend/database.

Behavior impact:
- Remote users can open the public frontend URL and use the app through the internet while the local PC, backend, frontend dev server, PostgreSQL, and both Cloudflare tunnel processes are running.
- Data created or updated through the public frontend still goes through the local Express backend and is saved into the local PostgreSQL database configured in `backend/.env`.
- No database schema or API contract was changed for this tunnel setup.

Verification:
- Confirmed local backend listener on port `5000`.
- Confirmed local frontend listener on port `5173`.
- Confirmed Cloudflare tunnel processes are running.
- Tested public frontend URL:
  GET https://assets-something-journal-ellis.trycloudflare.com/
  Result: HTTP 200.
- Tested backend CORS preflight from public frontend origin:
  OPTIONS https://percentage-reasoning-officially-cheque.trycloudflare.com/api/auth/login
  Result: HTTP 204 with Access-Control-Allow-Origin set to the public frontend URL.
- Earlier smoke testing also confirmed public backend login and frontend environment variables pointed to the public backend/socket URL.

Known risks:
- This is a temporary development tunnel, not a production deployment.
- The public URLs are valid only while the related `cloudflared` processes keep running.
- The link stops working if the PC/server is turned off, internet disconnects, backend stops, frontend dev server stops, PostgreSQL stops, or the tunnel processes stop.
- Anyone who has the frontend URL can reach the login page, so do not share it broadly.
- For production use, replace this with a proper deployment using a domain, HTTPS, secure authentication, database backup, firewall rules, and managed process supervision.


2026-05-22 - Roll back public tunnel and return to local network access
Files changed:
  frontend/vite.config.js
  readme.txt

Files removed:
  .tools/cloudflared.exe
  cloudflared-backend.err.log
  cloudflared-backend.log
  cloudflared-frontend.err.log
  cloudflared-frontend.log

What changed:
- Stopped the temporary Cloudflare Tunnel processes that exposed the local frontend and backend to the public internet.
- Removed the portable Cloudflare Tunnel binary and generated tunnel log files.
- Removed the Vite `allowedHosts` entry for `.trycloudflare.com`.
- Kept Vite listening on `0.0.0.0:5173` so the app can still be opened from another device on the same local network.
- Restarted the backend and frontend for LAN-only usage.

Reason:
- User requested cancelling the public remote link and using local network access only through:
  http://192.168.34.48:5173/

Behavior impact:
- The app is no longer intentionally exposed through the public Cloudflare URLs.
- Devices on the same local network can open `http://192.168.34.48:5173/`.
- When opened through `192.168.34.48`, the frontend API and realtime clients derive the backend address from the browser hostname and call:
  http://192.168.34.48:5000/api
  http://192.168.34.48:5000
- Data updates still go into the same local PostgreSQL database through the local Express backend.

Verification:
- Confirmed no `cloudflared` process is running.
- Confirmed local frontend listener on `0.0.0.0:5173`.
- Confirmed local backend listener on port `5000`.
- Tested frontend LAN URL:
  GET http://192.168.34.48:5173/
  Result: HTTP 200.
- Tested backend health through LAN IP:
  GET http://192.168.34.48:5000/
  Result: HTTP 200.
- Tested backend CORS preflight from LAN frontend origin:
  OPTIONS http://192.168.34.48:5000/api/auth/login
  Origin: http://192.168.34.48:5173
  Result: HTTP 204 with Access-Control-Allow-Origin set to the LAN frontend URL.
- Tested login through LAN backend URL:
  POST http://192.168.34.48:5000/api/auth/login
  Result: HTTP 200 with token.

Known risks:
- This LAN URL only works for devices that can reach the same local network or VPN.
- Windows Firewall, antivirus firewall, router isolation, or a changed local IP can block access.
- If the PC/server, PostgreSQL, backend, or frontend dev server stops, the LAN link stops working.
- For stable internal usage, reserve a fixed local IP or DHCP reservation for this machine.
