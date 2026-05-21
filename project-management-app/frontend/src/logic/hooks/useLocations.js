import { useEffect, useState } from 'react';

import { getApiErrorMessage } from '../services/api';
import { getLocations } from '../services/locationApi';

// Hook untuk mengambil semua lokasi/bisnis unit dari backend.
export const useLocations = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mengambil ulang daftar lokasi.
  const fetchLocations = async () => {
    setLoading(true);
    setError('');

    try {
      setLocations(await getLocations());
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Mengambil lokasi saat hook pertama dipakai.
  useEffect(() => {
    fetchLocations();
  }, []);

  return { locations, loading, error, refetch: fetchLocations };
};
