import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    profilepic: {
      type: String,
      default:
        "https://res.cloudinary.com/dxkufsejm/image/upload/v1631023531/blank-profile-picture-973460_640_ewxv2f.png",
      required: true,
    },
    bio: {
      type: String,
      default: "a happy user",
    },
    coverimage: {
      type: String,
      default:
        "https://res.cloudinary.com/dxkufsejm/image/upload/v1631023531/blank-profile-picture-973460_640_ewxv2f.png",
      required: true,
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    refereshToken: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);

  next();
});

userSchema.methods.isPasswordCorrect = async function (password: string) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateRefreshToken = function () {
  if (!process.env.ACESS_TOKEN_SECRET) {
    throw new Error("ACESS_TOKEN_SECRET is not defined");
  }
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      name: this.name,
    },
    process.env.ACESS_TOKEN_SECRET,
    { expiresIn: "1d" }
  );
};

userSchema.methods.generateAccessToken = function () {
  if (!process.env.REFERESH_TOKEN_SECRET) {
    throw new Error("REFERESH_TOKEN_SECRET is not defined");
  }
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFERESH_TOKEN_SECRET,
    { expiresIn: "1d" }
  );
};

export const User = mongoose.model("User", userSchema);
