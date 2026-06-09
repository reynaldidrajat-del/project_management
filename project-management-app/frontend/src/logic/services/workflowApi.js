import api, { unwrapData } from './api';

const toWorkflowParams = (projectId) => {
  if (!projectId) {
    return {};
  }

  return { project_id: projectId };
};

export const getWorkflows = (projectId) => api.get('/workflows', { params: toWorkflowParams(projectId) }).then(unwrapData);

export const getWorkflow = (id) => api.get(`/workflows/${id}`).then(unwrapData);

export const getWorkflowDetails = (id) => api.get(`/workflows/${id}/details`).then(unwrapData);

export const createWorkflow = (payload) => api.post('/workflows', payload).then(unwrapData);

export const updateWorkflow = (id, payload) => api.put(`/workflows/${id}`, payload).then(unwrapData);

export const deleteWorkflow = (id) => api.delete(`/workflows/${id}`).then(unwrapData);

export const createDefaultWorkflow = (projectId) => api.post(`/workflows/default/${projectId}`).then(unwrapData);

export const getWorkflowStates = (workflowId) => api.get(`/workflows/${workflowId}/states`).then(unwrapData);

export const createWorkflowState = (workflowId, payload) => api.post(`/workflows/${workflowId}/states`, payload).then(unwrapData);

export const updateWorkflowState = (stateId, payload) => api.put(`/workflows/states/${stateId}`, payload).then(unwrapData);

export const deleteWorkflowState = (stateId) => api.delete(`/workflows/states/${stateId}`).then(unwrapData);

export const getWorkflowTransitions = (workflowId) => api.get(`/workflows/${workflowId}/transitions`).then(unwrapData);

export const createWorkflowTransition = (workflowId, payload) => api.post(`/workflows/${workflowId}/transitions`, payload).then(unwrapData);

export const updateWorkflowTransition = (transitionId, payload) => api.put(`/workflows/transitions/${transitionId}`, payload).then(unwrapData);

export const deleteWorkflowTransition = (transitionId) => api.delete(`/workflows/transitions/${transitionId}`).then(unwrapData);

export const getAvailableIssueTransitions = (issueId) => api.get(`/workflows/issues/${issueId}/transitions`).then(unwrapData);

export const executeIssueTransition = (issueId, transitionId, payload = {}) =>
  api.post(`/workflows/issues/${issueId}/transitions/${transitionId}`, payload).then(unwrapData);
