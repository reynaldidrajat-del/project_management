const PDFDocument = require('pdfkit');
const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { getBurndownData } = require('./burndownService');
const { getDashboardMetrics } = require('./dashboardMetricsService');
const { searchIssues } = require('./jqlService');
const { getTimeTrackingReport } = require('./timeTrackingService');
const { getVelocitySummary } = require('./velocityService');
const { eachDateInclusive, formatDateKey } = require('../utils/dateUtils');

const REPORT_TYPES = new Set(['issue_statistics', 'time_tracking', 'velocity', 'burndown', 'cumulative_flow', 'custom']);

const REPORT_SELECT = `
  SELECT
    r.id,
    r.project_id,
    p.name AS project_name,
    r.name,
    r.type,
    r.config,
    r.is_favorite,
    r.created_by,
    creator.name AS created_by_name,
    r.created_at,
    r.updated_at
  FROM reports r
  LEFT JOIN projects p ON p.id = r.project_id
  LEFT JOIN users creator ON creator.id = r.created_by
`;

const normalizePositiveInteger = (value, fieldName = 'ID') => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const normalizeReportType = (type) => {
  const normalizedType = String(type || '').trim();

  if (!REPORT_TYPES.has(normalizedType)) {
    throw new Error(`Unsupported report type: ${type}.`);
  }

  return normalizedType;
};

const normalizeDateRange = (filters = {}) => {
  const endDate = formatDateKey(filters.date_to || filters.dateTo || new Date());
  const startDate = formatDateKey(filters.date_from || filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  return { endDate, startDate };
};

const listReports = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.project_id || filters.projectId) {
    values.push(normalizePositiveInteger(filters.project_id || filters.projectId, 'Project ID'));
    conditions.push(`(r.project_id = $${values.length} OR r.project_id IS NULL)`);
  }

  if (filters.type) {
    values.push(normalizeReportType(filters.type));
    conditions.push(`r.type = $${values.length}`);
  }

  if (filters.favorite === 'true' || filters.is_favorite === 'true') {
    conditions.push('r.is_favorite = TRUE');
  }

  const result = await query(
    `
    ${REPORT_SELECT}
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY r.is_favorite DESC, r.updated_at DESC, r.name ASC
    `,
    values,
  );

  return result.rows;
};

const getReportById = async (reportId) => {
  const result = await query(
    `
    ${REPORT_SELECT}
    WHERE r.id = $1
    `,
    [reportId],
  );

  return result.rows[0] || null;
};

const createReport = async (payload = {}, context = {}) => {
  if (!payload.name || !String(payload.name).trim()) {
    throw new Error('Report name is required.');
  }

  const type = normalizeReportType(payload.type);
  const result = await query(
    `
    INSERT INTO reports (project_id, name, type, config, is_favorite, created_by)
    VALUES ($1, $2, $3, $4::JSONB, $5, $6)
    RETURNING id
    `,
    [
      payload.project_id || payload.projectId || null,
      String(payload.name).trim(),
      type,
      JSON.stringify(payload.config || {}),
      Boolean(payload.is_favorite || payload.isFavorite),
      context.actor_user_id || context.user_id || null,
    ],
  );

  const report = await getReportById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: report.project_id,
    action: 'report.create',
    object_type: 'report',
    object_id: report.id,
    description: `Report "${report.name}" created.`,
    metadata: { type: report.type },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return report;
};

const updateReport = async (reportId, payload = {}, context = {}) => {
  const current = await getReportById(reportId);

  if (!current) {
    throw new Error('Report not found.');
  }

  const result = await query(
    `
    UPDATE reports
    SET
      project_id = $1,
      name = $2,
      type = $3,
      config = $4::JSONB,
      is_favorite = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING id
    `,
    [
      payload.project_id === undefined && payload.projectId === undefined
        ? current.project_id
        : payload.project_id || payload.projectId || null,
      payload.name === undefined ? current.name : String(payload.name).trim(),
      payload.type === undefined ? current.type : normalizeReportType(payload.type),
      JSON.stringify(payload.config === undefined ? current.config : payload.config || {}),
      payload.is_favorite === undefined && payload.isFavorite === undefined
        ? current.is_favorite
        : Boolean(payload.is_favorite || payload.isFavorite),
      reportId,
    ],
  );

  const report = await getReportById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: report.project_id,
    action: 'report.update',
    object_type: 'report',
    object_id: report.id,
    description: `Report "${report.name}" updated.`,
    metadata: { changed_fields: Object.keys(payload) },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return report;
};

