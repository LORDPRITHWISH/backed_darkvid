import { Router } from "express";
import {
  getDashboardStats,
  getChannelVideos,
  getChannelAnalytics,
  getStudioComments,
  replyToComment,
  deleteCommentFromStudio,
  getChannelStats,
} from "../controllers/studio.controller.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = Router();

router.use(verifyJwt);

// ── Dashboard ──────────────────────────────────────────────────────────────────
router.get("/dashboard", getDashboardStats);

// ── Content / Videos ──────────────────────────────────────────────────────────
router.get("/videos", getChannelVideos);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get("/analytics", getChannelAnalytics);

// ── Community – Comments ──────────────────────────────────────────────────────
router.get("/community/comments", getStudioComments);
router.post("/community/comments/:commentId/reply", replyToComment);
router.delete("/community/comments/:commentId", deleteCommentFromStudio);

// ── Legacy compat ─────────────────────────────────────────────────────────────
router.get("/stats", getChannelStats);

export default router;