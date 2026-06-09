import { AlertCircle, CheckCircle2, Download, FileText, PlayCircle, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import FormField from '../components/shared/FormField';
import { TASK_PRIORITIES } from '../logic/constants/priority';
import { TASK_STATUSES } from '../logic/constants/status';
import {
  autoMapImportFields,
  createCsvContent,
  downloadTextFile,
  getMappedImportValue,
  issueImportFields,
  parseCsv,
  parseJsonIssues,
} from '../logic/helpers/issueImportExportHelper';
import { useIssueTypes } from '../logic/hooks/useIssueTypes';
import { useProjects } from '../logic/hooks/useProjects';
import { useUsers } from '../logic/hooks/useUsers';
import { getApiErrorMessage } from '../logic/services/api';
import { createTask } from '../logic/services/taskApi';
import { useUiStore } from '../store/uiStore';

const initialImportState = {
  failures: [],
  successes: [],
};

const splitMultiValue = (value) =>
  String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeLookupValue = (value) => String(value || '').trim().toLowerCase();

const isValidDateValue = (value) => !value || !Number.isNaN(new Date(value).getTime());

const isValidNumberValue = (value) => value === '' || Number.isFinite(Number(value));

const getProjectByName = (projects, value) => {
  const normalizedValue = normalizeLookupValue(value);
  return projects.find(
    (project) =>
      normalizeLookupValue(project.name) === normalizedValue ||
      normalizeLookupValue(project.project_key) === normalizedValue ||
      normalizeLookupValue(project.key) === normalizedValue,
  );
};

const getUserByEmail = (users, value) => {
  const normalizedValue = normalizeLookupValue(value);
  return users.find((user) => normalizeLookupValue(user.email) === normalizedValue || normalizeLookupValue(user.name) === normalizedValue);
};

function ImportIssuesPage() {
  const { projects } = useProjects();
  const { users } = useUsers();
  const [defaultProjectId, setDefaultProjectId] = useState('');
  const [defaultIssueTypeId, setDefaultIssueTypeId] = useState('');
  const { issueTypes } = useIssueTypes(defaultProjectId || null, { enabled: Boolean(defaultProjectId) });
  const [fileName, setFileName] = useState('');
  const [sourceHeaders, setSourceHeaders] = useState([]);
  const [sourceRows, setSourceRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [result, setResult] = useState(initialImportState);
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    if (!issueTypes.length) {
      setDefaultIssueTypeId('');
      return;
    }

    setDefaultIssueTypeId((current) => current || String(issueTypes[0].id));
  }, [issueTypes]);

  const previewRows = useMemo(
    () =>
      sourceRows.map((row, index) => {
        const errors = [];
        const title = getMappedImportValue(row, mapping, 'title');
        const mappedProjectId = getMappedImportValue(row, mapping, 'project_id');
        const mappedProjectName = getMappedImportValue(row, mapping, 'project_name');
        const projectByName = mappedProjectName ? getProjectByName(projects, mappedProjectName) : null;
        const projectId = mappedProjectId || projectByName?.id || defaultProjectId;
        const mappedIssueTypeId = getMappedImportValue(row, mapping, 'issue_type_id');
        const mappedIssueTypeName = getMappedImportValue(row, mapping, 'issue_type_name');
        const issueTypeByName = mappedIssueTypeName
          ? issueTypes.find((issueType) => normalizeLookupValue(issueType.name) === normalizeLookupValue(mappedIssueTypeName))
          : null;
        const issueTypeId = mappedIssueTypeId || issueTypeByName?.id || defaultIssueTypeId;
        const status = getMappedImportValue(row, mapping, 'status') || 'Not Started';
        const priority = getMappedImportValue(row, mapping, 'priority') || 'Medium';
        const progressValue = getMappedImportValue(row, mapping, 'progress');
        const storyPointsValue = getMappedImportValue(row, mapping, 'story_points');
        const startDate = getMappedImportValue(row, mapping, 'start_date');
        const endDate = getMappedImportValue(row, mapping, 'end_date');
        const assigneeIdsValue = getMappedImportValue(row, mapping, 'assignee_ids');
        const assigneeEmailValue = getMappedImportValue(row, mapping, 'assignee_email');
        const assigneeIds = assigneeIdsValue
          ? splitMultiValue(assigneeIdsValue)
          : assigneeEmailValue
            ? splitMultiValue(assigneeEmailValue).map((item) => getUserByEmail(users, item)?.id).filter(Boolean)
            : [];

        if (!title) {
          errors.push('Title wajib diisi.');
        }

        if (!projectId) {
          errors.push('Project wajib diisi atau pilih default project.');
        }

        if (!issueTypeId) {
          errors.push('Issue type wajib diisi atau pilih default issue type.');
        }

        if (!TASK_STATUSES.includes(status)) {
          errors.push('Status tidak valid.');
        }

        if (!TASK_PRIORITIES.includes(priority)) {
          errors.push('Priority tidak valid.');
        }

        if (!isValidDateValue(startDate) || !isValidDateValue(endDate)) {
          errors.push('Tanggal tidak valid.');
        }

        if (startDate && endDate && endDate < startDate) {
          errors.push('End date tidak boleh sebelum start date.');
        }

        if (!isValidNumberValue(progressValue)) {
          errors.push('Progress harus angka.');
        }

        if (!isValidNumberValue(storyPointsValue)) {
          errors.push('Story points harus angka.');
        }

        const normalizedProgress = progressValue === '' ? 0 : Math.min(100, Math.max(0, Number(progressValue)));

        return {
          errors,
          index,
          payload: {
            assignee_id: assigneeIds[0] || null,
            assignee_ids: assigneeIds,
            bucket_id: getMappedImportValue(row, mapping, 'bucket_id') || null,
            description: getMappedImportValue(row, mapping, 'description') || null,
            end_date: endDate || null,
            epic_id: getMappedImportValue(row, mapping, 'epic_id') || null,
            issue_type_id: issueTypeId || null,
            lead_id: getMappedImportValue(row, mapping, 'lead_id') || null,
            priority,
            progress: normalizedProgress,
            project_id: projectId || null,
            sprint_id: getMappedImportValue(row, mapping, 'sprint_id') || null,
            start_date: startDate || null,
            status,
            story_points: storyPointsValue === '' ? null : Number(storyPointsValue),
            title,
          },
          row,
        };
      }),
    [defaultIssueTypeId, defaultProjectId, issueTypes, mapping, projects, sourceRows, users],
  );

  const validRows = previewRows.filter((row) => !row.errors.length);
  const invalidRows = previewRows.filter((row) => row.errors.length);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);
    setParseError('');
    setResult(initialImportState);
    setProgress({ completed: 0, total: 0 });

    try {
      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith('.json') ? parseJsonIssues(text) : parseCsv(text);

      setSourceHeaders(parsed.headers);
      setSourceRows(parsed.rows);
      setMapping(autoMapImportFields(parsed.headers));
    } catch (error) {
      setSourceHeaders([]);
      setSourceRows([]);
      setMapping({});
      setParseError(error.message || 'File import tidak bisa dibaca.');
    }
  };

  const updateMapping = (fieldKey, sourceHeader) => {
    setMapping((current) => ({ ...current, [fieldKey]: sourceHeader }));
    setResult(initialImportState);
  };

  const downloadTemplate = () => {
    downloadTextFile(
      createCsvContent([
        {
          title: 'Example issue',
          description: 'Imported from CSV',
          project_id: defaultProjectId || '1',
          issue_type_id: defaultIssueTypeId || '1',
          status: 'Not Started',
          priority: 'Medium',
          assignee_email: '',
          start_date: '2026-06-01',
          end_date: '2026-06-05',
          story_points: '3',
        },
      ]),
      'issue-import-template.csv',
      'text/csv;charset=utf-8',
    );
  };

  const handleImport = async () => {
    if (!validRows.length) {
      showToast({ type: 'error', message: 'Tidak ada row valid untuk diimport.' });
      return;
    }

    const successes = [];
    const failures = [];

    setImporting(true);
    setResult(initialImportState);
    setProgress({ completed: 0, total: validRows.length });

    for (const row of validRows) {
      try {
        const createdIssue = await createTask(row.payload);
        successes.push({ createdIssue, row });
      } catch (error) {
        failures.push({ error: getApiErrorMessage(error), row });
      } finally {
        setProgress((current) => ({ ...current, completed: current.completed + 1 }));
      }
    }

    setResult({ failures, successes });
    setImporting(false);
    showToast({ type: failures.length ? 'error' : 'success', message: `${successes.length} issue berhasil diimport, ${failures.length} gagal.` });
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">Import / Export</p>
          <h1 className="page-title">Import Issues</h1>
          <p className="page-description">Upload CSV atau JSON, mapping field, preview validasi, lalu create issue dari file.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={downloadTemplate}>
          <Download className="h-4 w-4" />
          Template CSV
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <h2 className="section-title">Source File</h2>
          </div>
          <div className="grid gap-4">
            <FormField htmlFor="import-default-project" label="Default Project">
              <select
                className="field mt-1"
                id="import-default-project"
                value={defaultProjectId}
                onChange={(event) => {
                  setDefaultProjectId(event.target.value);
                  setDefaultIssueTypeId('');
                }}
              >
                <option value="">No default project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField htmlFor="import-default-issue-type" label="Default Issue Type">
              <select
                className="field mt-1"
                disabled={!defaultProjectId}
                id="import-default-issue-type"
                value={defaultIssueTypeId}
                onChange={(event) => setDefaultIssueTypeId(event.target.value)}
              >
                <option value="">No default issue type</option>
                {issueTypes.map((issueType) => (
                  <option key={issueType.id} value={issueType.id}>
                    {issueType.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField error={parseError} htmlFor="import-file" label="CSV or JSON File" required>
              <input
                accept=".csv,.json,application/json,text/csv"
                className={`field mt-1 ${parseError ? 'field-error' : ''}`}
                id="import-file"
                type="file"
                onChange={handleFileChange}
              />
            </FormField>
            {fileName ? (
              <div className="rounded-lg border border-border bg-slate-50 p-3 text-sm font-semibold text-text-dark">
                <FileText className="mr-2 inline h-4 w-4 text-primary" />
                {fileName}
              </div>
            ) : null}
          </div>
        </section>

        <section className="card p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="section-title">Field Mapping</h2>
              <p className="section-subtitle">{sourceHeaders.length} source fields detected</p>
            </div>
          </div>
          {sourceHeaders.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {issueImportFields.map((field) => (
                <FormField key={field.key} htmlFor={`mapping-${field.key}`} label={field.label} required={field.required}>
                  <select
                    className="field mt-1"
                    id={`mapping-${field.key}`}
                    value={mapping[field.key] || ''}
                    onChange={(event) => updateMapping(field.key, event.target.value)}
                  >
                    <option value="">Not mapped</option>
                    {sourceHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </FormField>
              ))}
            </div>
          ) : (
            <div className="empty-state">Upload file untuk melihat mapping field.</div>
          )}
        </section>
      </div>

      <section className="table-shell">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="section-title">Import Preview</h2>
            <p className="section-subtitle">{validRows.length} valid, {invalidRows.length} invalid</p>
          </div>
          <button className="btn-primary" disabled={importing || !validRows.length} type="button" onClick={handleImport}>
            <PlayCircle className="h-4 w-4" />
            {importing ? 'Importing...' : 'Import Valid Rows'}
          </button>
        </div>

        {importing ? (
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 flex justify-between text-sm font-semibold">
              <span>Progress</span>
              <span>{progress.completed}/{progress.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        ) : null}

        {result.successes.length || result.failures.length ? (
          <div className="grid gap-3 border-b border-border px-4 py-3 md:grid-cols-2">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              {result.successes.length} imported
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              <AlertCircle className="mr-2 inline h-4 w-4" />
              {result.failures.length} failed
            </div>
          </div>
        ) : null}

        <div className="table-scroll">
          <table className="data-table min-w-[1040px]">
            <thead>
              <tr>
                <th>Row</th>
                <th>Title</th>
                <th>Project</th>
                <th>Issue Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Validation</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.length ? (
                previewRows.slice(0, 50).map((row) => (
                  <tr key={row.index}>
                    <td>{row.index + 2}</td>
                    <td className="font-semibold">{row.payload.title || '-'}</td>
                    <td>{projects.find((project) => Number(project.id) === Number(row.payload.project_id))?.name || row.payload.project_id || '-'}</td>
                    <td>{issueTypes.find((issueType) => Number(issueType.id) === Number(row.payload.issue_type_id))?.name || row.payload.issue_type_id || '-'}</td>
                    <td>{row.payload.status}</td>
                    <td>{row.payload.priority}</td>
                    <td>
                      {row.errors.length ? (
                        <span className="text-danger">{row.errors.join(' ')}</span>
                      ) : (
                        <span className="font-semibold text-green-700">Valid</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="text-text-muted" colSpan="7">
                    Belum ada data preview.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default ImportIssuesPage;
