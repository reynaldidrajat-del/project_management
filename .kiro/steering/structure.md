# Project Structure

## Root Organization

```
project-management-app/
├── backend/           # Express REST API
├── frontend/          # React + Vite UI
├── .gitignore
├── readme.txt         # Technical handoff and change log
└── AGENTS.md
```

## Backend Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                    # PostgreSQL connection and schema validation
│   ├── controllers/                 # Request handlers (thin layer)
│   │   ├── authController.js
│   │   ├── projectController.js
│   │   ├── taskController.js
│   │   ├── bucketController.js
│   │   ├── userController.js
│   │   ├── departmentController.js
│   │   ├── locationController.js
│   │   ├── calendarController.js
│   │   ├── ganttController.js
│   │   ├── dashboardController.js
│   │   ├── notificationController.js
│   │   ├── activityController.js
│   │   ├── chatController.js
│   │   ├── taskCommentController.js
│   │   ├── taskChecklistController.js
│   │   ├── taskLabelController.js
│   │   └── performanceController.js
│   ├── services/                    # Business logic layer
│   │   ├── authService.js
│   │   ├── projectService.js
│   │   ├── taskService.js
│   │   ├── calendarService.js
│   │   ├── ganttService.js
│   │   ├── dashboardService.js
│   │   └── realtimeService.js       # Socket.io initialization
│   ├── routes/                      # Express route definitions
│   │   ├── authRoutes.js
│   │   ├── projectRoutes.js
│   │   ├── taskRoutes.js
│   │   └── ... (mirrors controllers)
│   ├── middlewares/
│   │   ├── authMiddleware.js        # authenticateRequest
│   │   └── permissionMiddleware.js  # RBAC checks
│   ├── utils/
│   │   ├── responseUtils.js         # sendSuccess, sendError, asyncHandler
│   │   ├── dateUtils.js
│   │   └── workdayUtils.js
│   ├── database/
│   │   ├── schema.sql               # Complete database schema
│   │   ├── seed.sql                 # Sample data (TRUNCATES tables)
│   │   └── migrations/              # SQL migration files
│   └── server.js                    # Application entry point
├── .env                             # Database and port configuration
├── package.json
└── package-lock.json
```

## Frontend Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── App.jsx                  # Root component
│   │   └── router.jsx               # Route configuration
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MainLayout.jsx       # App shell with sidebar/topbar
│   │   │   ├── Sidebar.jsx
│   │   │   └── Topbar.jsx
│   │   ├── board/
│   │   │   └── BoardView.jsx        # Drag-and-drop board (dnd-kit)
│   │   ├── task/
│   │   │   ├── TaskFormModal.jsx
│   │   │   ├── TaskDetailModal.jsx
│   │   │   └── TaskTree.jsx         # Nested task list
│   │   ├── gantt/
│   │   │   ├── GanttChart.jsx       # Custom Gantt implementation
│   │   │   ├── GanttRow.jsx
│   │   │   ├── GanttTreeRow.jsx
│   │   │   ├── GanttTimelineHeader.jsx
│   │   │   ├── GanttFilters.jsx
│   │   │   └── GanttQuickResume.jsx
│   │   └── project/
│   │       ├── ProjectFormModal.jsx
│   │       ├── ProjectHeader.jsx
│   │       └── BucketManager.jsx
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── ProjectsPage.jsx
│   │   ├── ProjectDetailPage.jsx    # Tabs: Board, List, Gantt, Activity
│   │   ├── BoardPage.jsx
│   │   ├── TaskListPage.jsx
│   │   ├── GanttPage.jsx            # Project-level Gantt
│   │   ├── DepartmentGanttPage.jsx  # Department-level Gantt
│   │   ├── TeamPage.jsx             # User management
│   │   ├── LocationsPage.jsx        # Business unit management
│   │   ├── CalendarSettingsPage.jsx # Holiday/working day exceptions
│   │   └── SettingsPage.jsx         # Department management
│   ├── logic/
│   │   ├── services/                # API client wrappers
│   │   │   ├── api.js               # Axios instance with interceptors
│   │   │   ├── authApi.js
│   │   │   ├── projectApi.js
│   │   │   ├── taskApi.js
│   │   │   ├── departmentApi.js
│   │   │   ├── userApi.js
│   │   │   ├── locationApi.js
│   │   │   ├── calendarApi.js
│   │   │   ├── ganttApi.js
│   │   │   └── dashboardApi.js
│   │   ├── hooks/                   # React Query-style hooks
│   │   │   ├── useProjects.js
│   │   │   ├── useTasks.js
│   │   │   ├── useDepartments.js
│   │   │   ├── useLocations.js
│   │   │   ├── useUsers.js
│   │   │   └── useCalendar.js
│   │   ├── helpers/
│   │   │   ├── dateHelper.js
│   │   │   ├── ganttHelper.js
│   │   │   ├── taskTreeHelper.js
│   │   │   └── statusHelper.js
│   │   └── constants/
│   │       ├── status.js
│   │       ├── priority.js
│   │       └── colors.js
│   ├── store/                       # Zustand stores
│   │   ├── projectStore.js
│   │   ├── taskStore.js
│   │   └── uiStore.js
│   ├── styles/
│   │   └── index.css                # Tailwind imports and custom styles
│   └── main.jsx                     # React entry point
├── .env                             # VITE_API_BASE_URL
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── package-lock.json
```

