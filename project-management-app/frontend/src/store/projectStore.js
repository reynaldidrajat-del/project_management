import { create } from 'zustand';

// Store untuk menyimpan project yang sedang dipilih secara global.
export const useProjectStore = create((set) => ({
  selectedProjectId: null,
  // Mengganti project aktif.
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
}));
