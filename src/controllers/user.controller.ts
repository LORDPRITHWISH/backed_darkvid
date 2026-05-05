import mongoose from "mongoose";
import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import {
  deleteFromCloudinary,
  getCloudinaryPublicId,
  uploadToCloudinary,
} from "../utils/cloudinay";
import jwt from "jsonwebtoken";
import { UAParser } from "ua-parser-js";
import { Session } from "../models/sesson.models";

const DEFAULT_PROFILEPIC_PUBLIC_ID = "e5tmjgygwh8zffoibujr";
const DEFAULT_COVERIMAGE_PUBLIC_ID = "n3rwe2rqx2dqnvhffc3d";

const deletePreviousUserImage = async (
  assetUrl: string | undefined,
  defaultPublicId: string
) => {
  if (!assetUrl) return;

  const publicId = getCloudinaryPublicId(assetUrl);

  if (publicId === defaultPublicId) return;
  if (assetUrl.startsWith("http") && publicId === assetUrl) return;

  await deleteFromCloudinary(publicId);
};

export const genetateAccessAnsRefreshToken = async (userId: string) => {
  try {
    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
      throw new ApiError(500, "User not found");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      (error as Error).message || "User not able to fetch or generate tokens"
    );
  }
};

const registerUser = asyncHandeler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if (
    [fullname, email, username, password].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "Please fill in all fields");
  }
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  const profilepicBuffer = (
    req.files as { [fieldname: string]: Express.Multer.File[] }
  )?.profilepic?.[0]?.buffer;

  const coverimageBuffer = (
    req.files as { [fieldname: string]: Express.Multer.File[] }
  )?.coverimage?.[0]?.buffer;

  let profilepiccl;
  let coverimagecl;

  try {
    if (coverimageBuffer)
      coverimagecl = await uploadToCloudinary(coverimageBuffer, "channelcover");
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Cover pic not uploaded");
  }

  try {
    if (profilepicBuffer)
      profilepiccl = await uploadToCloudinary(profilepicBuffer, "profilepic");
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Profile pic not uploaded");
  }

  try {
    const user = await User.create({
      username: username.toLowerCase(),
      email,
      password,
      name: fullname,
      profilepic: profilepiccl?.secure_url,
      coverimage: coverimagecl?.secure_url,
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );
    if (!createdUser) {
      throw new ApiError(500, "User not created");
    }

    return res
      .status(201)
      .json(new ApiResponce(201, "User created", createdUser));
  } catch (error) {
    if (profilepiccl) {
      await deleteFromCloudinary(profilepiccl.public_id);
    }
    if (coverimagecl) {
      await deleteFromCloudinary(coverimagecl.public_id);
    }
    throw new ApiError(500, "User not created so no point keeping the images");
  }
  // return  res.status(200).json(new ApiResponce(200, "uoy reached user at last", "OK"));
});

const loginUser = asyncHandeler(async (req, res) => {
  const { identity, password } = req.body;

  if (password && password.trim() === "") {
    throw new ApiError(400, "Password is required");
  }

  if (identity.trim() === "") {
    throw new ApiError(400, "Email or username is required");
  }

  const user = await User.findOne({
    $or: [{ email: identity }, { username: identity }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.password) {
    throw new ApiError(400, "No password set. Use Google login.");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Incorrect user Credentials");
  }

  const { accessToken, refreshToken } = await genetateAccessAnsRefreshToken(
    user._id
  );

  // Track session details
  const userAgentString = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();
  const ipAddress = (req.headers["x-forwarded-for"] || req.ip || "").toString();

  await Session.create({
    user: user._id,
    refreshToken,
    ipAddress,
    userAgent: userAgentString,
    browser: result.browser.name,
    browserVersion: result.browser.version,
    os: result.os.name,
    osVersion: result.os.version,
    device: result.device.type || "Desktop",
  });

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? "none"
        : ("lax" as "none" | "lax"),
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .cookie("dark", "I_am_alive", options)

    .json(
      new ApiResponce(200, "User logged in", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

const logoutUser = asyncHandeler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;
  if (incomingRefreshToken) {
    await Session.findOneAndUpdate(
      { user: req.user._id, refreshToken: incomingRefreshToken },
      { $set: { isActive: false, logoutAt: new Date() } }
    );
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponce(200, "User logged out successfully", {}));
});

const refreshAccessToken = asyncHandeler(async (req, res) => {
  // console.log("Cookies received:", req.cookies);
  // console.log("Body received:", req.body);

  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthenticated or refresh token missing");
  }

  try {
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!refreshTokenSecret) {
      throw new ApiError(500, "Refresh token secret is not defined");
    }

    // Verify the incoming refresh token

    const decodedToken = jwt.verify(incomingRefreshToken, refreshTokenSecret);

    console.log("Decoded token:", decodedToken);

    if (typeof decodedToken !== "string" && decodedToken?._id) {
      const user = await User.findById(decodedToken._id).select(
        // "-password -refreshToken"
        "-password "
      );

      // console.log("User found:", user);

      if (!user) {
        throw new ApiError(404, "Invalid token as user not found");
      }

      if (user?.refreshToken !== incomingRefreshToken) {
        throw new ApiError(401, "Invalid token did not match");
      }

      const { accessToken, refreshToken: newrefreshToken } =
        await genetateAccessAnsRefreshToken(user._id);

      const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        // sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      };

      return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
          new ApiResponce(200, "Token refreshed", {
            user,
            accessToken,
            newrefreshToken,
          })
        );
    } else {
      throw new ApiError(500, "something went wrong with token refresh");
    }
  } catch (error) {
    console.error("Error during token refresh:", (error as Error)?.message);
    // throw new ApiError(

    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "Refresh token expired");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, "Invalid refresh token");
    } else {
      throw new ApiError(
        500,
        (error as Error).message || "Internal server error during token refresh"
      );
    }
  }
});

