import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";

const GetAllUsers = asyncHandeler(async (req, res) => {
  const users = await User.find({}, "-password");
  if (!users || users.length === 0) {
    throw new ApiError(404, "No users found");
  }
  return res
    .status(200)
    .json(new ApiResponce(200, "Users fetched successfully", users));
});
