import express from "express";
import Member from "../models/Member.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

// عرض صفحة الأعضاء
// Allow viewers and responsible users to view the members page (read-only)
router.get("/", authenticate, authorizeRoles("admin", "secretary", "responsible"), async (req, res) => {
  try {
    // If the user is a viewer, redirect them to the read-only activities list
    if (req.user && String(req.user.role).toLowerCase() === 'viewer') {
      return res.redirect('/activities');
    }
  // Pagination params
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, Math.min(200, parseInt(req.query.size, 10) || 50)); // default 50, cap 200

    // Sorting
    const allowedSort = ['fullName', 'membershipId', 'joinedAt', 'status', 'memberType', 'phone', 'createdAt', '_id', 'gender', 'educationLevel'];
    let sortField = req.query.sort && allowedSort.includes(req.query.sort) ? req.query.sort : 'fullName';
    let sortOrder = req.query.order && String(req.query.order).toLowerCase() === 'desc' ? -1 : 1;
    const sortObj = { [sortField]: sortOrder };

    // Build filter (support name search via ?q=...) and optional filters for gender, educationLevel, memberType
    const q = req.query.q && String(req.query.q).trim();
    const filter = {};
    if (q) {
      // escape regex metacharacters from user input
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.fullName = { $regex: esc, $options: 'i' };
    }
    if (req.query.gender) filter.gender = req.query.gender;
    if (req.query.educationLevel) filter.educationLevel = req.query.educationLevel;
    if (req.query.memberType) filter.memberType = req.query.memberType;

    const totalCount = await Member.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);

    const members = await Member.find(filter)
      .sort(sortObj)
      .skip((safePage - 1) * pageSize)
      .limit(pageSize)
      .lean();

    res.render("members", {
      members,
      pagination: { page: safePage, pageSize, totalCount, totalPages },
      q: q || '',
      // echo back current filters for the UI
      currentFilters: {
        gender: req.query.gender || '',
        educationLevel: req.query.educationLevel || '',
        memberType: req.query.memberType || ''
      }
    });
  } catch (err) {
    console.error('Error loading members page', err);
    res.status(500).send("خطأ في تحميل الأعضاء");
  }
});

export default router;
