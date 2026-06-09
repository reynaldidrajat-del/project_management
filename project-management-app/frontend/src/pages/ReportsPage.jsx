import { BarChart3, Download, FileSpreadsheet, FileText, PlayCircle, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import BurndownChart from '../components/reports/BurndownChart';
import VelocityChart from '../components/reports/VelocityChart';
import FormField from '../components/shared/FormField';
import Modal from '../components/shared/Modal';
import { useProjects } from '../logic/hooks/useProjects';
import { useSprints } from '../logic/hooks/useSprints';
import { getApiErrorMessage } from '../logic/services/api';
import { exportGeneratedReport, generateReport } from '../logic/services/reportApi';
import { useUiStore } from '../store/uiStore';

const reportTypes = [
  {
    description: 'Sprint capacity trend, committed story points, completed story points, and average velocity.',
    key: 'velocity',
    title: 'Velocity',
  },
  {
    description: 'Ideal vs actual remaining work for a selected sprint.',
    key: 'burndown',
    title: 'Burndown',
  },
  {
    description: 'Issue distribution by status, priority, assignee, and issue type.',
    key: 'issue_statistics',
    title: 'Issue Statistics',
  },
  {
    description: 'Status flow trend across a date range.',
    key: 'cumulative_flow',
    title: 'Cumulative Flow',
  },
  {
    description: 'Logged time, estimates, and work log summaries.',
    key: 'time_tracking',
    title: 'Time Tracking',
  },
  {
    description: 'Run a report from a JQL query.',
    key: 'custom',
    title: 'Custom JQL',
  },
];

const initialConfig = {
  end_date: '',
  jql: 'status != Done ORDER BY priority DESC',
  limit: 10,
  mode: 'story_points',
  project_id: '',
  sprint_id: '',
  start_date: '',
};

const exportFormats = [
  { extension: 'csv', format: 'csv', icon: FileText, label: 'CSV' },
  { extension: 'xls', format: 'excel', icon: FileSpreadsheet, label: 'Excel' },
  { extension: 'pdf', format: 'pdf', icon: FileText, label: 'PDF' },
];

const getReportTitle = (type) => reportTypes.find((reportType) => reportType.key === type)?.title || type;

const getDefaultFileName = (type, format) => {
  const extension = exportFormats.find((item) => item.format === format)?.extension || format;
  return `${type}-${new Date().toISOString().slice(0, 10)}.${extension}`;
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

function ReportDataPreview({ data, type }) {
  if (!data) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 text-sm font-semibold text-text-muted">
        Configure and run a report to preview data.
      </div>
    );
  }

  if (type === 'velocity') {
    return <VelocityChart data={data} />;
  }

  if (type === 'burndown') {
    return <BurndownChart data={data} />;
  }

  if (type === 'issue_statistics') {
    const summary = data.summary || {};
    const statusRows = data.by_status || [];
    const priorityRows = data.by_priority || [];

    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="info-tile">
            <p className="label">Issues</p>
            <p className="mt-1 text-xl font-bold">{summary.total_issues || 0}</p>
          </div>
          <div className="info-tile">
            <p className="label">Open</p>
            <p className="mt-1 text-xl font-bold">{summary.open_issues || 0}</p>
          </div>
          <div className="info-tile">
            <p className="label">Done</p>
            <p className="mt-1 text-xl font-bold">{summary.done_issues || 0}</p>
          </div>
          <div className="info-tile">
            <p className="label">Story Points</p>
            <p className="mt-1 text-xl font-bold">{summary.total_story_points || 0}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportTable rows={statusRows} title="By Status" />
          <ReportTable rows={priorityRows} title="By Priority" />
        </div>
      </div>
    );
  }

  if (type === 'cumulative_flow') {
    return <ReportTable rows={data.points || []} title="Cumulative Flow Points" />;
  }

  if (type === 'custom') {
    return <ReportTable rows={data.issues || []} title={`${data.total || 0} Issues`} />;
  }

  if (Array.isArray(data?.logs)) {
    return <ReportTable rows={data.logs} title="Work Logs" />;
  }

  return <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(data, null, 2)}</pre>;
}

