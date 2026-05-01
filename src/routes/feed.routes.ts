import { Router } from 'express';
import {
    getChannelStats,
    getChannelVideos,
} from "../controllers/studio.controller.js"
import { verifyJwt } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verifyJwt);

router.route("/stats").get(getChannelStats);
router.route("/videos").get(getChannelVideos);

export default router