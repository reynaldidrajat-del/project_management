const {
  createCalendarException,
  deleteCalendarException,
  getCalendarExceptions,
  importIndonesiaNationalHolidays2026,
  updateCalendarException,
} = require('../services/calendarService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

// Mengirim daftar tanggal libur/hari kerja khusus ke frontend.
const listCalendarExceptions = asyncHandler(async (_req, res) => {
  const exceptions = await getCalendarExceptions();
  sendSuccess(res, exceptions);
});

// Membuat satu aturan kalender baru, misalnya libur atau Sabtu yang tetap kerja.
const createException = asyncHandler(async (req, res) => {
  const exception = await createCalendarException(req.body);
  sendSuccess(res, exception, 'Calendar exception berhasil dibuat.', 201);
});

// Mengubah aturan kalender yang sudah ada.
const updateException = asyncHandler(async (req, res) => {
  const exception = await updateCalendarException(req.params.id, req.body);
  sendSuccess(res, exception, 'Calendar exception berhasil diperbarui.');
});

// Menghapus aturan kalender agar perhitungan hari kerja kembali normal.
const deleteException = asyncHandler(async (req, res) => {
  const exception = await deleteCalendarException(req.params.id);
  sendSuccess(res, exception, 'Calendar exception berhasil dihapus.');
});

// Mengisi otomatis daftar hari libur nasional Indonesia 2026.
const importIndonesiaHolidays = asyncHandler(async (_req, res) => {
  const result = await importIndonesiaNationalHolidays2026();
  sendSuccess(res, result, 'Libur nasional Indonesia 2026 berhasil diimport.');
});

module.exports = {
  createException,
  deleteException,
  importIndonesiaHolidays,
  listCalendarExceptions,
  updateException,
};
