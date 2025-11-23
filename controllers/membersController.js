import Member from "../models/Member.js";
import { logAudit } from '../utils/audit.js';
import User from "../models/User.js";
import { safeUnlink } from '../utils/uploads.js';

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
    if (payload.photoUrl && typeof payload.photoUrl === 'string') payload.photoUrl = payload.photoUrl.trim();

    // Normalize and validate national ID (cin). If the incoming value is empty string
    // or only whitespace, remove the key so we don't persist empty values which can
    // cause duplicate-key errors on a unique index.
    if ('cin' in payload) {
      const rawCin = payload.cin;
      if (rawCin === null || (typeof rawCin === 'string' && rawCin.trim() === '')) {
        delete payload.cin;
      } else if (typeof rawCin === 'string') {
        const c = rawCin.trim().toUpperCase().replace(/[-\s]+/g, '');
        if (c === '') delete payload.cin; else payload.cin = c;
      }
    }

    if (payload.neighborhood && typeof payload.neighborhood === 'string') {
      payload.neighborhood = payload.neighborhood.trim();
      // validate neighborhood against allowed list to avoid tampering
      const allowedNeighborhoods = ['أكدال', 'دار دبيبغ', 'الأدارسة', 'الدكارات', 'سيدي ابراهيم', 'طارق'];
      if (payload.neighborhood === '' || !allowedNeighborhoods.includes(payload.neighborhood)) {
        // if not allowed or empty, remove the field so downstream won't persist invalid value
        delete payload.neighborhood;
      }
    }
    if (payload.financialCommitment && typeof payload.financialCommitment === 'string') payload.financialCommitment = payload.financialCommitment.trim();
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

    // Accept alternative input key `membershipDate` (preferred human-facing name)
    // Map it to the schema field `joinedAt` so the rest of the code can query by joinedAt.
    // Important: do not overwrite/clear existing joinedAt when the incoming field is empty
    // (e.g. edit form left blank). Only set `joinedAt` when a valid non-empty date is provided.
    if ('membershipDate' in payload) {
      const raw = payload.membershipDate;
      // if user submitted an empty value (""), treat as no-op for updates
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        // remove the membershipDate key so it doesn't overwrite existing value downstream
        delete payload.membershipDate;
      } else {
        try {
          const str = String(raw).trim();
          const d = new Date(str);
          if (!isNaN(d)) {
            // Prefer storing a date-only value (UTC midnight) when input is yyyy-mm-dd
            const parts = str.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
              const y = Number(parts[0]);
              const m = Number(parts[1]);
              const day = Number(parts[2]);
              if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(day)) {
                payload.joinedAt = new Date(Date.UTC(y, m - 1, day));
              } else {
                payload.joinedAt = d;
              }
            } else {
              payload.joinedAt = d;
            }
          } else {
            // invalid date string: do not set joinedAt (leave existing value unchanged)
          }
        } catch (e) { /* ignore invalid date */ }
      }
    }
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
    // Require explicit membershipDate / joinedAt on create
    if (!data.joinedAt) {
      return res.status(400).json({ message: 'تاريخ العضوية مطلوب عند إضافة عضو' });
    }
    const member = new Member(data);
    await member.save();
    // audit
    await logAudit(req, 'create', 'Member', member._id, null, member.toObject());
    // If this member has a role value and there is a linked User, ensure that
    // linked user's system role is set to 'responsible' so they see role-specific controls.
    try {
      if (member.role) {
        const linkedUser = await User.findOne({ member: member._id });
        if (linkedUser && (!linkedUser.role || (linkedUser.role !== 'admin' && linkedUser.role !== 'secretary'))) {
          const beforeU = linkedUser.toObject();
          linkedUser.role = 'responsible';
          await linkedUser.save();
          await logAudit(req, 'update', 'User', linkedUser._id, beforeU, linkedUser.toObject());
        }
      }
    } catch (syncErr) {
      console.error('Failed to sync member role to linked user', syncErr && (syncErr.stack || syncErr));
    }
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
    // If this member has a role value and there is a linked User, ensure that
    // linked user's system role is set to 'responsible' so they see role-specific controls.
    try {
      if (member.role) {
        const linkedUser = await User.findOne({ member: member._id });
        if (linkedUser && (!linkedUser.role || (linkedUser.role !== 'admin' && linkedUser.role !== 'secretary'))) {
          const beforeU = linkedUser.toObject();
          linkedUser.role = 'responsible';
          await linkedUser.save();
          await logAudit(req, 'update', 'User', linkedUser._id, beforeU, linkedUser.toObject());
        }
      }
    } catch (syncErr) {
      console.error('Failed to sync member role to linked user', syncErr && (syncErr.stack || syncErr));
    }
    // If the member replaced their photo, delete the old local upload to avoid orphans
    try {
      if (before && before.photoUrl && before.photoUrl !== member.photoUrl) {
        const removed = await safeUnlink(before.photoUrl);
        if (removed) console.log('Removed old upload:', before.photoUrl);
      }
    } catch (e) {
      console.error('Failed to remove old upload', e && (e.stack || e));
    }

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
    // delete stored photo file if present
    try {
      if (member.photoUrl) {
        const removed = await safeUnlink(member.photoUrl);
        if (removed) console.log('Deleted upload for removed member:', member.photoUrl);
      }
    } catch (e) {
      console.error('Failed to delete upload for removed member', e && (e.stack || e));
    }

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
