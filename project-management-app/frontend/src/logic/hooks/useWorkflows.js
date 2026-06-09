import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../services/api';
import { getAvailableIssueTransitions, getWorkflowDetails, getWorkflows } from '../services/workflowApi';

const isMatchingWorkflowProject = (payload, projectId) => {
  if (!projectId) {
    return !payload?.project_id;
  }

  return !payload?.project_id || Number(payload.project_id) === Number(projectId);
};

export const useWorkflows = (projectId = null, options = {}) => {
  const enabled = options.enabled ?? true;
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const fetchWorkflows = async () => {
    if (!enabled) {
      setWorkflows([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setWorkflows(await getWorkflows(projectId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'global']);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeWorkflowEvent = (event) => {
      if (isMatchingWorkflowProject(event.detail, projectId)) {
        fetchWorkflows();
      }
    };

    window.addEventListener('realtime:workflow.changed', handleRealtimeWorkflowEvent);

    return () => {
      window.removeEventListener('realtime:workflow.changed', handleRealtimeWorkflowEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'global']);

  return { workflows, loading, error, refetch: fetchWorkflows };
};

export const useWorkflowDetails = (workflowId, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(workflowId);
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const fetchWorkflowDetails = async () => {
    if (!enabled) {
      setWorkflow(null);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setWorkflow(await getWorkflowDetails(workflowId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflowDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, workflowId || 'none']);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleRealtimeWorkflowEvent = (event) => {
      if (!event.detail?.workflow_id || Number(event.detail.workflow_id) === Number(workflowId)) {
        fetchWorkflowDetails();
      }
    };

    window.addEventListener('realtime:workflow.changed', handleRealtimeWorkflowEvent);

    return () => {
      window.removeEventListener('realtime:workflow.changed', handleRealtimeWorkflowEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, workflowId || 'none']);

  return { workflow, loading, error, refetch: fetchWorkflowDetails };
};

export const useAvailableIssueTransitions = (issueId, workflowStateId, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(issueId) && Boolean(workflowStateId);
  const [transitions, setTransitions] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const fetchTransitions = async () => {
    if (!enabled) {
      setTransitions([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setTransitions(await getAvailableIssueTransitions(issueId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, issueId || 'none', workflowStateId || 'none']);

  return { transitions, loading, error, refetch: fetchTransitions };
};
