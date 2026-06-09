const { z } = require('zod');
const {
  buildImportPreview,
  executeIssueImport,
  exportIssues,
} = require('../services/importExportService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');
const { parseSchema } = require('../utils/zodUtils');

const positiveInteger = z.coerce.number().int().positive();
const nullableString = z.string().optional().nullable();
const fieldMappingSchema = z.record(z.string(), z.string()).optional();

const importPayloadSchema = z.object({
  content: nullableString,
  default_issue_type_id: positiveInteger.optional(),
  default_project_id: positiveInteger.optional(),
  field_mapping: fieldMappingSchema,
  fieldMapping: fieldMappingSchema,
  format: z.enum(['csv', 'json']).optional(),
  issue_type_id: positiveInteger.optional(),
  issueTypeId: positiveInteger.optional(),
  issues: z.array(z.record(z.string(), z.unknown())).optional(),
  project_id: positiveInteger.optional(),
  projectId: positiveInteger.optional(),
  skip_invalid: z.boolean().optional(),
  skipInvalid: z.boolean().optional(),
}).refine(
  (payload) => payload.content !== undefined || Array.isArray(payload.issues),
  'Konten import atau daftar issues wajib dikirim.',
);

const exportPayloadSchema = z.object({
  fields: z.array(z.string()).optional(),
  file_name_prefix: z.string().optional(),
  fileNamePrefix: z.string().optional(),
  format: z.enum(['csv', 'json', 'excel']).default('csv'),
  include_custom_fields: z.boolean().optional(),
  includeCustomFields: z.boolean().optional(),
  issue_ids: z.array(positiveInteger).optional(),
  issueIds: z.array(positiveInteger).optional(),
  jql: z.string().optional(),
  jql_query: z.string().optional(),
  jqlQuery: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  project_id: positiveInteger.optional(),
  projectId: positiveInteger.optional(),
});

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user: req.user,
  user_agent: req.headers['user-agent'],
});

const previewImport = asyncHandler(async (req, res) => {
  const payload = parseSchema(importPayloadSchema, req.body || {});
  const preview = await buildImportPreview(payload);

  sendSuccess(res, preview, 'Preview import berhasil diproses.');
});

const executeImport = asyncHandler(async (req, res) => {
  const payload = parseSchema(importPayloadSchema, req.body || {});
  const result = await executeIssueImport(payload, getRequestActivityContext(req));

  sendSuccess(res, result, 'Import issue berhasil diproses.');
});

const exportIssuesController = asyncHandler(async (req, res) => {
  const payload = parseSchema(exportPayloadSchema, {
    ...(req.query || {}),
    ...(req.body || {}),
  });
  const result = await exportIssues(payload, getRequestActivityContext(req));

  if (req.query.download === 'true' || req.body?.download === true) {
    res.setHeader('Content-Disposition', `attachment; filename="${result.file_name}"`);
    res.setHeader('Content-Type', result.content_type);
    return res.status(200).send(result.content);
  }

  return sendSuccess(res, result, 'Export issue berhasil diproses.');
});

module.exports = {
  executeImport,
  exportIssues: exportIssuesController,
  previewImport,
};
