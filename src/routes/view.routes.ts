import { Router } from "express";
import { verifyJwt } from "../middleware/auth.middleware";
import { endView, getViewHistory, heartbeatView, startView } from "../controllers/view.controller";

const router = Router();

router.use(verifyJwt);

router.get("/history", getViewHistory);
router.post("/video/:videoId/start", startView);
router.post("/video/:videoId/heartbeat", heartbeatView);
router.post("/video/:videoId/end", endView);

export default router;
