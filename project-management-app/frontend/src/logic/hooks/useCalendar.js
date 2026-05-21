import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../services/api';
import { getCalendarExceptions } from '../services/calendarApi';

// Hook untuk mengambil daftar kalender libur/hari kerja khusus.
export const useCalendar = () => {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mengambil ulang daftar pengecualian kalender.
  const fetchExceptions = async () => {
    setLoading(true);
    setError('');

    try {
      setExceptions(await getCalendarExceptions());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil kalender saat hook pertama dipakai.
  useEffect(() => {
    fetchExceptions();
  }, []);

  return { exceptions, loading, error, refetch: fetchExceptions };
};
