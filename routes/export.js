import express from "express";
import { exportMembers, exportAttendance, exportAttendancePdf, generateAttendanceReports, listAttendanceReports, getAttendanceReport } from "../controllers/exportController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

router.get('/members', authenticate, authorizeRoles('admin','secretary'), exportMembers);
router.get('/attendance', authenticate, authorizeRoles('admin','secretary'), exportAttendance);
router.get('/attendance/pdf', authenticate, authorizeRoles('admin','secretary'), exportAttendancePdf);
router.post('/attendance/reports/generate', authenticate, authorizeRoles('admin','secretary'), generateAttendanceReports);
router.get('/attendance/reports', authenticate, authorizeRoles('admin','secretary'), listAttendanceReports);
router.get('/attendance/reports/:id', authenticate, authorizeRoles('admin','secretary'), getAttendanceReport);

export default router;
