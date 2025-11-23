import Activity from "../models/Activity.js";
import Member from "../models/Member.js";
import Attendance from "../models/Attendance.js";
import { logAudit } from '../utils/audit.js';
import crypto from 'crypto';
import QRCode from 'qrcode';

// عرض كل الأنشطة
export const getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find().populate("responsible", "fullName role");
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// عرض نشاط واحد
export const getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id).populate("responsible", "fullName role");
    if (!activity) return res.status(404).json({ message: "النشاط غير موجود" });
    res.json(activity);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// إضافة نشاط جديد
export const createActivity = async (req, res) => {
  try {
    // accept either 'kind' or legacy 'type' from form
    const { title, kind, type, description, location, date, responsible, status } = req.body;
    const kindVal = kind || type || 'other';
    const statusVal = status || 'scheduled';

    // التحقق من أن المكلفين هم أعضاء مكتب فقط (responsible expected as array)
    const respArray = Array.isArray(responsible) ? responsible : (responsible ? [responsible] : []);
    if (respArray.length) {
      const validMembers = await Member.find({ _id: { $in: respArray }, memberType: "bureau" });
      if (validMembers.length !== respArray.length) {
        return res.status(400).json({ message: "بعض المكلفين غير أعضاء مكتب" });
      }
    }

    const activity = new Activity({ title, kind: kindVal, description, location, date, responsible: respArray, status: statusVal });
    await activity.save();
    await logAudit(req, 'create', 'Activity', activity._id, null, activity.toObject());
    res.status(201).json(activity);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// تعديل نشاط
export const updateActivity = async (req, res) => {
  try {
    const before = await Activity.findById(req.params.id).lean();
    const activity = await Activity.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!activity) return res.status(404).json({ message: "النشاط غير موجود" });
    await logAudit(req, 'update', 'Activity', activity._id, before, activity.toObject());
    res.json(activity);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// حذف نشاط
export const deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) return res.status(404).json({ message: "النشاط غير موجود" });
    await logAudit(req, 'delete', 'Activity', activity._id, activity.toObject(), null);
    res.json({ message: "تم حذف النشاط بنجاح" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Check-in by QR token: verifies activity's qrToken and creates/updates an attendance record
export const checkInByQr = async (req, res) => {
  try {
    const activityId = req.params.id;
    const { memberId, membershipId, qrToken, presenceStatus = 'present' } = req.body;

    const activity = await Activity.findById(activityId);
    if (!activity) return res.status(404).json({ message: 'النشاط غير موجود' });

    // Activity must have a qrToken set and it must match
    if (!activity.qrToken || !qrToken || activity.qrToken !== qrToken) {
      return res.status(403).json({ message: 'رمز QR غير صالح أو لا يطابق النشاط' });
    }

    // Find member by _id or by numeric membershipId
    let member = null;
    if (memberId) member = await Member.findById(memberId);
    else if (membershipId) member = await Member.findOne({ membershipId });

    if (!member) return res.status(404).json({ message: 'العضو غير موجود' });

    // Upsert attendance (one record per member+activity)
    const before = await Attendance.findOne({ memberId: member._id, activityId }).lean();
    const attendance = await Attendance.findOneAndUpdate(
      { memberId: member._id, activityId },
      { memberId: member._id, activityId, presenceStatus, method: 'qr', recordedBy: req.user && req.user._id ? req.user._id : undefined, recordedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logAudit(req, before ? 'update' : 'create', 'Attendance', attendance._id, before, attendance.toObject());
    res.json({ message: 'تم تسجيل الحضور عبر QR بنجاح', attendance });
  } catch (err) {
    console.error('QR checkin error', err);
    res.status(500).json({ message: err.message });
  }
};

// Regenerate (or create) a QR token for an activity and return printable info
export const regenerateQrToken = async (req, res) => {
  try {
    const activityId = req.params.id;
    const activity = await Activity.findById(activityId);
    if (!activity) return res.status(404).json({ message: 'النشاط غير موجود' });

    // Generate a secure random token
    const token = crypto.randomBytes(12).toString('hex');
    const before = activity.toObject();
    activity.qrToken = token;
    await activity.save();
    await logAudit(req, 'update', 'Activity', activity._id, before, activity.toObject());

    const baseUrl = process.env.APP_BASE_URL || '';
    const printableUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/attendance/qr?activity=${activity._id}&token=${token}` : `/?activity=${activity._id}&token=${token}`;

    res.json({ message: 'تم إنشاء رمز QR للنشاط', token, printableUrl });
  } catch (err) {
    console.error('regenerateQrToken error', err);
    res.status(500).json({ message: err.message });
  }
};

// Serve a PNG QR image for an activity. Requires the token query param to match activity.qrToken
export const serveQrPng = async (req, res) => {
  try {
    const activityId = req.params.id;
    const token = req.query.token;
    const activity = await Activity.findById(activityId);
    if (!activity) return res.status(404).json({ message: 'النشاط غير موجود' });

    if (!activity.qrToken || !token || activity.qrToken !== token) {
      return res.status(403).json({ message: 'رمز QR غير صالح أو لا يطابق النشاط' });
    }

    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const printableUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/attendance/qr?activity=${activity._id}&token=${token}` : `/?activity=${activity._id}&token=${token}`;

    const buffer = await QRCode.toBuffer(printableUrl, { type: 'png', width: 400 });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="activity-${activity._id}-qr.png"`);
    res.send(buffer);
  } catch (err) {
    console.error('serveQrPng error', err);
    res.status(500).json({ message: err.message });
  }
};

// Render a dedicated attendance page for an activity (UI)
export const renderActivityAttendancePage = async (req, res) => {
  try {
    // Prevent viewers from seeing member attendance lists — redirect to activities list
    if (req.user && String(req.user.role).toLowerCase() === 'viewer') {
      return res.redirect('/activities');
    }
    const activityId = req.params.id;
    const activity = await Activity.findById(activityId).populate('responsible', 'fullName memberType');
    if (!activity) return res.status(404).send('النشاط غير موجود');

    const attendance = await Attendance.find({ activityId }).populate('memberId', 'fullName membershipId memberType').populate('recordedBy', 'username');

    res.render('activity-attendance', { activity, attendance });
  } catch (err) {
    console.error('Failed to render activity attendance page', err);
    res.status(500).send('خطأ في تحميل لائحة الحضور للنشاط');
  }
};
