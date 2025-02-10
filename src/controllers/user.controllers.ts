import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { uploadImage } from "../utils/cloudinay";

const registerUser = asyncHandeler(async (req, res) => {

  console.log('lol');

  const { fullname, email, username, password } = req.body;
  console.log(req.body);
  console.log(req.files);

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

  const profilepiclocal = (req.files as { [fieldname: string]: Express.Multer.File[] })?.profilepic?.[0]?.path;
  const coverimagelocal = (req.files as { [fieldname: string]: Express.Multer.File[] })?.coverimage?.[0]?.path;

  const profilepiccl = await uploadImage(profilepiclocal)
  let coverimagecl;
  if (coverimagelocal)
  coverimagecl = await uploadImage(coverimagelocal);

  const user = await User.create({
    fullname,
    profilepic: profilepiccl?.url,
    coverimage: coverimagecl?.url,
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select("-password -refereshToken");
  console.log(createdUser);

  if (!createdUser) {
    throw new ApiError(500, "User not created");
  }

  // return 
  res.status(201).json(new ApiResponce(201, "User created", createdUser));

  return  res.status(200).json(new ApiResponce(200, "uoy reached user at last", "OK"));


});

export { registerUser };
