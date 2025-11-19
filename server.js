import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import memberRoutes from "./routes/members.js";
import activityRoutes from "./routes/activities.js";
import attendanceRoutes from "./routes/attendance.js";
import userRoutes from "./routes/users.js";
import dashboardRoutes from "./routes/dashboard.js";
import memberDashboardRoutes from "./routes/memberDashboard.js";
import activityDashboardRoutes from "./routes/activityDashboard.js";
import attendanceDashboardRoutes from "./routes/attendanceDashboard.js";
import attendanceReportRoutes from "./routes/attendanceReport.js";
import authRoutes from "./routes/auth.js";
import { register, registerAllowed, login } from "./controllers/authController.js";
import exportRoutes from "./routes/export.js";
import hundelRoutes from "./routes/hundels.js";
import hundelAdminRoutes from "./routes/hundelAdmin.js";
import auditRoutes from "./routes/audit.js";
import uploadRoutes from "./routes/uploads.js";
import uiAuth from "./middlewares/uiAuth.js";
import uiAdmin from "./middlewares/uiAdmin.js";
import attachUser from "./middlewares/attachUser.js";
import { authenticate } from "./middlewares/auth.js";
import path from 'path';
import { connectToDatabase } from './lib/mongoose.js';



dotenv.config();
const app = express();

// Diagnostics: capture unexpected errors and exit for clearer logs during dev
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('exit', (code) => {
  console.log('process.exit event, code =', code);
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('view engine', 'ejs');

// Serve static assets from /public at /static
app.use('/static', express.static(path.join(process.cwd(), 'public')));

// Attach user to req and res.locals when a valid token exists (non-intrusive)
app.use(attachUser);

// Content Security Policy: allow same-origin resources and local connections
// This sets a reasonable default while permitting devtools / local fetches to /.well-known/*
// Make the policy configurable through the `CSP_DIRECTIVES` environment variable.
app.use((req, res, next) => {
  const envDirectives = process.env.CSP_DIRECTIVES;
  if (envDirectives && String(envDirectives).trim()) {
    // Use environment-provided directives verbatim — allows production to lock down CSP.
    res.setHeader('Content-Security-Policy', String(envDirectives).trim());
    res.setHeader('X-CSP-Source', 'env');
    return next();
  }

  // Development-friendly default that allows same-origin and localhost connections.
  const directives = [
    "default-src 'self'",
    "connect-src 'self' http://localhost:5000 http://127.0.0.1:5000 ws://localhost:5000",
    "img-src 'self' data:",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:"
  ].join('; ');
  res.setHeader('Content-Security-Policy', directives);
  res.setHeader('X-CSP-Source', 'default');
  next();
});

// Rate limiter for auth endpoints (login) to slow brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // return JSON body instead of plain text for better client handling
  handler: (req, res) => res.status(429).json({ message: 'Too many requests, slow down and try again later.' })
});

// Browser login page for testing (posts to /api/auth/login)
app.get('/login', (req, res) => {
  res.render('login');
});

// Registration page
app.get('/register', (req, res) => {
  res.render('register');
});

// Connect to MongoDB — prefer MONGODB_URI, fall back to MONGO_URI for backward compatibility
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function startServer() {
  if (!mongoUri) {
    console.error('Error: no MongoDB URI found in environment (MONGODB_URI or MONGO_URI)');
    process.exit(1);
  }

  // Disable command buffering so model operations fail immediately if disconnected
  mongoose.set('bufferCommands', false);

  try {
    // serverSelectionTimeoutMS makes the driver fail fast when it can't reach the server
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err && err.message ? err.message : err);
    console.error('Common causes: invalid connection string, network/firewall, Atlas IP whitelist, or wrong credentials.');
    process.exit(1);
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Routes
app.use("/api/members", memberRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authLimiter, authRoutes);
console.log('Mounted router: /api/auth');
// Fallback direct routes (ensure register/register-allowed are available even if router isn't loaded)
app.get('/api/auth/register-allowed', async (req, res) => registerAllowed(req, res));
app.post('/api/auth/register', async (req, res) => register(req, res));
app.post('/api/auth/login', async (req, res) => login(req, res));
// Helpful GET to redirect browsers to the registration page
app.get('/api/auth/register', (req, res) => {
  res.redirect('/register');
});
console.log('Registered direct auth fallback routes');

// Additional convenience route
app.get('/register-allowed', async (req, res) => registerAllowed(req, res));
app.use("/api/export", exportRoutes);
app.use('/api/uploads', uploadRoutes);
// Hundel resource routes
app.use('/api/hundels', hundelRoutes);

// POST /login — accept browser form submissions and use the same controller as API login
app.post('/login', async (req, res) => {
  try {
    // delegate to controller's login handler
    await login(req, res);
  } catch (err) {
    console.error('Error handling /login POST', err);
    res.status(500).send('خطأ في الخادم');
  }
});

// API: return current authenticated user info (for client-side role-aware UI)
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Admin UI pages for Hundel (EJS)
// NOTE: hundels and audit-logs UI routes will be mounted after uiAdmin so they require admin access

// Note: root ("/") is handled by `dashboardRoutes` and protected by `uiAdmin`.
// Unauthenticated requests will be redirected to `/login` by the middleware.

// Protect all UI routes with uiAuth (requires authentication). Admin-only pages are mounted with uiAdmin below.
app.use(uiAuth);
app.use("/", dashboardRoutes); // Dashboard after login
app.use("/members", memberDashboardRoutes);
app.use("/activities", activityDashboardRoutes);
app.use("/attendance", attendanceDashboardRoutes);
app.use("/attendance-report", attendanceReportRoutes);
import userDashboardRoutes from './routes/userDashboard.js';

// Protected UI pages that require admin role
app.use('/hundels', uiAdmin, hundelAdminRoutes);
app.use('/audit-logs', uiAdmin, auditRoutes);
// Admin user management UI
app.use('/users', uiAdmin, userDashboardRoutes);


// Start the server after successful MongoDB connection
startServer();

// Debug: list registered routes (GET /__routes)
app.get('/__routes', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
      }
    });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Temporary debug endpoint: return the authenticated user's payload and request cookies/headers.
// Protected by `authenticate` to avoid leaking info to unauthenticated callers.
import { authenticate as _authenticate } from './middlewares/auth.js';
app.get('/__debug/me', _authenticate, (req, res) => {
  try {
    const info = {
      user: req.user || null,
      cookies: req.headers.cookie || null,
      authorization: req.headers.authorization || null,
      path: req.originalUrl
    };
    res.json({ ok: true, info });
  } catch (err) {
    res.status(500).json({ ok: false, message: err && err.message ? err.message : 'error' });
  }
});

await connectToDatabase();
// log like: console.log('MongoDB connected (serverless)');
// log like: console.log('MongoDB connected (serverless)');
