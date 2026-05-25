import { Navigate, Route, Routes } from 'react-router-dom';

import BoardPage from '../pages/BoardPage';
import CalendarSettingsPage from '../pages/CalendarSettingsPage';
import DashboardPage from '../pages/DashboardPage';
import DepartmentGanttPage from '../pages/DepartmentGanttPage';
import GanttPage from '../pages/GanttPage';
import LocationsPage from '../pages/LocationsPage';
import MyTasksPage from '../pages/MyTasksPage';
import NotificationsPage from '../pages/NotificationsPage';
import PerformancePage from '../pages/PerformancePage';
import ProjectDetailPage from '../pages/ProjectDetailPage';
import ProjectsPage from '../pages/ProjectsPage';
import SettingsPage from '../pages/SettingsPage';
import TaskCalendarPage from '../pages/TaskCalendarPage';
import TaskListPage from '../pages/TaskListPage';
import TeamPage from '../pages/TeamPage';

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
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/performance" element={<PerformancePage />} />
      <Route path="/gantt" element={<GanttPage />} />
      <Route path="/departments/gantt" element={<DepartmentGanttPage />} />
      <Route path="/team" element={<TeamPage />} />
      <Route path="/locations" element={<LocationsPage />} />
      <Route path="/calendar" element={<CalendarSettingsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRouter;
