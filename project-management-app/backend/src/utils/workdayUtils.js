const { eachDateInclusive, formatDateKey } = require('./dateUtils');

// Mengecek apakah sebuah tanggal jatuh pada Sabtu atau Minggu.
const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// Menentukan apakah tanggal dihitung sebagai hari kerja, termasuk pengecualian kalender.
const isWorkingDay = (date, exceptionByDate = new Map()) => {
  const key = formatDateKey(date);
  const exception = exceptionByDate.get(key);

  if (exception?.type === 'holiday') {
    return false;
  }

  if (exception?.type === 'working_day') {
    return true;
  }

  return !isWeekend(date);
};

// Menghitung jumlah hari kerja di antara dua tanggal dengan aturan kalender perusahaan.
const calculateWorkDays = (startDate, endDate, exceptionByDate = new Map()) => {
  return eachDateInclusive(startDate, endDate).filter((date) => isWorkingDay(date, exceptionByDate)).length;
};

module.exports = {
  calculateWorkDays,
  isWorkingDay,
};
