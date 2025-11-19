import AuditLog from '../models/AuditLog.js';

// List audit logs (admin only)
export const listAuditLogs = async (req, res) => {
  try {
    const q = {};
    if (req.query.actor) q.actor = req.query.actor;
    if (req.query.action) q.action = req.query.action;
    if (req.query.resourceType) q.resourceType = req.query.resourceType;

    const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
    const skip = parseInt(req.query.skip || '0', 10);

    const logs = await AuditLog.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'username');
    res.json({ count: logs.length, data: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

// Render audit logs UI for admins
export const auditLogsPage = async (req, res) => {
  try {
    res.render('auditLogs');
  } catch (err) {
    res.status(500).send('Failed to render audit logs page');
  }
};
