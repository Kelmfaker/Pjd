import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Non-intrusive middleware to attach user payload to req and res.locals when a valid token exists.
// Does NOT redirect or fail when no token is present — useful for rendering templates with user info.
export default async function attachUser(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
  else if (req.cookies && req.cookies.token) token = req.cookies.token;

  if (!token) {
    // no token — continue without attaching user
    res.locals.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // normalize role to lowercase for consistent template rendering and client-side checks
    if (payload && payload.role) {
      let r = String(payload.role).toLowerCase();
      // common synonyms: some accounts use 'responsable' spelling — normalize to 'responsible'
      if (r === 'responsable') r = 'responsible';
      payload.role = r;
    }

    // Try to load the User document to include linked member info (if any).
    // This allows templates to show member-specific controls for 'responsible' users.
    let userDoc = null;
    if (payload && payload.id) {
      try {
        userDoc = await User.findById(payload.id).populate('member', 'fullName role memberType').lean();
      } catch (dbErr) {
        console.error('attachUser: failed to load user profile', dbErr && (dbErr.stack || dbErr));
      }
    }

    // Build a minimal user object to attach to req/res.locals (avoid passing sensitive fields)
    const minimal = {
      id: payload.id || payload._id || null,
      username: payload.username || payload.name || null,
      role: payload.role || null
    };
    if (userDoc && userDoc.member) {
      minimal.member = {
        _id: String(userDoc.member._id),
        fullName: userDoc.member.fullName,
        role: userDoc.member.role,
        memberType: userDoc.member.memberType
      };
    }

    req.user = minimal;
    res.locals.user = minimal;
    return next();
  } catch (err) {
    // invalid token — clear any existing user and continue
    res.locals.user = null;
    return next();
  }
}