function ReportTable({ rows = [], title }) {
  const columns = useMemo(
    () =>
      Array.from(
        rows.reduce((set, row) => {
          Object.keys(row || {}).forEach((key) => set.add(key));
          return set;
        }, new Set()),
      ).slice(0, 8),
    [rows],
  );

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-slate-50 p-4 text-sm font-semibold text-text-muted">
        {title}: no rows.
      </div>
    );
  }

  return (
    <div className="table-shell">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-bold text-text-dark">{title}</h3>
      </div>
      <div className="table-scroll">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column.replaceAll('_', ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 25).map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                {columns.map((column) => (
                  <td key={column}>{String(row?.[column] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsPage() {
  const { projects } = useProjects();
  const [activeType, setActiveType] = useState('velocity');
  const [config, setConfig] = useState(initialConfig);
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState('');
  const [error, setError] = useState('');
  const { sprints } = useSprints(config.project_id, {}, { enabled: Boolean(config.project_id) });
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    if (!config.project_id || config.sprint_id || !sprints.length) {
      return;
    }

    const preferredSprint = sprints.find((sprint) => sprint.state === 'ACTIVE') || sprints[0];
    setConfig((current) => ({ ...current, sprint_id: String(preferredSprint.id) }));
  }, [config.project_id, config.sprint_id, sprints]);

  const reportConfig = useMemo(
    () => ({
      end_date: config.end_date || undefined,
      jql: config.jql || undefined,
      limit: Number(config.limit || 10),
      mode: config.mode,
      project_id: config.project_id || undefined,
      sprint_id: config.sprint_id || undefined,
      start_date: config.start_date || undefined,
    }),
    [config],
  );

  const selectedReport = reportTypes.find((reportType) => reportType.key === activeType);
  const canRunReport = activeType === 'burndown' ? Boolean(config.sprint_id) : activeType === 'custom' ? Boolean(config.jql.trim()) : Boolean(config.project_id);

  const updateConfig = (field, value) => {
    setConfig((current) => ({ ...current, [field]: value }));
  };

  const openConfiguration = (type) => {
    setActiveType(type);
    setConfigurationOpen(true);
  };

  const runReport = async (type = activeType) => {
    if (!canRunReport && type === activeType) {
      showToast({ type: 'error', message: 'Lengkapi konfigurasi report terlebih dahulu.' });
      return;
    }

    setActiveType(type);
    setLoading(true);
    setError('');

    try {
      const data = await generateReport(type, reportConfig);
      setReportData(data);
      setConfigurationOpen(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    if (!reportData) {
      showToast({ type: 'error', message: 'Run report sebelum export.' });
      return;
    }

    setExportingFormat(format);

    try {
      const response = await exportGeneratedReport(activeType, format, reportConfig);
      downloadBlob(response.data, getDefaultFileName(activeType, format));
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err) });
    } finally {
      setExportingFormat('');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Reporting</p>
          <h1 className="page-title">Reports</h1>
          <p className="page-description">Generate agile reports, preview charts, and export report data for business reviews.</p>
        </div>
        <div className="action-row">
          <button className="btn-secondary" type="button" onClick={() => setConfigurationOpen(true)}>
            <Settings2 className="h-4 w-4" />
            Configure
          </button>
          <button className="btn-primary" disabled={loading || !canRunReport} type="button" onClick={() => runReport()}>
            <PlayCircle className="h-4 w-4" />
            Run Report
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {reportTypes.map((reportType) => (
          <button
            key={reportType.key}
            className={[
              'rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-soft',
              activeType === reportType.key ? 'border-primary ring-2 ring-primary/10' : 'border-border',
            ].join(' ')}
            type="button"
            onClick={() => openConfiguration(reportType.key)}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-text-dark">{reportType.title}</h2>
              </div>
              <Settings2 className="h-4 w-4 text-text-muted" />
            </div>
            <p className="text-sm text-text-muted">{reportType.description}</p>
          </button>
        ))}
      </div>

      <section className="card p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">{getReportTitle(activeType)}</h2>
            <p className="section-subtitle">{selectedReport?.description}</p>
          </div>
          <div className="action-row">
            {exportFormats.map((format) => {
              const Icon = format.icon;

              return (
                <button
                  key={format.format}
                  className="btn-secondary"
                  disabled={!reportData || Boolean(exportingFormat)}
                  type="button"
                  onClick={() => handleExport(format.format)}
                >
                  {exportingFormat === format.format ? <Download className="h-4 w-4 animate-pulse" /> : <Icon className="h-4 w-4" />}
                  {format.label}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-danger">{error}</div> : null}
        {loading ? <div className="card p-6 text-text-muted">Generating report...</div> : <ReportDataPreview data={reportData} type={activeType} />}
      </section>

      <Modal
        footer={
          <>
            <button className="btn-secondary" disabled={loading} type="button" onClick={() => setConfigurationOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={loading || !canRunReport} form="report-configuration-form" type="submit">
              {loading ? 'Running...' : 'Run Report'}
            </button>
          </>
        }
        open={configurationOpen}
        title={`${getReportTitle(activeType)} Configuration`}
        onClose={() => setConfigurationOpen(false)}
      >
        <form id="report-configuration-form" noValidate onSubmit={(event) => {
          event.preventDefault();
          runReport();
        }}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField htmlFor="report-type" label="Report Type">
              <select className="field mt-1" id="report-type" value={activeType} onChange={(event) => setActiveType(event.target.value)}>
                {reportTypes.map((reportType) => (
                  <option key={reportType.key} value={reportType.key}>
                    {reportType.title}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField htmlFor="report-project" label="Project" required={activeType !== 'custom'}>
              <select className="field mt-1" id="report-project" value={config.project_id} onChange={(event) => updateConfig('project_id', event.target.value)}>
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            {activeType === 'burndown' ? (
              <FormField htmlFor="report-sprint" label="Sprint" required>
                <select className="field mt-1" id="report-sprint" value={config.sprint_id} onChange={(event) => updateConfig('sprint_id', event.target.value)}>
                  <option value="">Select sprint</option>
                  {sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name} ({sprint.state})
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            {activeType === 'burndown' ? (
              <FormField htmlFor="report-mode" label="Burndown Mode">
                <select className="field mt-1" id="report-mode" value={config.mode} onChange={(event) => updateConfig('mode', event.target.value)}>
                  <option value="story_points">Story points</option>
                  <option value="issue_count">Issue count</option>
                </select>
              </FormField>
            ) : null}
            {activeType === 'velocity' ? (
              <FormField htmlFor="report-limit" label="Sprint Window">
                <input className="field mt-1" id="report-limit" min="3" max="50" type="number" value={config.limit} onChange={(event) => updateConfig('limit', event.target.value)} />
              </FormField>
            ) : null}
            {['issue_statistics', 'cumulative_flow', 'time_tracking'].includes(activeType) ? (
              <>
                <FormField htmlFor="report-start-date" label="Start Date">
                  <input className="field mt-1" id="report-start-date" type="date" value={config.start_date} onChange={(event) => updateConfig('start_date', event.target.value)} />
                </FormField>
                <FormField htmlFor="report-end-date" label="End Date">
                  <input className="field mt-1" id="report-end-date" type="date" value={config.end_date} onChange={(event) => updateConfig('end_date', event.target.value)} />
                </FormField>
              </>
            ) : null}
            {activeType === 'custom' ? (
              <FormField className="md:col-span-2" htmlFor="report-jql" label="JQL" required>
                <textarea className="field mt-1 min-h-24 resize-y font-mono" id="report-jql" value={config.jql} onChange={(event) => updateConfig('jql', event.target.value)} />
              </FormField>
            ) : null}
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ReportsPage;
