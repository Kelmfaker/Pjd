import express from "express";
import Activity from "../models/Activity.js";
import Member from "../models/Member.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";
import { renderActivityAttendancePage } from "../controllers/activitiesController.js";

const router = express.Router();

// عرض صفحة الأنشطة
// Allow responsible and viewer roles to view activities dashboard (read-only)
router.get("/", authenticate, authorizeRoles("admin", "secretary", "responsible", "viewer"), async (req, res) => {
  try {
    let activities = [];

    // If the user is a 'responsible' role, show only activities assigned to them ("مهامي").
    if (req.user && String(req.user.role).toLowerCase() === 'responsible') {
      // Attempt to find Member records that correspond to this user.
      // Match by email, fullName containing username, or username equality.
      const username = (req.user.username || req.user.name || '').trim();
      const possibleMatches = [];
      if (req.user.email) possibleMatches.push({ email: req.user.email });
      if (username) {
        possibleMatches.push({ email: username });
        possibleMatches.push({ fullName: { $regex: username.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), $options: 'i' } });
      }

      let memberIds = [];
      if (possibleMatches.length > 0) {
        const members = await Member.find({ $or: possibleMatches }).select('_id');
        memberIds = members.map(m => m._id);
      }

      if (memberIds.length > 0) {
        activities = await Activity.find({ responsible: { $in: memberIds } }).populate('responsible', 'fullName');
      } else {
        // No linked member found — return empty list so the user sees "مهامي" but no items.
        activities = [];
      }
    } else {
      // Admin/secretary/viewer see all activities
      activities = await Activity.find().populate("responsible", "fullName");
    }

    const bureauMembers = await Member.find({ memberType: "bureau" }); // لأختيار المكلفين
    res.render("activities", { activities, bureauMembers });
  } catch (err) {
    console.error('Error loading activities dashboard', err);
    res.status(500).send("خطأ في تحميل الأنشطة");
  }
});

  // صفحـة لائحة الحضور لنشاط معين (UI)
  router.get('/:id/attendance', authenticate, authorizeRoles('admin','secretary','responsible','viewer'), renderActivityAttendancePage);

export default router;
