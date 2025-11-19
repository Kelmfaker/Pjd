import express from "express";
import { createUser, getAllUsers, deleteUser, updateUser } from "../controllers/usersController.js";
import { linkUserToMember } from "../controllers/usersController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", authenticate, authorizeRoles("admin"), createUser); // Admin فقط
// Login routed via /api/auth/login (consolidated)
router.get("/", authenticate, authorizeRoles("admin"), getAllUsers); // عرض كل المستخدمين Admin فقط
router.put('/:id', authenticate, authorizeRoles('admin'), updateUser);
router.put('/:id/link-member', authenticate, authorizeRoles('admin'), linkUserToMember);
// Some clients (or proxies) may not send PUT correctly; accept POST as an alias too.
router.post('/:id/link-member', authenticate, authorizeRoles('admin'), linkUserToMember);

// Note: explicit PUT/POST routes above handle the expected requests.
// Avoid catch-all patterns that path-to-regexp rejects (wildcards must be used carefully).
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteUser);

export default router;
