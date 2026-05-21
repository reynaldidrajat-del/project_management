import { useEffect, useState } from 'react';

import { getProject, getProjectBuckets, getProjects } from '../services/projectApi';
import { getApiErrorMessage } from '../services/api';

// Hook untuk mengambil daftar project beserta loading, error, dan fungsi refresh.
export const useProjects = (filters = {}) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filterKey = JSON.stringify(filters);

  // Mengambil ulang project dari API berdasarkan filter.
  const fetchProjects = async () => {
    setLoading(true);
    setError('');

    try {
      setProjects(await getProjects(filters));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil project saat hook dipakai atau filter berubah.
  useEffect(() => {
    fetchProjects();
  }, [filterKey]);

  return { projects, loading, error, refetch: fetchProjects };
};

// Hook untuk mengambil detail satu project.
export const useProject = (projectId) => {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState('');

  // Mengambil ulang detail project, atau mengosongkan data jika id belum ada.
  const fetchProject = async () => {
    if (!projectId) {
      setProject(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setProject(await getProject(projectId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil project saat id berubah.
  useEffect(() => {
    fetchProject();
  }, [projectId]);

  return { project, loading, error, refetch: fetchProject };
};

// Hook untuk mengambil daftar bucket dari project tertentu.
export const useBuckets = (projectId) => {
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState('');

  // Mengambil ulang bucket, atau mengosongkan data jika project belum dipilih.
  const fetchBuckets = async () => {
    if (!projectId) {
      setBuckets([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setBuckets(await getProjectBuckets(projectId));
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil bucket saat project berubah.
  useEffect(() => {
    fetchBuckets();
  }, [projectId]);

  return { buckets, loading, error, refetch: fetchBuckets };
};
