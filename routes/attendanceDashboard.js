import express from "express";
import Activity from "../models/Activity.js";
import Member from "../models/Member.js";
import Attendance from "../models/Attendance.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import { logAudit } from '../utils/audit.js';

const router = express.Router();

// عرض صفحة الحضور
router.get("/", authenticate, authorizeRoles("admin", "secretary"), async (req, res) => {
  try {
    const activities = await Activity.find().populate("responsible", "fullName");
    res.render("attendance", { activities });
  } catch (err) {
    res.status(500).send("خطأ في تحميل الأنشطة للحضور");
  }
});

// حفظ الحضور
router.post("/", authenticate, authorizeRoles("admin", "secretary"), async (req, res) => {
  try {
    const { activityId, records } = req.body; // records = [{ memberId, presenceStatus, method, comment }, ...]

    // Snapshot before changes for audit
    const before = await Attendance.find({ activityId }).lean();

    const now = new Date();
    const results = [];

    // Process each submitted record individually (upsert semantics)
    for (const r of (records || [])) {
      if (!r || !r.memberId) continue;
      const filter = { activityId, memberId: r.memberId };
      const existing = await Attendance.findOne(filter);

      // Determine whether we need to update or create
      if (existing) {
        const samePresence = existing.presenceStatus === r.presenceStatus;
        const sameComment = (existing.comment || '') === (r.comment || '');
        const sameMethod = (existing.method || 'manual') === (r.method || 'manual');
        if (samePresence && sameComment && sameMethod) {
          // no-op, keep existing timestamps
          results.push(existing);
          continue;
        }

        // update changed fields and set recordedBy/recordedAt to now
        existing.presenceStatus = r.presenceStatus;
        existing.comment = r.comment || '';
        existing.method = r.method || 'manual';
        existing.recordedBy = req.user && req.user._id ? req.user._id : existing.recordedBy;
        existing.recordedAt = now;
        await existing.save();
        results.push(existing);
      } else {
        // create new attendance
        const doc = new Attendance({
          memberId: r.memberId,
          activityId,
          presenceStatus: r.presenceStatus,
          recordedBy: req.user && req.user._id ? req.user._id : undefined,
          recordedAt: now,
          method: r.method || 'manual',
          comment: r.comment || ''
        });
        await doc.save();
        results.push(doc);
      }
    }

    // After snapshot for audit
    const after = await Attendance.find({ activityId }).lean();
    await logAudit(req, 'update', 'Attendance', activityId, before, after);

    res.json({ message: "تم حفظ الحضور بنجاح", data: results });
  } catch (err) {
    console.error('Failed saving attendance', err && (err.stack || err));
    res.status(500).json({ message: "حدث خطأ أثناء حفظ الحضور" });
  }
});

export default router;

// QR check-in UI route (renders a small page for scanning/entering QR tokens)
router.get('/qr', authenticate, authorizeRoles('admin','secretary','responsible'), async (req, res) => {
  try {
    const activities = await Activity.find().populate('responsible','fullName');
    res.render('attendance-qr', { activities });
  } catch (err) {
    res.status(500).send('خطأ في تحميل صفحة QR للحضور');
  }
});
