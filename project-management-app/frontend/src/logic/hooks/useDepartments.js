import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../services/api';
import { getDepartments } from '../services/departmentApi';

// Hook untuk mengambil semua department dari backend.
export const useDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mengambil ulang daftar department.
  const fetchDepartments = async () => {
    setLoading(true);
    setError('');

    try {
      setDepartments(await getDepartments());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil department saat hook pertama dipakai.
  useEffect(() => {
    fetchDepartments();
  }, []);

  return { departments, loading, error, refetch: fetchDepartments };
};
