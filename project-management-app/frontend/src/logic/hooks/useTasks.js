import { useEffect, useState } from 'react';

import { getProjectTasks, getTasks } from '../services/taskApi';
import { getApiErrorMessage } from '../services/api';

// Hook untuk mengambil daftar task umum beserta loading, error, dan fungsi refresh.
export const useTasks = (filters = {}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filterKey = JSON.stringify(filters);

  // Mengambil ulang task dari API berdasarkan filter terbaru.
  const fetchTasks = async () => {
    setLoading(true);
    setError('');

    try {
      setTasks(await getTasks(filters));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil task saat hook pertama dipakai atau saat filter berubah.
  useEffect(() => {
    fetchTasks();
  }, [filterKey]);

  return { tasks, loading, error, refetch: fetchTasks };
};

// Hook untuk mengambil task yang hanya berada di satu project.
export const useProjectTasks = (projectId, filters = {}) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState('');
  const filterKey = JSON.stringify(filters);

  // Mengambil ulang task project, atau mengosongkan data jika project belum dipilih.
  const fetchTasks = async () => {
    if (!projectId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setTasks(await getProjectTasks(projectId, filters));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil task saat project atau filter berubah.
  useEffect(() => {
    fetchTasks();
  }, [projectId, filterKey]);

  return { tasks, loading, error, refetch: fetchTasks };
};
