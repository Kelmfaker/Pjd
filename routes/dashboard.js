import express from "express";
import Member from "../models/Member.js";
import Activity from "../models/Activity.js";
import Attendance from "../models/Attendance.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import { logAudit } from '../utils/audit.js';
import crypto from 'crypto';

const router = express.Router();

// Render dashboard shell (client will fetch protected overview data)
router.get('/', (req, res) => {
  res.render('dashboard');
});

// Protected API: return dashboard overview JSON
router.get('/overview', authenticate, authorizeRoles('admin','secretary','responsible','viewer'), async (req, res) => {
  try {
    const bureauCount = await Member.countDocuments({ memberType: 'bureau' });
    const activeCount = await Member.countDocuments({ memberType: 'active' });
    const sympathizerCount = await Member.countDocuments({ memberType: 'sympathizer' });

    const upcomingActivities = await Activity.countDocuments({ date: { $gte: new Date() } });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

  // Avoid loading all attendance documents into memory (can be large) — use counts instead
  const totalAttendances = await Attendance.countDocuments({ recordedAt: { $gte: startOfMonth } });
  const presentCount = await Attendance.countDocuments({ recordedAt: { $gte: startOfMonth }, presenceStatus: 'present' });
    const attendanceRate = totalAttendances ? ((presentCount / totalAttendances) * 100).toFixed(1) : 0;

    res.json({
      bureauCount,
      activeCount,
      sympathizerCount,
      upcomingActivities,
      attendanceRate
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'فشل في تحميل ملخص لوحة التحكم' });
  }
});

// ADMIN: regenerate QR token for all activities (admin-only)
router.post('/admin/regenerate-all-qr', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const activities = await Activity.find();
    const updated = [];
    for (const act of activities) {
      const before = act.toObject();
      act.qrToken = crypto.randomBytes(12).toString('hex');
      await act.save();
      await logAudit(req, 'update', 'Activity', act._id, before, act.toObject());
      updated.push({ id: act._id, token: act.qrToken });
    }
    res.json({ message: 'تم تجديد رموز QR لجميع الأنشطة', count: updated.length, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'فشل في تجديد رموز QR' });
  }
});

// ADMIN: clear attendances (optionally for a specific activity)
router.post('/admin/clear-attendance', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const { activityId } = req.body || {};
    let result;
    if (activityId) {
      result = await Attendance.deleteMany({ activityId });
    } else {
      result = await Attendance.deleteMany({});
    }
    await logAudit(req, 'delete', 'Attendance', null, { activityId: activityId || 'all' }, null);
    res.json({ message: 'تم حذف سجلات الحضور', deletedCount: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'فشل في مسح سجلات الحضور' });
  }
});

// ADMIN: export core collections as JSON (members, activities, attendances)
router.get('/admin/export', authenticate, authorizeRoles('admin'), async (req, res) => {
  try {
    const members = await Member.find().lean();
    const activities = await Activity.find().lean();
    const attendances = await Attendance.find().lean();
    res.json({ members, activities, attendances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'فشل في تصدير البيانات' });
  }
});

export default router;
