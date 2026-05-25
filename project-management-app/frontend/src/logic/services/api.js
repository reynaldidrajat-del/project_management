import axios from 'axios';

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000/api';
  }

  return `${window.location.protocol}//${window.location.hostname}:5000/api`;
};

// Membuat client HTTP bersama agar semua request API memakai base URL dan header yang sama.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mengirim id user login ke backend agar endpoint yang membutuhkan konteks user bisa memvalidasi otoritas.
api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') {
    return config;
  }

  try {
    const storedUser = window.localStorage.getItem('project-management-auth-user');
    const authToken = window.localStorage.getItem('project-management-auth-token');
    const currentUser = storedUser ? JSON.parse(storedUser) : null;

    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    if (currentUser?.id) {
      config.headers['X-User-Id'] = currentUser.id;
    }
  } catch (_error) {
    window.localStorage.removeItem('project-management-auth-user');
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error?.response?.status === 401) {
      window.localStorage.removeItem('project-management-auth-user');
      window.localStorage.removeItem('project-management-auth-token');
      window.localStorage.removeItem('project-management-current-user-id');

      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);

// Mengambil isi data utama dari response backend yang bentuknya { success, message, data }.
export const unwrapData = (response) => response.data.data;

// Mengambil pesan error yang paling mudah dipahami dari response API.
export const getApiErrorMessage = (error) => {
  const responseData = error?.response?.data;

  if (responseData?.success === false) {
    return responseData.error || responseData.message || 'Terjadi kesalahan.';
  }

  return responseData?.message || responseData?.error || error.message || 'Terjadi kesalahan.';
};

export default api;
