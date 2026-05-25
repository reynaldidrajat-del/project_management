import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../services/api';
import { getTaskLabels } from '../services/taskApi';

// Hook untuk membaca label task, baik global maupun berdasarkan project.
export const useTaskLabels = (projectId = '') => {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState('');

  const fetchLabels = async () => {
    setLoading(true);
    setError('');

    try {
      setLabels(await getTaskLabels(projectId ? { project_id: projectId } : {}));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabels();
  }, [projectId]);

  return { labels, loading, error, refetch: fetchLabels };
};
