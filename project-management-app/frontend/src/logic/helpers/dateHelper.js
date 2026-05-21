import { format, isValid, parseISO } from 'date-fns';

// Mengubah input tanggal menjadi Date, lalu mengembalikan null jika tanggalnya tidak valid.
export const parseDateSafe = (value) => {
  if (!value) {
    return null;
  }

  const date = typeof value === 'string' ? parseISO(value) : new Date(value);

  return isValid(date) ? date : null;
};

// Menampilkan tanggal dalam format yang ramah dibaca user.
export const formatDate = (value, pattern = 'dd MMM yyyy') => {
  const date = parseDateSafe(value);
  return date ? format(date, pattern) : '-';
};

// Mengubah tanggal menjadi format YYYY-MM-DD agar cocok untuk input type date.
export const toDateInputValue = (value) => {
  const date = parseDateSafe(value);
  return date ? format(date, 'yyyy-MM-dd') : '';
};
