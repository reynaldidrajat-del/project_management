import { addDays } from 'date-fns';
import { useEffect, useRef, useState } from 'react';

import DashboardDataModal from '../components/dashboard/DashboardDataModal';
import ProjectProgressCard from '../components/dashboard/ProjectProgressCard';
import SummaryCard from '../components/dashboard/SummaryCard';
import TaskStatusChart from '../components/dashboard/TaskStatusChart';
import TaskDetailModal from '../components/task/LazyTaskDetailModal';
import { toDateInputValue } from '../logic/helpers/dateHelper';
import { useTaskLabels } from '../logic/hooks/useTaskLabels';
import { useProjects } from '../logic/hooks/useProjects';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { getDashboardSummary } from '../logic/services/dashboardApi';
import { getProjects } from '../logic/services/projectApi';
import { getTasks } from '../logic/services/taskApi';

const INITIAL_DRILLDOWN = {
  open: false,
  title: '',
  type: 'tasks',
  rows: [],
  loading: false,
  error: '',
};

const getDueThisWeekRange = () => {
  const today = new Date();

  return {
    startDate: toDateInputValue(today),
    endDate: toDateInputValue(addDays(today, 7)),
  };
};

const filterTasksByDueDateRange = (tasks, startDate, endDate) =>
  tasks.filter((task) => {
    const dueDate = task.end_date || '';

    return dueDate >= startDate && dueDate <= endDate;
  });

const getDashboardTaskStatus = (task, todayDate) => {
  const status = task.raw_status || task.status || '';

  if (task.end_date && task.end_date < todayDate && Number(task.progress || 0) < 100 && !['Done', 'Waiting Review'].includes(status)) {
    return 'Overdue';
  }

  return status;
};

const filterTasksByDashboardStatus = (tasks, status) => {
  const todayDate = toDateInputValue(new Date());

  return tasks.filter((task) => getDashboardTaskStatus(task, todayDate) === status);
};

