// Mengubah kode mode realisasi menjadi label yang mudah dibaca user.
export const getRealizationModeLabel = (mode) => {
  if (mode === 'manual') {
    return 'Manual';
  }

  if (mode === 'normal') {
    return 'Normal';
  }

  return '-';
};

// Mengambil class warna badge berdasarkan mode realisasi.
export const getRealizationModeBadgeClass = (mode) => {
  if (mode === 'manual') {
    return 'bg-amber-100 text-amber-700';
  }

  if (mode === 'normal') {
    return 'bg-green-100 text-green-700';
  }

  return 'bg-slate-100 text-slate-700';
};
