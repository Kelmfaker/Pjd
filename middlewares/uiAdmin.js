import jwt from 'jsonwebtoken';

// Middleware for EJS UI routes: require authenticated admin user
export default function uiAdmin(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.split(' ')[1];
  else if (req.cookies && req.cookies.token) token = req.cookies.token;

  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  if (!token) {
    return res.redirect(`/login?msg=${encodeURIComponent('Authentication required')}&next=${nextUrl}`);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    if (payload.role !== 'admin') {
      return res.redirect(`/login?msg=${encodeURIComponent('Admin access required')}`);
    }
    return next();
  } catch (err) {
    return res.redirect(`/login?msg=${encodeURIComponent('Authentication required')}&next=${nextUrl}`);
  }
}
