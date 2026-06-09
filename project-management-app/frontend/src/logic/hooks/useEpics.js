import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../services/api';
import { getEpicIssues, getEpics } from '../services/epicApi';

export const useEpics = (projectId, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(projectId);
  const [epics, setEpics] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const fetchEpics = async () => {
    if (!enabled) {
      setEpics([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setEpics(await getEpics(projectId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'none']);

  return { epics, loading, error, refetch: fetchEpics };
};

export const useEpicIssues = (epicId, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(epicId);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const fetchIssues = async () => {
    if (!enabled) {
      setIssues([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setIssues(await getEpicIssues(epicId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, epicId || 'none']);

  return { issues, loading, error, refetch: fetchIssues };
};
