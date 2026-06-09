export const issueImportFields = [
  { key: 'title', label: 'Title', required: true, aliases: ['title', 'summary', 'name'] },
  { key: 'description', label: 'Description', aliases: ['description', 'details'] },
  { key: 'project_id', label: 'Project ID', aliases: ['project_id', 'project id', 'project'] },
  { key: 'project_name', label: 'Project Name', aliases: ['project_name', 'project name'] },
  { key: 'issue_type_id', label: 'Issue Type ID', required: true, aliases: ['issue_type_id', 'issue type id', 'type_id'] },
  { key: 'issue_type_name', label: 'Issue Type Name', aliases: ['issue_type_name', 'issue type', 'type', 'issuetype'] },
  { key: 'status', label: 'Status', aliases: ['status'] },
  { key: 'priority', label: 'Priority', aliases: ['priority'] },
  { key: 'assignee_ids', label: 'Assignee IDs', aliases: ['assignee_ids', 'assignee ids', 'pic_ids', 'pic ids'] },
  { key: 'assignee_email', label: 'Assignee Email', aliases: ['assignee_email', 'assignee email', 'pic_email', 'pic email'] },
  { key: 'lead_id', label: 'Lead ID', aliases: ['lead_id', 'lead id'] },
  { key: 'start_date', label: 'Start Date', aliases: ['start_date', 'start date'] },
  { key: 'end_date', label: 'End Date', aliases: ['end_date', 'end date', 'due_date', 'due date'] },
  { key: 'progress', label: 'Progress', aliases: ['progress'] },
  { key: 'story_points', label: 'Story Points', aliases: ['story_points', 'story points', 'points'] },
  { key: 'epic_id', label: 'Epic ID', aliases: ['epic_id', 'epic id'] },
  { key: 'sprint_id', label: 'Sprint ID', aliases: ['sprint_id', 'sprint id'] },
  { key: 'bucket_id', label: 'Bucket ID', aliases: ['bucket_id', 'bucket id'] },
];

export const issueExportColumns = [
  { key: 'issue_key', label: 'Issue Key' },
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'project_name', label: 'Project' },
  { key: 'issue_type_name', label: 'Issue Type' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee_names', label: 'Assignees' },
  { key: 'lead_name', label: 'Lead' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'progress', label: 'Progress' },
  { key: 'story_points', label: 'Story Points' },
  { key: 'epic_name', label: 'Epic' },
  { key: 'sprint_name', label: 'Sprint' },
  { key: 'bucket_name', label: 'Bucket' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' },
];

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

const escapeCsvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
};

const escapeHtmlCell = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export const parseCsv = (text) => {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  const nonEmptyRows = rows.filter((row) => row.some((cell) => String(cell || '').trim()));
  const headers = (nonEmptyRows[0] || []).map((header) => String(header || '').trim()).filter(Boolean);

  if (!headers.length) {
    return { headers: [], rows: [] };
  }

  return {
    headers,
    rows: nonEmptyRows.slice(1).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, String(row[index] || '').trim()])),
    ),
  };
};

export const parseJsonIssues = (text) => {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed?.issues;

  if (!Array.isArray(rows)) {
    throw new Error('JSON harus berupa array issue atau object dengan property issues.');
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );

  return { headers, rows };
};

export const autoMapImportFields = (headers = []) => {
  const normalizedHeaderByOriginal = new Map(headers.map((header) => [header, normalizeHeader(header)]));

  return Object.fromEntries(
    issueImportFields.map((field) => {
      const matchedHeader = headers.find((header) => field.aliases.some((alias) => normalizeHeader(alias) === normalizedHeaderByOriginal.get(header)));
      return [field.key, matchedHeader || ''];
    }),
  );
};

export const getMappedImportValue = (row, mapping, fieldKey) => {
  const sourceField = mapping[fieldKey];

  if (!sourceField) {
    return '';
  }

  return row?.[sourceField] === undefined || row?.[sourceField] === null ? '' : String(row[sourceField]).trim();
};

export const getIssueExportRows = (issues = []) =>
  issues.map((issue) =>
    Object.fromEntries(
      issueExportColumns.map((column) => {
        if (column.key === 'assignee_names') {
          return [column.label, issue.assignee_names || issue.assignee_name || ''];
        }

        return [column.label, issue[column.key] ?? ''];
      }),
    ),
  );

export const createCsvContent = (rows = []) => {
  const headers = rows.length ? Object.keys(rows[0]) : issueExportColumns.map((column) => column.label);
  const lines = [headers.map(escapeCsvCell).join(',')];

  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','));
  });

  return lines.join('\r\n');
};

export const createExcelHtmlContent = (rows = []) => {
  const headers = rows.length ? Object.keys(rows[0]) : issueExportColumns.map((column) => column.label);
  const headerCells = headers.map((header) => `<th>${escapeHtmlCell(header)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtmlCell(row[header])}</td>`).join('')}</tr>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
};

export const downloadTextFile = (content, fileName, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
