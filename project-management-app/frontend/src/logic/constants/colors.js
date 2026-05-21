// Warna tampilan untuk setiap status task agar badge dan bar selalu konsisten.
export const STATUS_COLORS = {
  'Not Started': {
    badge: 'bg-slate-100 text-slate-700',
    bar: '#CBD5E1',
  },
  'In Progress': {
    badge: 'bg-blue-100 text-blue-700',
    bar: '#2563EB',
  },
  'Waiting Review': {
    badge: 'bg-amber-100 text-amber-700',
    bar: '#F59E0B',
  },
  Done: {
    badge: 'bg-green-100 text-green-700',
    bar: '#16A34A',
  },
  Overdue: {
    badge: 'bg-red-100 text-red-700',
    bar: '#DC2626',
  },
};

// Warna tampilan untuk setiap priority task.
export const PRIORITY_COLORS = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-amber-100 text-amber-700',
  Urgent: 'bg-red-100 text-red-700',
};
