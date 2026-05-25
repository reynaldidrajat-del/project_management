import { useEffect, useMemo, useState } from 'react';

import SummaryCard from '../components/dashboard/SummaryCard';
import { useDepartments } from '../logic/hooks/useDepartments';
import { getApiErrorMessage } from '../logic/services/api';
import {
  exportPerformanceUsers,
  getDepartmentPerformance,
  getPerformanceBottlenecks,
  getPerformanceUsers,
  getUserPerformance,
} from '../logic/services/performanceApi';
import { useUiStore } from '../store/uiStore';

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDefaultFilters = () => {
  const now = new Date();

  return {
    start_date: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end_date: formatDate(now),
    department_id: '',
  };
};

const buildParams = (filters) => ({
  start_date: filters.start_date,
  end_date: filters.end_date,
  department_id: filters.department_id || undefined,
});

const getRatingClass = (rating) => {
  if (rating === 'Bagus') {
    return 'bg-green-100 text-green-700';
  }

  if (rating === 'Cukup') {
    return 'bg-blue-100 text-blue-700';
  }

  if (rating === 'Kurang') {
    return 'bg-red-100 text-red-700';
  }

  return 'bg-slate-100 text-slate-600';
};

const formatScore = (score) => (score === null || score === undefined ? '-' : score);

const formatRatio = (ratio) => `${Math.round((ratio || 0) * 100)}%`;

const getScoreWidth = (score) => `${Math.max(0, Math.min(100, Number(score || 0)))}%`;

const getExportFileName = (response, fallback) => {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);

  return match?.[1] || fallback;
};

const taskCategoryConfig = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'stale', label: 'Stale Progress' },
  { key: 'waiting_review', label: 'Waiting Review' },
  { key: 'no_due_date', label: 'Tanpa Deadline' },
];

