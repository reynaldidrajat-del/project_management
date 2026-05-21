import { useEffect, useState } from 'react';

import ProjectProgressCard from '../components/dashboard/ProjectProgressCard';
import SummaryCard from '../components/dashboard/SummaryCard';
import TaskStatusChart from '../components/dashboard/TaskStatusChart';
import { useProjects } from '../logic/hooks/useProjects';
import { getApiErrorMessage } from '../logic/services/api';
import { getDashboardSummary } from '../logic/services/dashboardApi';

// Halaman dashboard untuk menampilkan ringkasan kesehatan project dan task.
function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { projects } = useProjects();

  useEffect(() => {
    // Mengambil ringkasan dashboard dari API saat halaman dibuka.
    const fetchSummary = async () => {
      setLoading(true);
      setError('');

      try {
        setSummary(await getDashboardSummary());
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return <div className="card p-6 text-text-muted">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="card p-6 text-danger">{error}</div>;
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Overview</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Ringkasan portofolio project, progres pekerjaan, risiko overdue, dan beban lintas department.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Total Projects" value={summary?.total_projects} helper={`${summary?.active_projects || 0} active`} />
        <SummaryCard label="Total Tasks" value={summary?.total_tasks} tone="slate" />
        <SummaryCard label="Done" value={summary?.done_tasks} tone="green" />
        <SummaryCard label="Overdue" value={summary?.overdue_tasks} tone="red" />
        <SummaryCard label="Avg Progress" value={`${summary?.average_progress || 0}%`} tone="blue" />
        <SummaryCard label="Due This Week" value={summary?.tasks_due_this_week} tone="amber" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="card p-4">
          <div className="section-header">
            <div>
              <h2 className="section-title">Project Progress</h2>
              <p className="section-subtitle">Progress dihitung dari task utama dan subtask turunannya.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {projects.slice(0, 6).map((project) => (
              <ProjectProgressCard key={project.id} project={project} />
            ))}
          </div>
        </div>

        <TaskStatusChart rows={summary?.tasks_by_status || []} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-4">
          <div className="section-header">
            <div>
              <h3 className="section-title">Involved Projects by Department</h3>
              <p className="section-subtitle">Project yang melibatkan user dari masing-masing department.</p>
            </div>
          </div>
          <div className="space-y-2">
            {(summary?.projects_by_department || []).map((row) => (
              <div key={row.department_id} className="info-tile flex justify-between text-sm">
                <span>{row.department_name}</span>
                <strong>{row.total_projects}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="section-header">
            <div>
              <h3 className="section-title">Overdue by Department</h3>
              <p className="section-subtitle">Task overdue berdasarkan department PIC.</p>
            </div>
          </div>
          <div className="space-y-2">
            {(summary?.overdue_by_department || []).map((row) => (
              <div key={row.department_id} className="info-tile flex justify-between text-sm">
                <span>{row.department_name}</span>
                <strong className="text-danger">{row.overdue_tasks}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
