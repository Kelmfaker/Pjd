import express from "express";
import {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember
} from "../controllers/membersController.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", authenticate, authorizeRoles('admin','secretary'), getAllMembers);          // عرض جميع الأعضاء (محمي)
router.get("/:id", authenticate, authorizeRoles('admin','secretary'), getMemberById);       // عرض عضو واحد (محمي)
router.post("/", authenticate, authorizeRoles('admin','secretary'), createMember);          // إضافة عضو جديد (محمي)
router.put("/:id", authenticate, authorizeRoles('admin','secretary'), updateMember);        // تعديل عضو (محمي)
router.delete("/:id", authenticate, authorizeRoles('admin'), deleteMember);     // حذف عضو (Admin فقط)
// Bulk delete: DELETE /api/members?confirm=true  -> delete all (requires confirm)
// Or provide filters: ?memberType=active&status=inactive&beforeJoined=2023-01-01
router.delete("/", authenticate, authorizeRoles('admin'), async (req, res, next) => {
  // delegate to controller for testability
  const { deleteMembers } = await import('../controllers/membersController.js');
  return deleteMembers(req, res, next);
});

export default router;
