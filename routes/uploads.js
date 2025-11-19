import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import Member from '../models/Member.js';
import { logAudit } from '../utils/audit.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();

// Serve a simple sample template (generated into tmp/members-template.xlsx)
router.get('/template', (req, res) => {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(__dirname, '../tmp/members-template.xlsx');
    console.log('[uploads] template request, resolved path=', filePath, 'exists=', fs.existsSync(filePath));
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Template not found' });
    return res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Failed to send template via sendFile', err && err.message ? err.message : err);
        if (!res.headersSent) res.status(500).json({ message: 'Failed to send template' });
      }
    });
  } catch (err) {
    console.error('Error serving template', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Use memory storage — we'll parse buffer directly
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function mapRowToMember(row) {
  // Normalize header keys (lowercase, trim, remove spaces/underscores)
  const mapped = {};
  for (const key of Object.keys(row)) {
    const raw = String(key).trim();
    const rawLower = raw.toLowerCase();
    // ascii-normalized key (for common English headers)
    const ascii = rawLower.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    // keep both forms so Arabic or non-ascii headers are still accessible
    if (ascii) mapped[ascii] = row[key];
    mapped[rawLower] = row[key];
  }

  // Map likely column names to Member fields
  const payload = {
    // try ascii keys first, then raw lowercase keys (this lets Arabic headers like 'الاسم' work)
    fullName: mapped.fullname || mapped.name || mapped['الاسم'] || mapped['full_name'] || mapped['full name'] || mapped['name_ar'] || mapped.name || mapped['الاسم'.toLowerCase()],
    membershipId: mapped.membershipid || mapped.id || mapped['membership_id'],
    phone: mapped.phone || mapped.telephone || mapped['الهاتف'],
    email: mapped.email || mapped['البريد الإلكتروني'] || mapped.mail,
    address: mapped.address || mapped['address_ar'],
    gender: mapped.gender || mapped.sex || mapped['الجنس'],
    status: mapped.status || mapped['الحالة'],
    memberType: mapped.membertype || mapped['member_type'] || mapped['type'],
    joinedAt: mapped.joinedat || mapped['joined_at'] || mapped.joined || mapped['join_date'] || mapped['تاريخ الانضمام'] || mapped['تاريخ_الانضمام'],
    educationLevel: mapped.educationlevel || mapped.education || mapped['education_level'],
    occupation: mapped.occupation || mapped.job || mapped['العمل'],
    role: mapped.role || mapped.position || mapped['المهمة'] || mapped['المهمة (نص)'],
    bio: mapped.bio || mapped.notes || mapped.description,
    pdfUrl: mapped.pdfurl || mapped.cv || mapped.resume,
    cin: mapped.cin || mapped['cin'] || mapped['الرقم_الوطني'] || mapped['الرقم الوطني'] || mapped['cin_number']
  };

  // Remove undefined fields
  Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
  return payload;
}

// POST /api/uploads/members-import
router.post('/members-import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded. Attach an Excel file using field name "file".' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ message: 'Excel file contains no sheets.' });

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: 'No rows found in sheet.' });

    // Limit rows to prevent accidental huge imports
    const MAX_ROWS = 1000;
    if (rows.length > MAX_ROWS) return res.status(400).json({ message: `Too many rows (${rows.length}). Limit is ${MAX_ROWS}.` });

  const results = { created: 0, updated: 0, failed: 0, errors: [] };

    // import mode: 'upsert' (default) | 'append' | 'skip'
    const mode = (req.body && req.body.mode) ? String(req.body.mode).toLowerCase() : (req.query.mode || 'upsert');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const payload = mapRowToMember(row);
        // Basic normalization to satisfy Member schema defaults/constraints
        if (!payload.memberType) payload.memberType = 'active';
        if (!payload.status) payload.status = 'active';
        if (payload.joinedAt) {
          // try common Excel date formats and ISO strings
          const parsed = new Date(payload.joinedAt);
          if (!isNaN(parsed)) payload.joinedAt = parsed;
          else delete payload.joinedAt;
        }
        if (payload.gender) {
          const g = String(payload.gender).trim().toLowerCase();
          if (['m','male','ذكر','ذكرى'].includes(g)) payload.gender = 'M';
          else if (['f','female','أنثى','انثى'].includes(g)) payload.gender = 'F';
          else delete payload.gender;
        }
        if (payload.membershipId) {
          const n = Number(payload.membershipId);
          if (!isNaN(n)) payload.membershipId = n;
          else delete payload.membershipId;
        }
        if (payload.cin && typeof payload.cin === 'string') {
          const c = String(payload.cin).trim().toUpperCase();
          // remove common spaces or dashes
          payload.cin = c.replace(/[-\s]+/g, '') || undefined;
          if (!payload.cin) delete payload.cin;
        }
        // normalize phone by removing spaces, dashes and parentheses
        if (payload.phone && typeof payload.phone === 'string') {
          payload.phone = payload.phone.replace(/[\s\-()]+/g, '').trim();
          if (!payload.phone) delete payload.phone;
        }
      // Attempt upsert: match by membershipId -> email -> phone -> fullname (case-insensitive)
      try {
        let existing = null;

        if (mode === 'append') {
          // force create new member (do not search for existing). Note: unique index conflicts may still occur.
          existing = null;
        } else {
          // default/upsert/skip: search for existing by membershipId, cin, email, phone, fullname
          if (payload.membershipId) existing = await Member.findOne({ membershipId: payload.membershipId });
          if (!existing && payload.cin) existing = await Member.findOne({ cin: payload.cin });
          if (!existing && payload.email) existing = await Member.findOne({ email: ('' + payload.email).toLowerCase().trim() });
          if (!existing && payload.phone) existing = await Member.findOne({ phone: '' + payload.phone });
          if (!existing && payload.fullName) {
            // case-insensitive exact match
            const esc = payload.fullName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
            existing = await Member.findOne({ fullName: { $regex: `^${esc}$`, $options: 'i' } });
          }
        }

        if (existing) {
          if (mode === 'skip') {
            // don't update; count as skipped
            results.errors.push({ row: i + 1, message: 'Skipped existing member (mode=skip)' });
            continue;
          }
          const before = existing.toObject();
          // merge fields from payload (prefer non-empty values)
          const updates = {};
          for (const k of Object.keys(payload)) {
            const v = payload[k];
            if (v !== undefined && v !== null && v !== '') updates[k] = v;
          }
          // If membershipId present and existing has none, set it
          if (updates.membershipId && !existing.membershipId) existing.membershipId = updates.membershipId;
          // apply other updates
          Object.assign(existing, updates);
          const saved = await existing.save();
          await logAudit(req, 'update', 'Member', saved._id, before, saved.toObject());
          results.updated += 1;
        } else {
          const member = new Member(payload);
          await member.save();
          await logAudit(req, 'create', 'Member', member._id, null, member.toObject());
          results.created += 1;
        }
      } catch (err) {
        results.failed += 1;
        results.errors.push({ row: i + 1, message: err.message || String(err) });
      }
    }

    res.json({ message: 'Import completed', rows: rows.length, results });
  } catch (err) {
    console.error('Import error', err);
    res.status(500).json({ message: err.message || 'Import failed' });
  }
});

export default router;
