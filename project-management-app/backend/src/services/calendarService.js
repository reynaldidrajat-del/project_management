const { query } = require('../config/db');
const { calculateDurationDays, formatDateKey } = require('../utils/dateUtils');
const { calculateWorkDays } = require('../utils/workdayUtils');

// Query dasar untuk mengambil data kalender dalam format tanggal yang mudah dipakai frontend.
const CALENDAR_SELECT = `
  SELECT
    id,
    to_char(exception_date, 'YYYY-MM-DD') AS exception_date,
    type,
    name,
    description,
    created_at,
    updated_at
  FROM calendar_exceptions
`;

// Daftar bawaan hari libur nasional 2026 yang bisa diimport sekali klik dari halaman kalender.
const INDONESIA_NATIONAL_HOLIDAYS_2026 = [
  { exception_date: '2026-01-01', name: "New Year's Day" },
  { exception_date: '2026-01-16', name: "Isra Mi'raj Nabi Muhammad SAW" },
  { exception_date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili' },
  { exception_date: '2026-03-19', name: 'Hari Suci Nyepi Tahun Baru Saka 1948' },
  { exception_date: '2026-03-21', name: 'Idul Fitri 1477 H' },
  { exception_date: '2026-03-22', name: 'Idul Fitri 1477 H' },
  { exception_date: '2026-04-03', name: 'Wafat Yesus Kristus' },
  { exception_date: '2026-04-05', name: 'Kebangkitan Yesus Kristus' },
  { exception_date: '2026-05-01', name: 'Hari Buruh Internasional' },
  { exception_date: '2026-05-14', name: 'Kenaikan Yesus Kristus' },
  { exception_date: '2026-05-27', name: 'Idul Adha 1447 H' },
  { exception_date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE' },
  { exception_date: '2026-06-01', name: 'Hari Lahir Pancasila' },
  { exception_date: '2026-06-16', name: 'Tahun Baru Islam 1448 H' },
  { exception_date: '2026-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
  { exception_date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW' },
  { exception_date: '2026-12-25', name: 'Hari Raya Natal' },
];

// Mengambil semua pengecualian kalender, seperti libur dan hari kerja pengganti.
const getCalendarExceptions = async () => {
  const result = await query(`${CALENDAR_SELECT} ORDER BY exception_date ASC`);
  return result.rows;
};

// Mengubah daftar kalender menjadi Map agar pencarian per tanggal lebih cepat saat menghitung hari kerja.
const getCalendarExceptionMap = async () => {
  const exceptions = await getCalendarExceptions();
  return new Map(exceptions.map((exception) => [exception.exception_date, exception]));
};

// Memastikan data kalender wajib punya tanggal, tipe, dan nama yang benar.
const validateCalendarException = (payload) => {
  if (!payload.exception_date) {
    throw new Error('Tanggal exception wajib diisi.');
  }

  if (!['holiday', 'working_day'].includes(payload.type)) {
    throw new Error('Type calendar exception harus holiday atau working_day.');
  }

  if (!payload.name) {
    throw new Error('Nama calendar exception wajib diisi.');
  }
};

// Menghitung durasi kalender dan hari kerja untuk task berdasarkan tanggal dan aturan kalender.
const calculateTaskDateMetrics = async (startDate, endDate) => {
  const exceptionByDate = await getCalendarExceptionMap();

  return {
    duration_days: calculateDurationDays(startDate, endDate),
    work_days: calculateWorkDays(startDate, endDate, exceptionByDate),
  };
};

// Menghitung ulang durasi semua task setelah aturan kalender berubah.
const recalculateAllTaskDateMetrics = async () => {
  const exceptionByDate = await getCalendarExceptionMap();
  const result = await query('SELECT id, start_date, end_date, actual_start_date, actual_end_date FROM tasks');

  await Promise.all(
    result.rows.map((task) => {
      const startDate = formatDateKey(task.start_date);
      const endDate = formatDateKey(task.end_date);
      const actualStartDate = formatDateKey(task.actual_start_date);
      const actualEndDate = formatDateKey(task.actual_end_date);
      const metrics = {
        duration_days: calculateDurationDays(startDate, endDate),
        work_days: calculateWorkDays(startDate, endDate, exceptionByDate),
        actual_duration_days: calculateDurationDays(actualStartDate, actualEndDate),
        actual_work_days: calculateWorkDays(actualStartDate, actualEndDate, exceptionByDate),
      };

      return query(
        `
        UPDATE tasks
          SET
            duration_days = $1,
            work_days = $2,
            actual_duration_days = $3,
            actual_work_days = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `,
        [metrics.duration_days, metrics.work_days, metrics.actual_duration_days, metrics.actual_work_days, task.id],
      );
    }),
  );
};

// Membuat pengecualian kalender baru lalu memperbarui perhitungan durasi task.
const createCalendarException = async (payload) => {
  validateCalendarException(payload);

  const result = await query(
    `
      INSERT INTO calendar_exceptions (exception_date, type, name, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id, to_char(exception_date, 'YYYY-MM-DD') AS exception_date, type, name, description, created_at, updated_at
    `,
    [payload.exception_date, payload.type, payload.name, payload.description || null],
  );

  await recalculateAllTaskDateMetrics();

  return result.rows[0];
};

// Mengimport libur nasional Indonesia 2026 dan menimpa data tanggal yang sama jika sudah ada.
const importIndonesiaNationalHolidays2026 = async () => {
  const description = 'Libur nasional Indonesia 2026 berdasarkan SKB pemerintah.';

  const importedRows = await Promise.all(
    INDONESIA_NATIONAL_HOLIDAYS_2026.map((holiday) =>
      query(
        `
          INSERT INTO calendar_exceptions (exception_date, type, name, description)
          VALUES ($1, 'holiday', $2, $3)
          ON CONFLICT (exception_date) DO UPDATE
          SET
            type = EXCLUDED.type,
            name = EXCLUDED.name,
            description = EXCLUDED.description
          RETURNING id, to_char(exception_date, 'YYYY-MM-DD') AS exception_date, type, name, description, created_at, updated_at
        `,
        [holiday.exception_date, holiday.name, description],
      ),
    ),
  );

  await recalculateAllTaskDateMetrics();

  return {
    total: importedRows.length,
    holidays: importedRows.map((result) => result.rows[0]),
  };
};

// Mengubah satu pengecualian kalender lalu menghitung ulang durasi task.
const updateCalendarException = async (id, payload) => {
  validateCalendarException(payload);

  const result = await query(
    `
      UPDATE calendar_exceptions
      SET exception_date = $1, type = $2, name = $3, description = $4
      WHERE id = $5
      RETURNING id, to_char(exception_date, 'YYYY-MM-DD') AS exception_date, type, name, description, created_at, updated_at
    `,
    [payload.exception_date, payload.type, payload.name, payload.description || null, id],
  );

  if (!result.rows[0]) {
    throw new Error('Calendar exception tidak ditemukan.');
  }

  await recalculateAllTaskDateMetrics();

  return result.rows[0];
};

// Menghapus pengecualian kalender lalu menghitung ulang durasi task.
const deleteCalendarException = async (id) => {
  const result = await query('DELETE FROM calendar_exceptions WHERE id = $1 RETURNING id', [id]);

  if (!result.rows[0]) {
    throw new Error('Calendar exception tidak ditemukan.');
  }

  await recalculateAllTaskDateMetrics();

  return result.rows[0];
};

module.exports = {
  calculateTaskDateMetrics,
  createCalendarException,
  deleteCalendarException,
  getCalendarExceptionMap,
  getCalendarExceptions,
  importIndonesiaNationalHolidays2026,
  recalculateAllTaskDateMetrics,
  updateCalendarException,
};
