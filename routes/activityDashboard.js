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
      // If the account is linked to a Member document, use that directly for filtering.
      if (req.user.member && req.user.member._id) {
        activities = await Activity.find({ responsible: req.user.member._id }).populate('responsible', 'fullName');
      } else {
        // Fallback: attempt to find Member records that correspond to this user by username/email
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
      }
    } else {
      // Admin/secretary/viewer see all activities
      activities = await Activity.find().populate("responsible", "fullName");
    }

    // Support filtering by member.role via query param `memberRole` or `roleFilter`.
    const memberRoleFilter = (req.query.memberRole || req.query.roleFilter || '').toString().trim();
    if (memberRoleFilter) {
      const matched = await Member.find({ role: memberRoleFilter }).select('_id');
      const matchedIds = matched.map(m => m._id);
      if (matchedIds.length > 0) {
        activities = await Activity.find({ responsible: { $in: matchedIds } }).populate('responsible', 'fullName');
      } else {
        activities = [];
      }
    }

    const isViewer = req.user && String(req.user.role).toLowerCase() === 'viewer';

    let bureauMembers = [];
    if (!isViewer) {
      bureauMembers = await Member.find({ memberType: "bureau" }); // لأختيار المكلفين
    }

    // For viewers we avoid populating member names/returning member lists.
    res.render("activities", { activities, bureauMembers, showMemberNames: !isViewer });
  } catch (err) {
    console.error('Error loading activities dashboard', err);
    res.status(500).send("خطأ في تحميل الأنشطة");
  }
});

  // صفحـة لائحة الحضور لنشاط معين (UI)
  router.get('/:id/attendance', authenticate, authorizeRoles('admin','secretary','responsible','viewer'), renderActivityAttendancePage);

export default router;
