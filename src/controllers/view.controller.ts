import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";

import mongoose from "mongoose";
import { ApiResponce } from "../utils/ApiResponce";
import { View } from "../models/view.models";

export const getLastViews = asyncHandeler(async (req, res) => {
  // Implementation for getting views will go here
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "Video ID is required");
  }

  const views = await View.find({ videoId }).sort({ createdAt: -1 }).limit(10);

  return res
    .status(200)
    .json(new ApiResponce(200, "Get views endpoint", views));
});

export const addView = asyncHandeler(async (req, res) => {
  const { videoId, duration } = req.body;

  if (!videoId || !duration) {
    throw new ApiError(400, "Video ID and duration are required");
  }

  const view = new View({
    videoId,
    userId: req.user.id,
    duration,
  });

  await view.save();

  return res
    .status(201)
    .json(new ApiResponce(201, "View added successfully", view));
});
