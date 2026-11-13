import express from "express";
import {
  isAuthenticated,
  authorizeAdminRole,
} from "../middleware/auth";
import {
  getAdminStats,
  getAdminUsers,
  toggleUserStatus,
  getAdminSets,
  deleteAdminSet,
  getAdminFolders,
} from "../controllers/admin.controller";

const router = express.Router();

// Tất cả các routes admin đều cần đăng nhập & quyền Admin
router.use(isAuthenticated, authorizeAdminRole);

router.get("/stats", getAdminStats);
router.get("/users", getAdminUsers);
router.patch("/users/:id/status", toggleUserStatus);
router.get("/sets", getAdminSets);
router.delete("/sets/:id", deleteAdminSet);
router.get("/folders", getAdminFolders);

export default router;
