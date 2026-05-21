// Mengubah input tanggal dari database/form menjadi object Date yang aman dipakai JavaScript.
const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// Mengubah tanggal menjadi format pendek YYYY-MM-DD agar konsisten untuk database dan input date.
const formatDateKey = (value) => {
  const date = parseDate(value);

  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// Menghitung total hari kalender dari tanggal mulai sampai tanggal selesai, termasuk kedua tanggalnya.
const calculateDurationDays = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end || start > end) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
};

// Membuat daftar semua tanggal di antara start dan end agar bisa dihitung satu per satu.
const eachDateInclusive = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end || start > end) {
    return [];
  }

  const dates = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

module.exports = {
  calculateDurationDays,
  eachDateInclusive,
  formatDateKey,
  parseDate,
};
