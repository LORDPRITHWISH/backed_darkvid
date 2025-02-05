import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { asyncHandeler } from "../utils/asyncHandelers";

const registerUser = asyncHandeler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if (
    [fullname, email, username, password].some((field) => field?.trim === "")
  ) {
    throw new Error("Please fill in all fields");
  }
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  })

  if (existingUser) {
    throw new ApiError(409, "User already exists");
  }

  // let profilepic;
  // if (req.files && "profilepic" in req.files) {
  //   profilepic = req.files.profilepic[0].path;
  // }

  const profilepic = req.files?.profilepic[0]?.path;
  const coverimage = req.files?.coverimage[0]?.path;
});

export { registerUser };
