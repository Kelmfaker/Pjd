import AuditLog from '../models/AuditLog.js';

export async function logAudit(req, action, resourceType, resourceId, before, after) {
  try {
    const actor = (req && req.user && req.user.id) ? req.user.id : null;
    const ip = req && (req.ip || req.headers['x-forwarded-for']) ? (req.ip || req.headers['x-forwarded-for']) : '';
    const entry = new AuditLog({ actor, action, resourceType, resourceId, before, after, ip });
    await entry.save();
  } catch (err) {
    console.error('Failed to write audit log', err);
  }
}
