import { Router } from "express";
import { registerUser } from "../controllers/user.controllers";
import { upload } from "../middleware/multer.middleware";
// import { upload } from "../middleware/multer.middleware";

const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "profilepic", maxCount: 1 },
    { name: "coverimage", maxCount: 1 },
  ]),
  registerUser
);

export default router;
