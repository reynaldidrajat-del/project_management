import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const BacklogPage = lazy(() => import('../pages/BacklogPage'));
const BoardConfigurationPage = lazy(() => import('../pages/BoardConfigurationPage'));
const BoardPage = lazy(() => import('../pages/BoardPage'));
const CalendarSettingsPage = lazy(() => import('../pages/CalendarSettingsPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const DepartmentGanttPage = lazy(() => import('../pages/DepartmentGanttPage'));
const GanttPage = lazy(() => import('../pages/GanttPage'));
const ImportIssuesPage = lazy(() => import('../pages/ImportIssuesPage'));
const IssueTypesPage = lazy(() => import('../pages/IssueTypesPage'));
const JQLSearchPage = lazy(() => import('../pages/JQLSearchPage'));
const LocationsPage = lazy(() => import('../pages/LocationsPage'));
const MyTasksPage = lazy(() => import('../pages/MyTasksPage'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const PerformancePage = lazy(() => import('../pages/PerformancePage'));
const ProjectDetailPage = lazy(() => import('../pages/ProjectDetailPage'));
const ProjectsPage = lazy(() => import('../pages/ProjectsPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const RoadmapPage = lazy(() => import('../pages/RoadmapPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const SprintBoardPage = lazy(() => import('../pages/SprintBoardPage'));
const TaskCalendarPage = lazy(() => import('../pages/TaskCalendarPage'));
const TaskListPage = lazy(() => import('../pages/TaskListPage'));
const TeamPage = lazy(() => import('../pages/TeamPage'));
const AutomationRulesPage = lazy(() => import('../pages/AutomationRulesPage'));
const WorkflowDesignerPage = lazy(() => import('../pages/WorkflowDesignerPage'));

const pageFallback = (
  <div className="page-shell">
    <div className="card p-6 text-text-muted">Loading page...</div>
  </div>
);

const renderLazyPage = (Page, label) => (
  <Suspense fallback={<div className="page-shell"><div className="card p-6 text-text-muted">Loading {label}...</div></div>}>
    <Page />
  </Suspense>
);

// Mengatur URL mana yang membuka halaman tertentu di frontend.
function AppRouter() {
  return (
    <Suspense fallback={pageFallback}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/board" element={<BoardPage />} />
        <Route path="/projects/:projectId/list" element={<TaskListPage />} />
        <Route path="/projects/:projectId/gantt" element={<GanttPage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/my-tasks" element={<MyTasksPage />} />
        <Route path="/tasks/calendar" element={<TaskCalendarPage />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/sprints" element={<SprintBoardPage />} />
        <Route path="/jql" element={<JQLSearchPage />} />
        <Route path="/import" element={<ImportIssuesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/reports" element={renderLazyPage(ReportsPage, 'reports')} />
        <Route path="/gantt" element={<GanttPage />} />
        <Route path="/departments/gantt" element={<DepartmentGanttPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/issue-types" element={<IssueTypesPage />} />
        <Route path="/workflows" element={<WorkflowDesignerPage />} />
        <Route path="/board-configuration" element={<BoardConfigurationPage />} />
        <Route path="/automation" element={renderLazyPage(AutomationRulesPage, 'automation rules')} />
        <Route path="/locations" element={<LocationsPage />} />
        <Route path="/calendar" element={<CalendarSettingsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default AppRouter;
