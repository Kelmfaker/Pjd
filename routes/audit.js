import express from 'express';
import { listAuditLogs, auditLogsPage } from '../controllers/auditController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

// API: list logs (admin only)
router.get('/api', authenticate, authorizeRoles('admin'), listAuditLogs);

// UI page: /audit-logs
router.get('/', authenticate, authorizeRoles('admin'), auditLogsPage);

export default router;
