import jwt from "jsonwebtoken";

// Accept token from Authorization header OR from cookie (req.cookies.token)
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ message: "مطلوب تسجيل الدخول" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // normalize role to lowercase/trim for consistent checks across server and templates
    if (payload && payload.role) {
      const normalize = (x) => {
        if (!x) return '';
        let s = String(x).trim().toLowerCase();
        if (s === 'responsable') s = 'responsible';
        return s;
      };
      payload.role = normalize(payload.role);
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "الرمز غير صالح أو منتهي الصلاحية" });
  }
};

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "مطلوب تسجيل الدخول" });
  const normalize = (x) => {
    if (!x) return '';
    let s = String(x).trim().toLowerCase();
    if (s === 'responsable') s = 'responsible';
    return s;
  };
  const allowed = roles.map(r => normalize(r));
  const userRole = normalize(req.user.role || '');
  if (!allowed.includes(userRole)) return res.status(403).json({ message: "ممنوع" });
  next();
};
