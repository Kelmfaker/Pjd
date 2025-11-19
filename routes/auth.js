import express from "express";
import { login, register, logout } from "../controllers/authController.js";
import { registerAllowed } from "../controllers/authController.js";
import { requestPasswordReset, resetPassword } from "../controllers/authController.js";

const router = express.Router();

// Public registration (first user becomes admin automatically)
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Public: check if registration is allowed (true only when no users exist)
router.get('/register-allowed', registerAllowed);

// Password reset endpoints
router.post('/password-reset-request', requestPasswordReset);
router.post('/password-reset', resetPassword);

// Note: seed-admin endpoint was removed for security. Use `scripts/seed-admin.js` or the register endpoint to create a first admin.
export default router;
