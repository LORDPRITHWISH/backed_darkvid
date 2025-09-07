import mongoose, {isValidObjectId} from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import { asyncHandeler } from "../utils/asyncHandelers.js"
import { ApiResponce } from "../utils/ApiResponce.js";
import { User } from "../models/user.models.js";



const GetAllUsers = asyncHandeler(async (req, res) => {
  const users = await User.find({}, "-password");
    if (!users || users.length === 0) {
        throw new ApiError(404, "No users found");
    }
  return res.status(200).json(new ApiResponce(200, "Users fetched successfully", users));
});

const GetUser = asyncHandeler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await User.findById(id, "username name");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(new ApiResponce(200, "User fetched successfully", user));
});

export {
  GetAllUsers,
  GetUser
}