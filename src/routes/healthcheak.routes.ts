import { Router } from "express";
import { healthcheak } from "../controllers/healthcheak.controllers";
// import { upload } from "../middleware/multer.middleware";


const router = Router();

router.route("/").get(healthcheak)


// router.route("/").get(upload.single('avatar'), healthcheak)

export default router;