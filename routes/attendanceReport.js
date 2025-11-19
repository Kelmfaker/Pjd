import express from "express";
import Activity from "../models/Activity.js";
import Attendance from "../models/Attendance.js";
import Member from "../models/Member.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

// عرض صفحة التقرير
router.get("/", authenticate, authorizeRoles("admin", "secretary"), async (req, res) => {
  try {
    const activities = await Activity.find().populate("responsible", "fullName");
    res.render("attendanceReport", { activities });
  } catch (err) {
    res.status(500).send("خطأ في تحميل التقرير");
  }
});

// جلب تقرير نشاط محدد (AJAX)
router.get("/:activityId", authenticate, authorizeRoles("admin", "secretary"), async (req, res) => {
  try {
    const activityId = req.params.activityId;
    const activity = await Activity.findById(activityId).populate("responsible", "fullName");
    if(!activity) return res.status(404).json({ message: "النشاط غير موجود" });

    const attendances = await Attendance.find({ activityId });
    const report = activity.responsible.map(member => {
      const record = attendances.find(a => a.memberId.toString() === member._id.toString());
      return {
        fullName: member.fullName,
        presenceStatus: record ? record.presenceStatus : "غير مسجل"
      };
    });

    const total = report.length;
    const presentCount = report.filter(r => r.presenceStatus === "present").length;
    const attendanceRate = total ? ((presentCount / total) * 100).toFixed(1) : 0;

    res.json({ report, attendanceRate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "حدث خطأ أثناء جلب التقرير" });
  }
});

// تقرير إجمالي الشهر
router.get("/month/summary", authenticate, authorizeRoles("admin", "secretary"), async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const attendances = await Attendance.find({ recordedAt: { $gte: startOfMonth } });
    const total = attendances.length;
    const presentCount = attendances.filter(a => a.presenceStatus === "present").length;
    const attendanceRate = total ? ((presentCount / total) * 100).toFixed(1) : 0;

    res.json({ totalAttendances: total, presentCount, attendanceRate });
  } catch(err){
    console.error(err);
    res.status(500).json({ message: "حدث خطأ أثناء جلب تقرير الشهر" });
  }
});

export default router;
