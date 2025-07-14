import jwt from "jsonwebtoken";
import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";
import { User } from "../models/user.models";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const verifyJwt = asyncHandeler(async (req, _, next) => {
  const token =
    req.cookies?.accessToken || req.headers?.authorization?.split(" ")[1];

  // const token = req.cookies?.accessToken || req.headers?.authorization?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthenticated or token missing");
  }
  try {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET;
    if (!accessSecret) {
      throw new ApiError(500, "Access token secret is not defined");
    }

    const decodedToken = jwt.verify(token, accessSecret) as jwt.JwtPayload;

    if (
      !decodedToken ||
      typeof decodedToken !== "object" ||
      !("_id" in decodedToken)
    ) {
      throw new ApiError(401, "Unauthenticated or token missing");
    }

    const user = await User.findById(decodedToken._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Unauthenticated or User not found");
    }

    req.user = user;
    
    next();

  } catch (error) {
    throw new ApiError(
      401,
      (error as Error)?.message || "Unauthenticated or token missing"
    );
  }
});

