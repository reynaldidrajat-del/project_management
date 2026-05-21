import { create } from 'zustand';

const AUTH_USER_STORAGE_KEY = 'project-management-auth-user';
const CURRENT_USER_ID_STORAGE_KEY = 'project-management-current-user-id';
const SIDEBAR_HIDDEN_STORAGE_KEY = 'project-management-sidebar-hidden';

const getStoredCurrentUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (_error) {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return null;
  }
};

const storedCurrentUser = getStoredCurrentUser();

const getStoredSidebarHidden = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(SIDEBAR_HIDDEN_STORAGE_KEY) === 'true';
};

// Store kecil untuk menampilkan toast/notifikasi singkat di seluruh aplikasi.
export const useUiStore = create((set) => ({
  currentUser: storedCurrentUser,
  currentUserId: storedCurrentUser?.id ? String(storedCurrentUser.id) : '',
  isSidebarHidden: getStoredSidebarHidden(),
  toast: null,
  // Menyimpan user hasil login agar approval dan aktivitas memakai identitas yang sama.
  setAuthenticatedUser: (user) => {
    const normalizedUser = user
      ? {
          ...user,
          id: String(user.id),
        }
      : null;

    if (typeof window !== 'undefined') {
      if (normalizedUser) {
        window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalizedUser));
        window.localStorage.setItem(CURRENT_USER_ID_STORAGE_KEY, normalizedUser.id);
      } else {
        window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        window.localStorage.removeItem(CURRENT_USER_ID_STORAGE_KEY);
      }
    }

    set({ currentUser: normalizedUser, currentUserId: normalizedUser?.id || '' });
  },
  // Menyimpan user aktif lokal untuk kompatibilitas komponen lama.
  setCurrentUserId: (userId) => {
    const nextUserId = userId ? String(userId) : '';

    if (typeof window !== 'undefined') {
      if (nextUserId) {
        window.localStorage.setItem(CURRENT_USER_ID_STORAGE_KEY, nextUserId);
      } else {
        window.localStorage.removeItem(CURRENT_USER_ID_STORAGE_KEY);
      }
    }

    set({ currentUserId: nextUserId });
  },
  // Menghapus sesi login lokal dan mengembalikan aplikasi ke halaman login.
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      window.localStorage.removeItem(CURRENT_USER_ID_STORAGE_KEY);
    }

    set({ currentUser: null, currentUserId: '' });
  },
  // Menyimpan preferensi tampilan sidebar agar halaman bisa memakai ruang kerja lebih lebar.
  setSidebarHidden: (isHidden) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIDEBAR_HIDDEN_STORAGE_KEY, String(isHidden));
    }

    set({ isSidebarHidden: isHidden });
  },
  toggleSidebar: () => {
    set((state) => {
      const nextIsHidden = !state.isSidebarHidden;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_HIDDEN_STORAGE_KEY, String(nextIsHidden));
      }

      return { isSidebarHidden: nextIsHidden };
    });
  },
  // Menampilkan toast lalu otomatis menghilangkannya setelah beberapa detik.
  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => set({ toast: null }), 2800);
  },
  // Menghapus toast secara manual.
  clearToast: () => set({ toast: null }),
}));
