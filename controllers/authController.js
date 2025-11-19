import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from 'nodemailer';

// Login
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: "بيانات اعتماد غير صحيحة" });
    const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(400).json({ message: "بيانات اعتماد غير صحيحة" });
  // ensure role is stored lowercased in the token for consistency
  const token = jwt.sign({ id: user._id, username: user.username, role: String(user.role).toLowerCase() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    // set httpOnly cookie for UI authentication as well
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: (1000 * 60 * 60 * 8) });
    // If the request expects JSON (API / AJAX), return JSON.
    const contentType = (req.get('content-type') || '').toLowerCase();
    const accept = (req.get('accept') || '').toLowerCase();
    const isJsonRequest = contentType.includes('application/json') || accept.includes('application/json') || req.xhr;

    if (isJsonRequest) {
  return res.json({ token, user: { id: user._id, username: user.username, role: String(user.role).toLowerCase() } });
    }

    // Otherwise perform a server-side redirect. Determine safe redirect target.
    const nextUrl = (req.query.next || req.body.next || '').toString();
    // Prevent open redirect: only allow relative paths starting with '/'
    const safeNext = nextUrl && nextUrl.startsWith('/') ? nextUrl : null;

    // For simplicity (single-admin setup) always redirect to the dashboard for non-API form posts.
    const target = safeNext || '/';
    return res.redirect(target);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logout: clear the httpOnly cookie
export const logout = async (req, res) => {
  try {
    res.clearCookie('token');
    res.json({ message: 'تم تسجيل الخروج' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Dev helper: seed an admin user if none exists
export const seedAdmin = async (req, res) => {
  try {
    const existing = await User.findOne({ role: 'admin' });
  if (existing) return res.status(400).json({ message: 'المشرف موجود بالفعل' });
    const { username = 'admin', password = 'admin123' } = req.body;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = new User({ username, passwordHash, role: 'admin' });
    await user.save();
  res.status(201).json({ message: 'تم إنشاء حساب المشرف', user: { id: user._id, username: user.username } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Public registration: if no users exist, first registrant becomes admin.
export const register = async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبان' });

    const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ message: 'اسم المستخدم غير متاح' });

    const usersCount = await User.countDocuments();
    // Only allow public registration if there are no users yet (first user becomes admin).
    if (usersCount > 0) {
  return res.status(403).json({ message: 'التسجيل مغلق. تواصل مع المسؤول لإنشاء حساب.' });
    }
    const role = 'admin';

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ username, passwordHash, role, name, email });
    await user.save();

    // sign token
  // use lowercase role in token
  const token = jwt.sign({ id: user._id, username: user.username, role: String(user.role).toLowerCase() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    // set cookie so browser UI can access protected pages without manual Authorization header
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: (1000 * 60 * 60 * 8) });
  res.status(201).json({ message: 'تم إنشاء المستخدم', token, user: { id: user._id, username: user.username, role: String(user.role).toLowerCase() } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Return whether public registration is allowed (true only when no users exist)
export const registerAllowed = async (req, res) => {
  try {
    const usersCount = await User.countDocuments();
    res.json({ allowed: usersCount === 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Request a password reset. Client provides { username } (often email).
// We generate a token, store it on the user with an expiry, and (placeholder) log or return the reset link.
export const requestPasswordReset = async (req, res) => {
  try {
    const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'اسم المستخدم مطلوب' });

    const user = await User.findOne({ username });
    // Always respond with success message to avoid leaking existence of accounts
    if (!user) {
      return res.json({ message: 'إذا كان هناك حساب مرتبط باسم المستخدم هذا، فسيتم إرسال رابط إعادة التعيين.' });
    }

    // generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (1000 * 60 * 60); // 1 hour

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(expires);
    await user.save();

    // Construct reset link — prefer FRONTEND_URL env var, otherwise host-based link
    const frontend = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const resetLink = `${frontend}/reset-password?token=${token}&username=${encodeURIComponent(user.username)}`;

    // Attempt to send email if SMTP is configured, otherwise fallback to console.log
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
          secure: process.env.SMTP_SECURE === 'true' || false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        const toAddress = user.email || user.username;
        const fromAddress = process.env.FROM_EMAIL || `no-reply@${req.get('host')}`;
        const mailOptions = {
          from: fromAddress,
          to: toAddress,
          subject: 'إعادة تعيين كلمة المرور',
            html: `<p>تلقينا طلبًا لإعادة تعيين كلمة المرور. اضغط الرابط أدناه لإعادة التعيين (صالح لمدة ساعة):</p><p><a href="${resetLink}">${resetLink}</a></p><p>إذا لم تطلب هذا، فتجاهل هذه الرسالة.</p>`
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${toAddress}`);
      } else {
        // SMTP not configured — log the link for development
        console.log(`Password reset requested for ${user.username}. Reset link (development only): ${resetLink}`);
      }
    } catch (emailErr) {
      // Don't fail the whole request if email sending fails; log and continue
      console.error('Failed to send password reset email', emailErr);
      console.log(`Reset link (fallback): ${resetLink}`);
    }

  return res.json({ message: 'إذا كان هناك حساب مرتبط باسم المستخدم هذا، فسيتم إرسال رابط إعادة التعيين.' });
  } catch (err) {
    console.error('requestPasswordReset error', err);
    res.status(500).json({ message: err.message });
  }
};

// Reset password using token. Client provides { username, token, newPassword }
export const resetPassword = async (req, res) => {
  try {
    const { username, token, newPassword } = req.body;
  if (!username || !token || !newPassword) return res.status(400).json({ message: 'اسم المستخدم والرمز وكلمة المرور الجديدة مطلوبة' });

    const user = await User.findOne({ username, resetPasswordToken: token });
  if (!user) return res.status(400).json({ message: 'الرمز أو اسم المستخدم غير صالح' });

    if (!user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) {
  return res.status(400).json({ message: 'انتهت صلاحية الرمز' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    // clear the reset token fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Optionally sign a token to log the user in immediately
  const jwtToken = jwt.sign({ id: user._id, username: user.username, role: String(user.role).toLowerCase() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.cookie('token', jwtToken, { httpOnly: true, sameSite: 'lax', maxAge: (1000 * 60 * 60 * 8) });

  return res.json({ message: 'تم إعادة تعيين كلمة المرور', token: jwtToken });
  } catch (err) {
    console.error('resetPassword error', err);
    res.status(500).json({ message: err.message });
  }
};
