import express from "express";
import {
  getAllActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity
  ,checkInByQr
  ,regenerateQrToken
  ,serveQrPng
} from "../controllers/activitiesController.js";
import { renderActivityAttendancePage } from '../controllers/activitiesController.js';
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", authenticate, authorizeRoles('admin','secretary','responsible','viewer'), getAllActivities);          // عرض كل الأنشطة (محمي)
// Serve PNG QR for activity (requires matching token query param)
router.get('/:id/qr.png', authenticate, authorizeRoles('admin','secretary'), serveQrPng);
router.get("/:id", authenticate, authorizeRoles('admin','secretary','responsible','viewer'), getActivityById);       // عرض نشاط واحد (محمي)
router.post("/", authenticate, authorizeRoles('admin','secretary'), createActivity);          // إضافة نشاط جديد (محمي)
router.put("/:id", authenticate, authorizeRoles('admin','secretary'), updateActivity);        // تعديل نشاط (محمي)
// Check-in via QR for a specific activity
router.post("/:id/checkin-qr", authenticate, authorizeRoles('admin','secretary','responsible'), checkInByQr);
// Regenerate QR token for printing/printing a QR
router.post('/:id/qr-regenerate', authenticate, authorizeRoles('admin','secretary'), regenerateQrToken);
router.delete("/:id", authenticate, authorizeRoles('admin'), deleteActivity);     // حذف نشاط (Admin فقط)

// صفحة لائحة الحضور الخاصة بنشاط
router.get('/:id/attendance', authenticate, authorizeRoles('admin','secretary','responsible','viewer'), renderActivityAttendancePage);

export default router;
