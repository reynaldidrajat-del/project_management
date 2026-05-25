const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const http = require('http');

const activityRoutes = require('./routes/activityRoutes');
const authRoutes = require('./routes/authRoutes');
const bucketRoutes = require('./routes/bucketRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const chatRoutes = require('./routes/chatRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const ganttRoutes = require('./routes/ganttRoutes');
const locationRoutes = require('./routes/locationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const performanceRoutes = require('./routes/performanceRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskChecklistRoutes = require('./routes/taskChecklistRoutes');
const taskCommentRoutes = require('./routes/taskCommentRoutes');
const taskLabelRoutes = require('./routes/taskLabelRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const { verifyApplicationSchema, verifyDatabaseConnection } = require('./config/db');
const { authenticateRequest } = require('./middlewares/authMiddleware');
const { initializeRealtimeServer } = require('./services/realtimeService');
const { sendError, sendSuccess } = require('./utils/responseUtils');

dotenv.config();

// Membuat aplikasi Express sebagai pintu masuk semua request backend.
const app = express();
const httpServer = http.createServer(app);
const port = process.env.PORT || 5000;

const configuredFrontendOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLocalOrPrivateNetworkOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch (_error) {
    return false;
  }
};

// Mengizinkan frontend lokal dan LAN memanggil API backend.
const corsOriginHandler = (origin, callback) => {
  if (configuredFrontendOrigins.includes(origin) || isLocalOrPrivateNetworkOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin tidak diizinkan oleh CORS.'));
};

app.use(
  cors({
    origin: corsOriginHandler,
  }),
);
initializeRealtimeServer(httpServer, {
  cors: {
    origin: corsOriginHandler,
  },
});
// Membaca body JSON dari request agar controller bisa memakai req.body.
app.use(express.json({ limit: '2mb' }));

// Endpoint sederhana untuk mengecek apakah backend sedang hidup.
app.get('/', (_req, res) => {
  sendSuccess(res, {
    name: 'Project Management API',
    status: 'running',
  });
});

// Mendaftarkan semua kelompok route API sesuai domain fitur.
app.use('/api/auth', authRoutes);
app.use('/api', authenticateRequest);
app.use('/api/activities', activityRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/buckets', bucketRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/task-checklists', taskChecklistRoutes);
app.use('/api/task-comments', taskCommentRoutes);
app.use('/api/task-labels', taskLabelRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gantt', ganttRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Menangani URL API yang tidak dikenal.
app.use((_req, res) => {
  sendError(res, 'Endpoint tidak ditemukan.', 'Endpoint tidak ditemukan.', 404);
});

// Menangani error tak terduga agar tetap dikirim sebagai JSON.
app.use((error, _req, res, _next) => {
  sendError(res, error);
});

// Menjalankan server hanya setelah koneksi database dan schema inti tervalidasi.
const startServer = async () => {
  try {
    const connection = await verifyDatabaseConnection();
    await verifyApplicationSchema();

    httpServer.listen(port, () => {
      console.log(
        `Project Management API running on http://localhost:${port} using database ${connection.database}@${connection.server_addr}:${connection.server_port}`,
      );
    });
  } catch (error) {
    console.error(`Database startup validation failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
