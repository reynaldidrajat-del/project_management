// Mengambil daftar PIC task dari format multi PIC baru atau format assignee lama.
export const getTaskAssignees = (task = {}) => {
  if (Array.isArray(task.assignees) && task.assignees.length) {
    return task.assignees.filter(Boolean);
  }

  if (task.assignee_id || task.assignee_name) {
    return [
      {
        id: task.assignee_id,
        name: task.assignee_name,
        department_id: task.assignee_department_id || task.department_id,
        department_name: task.assignee_department_name || task.department_name,
      },
    ].filter((assignee) => assignee.id || assignee.name);
  }

  return [];
};

// Menggabungkan nama PIC menjadi teks singkat untuk ditampilkan di kartu/table.
export const getTaskAssigneeNames = (task = {}, fallback = '-') => {
  if (task.assignee_names) {
    return task.assignee_names;
  }

  const names = getTaskAssignees(task)
    .map((assignee) => assignee.name)
    .filter(Boolean);

  return names.length ? names.join(', ') : fallback;
};

// Mengambil nama lead task atau fallback jika belum ada lead.
export const getTaskLeadName = (task = {}, fallback = '-') => {
  return task.lead_name || fallback;
};
