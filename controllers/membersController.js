import Member from "../models/Member.js";
import { logAudit } from '../utils/audit.js';

// Normalize incoming member fields (map localized labels to canonical enum values)
function normalizeMemberInput(input = {}) {
  const payload = { ...input };

  // normalize gender -> schema expects 'M' or 'F' (we removed 'other')
  if (payload.gender && typeof payload.gender === 'string') {
    const g = payload.gender.trim().toLowerCase();
    if (g === 'أنثى' || g === 'female' || g === 'f' || g === 'أنثي' || g === 'انثى') {
      payload.gender = 'F';
    } else if (g === 'ذكر' || g === 'male' || g === 'm') {
      payload.gender = 'M';
    } else if (g === 'other' || g === 'غير محدد' || g === 'غير_محدد' || g === 'غير محددة') {
      // no longer support 'other' — remove the field so it won't fail validation
      delete payload.gender;
    } else {
      // keep as-is; mongoose will validate and reject invalid enums
      payload.gender = payload.gender;
    }
  }

  // normalize status -> schema expects 'active' or 'inactive'
  if (payload.status && typeof payload.status === 'string') {
    const s = payload.status.trim().toLowerCase();
    if (s === 'نشط' || s === 'active' || s === 'نشط️') {
      payload.status = 'active';
    } else if (s === 'غير نشط' || s === 'inactive' || s === 'غير_نشط' || s === 'غير-نشط') {
      payload.status = 'inactive';
    } else {
      payload.status = payload.status;
    }
  }
  
    // trim common text fields
    if (payload.fullName && typeof payload.fullName === 'string') payload.fullName = payload.fullName.trim();
    if (payload.phone && typeof payload.phone === 'string') {
      // normalize phone by removing spaces, dashes and parentheses
      payload.phone = payload.phone.replace(/[\s\-()]+/g, '').trim();
    }
    if (payload.email && typeof payload.email === 'string') payload.email = payload.email.trim();
    if (payload.address && typeof payload.address === 'string') payload.address = payload.address.trim();
    if (payload.role && typeof payload.role === 'string') payload.role = payload.role.trim();
    if (payload.bio && typeof payload.bio === 'string') payload.bio = payload.bio.trim();
    if (payload.pdfUrl && typeof payload.pdfUrl === 'string') payload.pdfUrl = payload.pdfUrl.trim();
    if (payload.cin && typeof payload.cin === 'string') {
      // national ID: normalize by trimming and uppercasing to reduce duplicates
      payload.cin = payload.cin.trim().toUpperCase();
    }
    // educationLevel and occupation should be canonical codes; trim if present
    if (payload.educationLevel && typeof payload.educationLevel === 'string') payload.educationLevel = payload.educationLevel.trim();
    if (payload.occupation && typeof payload.occupation === 'string') payload.occupation = payload.occupation.trim();
    // boolean fields: accept 'true'/'false', 'نعم'/'لا', '1'/'0'
    function parseBool(v){
      if (typeof v === 'boolean') return v;
      if (!v && v !== 0) return false;
      const s = String(v).trim().toLowerCase();
      return (s === 'true' || s === '1' || s === 'نعم' || s === 'y' || s === 'yes');
    }
    if ('memberOfRegionalBodies' in payload) payload.memberOfRegionalBodies = parseBool(payload.memberOfRegionalBodies);
    if ('assignedMission' in payload) payload.assignedMission = parseBool(payload.assignedMission);
    if (payload.memberOfRegionalBodiesDetail && typeof payload.memberOfRegionalBodiesDetail === 'string') payload.memberOfRegionalBodiesDetail = payload.memberOfRegionalBodiesDetail.trim();
    if (payload.assignedMissionDetail && typeof payload.assignedMissionDetail === 'string') payload.assignedMissionDetail = payload.assignedMissionDetail.trim();
    if (payload.previousPartyExperiences && typeof payload.previousPartyExperiences === 'string') payload.previousPartyExperiences = payload.previousPartyExperiences.trim();

  return payload;
}

// عرض كل الأعضاء
export const getAllMembers = async (req, res) => {
  try {
    // Server-side sorting: allow ?sort=field1,field2&order=asc|desc
    // Allow sorting by gender and educationLevel as well as memberType
    const allowedSortFields = ['fullName', 'membershipId', 'joinedAt', 'status', 'memberType', 'phone', 'createdAt', '_id', 'gender', 'educationLevel'];
    let sortParam = req.query.sort;
    const sortOrder = (req.query.order && String(req.query.order).toLowerCase() === 'desc') ? -1 : 1;
    let sortObj = {};
    if (sortParam) {
      // support comma-separated fields: ?sort=gender,educationLevel
      const parts = String(sortParam).split(',').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (allowedSortFields.includes(p)) sortObj[p] = sortOrder;
      }
    }
    // default sort if nothing valid provided
    if (Object.keys(sortObj).length === 0) sortObj = { fullName: 1 };

    // Filtering: allow ?gender=M|F, ?educationLevel=bachelor, ?memberType=active
    const filters = {};
    if (req.query.gender) filters.gender = req.query.gender;
    if (req.query.educationLevel) filters.educationLevel = req.query.educationLevel;
    if (req.query.memberType) filters.memberType = req.query.memberType;

    const members = await Member.find(filters).sort(sortObj);
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// عرض عضو واحد
export const getMemberById = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: "العضو غير موجود" });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// إضافة عضو جديد
export const createMember = async (req, res) => {
  try {
    const data = normalizeMemberInput(req.body);
    const member = new Member(data);
    await member.save();
    // audit
    await logAudit(req, 'create', 'Member', member._id, null, member.toObject());
    res.status(201).json(member);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// تعديل بيانات عضو
export const updateMember = async (req, res) => {
  try {
    const before = await Member.findById(req.params.id).lean();
    const data = normalizeMemberInput(req.body);
    const member = await Member.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!member) return res.status(404).json({ message: "العضو غير موجود" });
    await logAudit(req, 'update', 'Member', member._id, before, member.toObject());
    res.json(member);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// حذف عضو
export const deleteMember = async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json({ message: "العضو غير موجود" });
    await logAudit(req, 'delete', 'Member', member._id, member.toObject(), null);
    res.json({ message: "تم حذف العضو بنجاح" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Bulk delete members. Supports optional filters via query params.
// To delete all members: DELETE /api/members?confirm=true
// To delete filtered members: DELETE /api/members?memberType=active&status=inactive&beforeJoined=2023-01-01
export const deleteMembers = async (req, res) => {
  try {
    const { confirm } = req.query;
    const filters = {};
    if (req.query.memberType) filters.memberType = req.query.memberType;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.beforeJoined) {
      const d = new Date(req.query.beforeJoined);
      if (!isNaN(d)) filters.joinedAt = { $lt: d };
    }

    if (!confirm && Object.keys(filters).length === 0) {
      return res.status(400).json({ message: 'Specify at least one filter or set confirm=true to delete all members.' });
    }

    // perform delete
    const result = await Member.deleteMany(filters);
    // audit the action with filter summary
    await logAudit(req, 'delete', 'MemberBulk', null, { filters }, { deletedCount: result.deletedCount });
    res.json({ message: 'Bulk delete completed', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
