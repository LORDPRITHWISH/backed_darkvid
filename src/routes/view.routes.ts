import { Router } from "express";
import { verifyJwt } from "../middleware/auth.middleware";
import { addView } from "../controllers/view.controller";

const router = Router();

router.use(verifyJwt);

router.post("/video/:videoId", addView);



export default router;
