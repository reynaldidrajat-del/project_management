import api, { unwrapData } from './api';

export const getCustomFields = (projectId) => api.get('/custom-fields', { params: { project_id: projectId } }).then(unwrapData);

export const getApplicableCustomFields = (projectId, issueType) =>
  api.get('/custom-fields/applicable', { params: { project_id: projectId, issueType } }).then(unwrapData);

export const getIssueCustomFieldValues = (issueId) => api.get(`/custom-fields/issue/${issueId}`).then(unwrapData);

export const setIssueCustomFieldValue = (issueId, fieldId, value) =>
  api.put(`/custom-fields/issue/${issueId}/${fieldId}`, { value }).then(unwrapData);

export const setIssueCustomFieldValues = (issueId, values) =>
  api.post(`/custom-fields/issues/${issueId}/values`, { values }).then(unwrapData);
