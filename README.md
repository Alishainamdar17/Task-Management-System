# Task Manager 

A full-stack Task Manager application (Node.js + Express backend, React + Vite frontend) for managing workspaces, projects, tasks, users and reports. This README documents how to run both backend and frontend locally and important configuration values.

## Repository structure 

- backend/ - Express API server (MongoDB, JWT auth, file uploads)
- frontend/Task-Manager - React + Vite SPA (Tailwind, Recharts)
- uploads/ - example uploaded files used by the backend

## Prerequisites

- Node.js (v18+ recommended)
- npm (or yarn)
- MongoDB running locally or accessible via connection string

## Backend - setup & run

1. Open a terminal and navigate to `backend/`:

```powershell
cd "e:\FullStck Project\Task Manager\backend"
```

2. Install dependencies:

```powershell
npm install
```

3. Create a `.env` file in `backend/` (see example below) and set the required environment variables.

4. Start the backend server:

```powershell
npm run dev    # use nodemon for development
# or
npm start      # run once
```

The backend server listens on port defined by `PORT` env var or `8000` by default.

### backend/.env example

```
PORT=8000
MONGODB_URI=mongodb://localhost:27017/taskmanager
JWT_SECRET=your_jwt_secret_here
CLIENT_URL=http://localhost:5173
```

## Frontend - setup & run

1. Open a terminal and navigate to the frontend app:

```powershell
cd "e:\FullStck Project\Task Manager\frontend\Task-Manager"
```

2. Install dependencies:

```powershell
npm install
```

3. (Optional) Create a `.env` file at `frontend/Task-Manager/.env` to override the API base URL. Vite env var name:

```
VITE_API_BASE=http://localhost:8000
```

4. Run the frontend in development mode:

```powershell
npm run dev
```

The frontend uses the API base URL from `VITE_API_BASE` or falls back to `http://localhost:8000`.

## Useful scripts

Backend (in `backend/`):
- `npm run dev` - Start server with nodemon
- `npm start` - Start server with node

Frontend (in `frontend/Task-Manager`):
- `npm run dev` - Start Vite dev server
- `npm run build` - Build production assets
- `npm run preview` - Preview build

## API endpoints (summary)

Base URL: <VITE_API_BASE or http://localhost:8000>

- Auth: `/api/auth/login`, `/api/auth/register`, `/api/auth/profile`
- Tasks: `/api/tasks`, `/api/tasks/:id`, `/api/tasks/dashboard-data`, `/api/tasks/user-dashboard-data`, etc.
- Users: `/api/users`
- Projects: `/api/projects`
- Workspaces: `/api/workspaces`
- Uploads served at `/uploads/<filename>`

## Notes & troubleshooting

- Make sure MongoDB is running and `MONGODB_URI` is correct.
- If CORS issues occur, verify `CLIENT_URL` in backend `.env` matches the frontend origin (Vite uses `http://localhost:5173` by default).
- Uploaded files are saved in `backend/uploads` and served at `/uploads`.

## Contact

If you need help running the project, provide the terminal output of the failing command and I'll help diagnose.
