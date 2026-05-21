import { PRIORITY_COLORS, STATUS_COLORS } from '../constants/colors';

// Mengambil class warna badge berdasarkan status task.
export const getStatusBadgeClass = (status) => STATUS_COLORS[status]?.badge || 'bg-slate-100 text-slate-700';

// Mengambil warna bar kecil berdasarkan status task.
export const getStatusBarColor = (status) => STATUS_COLORS[status]?.bar || '#CBD5E1';

// Mengambil class warna badge berdasarkan priority task.
export const getPriorityBadgeClass = (priority) => PRIORITY_COLORS[priority] || 'bg-slate-100 text-slate-700';

// Menentukan warna progress bar, hijau jika selesai dan biru jika masih berjalan.
export const getProgressBarClass = ({ progress = 0, status } = {}) => {
  const numericProgress = Number(progress || 0);

  return status === 'Done' || numericProgress >= 100 ? 'bg-success' : 'bg-primary';
};