const deleteReport = async (reportId, context = {}) => {
  const report = await getReportById(reportId);

  if (!report) {
    throw new Error('Report not found.');
  }

  await query('DELETE FROM reports WHERE id = $1', [reportId]);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: report.project_id,
    action: 'report.delete',
    object_type: 'report',
    object_id: Number(reportId),
    description: `Report "${report.name}" deleted.`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return { deleted_report_id: Number(reportId) };
};

const getIssueStatisticsReport = async (config = {}) => {
  const values = [];
  const conditions = ['t.deleted_at IS NULL'];

  if (config.project_id || config.projectId) {
    values.push(normalizePositiveInteger(config.project_id || config.projectId, 'Project ID'));
    conditions.push(`t.project_id = $${values.length}`);
  }

  if (config.date_from || config.dateFrom) {
    values.push(config.date_from || config.dateFrom);
    conditions.push(`t.created_at::DATE >= $${values.length}::DATE`);
  }

  if (config.date_to || config.dateTo) {
    values.push(config.date_to || config.dateTo);
    conditions.push(`t.created_at::DATE <= $${values.length}::DATE`);
  }

  const whereClause = conditions.join(' AND ');
  const [summary, byStatus, byPriority, byIssueType, byAssignee] = await Promise.all([
    query(
      `
      SELECT
        COUNT(*)::INTEGER AS total_issues,
        COUNT(*) FILTER (WHERE t.status = 'Done')::INTEGER AS completed_issues,
        COUNT(*) FILTER (WHERE t.status <> 'Done')::INTEGER AS open_issues,
        COALESCE(SUM(COALESCE(t.story_points, 0)), 0)::INTEGER AS total_story_points
      FROM tasks t
      WHERE ${whereClause}
      `,
      values,
    ),
    query(`SELECT t.status, COUNT(*)::INTEGER AS issue_count FROM tasks t WHERE ${whereClause} GROUP BY t.status ORDER BY issue_count DESC`, values),
    query(`SELECT t.priority, COUNT(*)::INTEGER AS issue_count FROM tasks t WHERE ${whereClause} GROUP BY t.priority ORDER BY issue_count DESC`, values),
    query(
      `
      SELECT COALESCE(it.name, 'Unclassified') AS issue_type, COUNT(*)::INTEGER AS issue_count
      FROM tasks t
      LEFT JOIN issue_types it ON it.id = t.issue_type_id
      WHERE ${whereClause}
      GROUP BY COALESCE(it.name, 'Unclassified')
      ORDER BY issue_count DESC
      `,
      values,
    ),
    query(
      `
      SELECT COALESCE(u.name, 'Unassigned') AS assignee, COUNT(*)::INTEGER AS issue_count
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE ${whereClause}
      GROUP BY COALESCE(u.name, 'Unassigned')
      ORDER BY issue_count DESC
      `,
      values,
    ),
  ]);

  return {
    by_assignee: byAssignee.rows,
    by_issue_type: byIssueType.rows,
    by_priority: byPriority.rows,
    by_status: byStatus.rows,
    summary: summary.rows[0],
  };
};

const getCumulativeFlowReport = async (config = {}) => {
  const { endDate, startDate } = normalizeDateRange(config);
  const dates = eachDateInclusive(startDate, endDate).map((date) => formatDateKey(date));
  const values = [];
  const projectCondition = config.project_id || config.projectId
    ? `AND t.project_id = $${values.push(normalizePositiveInteger(config.project_id || config.projectId, 'Project ID'))}`
    : '';
  const result = await query(
    `
    SELECT
      t.id,
      t.status,
      t.created_at::DATE AS created_date,
      COALESCE(t.completed_at, CASE WHEN t.status = 'Done' THEN t.updated_at ELSE NULL END)::DATE AS completed_date
    FROM tasks t
    WHERE t.deleted_at IS NULL
      ${projectCondition}
      AND t.created_at::DATE <= $${values.push(endDate)}::DATE
    `,
    values,
  );

  const points = dates.map((dateKey) => {
    const counts = {
      date: dateKey,
      Done: 0,
      'In Progress': 0,
      'Not Started': 0,
      Overdue: 0,
      'Waiting Review': 0,
    };

    result.rows.forEach((issue) => {
      const createdDate = formatDateKey(issue.created_date);
      const completedDate = formatDateKey(issue.completed_date);

      if (createdDate && createdDate > dateKey) {
        return;
      }

      if (completedDate && completedDate <= dateKey) {
        counts.Done += 1;
        return;
      }

      counts[issue.status] = (counts[issue.status] || 0) + 1;
    });

    return counts;
  });

  return {
    end_date: endDate,
    points,
    start_date: startDate,
  };
};

