# BMS Task Management System (React + Flask + Firestore)

This project is a custom Task Management System for **Bhakti Vedanta Model School (BMS)**:
- React frontend (Kanban drag/drop, simple white UI)
- Flask backend (Firebase Admin auth verification, Firestore data)
- Firebase Auth (teachers/staff login with school email IDs)
- Firestore (tasks, comments, 2-year history, reminders as in-app notifications)

## Prerequisites
- Firebase project with:
  - Authentication enabled (Email/Password or Google)
  - Firestore enabled
  - Service account key created (for server)
- Python 3.x
- Node.js 18+

## Configure Firebase (important)
Create these collections in **Cloud Firestore**:
1. `users` (document id = Firebase Auth `uid`)
2. `tasks` (collection)
3. `notifications` (collection)

The backend automatically bootstraps `users/{uid}` for new sign-ins with default:
- `role: Teacher`
- `department: General`

Admins can manage employees in the app (**Employees** page): pre-register email/name/role/department, edit, and deactivate accounts.

Optional env vars:
- Backend `ALLOWED_EMAIL_DOMAINS` (e.g. `bms.edu`) — blocks new sign-ups outside listed domains
- Frontend `VITE_ALLOWED_EMAIL_DOMAINS` — client-side Google sign-in domain check

## Backend (Flask)
1. Install dependencies:
   - `pip install -r backend/requirements.txt`
2. Configure credentials:
   - Copy `backend/.env.example` to `backend/.env`
   - Set `FIREBASE_ADMIN_CREDENTIALS_PATH` (path to service account json)
3. Run:
   - `python backend/app.py`
   - Server should start on `http://localhost:5000`

## Frontend (React)
1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Configure env:
   - Copy `frontend/.env.example` to `frontend/.env`
   - Fill Firebase web app settings
   - Ensure `VITE_API_BASE_URL=http://localhost:5000`
3. Run:
   - `npm run dev`

## How Kanban works
- Drag a task card to a different column
- Backend updates `tasks/{taskId}.status`
- Comments and activity history are stored under:
  - `tasks/{taskId}/comments`
  - `tasks/{taskId}/history`

## Reminders
- Implemented as **in-app notifications** (collection: `notifications`)
- Scheduler job creates reminders for tasks due **tomorrow**
- Admin can trigger a manual reminder run:
  - `POST /api/admin/reminders/run`

