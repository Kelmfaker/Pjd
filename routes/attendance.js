import express from "express";
import {
  getAllAttendances,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance
} from "../controllers/attendanceController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", authenticate, authorizeRoles('admin','secretary'), getAllAttendances);          // عرض كل سجلات الحضور (محمي)
router.get("/:id", authenticate, authorizeRoles('admin','secretary'), getAttendanceById);       // عرض سجل واحد (محمي)
router.post("/", authenticate, authorizeRoles('admin','secretary'), createAttendance);          // تسجيل حضور (محمي)
router.put("/:id", authenticate, authorizeRoles('admin','secretary'), updateAttendance);        // تعديل حضور (محمي)
router.delete("/:id", authenticate, authorizeRoles('admin'), deleteAttendance);     // حذف سجل حضور (Admin فقط)

export default router;
