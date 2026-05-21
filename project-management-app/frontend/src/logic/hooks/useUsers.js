import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../services/api';
import { getUsers } from '../services/userApi';

// Hook untuk mengambil semua user/PIC dari backend.
export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mengambil ulang daftar user.
  const fetchUsers = async () => {
    setLoading(true);
    setError('');

    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil user saat hook pertama dipakai.
  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, error, refetch: fetchUsers };
};
