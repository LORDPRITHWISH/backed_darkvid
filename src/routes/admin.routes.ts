import { Router } from 'express';

import { verifyJwt } from '../middleware/auth.middleware.js';
import { GetAllUsers, GetAllVideos, GetUser, GetVideo } from '../controllers/admin.controller.js';


const router = Router();

router.use(verifyJwt);

router.route("/users").get(GetAllUsers);
router.route("/user/:id").get(GetUser);
router.route("/videos").get(GetAllVideos);
router.route("/video/:id").get(GetVideo);

export default router
