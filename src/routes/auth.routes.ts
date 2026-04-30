import { Router } from "express";
import passport from "../config/passport";
import { verifyJwt } from "../middleware/auth.middleware";
import {
  googleCallback,
  connectGoogle,
  setPassword,
} from "../controllers/auth.controller.js";


const router = Router();

// 🔹 start Google login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// 🔹 Google callback (main logic)
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  googleCallback
);

// 🔹 user already logged in → link Google
router.get(
  "/connect/google",
  verifyJwt,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/connect/google/callback",
  verifyJwt,
  passport.authenticate("google", { session: false }),
  connectGoogle
);

// 🔹 Google user → set password (migration)
router.post("/set-password", verifyJwt, setPassword);

export default router;
