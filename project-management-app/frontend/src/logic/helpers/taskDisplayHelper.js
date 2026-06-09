// Nomor jadwal dipakai untuk tampilan planning/Gantt karena urutannya mengikuti start date.
export const getTaskDisplayKey = (task) => task?.schedule_issue_key || task?.display_issue_key || task?.issue_key || '';
