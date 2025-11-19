import Attendance from "../models/Attendance.js";
import Member from "../models/Member.js";
import Activity from "../models/Activity.js";
import { logAudit } from '../utils/audit.js';

// عرض كل سجلات الحضور
export const getAllAttendances = async (req, res) => {
  try {
    // Support optional query filters for activityId and memberId to allow
    // fetching attendances for a specific activity or member.
    const filter = {};
    if (req.query.activityId) filter.activityId = req.query.activityId;
    if (req.query.memberId) filter.memberId = req.query.memberId;

    const attendances = await Attendance.find(filter)
      .populate("memberId", "fullName memberType")
      .populate("activityId", "title date")
      .populate("recordedBy", "username");
    res.json(attendances);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// عرض سجل حضور واحد
export const getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate("memberId", "fullName memberType")
      .populate("activityId", "title date");
    if (!attendance) return res.status(404).json({ message: "سجل الحضور غير موجود" });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// تسجيل حضور عضو لنشاط
export const createAttendance = async (req, res) => {
  try {
    const { memberId, activityId, presenceStatus } = req.body;

    // التأكد من وجود العضو والنشاط
    const member = await Member.findById(memberId);
    const activity = await Activity.findById(activityId);
    if (!member) return res.status(404).json({ message: "العضو غير موجود" });
    if (!activity) return res.status(404).json({ message: "النشاط غير موجود" });

    // منع تسجيل نفس العضو لنفس النشاط أكثر من مرة
    const existing = await Attendance.findOne({ memberId, activityId });
    if (existing) return res.status(400).json({ message: "الحضور مسجل مسبقاً" });

    const attendance = new Attendance({ memberId, activityId, presenceStatus });
    await attendance.save();
    await logAudit(req, 'create', 'Attendance', attendance._id, null, attendance.toObject());
    res.status(201).json(attendance);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// تعديل حضور
export const updateAttendance = async (req, res) => {
  try {
    const before = await Attendance.findById(req.params.id).lean();
    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!attendance) return res.status(404).json({ message: "سجل الحضور غير موجود" });
    await logAudit(req, 'update', 'Attendance', attendance._id, before, attendance.toObject());
    res.json(attendance);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// حذف سجل حضور
export const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) return res.status(404).json({ message: "سجل الحضور غير موجود" });
    await logAudit(req, 'delete', 'Attendance', attendance._id, attendance.toObject(), null);
    res.json({ message: "تم حذف سجل الحضور بنجاح" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
