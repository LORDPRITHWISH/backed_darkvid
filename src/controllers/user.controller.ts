import mongoose from "mongoose";
import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { deleteFile, uploadFile } from "../utils/cloudinay";
import jwt from "jsonwebtoken";
// import { Subscription } from "../models/subscription.models";
// import fs from "fs/promises";

const genetateAccessAnsRefreshToken = async (userId: string) => {
  try {
    const user = await User.findById(userId).select("-password -refereshToken");
    // console.log(user);
    if (!user) {
      throw new ApiError(500, "User not found");
    }
    // console.log("user found for token generation", user);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // console.log("accessToken", accessToken);
    // console.log("refreshToken", refreshToken);

    user.refereshToken = refreshToken;
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
  console.log("FILES RECEIVED:", req.files);

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

  const profilepiclocal = (
    req.files as { [fieldname: string]: Express.Multer.File[] }
  )?.profilepic?.[0]?.path;

  const coverimagelocal = (
    req.files as { [fieldname: string]: Express.Multer.File[] }
  )?.coverimage?.[0]?.path;

  console.log("profilepiclocal", profilepiclocal);
  console.log("coverimagelocal", coverimagelocal);

  let profilepiccl;
  let coverimagecl;

  try {
    if (coverimagelocal) coverimagecl = await uploadFile(coverimagelocal);
    console.log("coverimage uploaded", coverimagecl);
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Cover pic not uploaded");
  }

  try {
    if (profilepiclocal) profilepiccl = await uploadFile(profilepiclocal);
    console.log("profilepic uploaded", profilepiccl);
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Profile pic not uploaded");
  }

  // if (profilepiclocal) {
  //   try {
  //     await fs.unlink(profilepiclocal);
  //   } catch (err) {
  //     console.error("Failed to delete local profile pic:", err);
  //   }
  // }

  // if (coverimagelocal) {
  //   try {
  //     await fs.unlink(coverimagelocal);
  //   } catch (err) {
  //     console.error("Failed to delete local cover image:", err);
  //   }
  // }

  try {
    const user = await User.create({
      username: username.toLowerCase(),
      email,
      password,
      name: fullname,
      profilepic: profilepiccl?.url,
      coverimage: coverimagecl?.url,
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refereshToken"
    );
    console.log(createdUser);

    if (!createdUser) {
      throw new ApiError(500, "User not created");
    }

    return res
      .status(201)
      .json(new ApiResponce(201, "User created", createdUser));
  } catch (error) {
    if (profilepiccl) {
      await deleteFile(profilepiccl.public_id);
    }
    if (coverimagecl) {
      await deleteFile(coverimagecl.public_id);
    }
    throw new ApiError(500, "User not created so no point keeping the images");
  }
  // return  res.status(200).json(new ApiResponce(200, "uoy reached user at last", "OK"));
});

const loginUser = asyncHandeler(async (req, res) => {
  // console.log("\nlogin user called");
  // console.log("body :-", req.body);
  const { identity, password } = req.body;

  // console.log("body :-", req);

  if (password && password.trim() === "") {
    throw new ApiError(400, "Password is required");
  }

  if (identity.trim() === "") {
    throw new ApiError(400, "Email or username is required");
  }

  // console.log("provided user", email, username, password);

  const user = await User.findOne({
    $or: [{ email: identity }, { username: identity }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // console.log("user found", user);

  const isPasswordValid = await user.isPasswordCorrect(password);

  // console.log("isPasswordValid", isPasswordValid);

  if (!isPasswordValid) {
    throw new ApiError(401, "Incorrect user Credentials");
  }

  const { accessToken, refreshToken } = await genetateAccessAnsRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refereshToken"
  );

  // console.log("loggedInUser", loggedInUser);

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
        // "-password -refereshToken"
        "-password "
      );

      // console.log("User found:", user);

      if (!user) {
        throw new ApiError(404, "Invalid token as user not found");
      }

      if (user?.refereshToken !== incomingRefreshToken) {
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
    .select("-password -refereshToken")
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
  // const profilepiclocal = (
  //   req.files as { [fieldname: string]: Express.Multer.File[] }
  // )?.profilepic?.[0]?.path;

  const profilepiclocal = req.file?.path;

  if (!profilepiclocal) {
    throw new ApiError(400, "Profile picture is required");
  }

  let profilepiccl;
  try {
    profilepiccl = await uploadFile(profilepiclocal);
    console.log("profilepic uploaded", profilepiccl);
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Profile pic not uploaded");
  }

  if (!profilepiccl?.url) {
    throw new ApiError(500, "Profile picture upload failed");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { profilepic: profilepiccl.url } },
    { new: true, runValidators: true }
  ).select("-password -refereshToken");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  // Delete the old profile picture if it exists
  if (req.user.profilepic) {
    try {
      await deleteFile(req.user.profilepic);
    } catch (error) {
      console.error("Error deleting old profile picture:", error);
    }
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "Profile picture updated", updatedUser));
});

const changeCoverImage = asyncHandeler(async (req, res) => {
  const coverimagelocal = req.file?.path;

  if (!coverimagelocal) {
    throw new ApiError(400, "Cover image is required");
  }

  let coverimagecl;
  try {
    coverimagecl = await uploadFile(coverimagelocal);
    console.log("coverimage uploaded", coverimagecl);
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Cover image not uploaded");
  }

  if (!coverimagecl?.url) {
    throw new ApiError(500, "Cover image upload failed");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { coverimage: coverimagecl.url } },
    { new: true, runValidators: true }
  ).select("-password -refereshToken");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  // Delete the old cover image if it exists
  if (req.user.coverimage) {
    try {
      await deleteFile(req.user.coverimage);
    } catch (error) {
      console.error("Error deleting old cover image:", error);
    }
  }

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

const getUserWatchHistory = asyncHandeler(async (req, res) => {
  const user = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.user?._id) } },
    {
      $lookup: {
        from: "Video",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "User",
              localField: "uploader",
              foreignField: "_id",
              as: "uploader",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    name: 1,
                    profilepic: 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: "$uploader",
          },
          {
            $project: {
              title: 1,
              description: 1,
              thumbnail: 1,
              videoUrl: 1,
              uploader: {
                _id: "$uploader._id",
                username: "$uploader.username",
                name: "$uploader.name",
                profilepic: "$uploader.profilepic",
              },
              createdAt: 1,
            },
          },
        ],
      },
    },
  ]);

  if (!user || user.length === 0) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponce(200, "User watch history fetched", user[0].watchHistory)
    );
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
  getUserWatchHistory,
};
