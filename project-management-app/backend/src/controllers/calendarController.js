const {
  createCalendarException,
  deleteCalendarException,
  getCalendarExceptions,
  importIndonesiaNationalHolidays2026,
  updateCalendarException,
} = require('../services/calendarService');
const { logActivity } = require('../services/activityService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

// Mengirim daftar tanggal libur/hari kerja khusus ke frontend.
const listCalendarExceptions = asyncHandler(async (_req, res) => {
  const exceptions = await getCalendarExceptions();
  sendSuccess(res, exceptions);
});

// Membuat satu aturan kalender baru, misalnya libur atau Sabtu yang tetap kerja.
const createException = asyncHandler(async (req, res) => {
  const exception = await createCalendarException(req.body);
  await logActivity({
    ...getRequestActivityContext(req),
    action: 'calendar.exception.create',
    object_type: 'calendar_exception',
    object_id: exception.id,
    description: `Calendar exception "${exception.name}" dibuat untuk ${exception.exception_date}.`,
    metadata: { type: exception.type, exception_date: exception.exception_date },
  });
  sendSuccess(res, exception, 'Calendar exception berhasil dibuat.', 201);
});

// Mengubah aturan kalender yang sudah ada.
const updateException = asyncHandler(async (req, res) => {
  const exception = await updateCalendarException(req.params.id, req.body);
  await logActivity({
    ...getRequestActivityContext(req),
    action: 'calendar.exception.update',
    object_type: 'calendar_exception',
    object_id: exception.id,
    description: `Calendar exception "${exception.name}" diperbarui.`,
    metadata: { type: exception.type, exception_date: exception.exception_date },
  });
  sendSuccess(res, exception, 'Calendar exception berhasil diperbarui.');
});

// Menghapus aturan kalender agar perhitungan hari kerja kembali normal.
const deleteException = asyncHandler(async (req, res) => {
  const exception = await deleteCalendarException(req.params.id);
  await logActivity({
    ...getRequestActivityContext(req),
    action: 'calendar.exception.delete',
    object_type: 'calendar_exception',
    object_id: exception.id,
    description: `Calendar exception "${exception.name || exception.id}" dihapus.`,
  });
  sendSuccess(res, exception, 'Calendar exception berhasil dihapus.');
});

// Mengisi otomatis daftar hari libur nasional Indonesia 2026.
const importIndonesiaHolidays = asyncHandler(async (req, res) => {
  const result = await importIndonesiaNationalHolidays2026();
  await logActivity({
    ...getRequestActivityContext(req),
    action: 'calendar.holidays.import',
    object_type: 'calendar_exception',
    description: 'Libur nasional Indonesia 2026 diimport.',
    metadata: { total: result.total },
  });
  sendSuccess(res, result, 'Libur nasional Indonesia 2026 berhasil diimport.');
});

module.exports = {
  createException,
  deleteException,
  importIndonesiaHolidays,
  listCalendarExceptions,
  updateException,
};
