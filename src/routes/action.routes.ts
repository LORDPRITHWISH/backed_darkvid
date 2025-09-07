import { Router } from 'express';

import { verifyJwt } from '../middleware/auth.middleware.js';
import { GetAllUsers, GetUser } from '../controllers/actions.controller.js';

const router = Router();

router.use(verifyJwt);

router.route("/getalluser").get(GetAllUsers);
router.route("/getuser/:id").get(GetUser);

export default router