import type { CookieOptions, Response, Request } from "express";
import { ApiError } from "../utils/ApiError";
import { asyncHandeler } from "../utils/asyncHandelers";
import { genetateAccessAnsRefreshToken } from "./user.controller";

export const googleCallback = asyncHandeler(async (req, res) => {
  const user = req.user as any;

  if (!user) throw new ApiError(401, "Google auth failed");

  const { accessToken, refreshToken } = await genetateAccessAnsRefreshToken(
    user._id
  );

  const options: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  return res
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .redirect("http://localhost:5173");
});

import { User } from "../models/user.models";

export const connectGoogle = asyncHandeler(async (req: any, res: Response) => {
  const loggedInUser = req.user; // from JWT middleware
  const googleProfile = req.authInfo || req.user;

  const googleId = googleProfile.id;

  const user = await User.findById(loggedInUser._id);

  if (!user) throw new ApiError(404, "User not found");

  if (user.authProviders?.googleId) {
    throw new ApiError(400, "Google already linked");
  }

  user.authProviders = {
    ...user.authProviders,
    googleId,
  };

  await user.save();

  return res.redirect("http://localhost:5173/settings");
});

import bcrypt from "bcrypt";

export const setPassword = asyncHandeler(async (req: any, res: Response) => {
  const { password } = req.body;

  if (!password || password.trim() === "") {
    throw new ApiError(400, "Password required");
  }

  const user = await User.findById(req.user._id);

  if (!user) throw new ApiError(404, "User not found");

  if (user.password) {
    throw new ApiError(400, "Password already exists");
  }

  user.password = await bcrypt.hash(password, 10);
  await user.save();

  return res.status(200).json({
    message: "Password set successfully",
  });
});