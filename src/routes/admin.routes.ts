import { Router } from 'express';

import { verifyJwt } from '../middleware/auth.middleware.js';
import { GetAllUsers, GetUser, Test } from '../controllers/actions.controller.js';

const router = Router();

router.use(verifyJwt);

router.route("/getalluser").get(GetAllUsers);
router.route("/getuser/:id").get(GetUser);
router.route("/test").get(Test);

export default router