import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";

import mongoose from "mongoose";
import { ApiResponce } from "../utils/ApiResponce";
import { View } from "../models/view.models";
import { ViewHistory } from "../models/viewhistory.models";
import { redisClient } from "../utils/redis";

export const getLastViews = asyncHandeler(async (req, res) => {
  // Implementation for getting views will go here
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "Video ID is required");
  }

  const views = await View.find({ videoId }).sort({ createdAt: -1 }).limit(10);

  return res.status(200).json(new ApiResponce(200, "viewed till", views));
});

export const getViewHistory = asyncHandeler(async (req, res) => {
  console.log("Hello History");
  return res.status(200).json(new ApiResponce(200, "view History", null));
});

export const startView = asyncHandeler(async (req, res) => {
  const { videoId } = req.params;
  // const { videoId } = req.body;

  if (!videoId) {
    throw new ApiError(400, "Video ID is required");
  }

  const userId = req.user.id;

  // Redis keys for this session
  const sessionKey = `session:${userId}:${videoId}`;
  const progressKey = `progress:${userId}:${videoId}`;
  const progressLastKey = `progress:last:${userId}:${videoId}`;

  const existingHistoryId = await redisClient.get(sessionKey);

  if (existingHistoryId) {
    const lastPosition = await redisClient.get(progressLastKey);

    await redisClient.setEx(progressKey, 30, String(lastPosition));

    return res.status(200).json(
      new ApiResponce(200, "View session already exists", {
        historyId: existingHistoryId,
        startPosition: lastPosition ? Number(lastPosition) : 0,
      })
    );
  }

  const preView = await View.findOne({ videoId, userId });

  const startPosition = preView ? preView.lastPosition : 0;

  const history = await ViewHistory.create({
    userId,
    videoId,
    startPosition,
    viewedAt: new Date(),
  });

  // Store current session history id
  await redisClient.set(sessionKey, history._id.toString());

  // Add watcher to active watcher set
  await redisClient.sAdd("activeWatchers", `${userId}:${videoId}`);

  // Initialize current position with TTL for heartbeat tracking
  await redisClient.setEx(progressKey, 30, String(startPosition));

  // Backup position (no TTL)
  await redisClient.set(progressLastKey, String(startPosition));

  // await view.save();

  return res.status(201).json(
    new ApiResponce(201, "View started successfully", {
      historyId: history._id.toString(),
      startPosition,
    })
  );
});

export const heartbeatView = asyncHandeler(async (req, res) => {
  const { videoId } = req.params;
  const { lastPosition } = req.body;

  if (!videoId || !lastPosition) {
    throw new ApiError(400, "Video ID and last position are required");
  }

  if (lastPosition < 0) {
    throw new ApiError(400, "Last position cannot be negative");
  }
  if (isNaN(lastPosition)) {
    throw new ApiError(400, "Last position must be a number");
  }

  const userId = req.user.id;

  const sessionKey = `session:${userId}:${videoId}`;
  const progressKey = `progress:${userId}:${videoId}`;
  const progressLastKey = `progress:last:${userId}:${videoId}`;

  const sessionId = await redisClient.get(sessionKey);
  if (!sessionId) {
    throw new ApiError(400, "No active viewing session found");
  }

  await redisClient
    .multi()
    .setEx(progressKey, 30, String(lastPosition))
    .set(progressLastKey, String(lastPosition))
    .exec();

  return res
    .status(201)
    .json(
      new ApiResponce(201, "Sesson updated successfully", { lastPosition })
    );
});

export const endView = asyncHandeler(async (req, res) => {
  const { videoId, lastPosition } = req.body;

  if (!videoId || !lastPosition) {
    throw new ApiError(400, "Video ID and last position are required");
  }

  const userId = req.user.id;

  // const view = new View({
  //   videoId,
  //   userId: req.user.id,
  //   duration,
  // });

  // await view.save();

  return res
    .status(201)
    .json(new ApiResponce(201, "View added successfully", null));
});