## Database Schema Organization

**Core Tables**:
- `departments` - Department master data
- `locations` - Business unit/location master data
- `users` - User accounts with department and location
- `auth_sessions` - Session tokens
- `password_reset_tokens` - Password reset flow
- `role_permissions` - RBAC permission rules

**Project & Task Tables**:
- `projects` - Project master data
- `project_members` - Many-to-many project membership
- `buckets` - Project-specific task groupings
- `tasks` - Task data with self-referencing parent_task_id
- `task_assignees` - Many-to-many task assignments
- `task_comments` - Task discussion threads
- `comment_mentions` - @mentions in comments
- `task_attachments` - File references
- `task_labels` - Project-specific labels
- `task_label_assignments` - Many-to-many task labels
- `task_checklists` - Nested checklist items

**Activity & Notifications**:
- `activity_logs` - Audit trail
- `notifications` - User notifications
- `notification_preferences` - Per-user notification settings
- `read_receipts` - Generic read tracking

**Chat**:
- `chat_rooms` - Project/department/private/company rooms
- `chat_room_members` - Room membership
- `chat_messages` - Messages with threading

**Calendar**:
- `calendar_exceptions` - Holiday and working day overrides

## Key Architectural Patterns

### Backend Layering

1. **Routes** - Define HTTP endpoints, apply middleware
2. **Controllers** - Parse request, call service, format response
3. **Services** - Business logic, database queries, calculations
4. **Utils** - Shared helpers (response formatting, date calculations)

### Frontend Layering

1. **Pages** - Route-level components, layout composition
2. **Components** - Reusable UI elements
3. **Logic/Services** - API calls (Axios wrappers)
4. **Logic/Hooks** - Data fetching and state management
5. **Store** - Global UI state (Zustand)
6. **Logic/Helpers** - Pure functions for calculations

### Data Flow

**Task Updates**:
```
User Action → Component → API Service → Backend Route → Controller → Service → Database
                                                                          ↓
                                                                    Recalculation
                                                                          ↓
Response ← Component ← API Service ← Backend Route ← Controller ← Service
```

**Real-time Updates**:
```
Backend Event → Socket.io → Frontend Listener → Store Update → Component Re-render
```

## Important Conventions

### Backend

- Controllers use `asyncHandler` wrapper for error handling
- All responses use `sendSuccess` or `sendError` from responseUtils
- Services contain all database queries and business logic
- Activity context extracted via `getRequestActivityContext(req)`
- Task/project recalculation happens in services after mutations

### Frontend

- API services return unwrapped data (not full Axios response)
- Hooks manage loading/error states
- Components receive data via props or hooks, not direct API calls
- Modal components control their own open/close state
- Date formatting uses date-fns consistently

### Naming

- Backend files: camelCase (e.g., `taskController.js`)
- Frontend components: PascalCase (e.g., `TaskFormModal.jsx`)
- Database tables: snake_case (e.g., `task_assignees`)
- API endpoints: kebab-case (e.g., `/api/task-comments`)

## Migration Files

Located in `backend/src/database/migrations/`, named with date prefix:
- `20260429_*.sql` - Initial feature migrations
- `20260430_*.sql` - Parent task rollup and bucket imports
- `20260519_*.sql` - Location and auth enhancements
- `20260521_*.sql` - Phase 1: Auth, RBAC, activity
- `20260522_*.sql` - Phase 2-4: Labels, checklists, comments, notifications, chat

Migrations are idempotent and can be re-run safely.
