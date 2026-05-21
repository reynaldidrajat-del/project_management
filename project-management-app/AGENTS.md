# Project Management Planner Gantt

Aplikasi full-stack Project Management berbasis React + Vite dan Express + PostgreSQL.

Konsep utama aplikasi ini adalah Microsoft Planner-style task board yang menghasilkan Gantt Chart otomatis dari data task yang sama. User mengelola project, bucket, task, subtask, PIC, status, progress, dan working calendar lewat Board/List, lalu manajemen dapat melihat timeline project maupun timeline gabungan department.

## Stack

- Frontend: React, Vite, React Router, Tailwind CSS, Axios, dnd-kit, date-fns, Zustand.
- Backend: Node.js, Express, PostgreSQL `pg`, CORS, dotenv.
- Database: PostgreSQL.

## Database

Pastikan PostgreSQL berjalan dengan konfigurasi:

```txt
Host: 127.0.0.1
Port: 5433
Database: project_management
Username: pstgres
Password: admin
```

File konfigurasi backend ada di `backend/.env`.

## Membuat Tabel

Jalankan file schema berikut ke database `project_management`:

```txt
backend/src/database/schema.sql
```

## Memasukkan Contoh Data

Jalankan file seed berikut setelah schema selesai:

```txt
backend/src/database/seed.sql
```

Seed berisi contoh project `Timeline E-KPI`, nested subtask, bucket Planner, user/PIC, department, dan calendar exceptions.

## Menjalankan Backend

```bash
cd backend
npm install
npm run dev
```

Backend default berjalan di:

```txt
http://localhost:5000
```

## Menjalankan Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default berjalan di:

```txt
http://localhost:5173
```

## Fitur MVP

- Dashboard monitoring project/task/progress/overdue.
- Project list dan project detail.
- Board View dengan grouping by Status atau by Bucket.
- Drag and drop task board menggunakan dnd-kit dan langsung tersimpan ke PostgreSQL.
- Task List View dengan tree nested subtask tanpa batas level konseptual.
- Task form mendukung parent task, PIC, lead, date, progress, status, dan priority.
- Parent task menghitung progress otomatis dari child langsung secara rekursif.
- Project progress dihitung otomatis dari task utama.
- Gantt Chart per project.
- Gantt Chart seluruh task dengan filter.
- Department Gantt yang menggabungkan project dalam department.
- Working calendar default Senin-Jumat.
- Calendar exceptions untuk `holiday` dan `working_day`.
- `duration_days` dan `work_days` dihitung backend dari tanggal dan calendar exceptions.

## Endpoint Utama

- `GET /api/dashboard/summary`
- `GET /api/projects`
- `GET /api/projects/:projectId/tasks?tree=true`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id/move`
- `PATCH /api/tasks/:id/progress`
- `GET /api/gantt/tasks`
- `GET /api/gantt/projects/:projectId`
- `GET /api/gantt/departments/:departmentId`
- `GET /api/calendar/exceptions`

## Catatan MVP

- Tidak ada sistem login. Semua akses dianggap admin.
- Tabel `users` dipakai untuk PIC, owner project, dan role default.
- Dependency antar-task dan import Excel belum dibuat, tetapi schema sudah disiapkan agar mudah ditambahkan pada versi berikutnya.



#Catatan Tambahan
- Selalu catat perubahanyang dilakukan atau apapun yang dibuat di dalam file readme.txt
- Semua perubahan dicatat secara detail termasuk technical dan bisnis prosesnya
- Apabila belum terdapat file readme.txt silahkan buat file readme.txt