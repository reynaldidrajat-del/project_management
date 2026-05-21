// Mengubah task bertingkat menjadi daftar datar agar mudah dicari atau dihitung.
export const flattenTaskTree = (tasks = []) => {
  const flattened = [];

  // Menelusuri task dan semua anaknya dari atas ke bawah.
  const walk = (items) => {
    items.forEach((task) => {
      flattened.push(task);
      walk(task.children || []);
    });
  };

  walk(tasks);

  return flattened;
};

// Menghitung jumlah semua subtask di bawah satu task.
export const countSubtasks = (task) => flattenTaskTree(task.children || []).length;

// Mengecek apakah task memiliki subtask.
export const hasChildren = (task) => Boolean(task?.children?.length);
