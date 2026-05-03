import { Router } from 'express';

import { verifyJwt } from '../middleware/auth.middleware.js';
import { Test } from '../controllers/actions.controller.js';

const router = Router();

router.use(verifyJwt);

router.route("/test").get(Test);

export default router