const generateReport = async (type, config = {}) => {
  const reportType = normalizeReportType(type);

  if (reportType === 'issue_statistics') {
    return getIssueStatisticsReport(config);
  }

  if (reportType === 'time_tracking') {
    return getTimeTrackingReport(config);
  }

  if (reportType === 'velocity') {
    return getVelocitySummary(config.project_id || config.projectId, config);
  }

  if (reportType === 'burndown') {
    return getBurndownData(config.sprint_id || config.sprintId, config);
  }

  if (reportType === 'cumulative_flow') {
    return getCumulativeFlowReport(config);
  }

  if (reportType === 'custom') {
    return searchIssues(config.jql || config.jql_query || '', config);
  }

  return getDashboardMetrics(config);
};

const generateSavedReport = async (reportId, overrideConfig = {}) => {
  const report = await getReportById(reportId);

  if (!report) {
    throw new Error('Report not found.');
  }

  const config = {
    ...(report.config || {}),
    ...overrideConfig,
    project_id: overrideConfig.project_id || overrideConfig.projectId || report.project_id || report.config?.project_id,
  };

  return {
    data: await generateReport(report.type, config),
    report,
  };
};

const flattenRows = (value, prefix = '') => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenRows(item, prefix || `row_${index + 1}`));
  }

  if (!value || typeof value !== 'object') {
    return [{ key: prefix || 'value', value }];
  }

  const rows = [];

  Object.entries(value).forEach(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(item)) {
      item.forEach((arrayItem, index) => {
        if (arrayItem && typeof arrayItem === 'object' && !Array.isArray(arrayItem)) {
          rows.push({ section: path, ...arrayItem });
        } else {
          rows.push({ section: path, index: index + 1, value: arrayItem });
        }
      });
      return;
    }

    if (item && typeof item === 'object') {
      rows.push(...flattenRows(item, path));
      return;
    }

    rows.push({ key: path, value: item });
  });

  return rows;
};

const rowsToCsv = (rows = []) => {
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set(['key', 'value'])));
  const escapeCsv = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    columns.map(escapeCsv).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(',')),
  ].join('\n');
};

const escapeXml = (value) => String(value === null || value === undefined ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const buildExcelBuffer = (reportName, data) => {
  const rows = flattenRows(data);
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set(['key', 'value'])));
  const headerRow = columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`).join('');
  const dataRows = rows.map((row) => {
    return `<Row>${columns.map((column) => `<Cell><Data ss:Type="String">${escapeXml(row[column])}</Data></Cell>`).join('')}</Row>`;
  }).join('');
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Report">
  <Table>
   <Row><Cell ss:MergeAcross="${Math.max(columns.length - 1, 0)}"><Data ss:Type="String">${escapeXml(reportName)}</Data></Cell></Row>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(workbook, 'utf8');
};

const buildPdfBuffer = async (reportName, data) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(reportName, { underline: true });
    doc.moveDown();
    doc.fontSize(9).text(JSON.stringify(data, null, 2), {
      lineGap: 2,
    });
    doc.end();
  });
};

const exportReportData = async (reportName, data, format = 'csv') => {
  const normalizedFormat = String(format || 'csv').toLowerCase();
  const rows = flattenRows(data);

  if (normalizedFormat === 'csv') {
    return {
      body: Buffer.from(rowsToCsv(rows), 'utf8'),
      content_type: 'text/csv; charset=utf-8',
      extension: 'csv',
    };
  }

  if (normalizedFormat === 'xlsx' || normalizedFormat === 'excel') {
    return {
      body: buildExcelBuffer(reportName, data),
      content_type: 'application/vnd.ms-excel; charset=utf-8',
      extension: 'xls',
    };
  }

  if (normalizedFormat === 'pdf') {
    return {
      body: await buildPdfBuffer(reportName, data),
      content_type: 'application/pdf',
      extension: 'pdf',
    };
  }

  return {
    body: Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
    content_type: 'application/json; charset=utf-8',
    extension: 'json',
  };
};

const scheduleReport = async (reportId, payload = {}, context = {}) => {
  const report = await getReportById(reportId);

  if (!report) {
    throw new Error('Report not found.');
  }

  const nextConfig = {
    ...(report.config || {}),
    schedule: {
      enabled: payload.enabled !== false,
      frequency: payload.frequency || 'weekly',
      recipients: payload.recipients || [],
      next_run_at: payload.next_run_at || payload.nextRunAt || null,
    },
  };

  const updated = await updateReport(reportId, { config: nextConfig }, context);

  return {
    report: updated,
    schedule: updated.config.schedule,
  };
};

module.exports = {
  createReport,
  deleteReport,
  exportReportData,
  generateReport,
  generateSavedReport,
  getCumulativeFlowReport,
  getIssueStatisticsReport,
  getReportById,
  listReports,
  scheduleReport,
  updateReport,
};