// Halaman dashboard untuk menampilkan ringkasan kesehatan project dan task.
function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(INITIAL_DRILLDOWN);
  const [selectedTask, setSelectedTask] = useState(null);
  const drilldownRequestId = useRef(0);
  const drilldownLoaderRef = useRef(null);
  const { projects } = useProjects();
  const { users } = useUsers();
  const { labels, refetch: refetchTaskLabels } = useTaskLabels(selectedTask?.project_id || '');

  const fetchSummary = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    setError('');

    try {
      setSummary(await getDashboardSummary());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Mengambil ringkasan dashboard dari API saat halaman dibuka.
    fetchSummary();
  }, []);

  useEffect(() => {
    const handleRealtimeDashboardEvent = () => {
      fetchSummary();
    };

    window.addEventListener('realtime:dashboard.metrics.updated', handleRealtimeDashboardEvent);

    return () => {
      window.removeEventListener('realtime:dashboard.metrics.updated', handleRealtimeDashboardEvent);
    };
  }, []);

  const openDrilldown = async ({ title, type, loadRows }) => {
    const requestId = drilldownRequestId.current + 1;
    drilldownRequestId.current = requestId;
    drilldownLoaderRef.current = loadRows;

    setDrilldown({
      open: true,
      title,
      type,
      rows: [],
      loading: true,
      error: '',
    });

    try {
      const rows = await loadRows();

      setDrilldown((current) => {
        if (drilldownRequestId.current !== requestId || !current.open) {
          return current;
        }

        return {
          ...current,
          rows,
          loading: false,
        };
      });
    } catch (err) {
      setDrilldown((current) => {
        if (drilldownRequestId.current !== requestId || !current.open) {
          return current;
        }

        return {
          ...current,
          loading: false,
          error: getApiErrorMessage(err),
        };
      });
    }
  };

  const openTaskDrilldown = (title, params = {}, refineRows = (rows) => rows) => {
    openDrilldown({
      title,
      type: 'tasks',
      loadRows: async () => refineRows(await getTasks({ ...params, tree: false })),
    });
  };

  const openTaskStatusDrilldown = (status, params = {}) => {
    openTaskDrilldown(`${status} Tasks`, params, (rows) => filterTasksByDashboardStatus(rows, status));
  };

  const openProjectDrilldown = (title, params = {}) => {
    openDrilldown({
      title,
      type: 'projects',
      loadRows: () => getProjects(params),
    });
  };

  const openDueThisWeekDrilldown = () => {
    const { startDate, endDate } = getDueThisWeekRange();

    openTaskDrilldown('Due This Week', { start_date: startDate, end_date: endDate }, (rows) =>
      filterTasksByDueDateRange(rows, startDate, endDate),
    );
  };

  const closeDrilldown = () => {
    drilldownRequestId.current += 1;
    drilldownLoaderRef.current = null;
    setSelectedTask(null);
    setDrilldown(INITIAL_DRILLDOWN);
  };

  const refreshDrilldownRows = async () => {
    const loadRows = drilldownLoaderRef.current;

    if (!loadRows) {
      return;
    }

    const requestId = drilldownRequestId.current + 1;
    drilldownRequestId.current = requestId;

    setDrilldown((current) => {
      if (!current.open) {
        return current;
      }

      return {
        ...current,
        loading: true,
        error: '',
      };
    });

    try {
      const rows = await loadRows();

      setDrilldown((current) => {
        if (drilldownRequestId.current !== requestId || !current.open) {
          return current;
        }

        return {
          ...current,
          rows,
          loading: false,
        };
      });
    } catch (err) {
      setDrilldown((current) => {
        if (drilldownRequestId.current !== requestId || !current.open) {
          return current;
        }

        return {
          ...current,
          loading: false,
          error: getApiErrorMessage(err),
        };
      });
    }
  };

  const refreshDashboardAfterTaskChange = async () => {
    await Promise.all([fetchSummary({ silent: true }), refreshDrilldownRows(), refetchTaskLabels()]);
  };

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
        <SummaryCard
          helper={`${summary?.active_projects || 0} active`}
          label="Total Projects"
          value={summary?.total_projects}
          onClick={() => openProjectDrilldown('Total Projects')}
        />
        <SummaryCard label="Total Tasks" tone="slate" value={summary?.total_tasks} onClick={() => openTaskDrilldown('Total Tasks')} />
        <SummaryCard label="Done" tone="green" value={summary?.done_tasks} onClick={() => openTaskStatusDrilldown('Done')} />
        <SummaryCard label="Overdue" tone="red" value={summary?.overdue_tasks} onClick={() => openTaskStatusDrilldown('Overdue')} />
        <SummaryCard
          label="Avg Progress"
          tone="blue"
          value={`${summary?.average_progress || 0}%`}
          onClick={() => openProjectDrilldown('Project Progress')}
        />
        <SummaryCard label="Due This Week" tone="amber" value={summary?.tasks_due_this_week} onClick={openDueThisWeekDrilldown} />
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

        <TaskStatusChart rows={summary?.tasks_by_status || []} onStatusClick={(status) => openTaskStatusDrilldown(status)} />
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
              <button
                key={row.department_id}
                className="info-tile flex w-full justify-between text-left text-sm transition hover:border-primary/40 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                type="button"
                onClick={() => openProjectDrilldown(`Projects - ${row.department_name}`, { department_id: row.department_id })}
              >
                <span>{row.department_name}</span>
                <strong>{row.total_projects}</strong>
              </button>
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
              <button
                key={row.department_id}
                className="info-tile flex w-full justify-between text-left text-sm transition hover:border-primary/40 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                type="button"
                onClick={() => openTaskStatusDrilldown('Overdue', { department_id: row.department_id })}
              >
                <span>{row.department_name}</span>
                <strong className="text-danger">{row.overdue_tasks}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      <DashboardDataModal
        error={drilldown.error}
        loading={drilldown.loading}
        open={drilldown.open}
        rows={drilldown.rows}
        title={drilldown.title}
        type={drilldown.type}
        onClose={closeDrilldown}
        onTaskOpen={setSelectedTask}
      />

      <TaskDetailModal
        labels={labels}
        projects={projects}
        task={selectedTask}
        tasks={drilldown.type === 'tasks' ? drilldown.rows : []}
        users={users}
        onClose={() => setSelectedTask(null)}
        onSaved={refreshDashboardAfterTaskChange}
      />
    </div>
  );
}

export default DashboardPage;