function PerformancePage() {
  const [filters, setFilters] = useState(getDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(getDefaultFilters);
  const [report, setReport] = useState(null);
  const [departmentReport, setDepartmentReport] = useState(null);
  const [bottleneckReport, setBottleneckReport] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const { departments } = useDepartments();
  const showToast = useUiStore((state) => state.showToast);

  const params = useMemo(() => buildParams(appliedFilters), [appliedFilters]);

  useEffect(() => {
    let ignore = false;

    const fetchPerformance = async () => {
      setLoading(true);
      setError('');

      try {
        const [nextReport, nextDepartmentReport, nextBottleneckReport] = await Promise.all([
          getPerformanceUsers(params),
          getDepartmentPerformance(params),
          getPerformanceBottlenecks({ ...params, limit: 8 }),
        ]);

        if (ignore) {
          return;
        }

        setReport(nextReport);
        setDepartmentReport(nextDepartmentReport);
        setBottleneckReport(nextBottleneckReport);

        const availableUserIds = new Set(nextReport.users.map((userMetrics) => userMetrics.user.id));
        const fallbackUser = nextReport.users.find((userMetrics) => userMetrics.total_tasks > 0) || nextReport.users[0] || null;

        setSelectedUserId((currentUserId) => (currentUserId && availableUserIds.has(currentUserId) ? currentUserId : fallbackUser?.user.id || null));
      } catch (err) {
        if (!ignore) {
          setError(getApiErrorMessage(err));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchPerformance();

    return () => {
      ignore = true;
    };
  }, [params]);

  useEffect(() => {
    if (!selectedUserId) {
      setUserDetail(null);
      return undefined;
    }

    let ignore = false;

    const fetchUserDetail = async () => {
      setDetailLoading(true);

      try {
        const detail = await getUserPerformance(selectedUserId, params);

        if (!ignore) {
          setUserDetail(detail);
        }
      } catch (err) {
        if (!ignore) {
          showToast({ type: 'error', message: getApiErrorMessage(err) });
        }
      } finally {
        if (!ignore) {
          setDetailLoading(false);
        }
      }
    };

    fetchUserDetail();

    return () => {
      ignore = true;
    };
  }, [params, selectedUserId, showToast]);

  const handleFilterChange = (field, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
  };

  const handleExport = async () => {
    setExporting(true);

    try {
      const response = await exportPerformanceUsers(params);
      const fileName = getExportFileName(response, `performance-${appliedFilters.start_date}-to-${appliedFilters.end_date}.csv`);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast({ type: 'success', message: 'Export performance dibuat.' });
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Performance</p>
          <h1 className="page-title">Performance Report</h1>
          <p className="page-description">Laporan kinerja per user dari data task, deadline, progress, waiting review, dan bottleneck pekerjaan.</p>
        </div>
        <button className="btn-secondary" disabled={exporting || loading} type="button" onClick={handleExport}>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      <form className="toolbar" onSubmit={handleApplyFilters}>
        <label className="grid gap-1 text-sm font-semibold text-text-dark">
          Start Date
          <input className="field min-w-[160px]" type="date" value={filters.start_date} onChange={(event) => handleFilterChange('start_date', event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-text-dark">
          End Date
          <input className="field min-w-[160px]" type="date" value={filters.end_date} onChange={(event) => handleFilterChange('end_date', event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-text-dark">
          Department
          <select className="field min-w-[220px]" value={filters.department_id} onChange={(event) => handleFilterChange('department_id', event.target.value)}>
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary self-end" type="submit">
          Apply
        </button>
      </form>

      {loading ? <div className="card p-6 text-text-muted">Loading performance report...</div> : null}
      {error ? <div className="card p-6 text-danger">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <SummaryCard helper={`${report?.summary?.users_with_tasks || 0} with tasks`} label="Users" tone="slate" value={report?.summary?.total_users} />
            <SummaryCard label="Avg Score" value={report?.summary?.average_score ?? '-'} />
            <SummaryCard label="Bagus" tone="green" value={report?.summary?.good_rating_users} />
            <SummaryCard label="Kurang" tone="red" value={report?.summary?.low_rating_users} />
            <SummaryCard label="Overdue" tone="amber" value={report?.summary?.overdue_tasks} />
            <SummaryCard label="Bottlenecks" tone="red" value={report?.summary?.bottleneck_tasks} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <div className="table-shell">
              <div className="table-scroll">
                <table className="data-table min-w-[980px]">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Department</th>
                      <th>Score</th>
                      <th>Rating</th>
                      <th>Done</th>
                      <th>In Progress</th>
                      <th>Waiting Review</th>
                      <th>Overdue</th>
                      <th>Recommendation</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.users || []).map((userMetrics) => (
                      <tr key={userMetrics.user.id} className={selectedUserId === userMetrics.user.id ? 'bg-blue-50/70' : ''}>
                        <td>
                          <div className="font-semibold">{userMetrics.user.name}</div>
                          <div className="text-xs text-text-muted">{userMetrics.user.role || '-'}</div>
                        </td>
                        <td>{userMetrics.user.department_name || '-'}</td>
                        <td>
                          <div className="min-w-[120px]">
                            <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                              <span>{formatScore(userMetrics.score)}</span>
                              <span className="text-text-muted">{formatRatio(userMetrics.ratios.completed)} done</span>
                            </div>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: getScoreWidth(userMetrics.score) }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${getRatingClass(userMetrics.rating)}`}>{userMetrics.rating}</span>
                        </td>
                        <td>{userMetrics.completed_tasks}</td>
                        <td>{userMetrics.in_progress_tasks}</td>
                        <td>{userMetrics.waiting_review_tasks}</td>
                        <td className={userMetrics.overdue_tasks ? 'font-semibold text-danger' : ''}>{userMetrics.overdue_tasks}</td>
                        <td className="max-w-[280px] text-text-muted">{userMetrics.recommendations[0]}</td>
                        <td>
                          <button className="btn-secondary py-1" type="button" onClick={() => setSelectedUserId(userMetrics.user.id)}>
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!report?.users?.length ? (
                      <tr>
                        <td className="text-text-muted" colSpan="10">
                          Tidak ada user pada filter ini.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-4">
              <div className="section-header">
                <div>
                  <h2 className="section-title">User Detail</h2>
                  <p className="section-subtitle">{userDetail?.user?.name || 'Pilih user untuk melihat detail.'}</p>
                </div>
                {userDetail ? <span className={`badge ${getRatingClass(userDetail.rating)}`}>{userDetail.rating}</span> : null}
              </div>

              {detailLoading ? <p className="text-sm text-text-muted">Loading user detail...</p> : null}
              {!detailLoading && userDetail ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="info-tile">
                      <p className="label">Score</p>
                      <p className="mt-1 text-2xl font-bold">{formatScore(userDetail.score)}</p>
                    </div>
                    <div className="info-tile">
                      <p className="label">Total Tasks</p>
                      <p className="mt-1 text-2xl font-bold">{userDetail.total_tasks}</p>
                    </div>
                    <div className="info-tile">
                      <p className="label">Overdue</p>
                      <p className="mt-1 text-2xl font-bold text-danger">{userDetail.overdue_tasks}</p>
                    </div>
                    <div className="info-tile">
                      <p className="label">Waiting Review</p>
                      <p className="mt-1 text-2xl font-bold text-warning">{userDetail.waiting_review_tasks}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-3">
                    <h3 className="text-sm font-bold text-text-dark">Score Formula</h3>
                    {userDetail.score_breakdown ? (
                      <div className="mt-3 grid gap-2 text-sm text-text-muted">
                        <div className="flex justify-between">
                          <span>Base</span>
                          <strong className="text-text-dark">{userDetail.score_breakdown.base}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Completed bonus</span>
                          <strong className="text-success">+{userDetail.score_breakdown.completed_bonus}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Healthy progress bonus</span>
                          <strong className="text-success">+{userDetail.score_breakdown.healthy_in_progress_bonus}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Overdue penalty</span>
                          <strong className="text-danger">{userDetail.score_breakdown.overdue_penalty}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Stale penalty</span>
                          <strong className="text-danger">{userDetail.score_breakdown.stale_penalty}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>No due date penalty</span>
                          <strong className="text-danger">{userDetail.score_breakdown.no_due_date_penalty}</strong>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-text-muted">Belum ada task untuk dihitung.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-text-dark">Recommendations</h3>
                    {userDetail.recommendations.map((recommendation) => (
                      <div key={recommendation} className="info-tile text-sm text-text-muted">
                        {recommendation}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {taskCategoryConfig.map((category) => {
                      const tasks = userDetail.tasks_by_category?.[category.key] || [];

                      return (
                        <div key={category.key} className="rounded-xl border border-border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-text-dark">{category.label}</h3>
                            <span className="badge bg-slate-100 text-slate-700">{tasks.length}</span>
                          </div>
                          <div className="space-y-2">
                            {tasks.slice(0, 5).map((task) => (
                              <div key={task.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                                <div className="font-semibold text-text-dark">{task.title}</div>
                                <div className="mt-1 text-xs text-text-muted">
                                  {task.project_name || '-'} - Due {task.end_date || '-'} - {task.progress}%
                                </div>
                              </div>
                            ))}
                            {!tasks.length ? <p className="text-sm text-text-muted">Tidak ada data.</p> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-4">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Department Summary</h2>
                  <p className="section-subtitle">Rata-rata score dan bottleneck berdasarkan department user.</p>
                </div>
              </div>
              <div className="space-y-2">
                {(departmentReport?.departments || []).map((department) => (
                  <div key={department.department_id || 'none'} className="info-tile">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text-dark">{department.department_name}</p>
                        <p className="text-sm text-text-muted">
                          {department.users_with_tasks}/{department.users} users with tasks
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatScore(department.average_score)}</p>
                        <p className="text-xs text-text-muted">avg score</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-text-muted">
                      <span>Done {department.completed_tasks}</span>
                      <span>Overdue {department.overdue_tasks}</span>
                      <span>Bottleneck {department.bottleneck_tasks}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Top Bottlenecks</h2>
                  <p className="section-subtitle">Task yang berisiko menahan penyelesaian pekerjaan.</p>
                </div>
              </div>
              <div className="space-y-2">
                {(bottleneckReport?.bottlenecks || []).map((task) => (
                  <div key={`${task.assigned_user?.id || 'user'}-${task.id}`} className="info-tile">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text-dark">{task.title}</p>
                        <p className="mt-1 text-sm text-text-muted">
                          {task.assigned_user?.name || '-'} - {task.project_name || '-'} - Due {task.end_date || '-'}
                        </p>
                      </div>
                      <span className="badge bg-red-100 text-red-700">{task.progress}%</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {task.bottleneck_reasons.map((reason) => (
                        <span key={reason.type} className="badge bg-amber-100 text-amber-700">
                          {reason.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {!bottleneckReport?.bottlenecks?.length ? <p className="text-sm text-text-muted">Tidak ada bottleneck pada filter ini.</p> : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default PerformancePage;
