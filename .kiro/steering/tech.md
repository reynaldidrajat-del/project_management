# Technology Stack

## Backend

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (pg driver)
- **Authentication**: bcryptjs for password hashing
- **Real-time**: Socket.io for live updates
- **Validation**: Zod for schema validation
- **Environment**: dotenv for configuration
- **CORS**: Configured for local and LAN origins

## Frontend

- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v7
- **Styling**: Tailwind CSS with PostCSS/Autoprefixer
- **State Management**: Zustand for lightweight UI state
- **HTTP Client**: Axios
- **Drag & Drop**: @dnd-kit (core, sortable, utilities)
- **Date Handling**: date-fns
- **Icons**: lucide-react
- **Real-time**: socket.io-client

## Database Configuration

**Connection Details** (from `backend/.env`):
```
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=5433
DB_USER=postgres
DB_PASSWORD=admin
DB_NAME=project_management
FRONTEND_URL=http://localhost:5173
```

**Important Notes**:
- Application tables are in database `project_management`, schema `public`
- User table is named `users` (not `user`)
- Password hashes stored in `users.password_hash`
- Super Admin role stored as `role=super_admin`

## Common Commands

### Backend

```bash
# Install dependencies
cd backend
npm install

# Development mode (with nodemon)
npm run dev

# Production mode
npm start

# Syntax check
node --check src/**/*.js
```

### Frontend

```bash
# Install dependencies
cd frontend
npm install

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Database Setup

```bash
# Execute schema (from PostgreSQL client)
psql -U postgres -d project_management -f backend/src/database/schema.sql

# Execute seed data (WARNING: truncates all tables)
psql -U postgres -d project_management -f backend/src/database/seed.sql
```

## Default URLs

- **Backend API**: http://localhost:5000
- **Frontend**: http://localhost:5173
- **API Base**: http://localhost:5000/api

## API Response Format

All backend responses follow this structure:

**Success**:
```json
{
  "success": true,
  "message": "Data berhasil diproses",
  "data": { ... }
}
```

**Error**:
```json
{
  "success": false,
  "message": "Pesan error",
  "error": { ... }
}
```

## Database Helpers

**SQL Functions**:
- `calculate_duration_days_sql(start_date, end_date)` - Calendar day count
- `calculate_work_days_sql(start_date, end_date)` - Working day count (respects calendar exceptions)
- `set_updated_at()` - Trigger function for automatic timestamp updates

## Working Calendar Logic

- **Default**: Monday-Friday are working days
- **Weekends**: Saturday-Sunday are non-working days
- **Exceptions**: `calendar_exceptions` table overrides defaults
  - `type='holiday'`: Makes a weekday non-working
  - `type='working_day'`: Makes a weekend day working

## Build Verification

Before committing changes:
1. Backend syntax check: `node --check` on all .js files
2. Frontend build: `npm run build` must succeed
3. Smoke tests: Verify API endpoints return HTTP 200
4. No npm audit vulnerabilities

## Environment Notes

- CORS allows local/LAN origins automatically
- Frontend uses `VITE_API_BASE_URL` for API calls
- Backend validates database schema on startup
- Socket.io uses same CORS configuration as Express
