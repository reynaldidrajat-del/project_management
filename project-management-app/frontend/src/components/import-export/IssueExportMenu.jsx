import { Download } from 'lucide-react';
import { useState } from 'react';

import {
  createCsvContent,
  createExcelHtmlContent,
  downloadTextFile,
  getIssueExportRows,
} from '../../logic/helpers/issueImportExportHelper';
import { flattenTaskTree } from '../../logic/helpers/taskTreeHelper';
import { useUiStore } from '../../store/uiStore';

const formatOptions = [
  { extension: 'csv', label: 'CSV', type: 'text/csv;charset=utf-8', value: 'csv' },
  { extension: 'json', label: 'JSON', type: 'application/json;charset=utf-8', value: 'json' },
  { extension: 'xls', label: 'Excel', type: 'application/vnd.ms-excel;charset=utf-8', value: 'excel' },
];

const getExportFileName = (prefix, format) => {
  const option = formatOptions.find((item) => item.value === format) || formatOptions[0];
  const safePrefix = String(prefix || 'issues').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'issues';
  return `${safePrefix}-${new Date().toISOString().slice(0, 10)}.${option.extension}`;
};

function IssueExportMenu({
  currentIssues = [],
  disabled = false,
  fileNamePrefix = 'issues',
  onLoadAllIssues,
}) {
  const [format, setFormat] = useState('csv');
  const [scope, setScope] = useState('filtered');
  const [loading, setLoading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);

  const handleExport = async () => {
    setLoading(true);

    try {
      const issues = scope === 'all' && onLoadAllIssues ? await onLoadAllIssues() : currentIssues;
      const flatIssues = flattenTaskTree(issues || []);

      if (!flatIssues.length) {
        showToast({ type: 'error', message: 'Tidak ada issue untuk diexport.' });
        return;
      }

      const rows = getIssueExportRows(flatIssues);
      const option = formatOptions.find((item) => item.value === format) || formatOptions[0];
      const fileName = getExportFileName(fileNamePrefix, format);

      if (format === 'json') {
        downloadTextFile(JSON.stringify(flatIssues, null, 2), fileName, option.type);
      } else if (format === 'excel') {
        downloadTextFile(createExcelHtmlContent(rows), fileName, option.type);
      } else {
        downloadTextFile(createCsvContent(rows), fileName, option.type);
      }

      showToast({ type: 'success', message: `${flatIssues.length} issue diexport.` });
    } catch (error) {
      showToast({ type: 'error', message: error.message || 'Export issue gagal.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="field max-w-36"
        disabled={disabled || loading}
        value={scope}
        onChange={(event) => setScope(event.target.value)}
      >
        <option value="filtered">Filtered</option>
        <option value="all">All</option>
      </select>
      <select
        className="field max-w-32"
        disabled={disabled || loading}
        value={format}
        onChange={(event) => setFormat(event.target.value)}
      >
        {formatOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button className="btn-secondary" disabled={disabled || loading} type="button" onClick={handleExport}>
        <Download className="h-4 w-4" />
        {loading ? 'Exporting...' : 'Export'}
      </button>
    </div>
  );
}

export default IssueExportMenu;
