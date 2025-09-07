import { Router } from "express";
import {
  registerUser,
  logoutUser,
  loginUser,
  refreshAccessToken,
  getUser,
  getUserChannel,
  updateDetails,
  updateAvator,
  changeCoverImage,
  getUserWatchHistory,
} from "../controllers/user.controller";
import { upload } from "../middleware/multer.middleware";
import { verifyJwt } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.route("/login").post(upload.none(), loginUser);

router.post(
  "/register",
  (req, res, next) => {
    upload.fields([
      { name: "profilepic", maxCount: 1 },
      { name: "coverimage", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        console.error("MULTER ERROR:", err);
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  registerUser
);

router.route("/refresh_token").post(refreshAccessToken);

//secured routes

router.route("/logout").post(verifyJwt, logoutUser);
router.route("/profile").get(verifyJwt, getUser);
router.route("/c/:username").get(verifyJwt, getUserChannel);
router.route("/update-profile").patch(verifyJwt, updateDetails);
router
  .route("/avatar")
  .patch(verifyJwt, upload.single("profilepic"), updateAvator);
router
  .route("/cover")
  .patch(verifyJwt, upload.single("coverimage"), changeCoverImage);
router.route("/history").get(verifyJwt, getUserWatchHistory);


export default router;
