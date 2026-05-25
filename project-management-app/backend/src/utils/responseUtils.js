// Membungkus response sukses agar semua endpoint punya bentuk JSON yang sama.
const sendSuccess = (res, data = null, message = 'Data berhasil diproses', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

// Membungkus response error agar pesan error API konsisten dan mudah dibaca frontend.
const sendError = (res, error, message = 'Terjadi kesalahan', statusCode = 500) => {
  const errorMessage = error instanceof Error ? error.message : error;

  return res.status(statusCode).json({
    success: false,
    message,
    error: errorMessage,
  });
};

// Menentukan HTTP status code dari isi pesan error, misalnya validasi menjadi 400.
const inferStatusCode = (error) => {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('tidak ditemukan')) {
    return 404;
  }

  if (
    message.includes('password tidak valid') ||
    message.includes('Autentikasi') ||
    message.includes('Sesi login')
  ) {
    return 401;
  }

  if (message.includes('tidak memiliki izin') || message.includes('Akses ditolak')) {
    return 403;
  }

  if (
    message.includes('wajib') ||
    message.includes('tidak valid') ||
    message.includes('tidak boleh') ||
    message.includes('tidak aktif') ||
    message.includes('Hanya') ||
    message.includes('hanya') ||
    message.includes('harus')
  ) {
    return 400;
  }

  return 500;
};

// Membungkus controller async agar error otomatis dikirim sebagai response JSON.
const asyncHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    sendError(res, error, 'Terjadi kesalahan', inferStatusCode(error));
  }
};

module.exports = {
  asyncHandler,
  inferStatusCode,
  sendError,
  sendSuccess,
};
