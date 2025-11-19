# Party Management (in-memory scaffold)

Simple Express + EJS scaffold for party management with in-memory CRUD for Members, Activities, Attendance, and Users.

Quick start

1. Install dependencies:

```powershell
cd "d:\Current Project\PJDAGDAL\party-management"
npm install
```

2. Run:

```powershell
npm start
```

3. Open http://localhost:3000 in your browser to see the dashboard. Use the `/api/*` endpoints for JSON CRUD.

Notes

- This scaffold uses an in-memory store. Data will be lost when the server restarts.
- If you'd like a DB-backed version (MongoDB/SQLite), tell me and I will wire it up.

Seeding an admin user (safe method)

To create the initial admin user (recommended instead of exposing a public seed endpoint), run the included script which reads credentials from environment variables or defaults:

```powershell
cd "d:\Current Project\PJDAGDAL\party-management"
# Optionally set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD in your .env
node scripts/seed-admin.js
```

The script will stop if an admin already exists.
