import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { deleteImage, uploadImage } from "../utils/cloudinay";
import jwt from "jsonwebtoken";

const genetateAccessAnsRefreshToken = async (userId: string) => {
  try {
    const user = await User.findById(userId).select("-password -refereshToken");
    console.log(user);
    if (!user) {
      throw new ApiError(500, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refereshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "User not able to fetch or generate tokens");
  }
};

const registerUser = asyncHandeler(async (req, res) => {
  // console.log('lol');

  const { fullname, email, username, password } = req.body;
  // console.log(req);
  // console.log(req.body);
  // console.log(req.files);
  // console.log(req.file);

  if (
    [fullname, email, username, password].some((field) => field?.trim === "")
  ) {
    throw new Error("Please fill in all fields");
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

  let profilepiccl;
  let coverimagecl;

  try {
    if (profilepiclocal) profilepiccl = await uploadImage(profilepiclocal);
    console.log("profilepic uploaded", profilepiccl);
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Profile pic not uploaded");
  }

  try {
    if (coverimagelocal) coverimagecl = await uploadImage(coverimagelocal);
    console.log("coverimage uploaded", coverimagecl);
  } catch (error) {
    console.log(error);
    throw new ApiError(500, "Cover pic not uploaded");
  }

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
      await deleteImage(profilepiccl.public_id);
    }
    if (coverimagecl) {
      await deleteImage(coverimagecl.public_id);
    }
    throw new ApiError(500, "User not created so no point keeping the images");
  }
  // return  res.status(200).json(new ApiResponce(200, "uoy reached user at last", "OK"));
});

const loginUser = asyncHandeler(async (req, res) => {
  const { email, username, password } = req.body;

  if (password.trim() === "") {
    throw new ApiError(400, "Password is required");
  }

  if (email.trim() === "" && username.trim() === "") {
    throw new ApiError(400, "Email or username is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Incorrect password");
  }

  const { accessToken, refreshToken } = await genetateAccessAnsRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refereshToken"
  );

  console.log(loggedInUser);

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponce(200, "User logged in", {
        user: loggedInUser,
        accessToken,
        refreshToken,
      })
    );
});

const logoutUser = asyncHandeler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refereshToken: "" });
});

const refreshAccessToken = asyncHandeler(async (req, res) => {
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
    const decodedToken = jwt.verify(incomingRefreshToken, refreshTokenSecret);

    if (typeof decodedToken !== "string" && decodedToken?._id) {
      const user = await User.findById(decodedToken._id).select(
        "-password -refereshToken"
      );
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
  } catch (error) {}
});

export { registerUser, loginUser };
