import { Router } from 'express';

import { verifyJwt } from '../middleware/auth.middleware.js';
import { GetAllUsers, GetAllVideos, GetUser } from '../controllers/admin.controller.js';
import { getVideo } from '../controllers/video.controller.js';


const router = Router();

router.use(verifyJwt);

router.route("/users").get(GetAllUsers);
router.route("/user/:id").get(GetUser);
router.route("/videos").get(GetAllVideos);
router.route("/video/:videoid").get(getVideo);

export default router