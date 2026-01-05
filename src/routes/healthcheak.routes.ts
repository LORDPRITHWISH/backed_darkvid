import { Router } from "express";
import { healthcheak } from "../controllers/healthcheak.controller";
// import { upload } from "../middleware/multer.middleware";


const router = Router();

router.route("/").get(healthcheak)

export default router;