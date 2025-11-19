import Member from "../models/Member.js";
import Attendance from "../models/Attendance.js";
import Activity from "../models/Activity.js";
import AttendanceReport from "../models/AttendanceReport.js";
import fs from 'fs';
import path from 'path';

let puppeteer;
try {
  // require lazily so app can still run if puppeteer isn't installed
  // user should run `npm install puppeteer --save` to enable PDF export
  // eslint-disable-next-line import/no-extraneous-dependencies
  const mod = await import('puppeteer');
  puppeteer = mod && (mod.default || mod);
} catch (err) {
  puppeteer = null;
}

// Skeleton: export members as CSV/JSON
export const exportMembers = async (req, res) => {
  try {
    const members = await Member.find();
    // TODO: implement CSV streaming; for now, return JSON
    res.json({ count: members.length, data: members });
  } catch (err) {
    const msg = err && (err.message || String(err)) || 'Unknown error';
    console.error('exportMembers error', err);
    res.status(500).json({ message: msg });
  }
};

export const exportAttendance = async (req, res) => {
  try {
    const { activityId } = req.query;
    const q = activityId ? { activityId } : {};
    const rows = await Attendance.find(q).populate('memberId', 'fullName membershipId').populate('activityId', 'title date');
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    const msg = err && (err.message || String(err)) || 'Unknown error';
    console.error('exportAttendance error', err);
    res.status(500).json({ message: msg });
  }
};

