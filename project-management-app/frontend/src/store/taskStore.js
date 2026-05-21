import { create } from 'zustand';

// Store untuk menyimpan task yang sedang dipilih jika fitur modal global dipakai.
export const useTaskStore = create((set) => ({
  selectedTask: null,
  taskModalMode: 'view',
  // Membuka task tertentu dalam mode lihat atau edit.
  openTask: (selectedTask, taskModalMode = 'view') => set({ selectedTask, taskModalMode }),
  // Menutup task yang sedang dipilih.
  closeTask: () => set({ selectedTask: null, taskModalMode: 'view' }),
}));
