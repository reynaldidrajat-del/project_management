import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../services/api';
import { getVersions } from '../services/versionApi';

export const useVersions = (projectId, params = {}, options = {}) => {
  const enabled = (options.enabled ?? true) && Boolean(projectId);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const paramsKey = JSON.stringify(params);

  const fetchVersions = async () => {
    if (!enabled) {
      setVersions([]);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setVersions(await getVersions(projectId, params));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, projectId || 'none', paramsKey]);

  return { versions, loading, error, refetch: fetchVersions };
};