// Server-side PDF export of attendance for an activity
export const exportAttendancePdf = async (req, res) => {
  try {
    console.log('exportAttendancePdf called', { path: req.originalUrl, query: req.query, method: req.method, user: req.user && req.user.username });
    if (!puppeteer) return res.status(500).json({ message: 'PDF export not available: puppeteer not installed' });
    const { activityId, presentOnly } = req.query;
    if (!activityId) return res.status(400).json({ message: 'activityId query param is required' });

    const activity = await Activity.findById(activityId).populate('responsible', 'fullName membershipId memberType');
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    // Helpers to translate codes to Arabic
    const translateStatus = (code) => {
      if (!code) return '';
      const c = String(code).toLowerCase();
      if (c === 'present') return 'حاضر';
      if (c === 'absent') return 'غائب';
      return code;
    };
    const translateMemberType = (t) => {
      if (!t) return '';
      const s = String(t).toLowerCase();
      if (s === 'bureau') return 'عضو المكتب';
      if (s === 'active') return 'عضو عامل';
      if (s === 'sympathizer') return 'متعاطف';
      return t;
    };

    // Fetch attendance rows for mapping and optional filtering
    const allAttendances = await Attendance.find({ activityId }).populate('memberId', 'fullName membershipId memberType').sort({ recordedAt: 1 });
    const attendances = (presentOnly === 'true' || presentOnly === '1') ? allAttendances.filter(a => a.presenceStatus === 'present') : allAttendances;

    // Build a map of memberId -> presenceStatus
    const attMap = {};
    allAttendances.forEach(a => {
      const mid = a.memberId && a.memberId._id ? String(a.memberId._id) : String(a.memberId || '');
      attMap[mid] = a.presenceStatus || '';
    });

    // Responsible members list (activity.responsible may be array of IDs or populated docs)
    const responsibles = Array.isArray(activity.responsible) ? activity.responsible.map(r => ({
      id: r._id ? String(r._id) : String(r),
      fullName: r.fullName || String(r),
      memberType: r.memberType || ''
    })) : [];

    // If there are responsibles, produce a combined list showing their presence (if any)
    const responsibleRowsHtml = responsibles.map(r => {
      const statusRaw = attMap[r.id] || '';
      const status = statusRaw ? translateStatus(statusRaw) : 'غير مسجل';
      return `<tr><td style="border:1px solid #ccc;padding:6px">${r.fullName}</td><td style="border:1px solid #ccc;padding:6px">${status}</td></tr>`;
    }).join('');

    // Build attendance rows HTML (the actual recorded rows)
    const rowsHtml = attendances.map(a => {
      const name = a.memberId && a.memberId.fullName ? a.memberId.fullName : (a.memberId ? String(a.memberId) : '—');
      const memberType = a.memberId && (a.memberId.memberType || a.memberId.type) ? translateMemberType(a.memberId.memberType || a.memberId.type) : '';
      const status = translateStatus(a.presenceStatus || '');
      const when = a.recordedAt ? new Date(a.recordedAt).toLocaleDateString('ar-MA') : '';
      const recorder = a.recordedBy ? (a.recordedBy.username || String(a.recordedBy)) : '';
      return `<tr><td style="border:1px solid #ccc;padding:6px">${name}</td><td style="border:1px solid #ccc;padding:6px;text-align:center">${memberType}</td><td style="border:1px solid #ccc;padding:6px">${status}</td><td style="border:1px solid #ccc;padding:6px">${when}</td><td style="border:1px solid #ccc;padding:6px">${recorder}</td></tr>`;
    }).join('');

    // Activity metadata
    const metaHtml = `
      <div style="margin-top:8px">الموقع: ${activity.location || '—'}</div>
      <div>الوصف: ${activity.description || '—'}</div>
      <div>التاريخ: ${activity.date ? new Date(activity.date).toLocaleDateString('ar-MA') : '—'}</div>
    `;

    // Inline logo as data URI so PDF always contains the image without remote fetch
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo.png');
    let logoDataUri = null;
    try {
      if (fs.existsSync(logoPath)) {
        const buf = fs.readFileSync(logoPath);
        const b64 = buf.toString('base64');
        logoDataUri = `data:image/png;base64,${b64}`;
      }
    } catch (e) {
      console.warn('Could not inline logo for PDF', e && e.message);
      logoDataUri = null;
    }
    const logoUrl = logoDataUri || ((process.env.APP_BASE_URL ? process.env.APP_BASE_URL.replace(/\/$/, '') : '') + '/static/images/logo.png');
    const title = `تقرير الحضور - ${activity.title}`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        /* Center content and ensure it fits in A4 with margins */
        html,body{height:100%;margin:0;padding:0;font-family:Arial, Helvetica, sans-serif;direction:rtl;box-sizing:border-box}
        .print-container{max-width:820px;margin:0 auto;padding:18px 20px}
        .header{display:flex;align-items:center;gap:12px;justify-content:center}
        .header .meta{text-align:center}
        img.logo{height:64px;object-fit:contain}
        table{width:100%;border-collapse:collapse;margin-top:12px;table-layout:fixed;word-wrap:break-word}
        th, td{border:1px solid #ccc;padding:10px;text-align:right}
        thead th{background:#f6f6f6}
        .section{margin-top:12px}
        .small{font-size:12px;color:#666}
        @media print { tr { page-break-inside: avoid; } }
      </style>
      </head><body>
      <div class="print-container">
        <div class="header"><img class="logo" src="${logoUrl}" alt="logo"/><div class="meta"><h2 style="margin:0">${title}</h2>${metaHtml}</div></div>

        ${responsibles.length ? `<div class="section"><h3>قائمة المكلفين</h3><table><thead><tr><th style="width:70%">العضو</th><th style="width:30%">الحالة</th></tr></thead><tbody>${responsibleRowsHtml}</tbody></table></div>` : ''}

        <div class="section"><h3>سجل الحضور${presentOnly ? ' (الحاضرون فقط)' : ''}</h3>
          <table><thead><tr><th style="width:35%">العضو</th><th style="width:15%">النوع</th><th style="width:15%">الحالة</th><th style="width:20%">وقت التسجيل</th><th style="width:15%">مسجل بواسطة</th></tr></thead><tbody>${rowsHtml}</tbody></table>
        </div>
      </div>
      </body></html>`;

    // Launch puppeteer and render with header/footer templates for page numbers
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:12px;width:100%;text-align:center"><span>${activity.title}</span></div>`,
      footerTemplate: `<div style="font-size:11px;width:100%;text-align:center"><span class='pageNumber'></span> / <span class='totalPages'></span></div>`,
      margin: { top: '60px', bottom: '60px', left: '20px', right: '20px' }
    });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${activityId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    const msg = err && (err.message || String(err)) || 'Unknown error';
    console.error('exportAttendancePdf error', err && (err.stack || err));
    res.status(500).json({ message: msg });
  }
};

// Generate and save attendance reports for activities (or a single activity via query)
export const generateAttendanceReports = async (req, res) => {
  try {
    const { activityId } = req.query;
    const activities = activityId ? await Activity.find({ _id: activityId }) : await Activity.find();
    const results = [];

    for (const activity of activities) {
      const attendances = await Attendance.find({ activityId: activity._id }).populate('memberId', 'fullName membershipId memberType').populate('recordedBy', 'username');

      // If activity has responsibles list, map those; otherwise include all members in attendances
      const memberRows = [];
      // Build rows from attendances (include ones even if member missing)
      attendances.forEach(a => {
        memberRows.push({
          memberId: a.memberId && a.memberId._id ? a.memberId._id : undefined,
          fullName: a.memberId && a.memberId.fullName ? a.memberId.fullName : (a.memberId ? String(a.memberId) : ''),
          membershipId: a.memberId && a.memberId.membershipId ? a.memberId.membershipId : undefined,
          memberType: a.memberId && (a.memberId.memberType || a.memberId.type) ? (a.memberId.memberType || a.memberId.type) : '',
          presenceStatus: a.presenceStatus || '',
          recordedAt: a.recordedAt || null,
          recordedBy: a.recordedBy && a.recordedBy._id ? a.recordedBy._id : (a.recordedBy || null),
          comment: a.comment || ''
        });
      });

      const total = memberRows.length;
      const presentCount = memberRows.filter(r => String(r.presenceStatus).toLowerCase() === 'present').length;
      const attendanceRate = total ? Number(((presentCount / total) * 100).toFixed(1)) : 0;

      // Save report document
      const reportDoc = new AttendanceReport({
        activityId: activity._id,
        generatedBy: req.user && req.user._id ? req.user._id : undefined,
        total,
        presentCount,
        attendanceRate,
        rows: memberRows
      });
      await reportDoc.save();
      results.push(reportDoc);
    }

    res.json({ message: 'تم إنشاء تقارير الحضور', count: results.length, results });
  } catch (err) {
    console.error('generateAttendanceReports error', err);
    res.status(500).json({ message: err.message || 'خطأ أثناء إنشاء تقارير الحضور' });
  }
};

export const listAttendanceReports = async (req, res) => {
  try {
    const reports = await AttendanceReport.find().populate('activityId', 'title date').populate('generatedBy', 'username').sort({ generatedAt: -1 });
    res.json({ count: reports.length, data: reports });
  } catch (err) {
    console.error('listAttendanceReports', err);
    res.status(500).json({ message: err.message || 'خطأ' });
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const id = req.params.id;
    const rep = await AttendanceReport.findById(id).populate('activityId', 'title date').populate('generatedBy', 'username').populate('rows.memberId', 'fullName membershipId memberType');
    if (!rep) return res.status(404).json({ message: 'التقرير غير موجود' });
    res.json({ data: rep });
  } catch (err) {
    console.error('getAttendanceReport', err);
    res.status(500).json({ message: err.message || 'خطأ' });
  }
};

