import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import BoardPage from '../pages/BoardPage';
import BacklogPage from '../pages/BacklogPage';
import BoardConfigurationPage from '../pages/BoardConfigurationPage';
import CalendarSettingsPage from '../pages/CalendarSettingsPage';
import DashboardPage from '../pages/DashboardPage';
import DepartmentGanttPage from '../pages/DepartmentGanttPage';
import GanttPage from '../pages/GanttPage';
import IssueTypesPage from '../pages/IssueTypesPage';
import JQLSearchPage from '../pages/JQLSearchPage';
import LocationsPage from '../pages/LocationsPage';
import MyTasksPage from '../pages/MyTasksPage';
import NotificationsPage from '../pages/NotificationsPage';
import PerformancePage from '../pages/PerformancePage';
import ProjectDetailPage from '../pages/ProjectDetailPage';
import ProjectsPage from '../pages/ProjectsPage';
import RoadmapPage from '../pages/RoadmapPage';
import SettingsPage from '../pages/SettingsPage';
import SprintBoardPage from '../pages/SprintBoardPage';
import TaskCalendarPage from '../pages/TaskCalendarPage';
import TaskListPage from '../pages/TaskListPage';
import TeamPage from '../pages/TeamPage';
import WorkflowDesignerPage from '../pages/WorkflowDesignerPage';

const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const AutomationRulesPage = lazy(() => import('../pages/AutomationRulesPage'));
const ImportIssuesPage = lazy(() => import('../pages/ImportIssuesPage'));

const renderLazyPage = (Page, label) => (
  <Suspense fallback={<div className="page-shell"><div className="card p-6 text-text-muted">Loading {label}...</div></div>}>
    <Page />
  </Suspense>
);

// Mengatur URL mana yang membuka halaman tertentu di frontend.
function AppRouter() {
  return (
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
      <Route path="/import" element={renderLazyPage(ImportIssuesPage, 'import issues')} />
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
  );
}

export default AppRouter;
