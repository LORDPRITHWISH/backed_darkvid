import mongoose, { Schema, Document } from "mongoose";

export interface ISession extends Document {
  user: mongoose.Types.ObjectId;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  loginAt: Date;
  lastActiveAt: Date;
  logoutAt?: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    browser: {
      type: String,
    },
    browserVersion: {
      type: String,
    },
    os: {
      type: String,
    },
    osVersion: {
      type: String,
    },
    device: {
      type: String,
    },
    location: {
      country: String,
      region: String,
      city: String,
    },
    loginAt: {
      type: Date,
      default: Date.now,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    logoutAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    revokedAt: {
      type: Date,
    },
    revokedReason: {
      type: String,
    },
  },
  { timestamps: true }
);

export const Session = mongoose.model<ISession>("Session", sessionSchema);