const changePassword = asyncHandeler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, "Incorrect old password");
  }

  if (newPassword.trim() === "") {
    throw new ApiError(400, "New password is required");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponce(200, "Password changed successfully", {}));
});

const getUser = asyncHandeler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponce(200, "User fetched successfully", req.user));
});

const updateDetails = asyncHandeler(async (req, res) => {
  const { fullname, username, bio, website } = req.body;

  if ([fullname, username, bio, website].some((field) => field?.trim === "")) {
    throw new ApiError(400, "Please fill in all fields");
  }

  // if (
  //   [fullname, username, bio, website].every(
  //     (field) => !field || field.trim() === ""
  //   )
  // ) {
  //   throw new ApiError(400, "At least one field must be filled");
  // }

  User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        name: fullname,
        username: username.toLowerCase(),
        bio,
        website,
      },
    },
    { new: true, runValidators: true }
  )
    .select("-password -refreshToken")
    .then((updatedUser) => {
      if (!updatedUser) {
        throw new ApiError(404, "User not found");
      }
      return res
        .status(200)
        .json(new ApiResponce(200, "User details updated", updatedUser));
    })
    .catch((error) => {
      console.error("Error updating user details:", error);
      throw new ApiError(500, "Internal server error at updateDetails");
    });
});

const updateAvator = asyncHandeler(async (req, res) => {
  const profilepicBuffer = req.file?.buffer;

  if (!profilepicBuffer) {
    throw new ApiError(400, "Profile picture is required");
  }

  let profilepiccl;
  try {
    profilepiccl = await uploadToCloudinary(profilepicBuffer, "profilepic");
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Profile pic not uploaded");
  }

  if (!profilepiccl?.secure_url) {
    throw new ApiError(500, "Profile picture upload failed");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { profilepic: profilepiccl.secure_url } },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  // Delete the old profile picture if it exists
  if (req.user.profilepic) {
    try {
      await deletePreviousUserImage(
        req.user.profilepic,
        DEFAULT_PROFILEPIC_PUBLIC_ID
      );
    } catch (error) {
      console.error("Error deleting old profile picture:", error);
    }
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "Profile picture updated", updatedUser));
});

const changeCoverImage = asyncHandeler(async (req, res) => {
  const coverimageBuffer = req.file?.buffer;

  if (!coverimageBuffer) {
    throw new ApiError(400, "Cover image is required");
  }

  let coverimagecl;
  try {
    coverimagecl = await uploadToCloudinary(coverimageBuffer, "coverimage");
    console.log("coverimage uploaded", coverimagecl);
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Cover image not uploaded");
  }

  if (!coverimagecl?.secure_url) {
    throw new ApiError(500, "Cover image upload failed");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { coverimage: coverimagecl.secure_url } },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  // Delete the old cover image if it exists
  // if (req.user.coverimage) {
  //   try {
  //     await deletePreviousUserImage(
  //       req.user.coverimage,
  //       DEFAULT_COVERIMAGE_PUBLIC_ID
  //     );
  //   } catch (error) {
  //     console.error("Error deleting old cover image:", error);
  //   }
  // }

  return res
    .status(200)
    .json(new ApiResponce(200, "Cover image updated", updatedUser));
});

const getUserChannel = asyncHandeler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is required");
  }

  const channel = await User.aggregate([
    { $match: { username: username.toLowerCase() } },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscribedTo",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        // foreignField: "subscribedTo",
        foreignField: "subscriber",
        as: "subscriptions",
      },
    },
    {
      $addFields: {
        subscriberCount: { $size: "$subscribers" },
        subscriptionCount: { $size: "$subscriptions" },
        isSubscribed: {
          $in: [
            new mongoose.Types.ObjectId(req.user?._id),
            { $map: { input: "$subscribers", as: "s", in: "$$s.subscriber" } },
          ],
        },
        isOwner: {
          $eq: [new mongoose.Types.ObjectId(req.user?._id), "$_id"],
        },
      },
    },
    {
      $project: {
        username: 1,
        name: 1,
        profilepic: 1,
        bio: 1,
        coverimage: 1,
        subscriberCount: 1,
        subscriptionCount: 1,
        isSubscribed: 1,
        isOwner: 1,
        // subscriptions: 1,
        // subscribers: 1,
      },
    },
  ]);

  if (!channel || channel.length === 0) {
    throw new ApiError(404, "Channel not found");
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "Channel fetched successfully", channel[0]));
});

export const avalableUsername = asyncHandeler(async (req, res) => {
  const { username } = req.params;

  if (!username || username.trim() === "") {
    throw new ApiError(400, "Username is required");
  }

  const existingUser = await User.findOne({ username: username.toLowerCase() });

  if (existingUser) {
    return res
      .status(200)
      .json(new ApiResponce(200, "Username is taken", { available: false }));
  } else {
    return res
      .status(200)
      .json(new ApiResponce(200, "Username is available", { available: true }));
  }
});

export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  changePassword,
  getUser,
  updateDetails,
  updateAvator,
  changeCoverImage,
  getUserChannel,
};
