const labelColorClasses = {
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  green: 'bg-green-100 text-green-700',
  pink: 'bg-pink-100 text-pink-700',
  purple: 'bg-purple-100 text-purple-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
};

export const TASK_LABEL_COLORS = Object.keys(labelColorClasses);

export const getTaskLabelBadgeClass = (color) => labelColorClasses[color] || labelColorClasses.slate;
