import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";

import mongoose from "mongoose";
import { ApiResponce } from "../utils/ApiResponce";
import { View } from "../models/view.models";
import { ViewHistory } from "../models/viewhistory.models";
import { redisClient } from "../utils/redis";
import { Video } from "../models/video.models";

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
  const { sessionId } = req.body;

  if (!videoId || !sessionId) {
    throw new ApiError(400, "Video ID and Session ID are required");
  }

  const video = await Video.findOne({ videoId });

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const { id } = video;

  const viewerId = req.user.id;

  // Redis keys for this session
  const sessionKey = `session:${viewerId}:${id}:${sessionId}`;
  const progressKey = `progress:${viewerId}:${id}:${sessionId}`;
  const progressLastKey = `progress:last:${viewerId}:${id}:${sessionId}`;

  const existingHistoryId = await redisClient.get(sessionKey);

  if (existingHistoryId) {
    const lastPosition = await redisClient.get(progressLastKey);

    await redisClient.setEx(progressKey, 30, String(lastPosition));

    return res.status(200).json(
      new ApiResponce(200, "View session already exists", {
        startPosition: lastPosition ? Number(lastPosition) : 0,
      })
    );
  }

  const preView = await View.findOne({ videoId: id, viewerId });

  const startPosition = preView ? preView.lastPosition : 0;

  const history = await ViewHistory.create({
    viewerId,
    videoId: id,
    startPosition,
    viewedAt: new Date(),
  });

  // Store current session history id
  await redisClient.set(sessionKey, history._id.toString());

  // Add watcher to active watcher set
  await redisClient.sAdd("activeWatchers", `${viewerId}:${id}`);

  // Initialize current position with TTL for heartbeat tracking
  await redisClient.setEx(progressKey, 30, String(startPosition));

  // Backup position (no TTL)
  await redisClient.set(progressLastKey, String(startPosition));

  // await view.save();

  return res.status(201).json(
    new ApiResponce(201, "View started successfully", {
      startPosition,
    })
  );
});

export const heartbeatView = asyncHandeler(async (req, res) => {
  const { videoId } = req.params;
  const { lastPosition, sessionId } = req.body;

  if (!videoId || !lastPosition) {
    throw new ApiError(400, "Video ID and last position are required");
  }

  if (lastPosition < 0) {
    throw new ApiError(400, "Last position cannot be negative");
  }
  if (isNaN(lastPosition)) {
    throw new ApiError(400, "Last position must be a number");
  }

  const viewerId = req.user.id;

  const video = await Video.findOne({ videoId });

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const { id } = video;

  const sessionKey = `session:${viewerId}:${id}:${sessionId}`;
  const progressKey = `progress:${viewerId}:${id}:${sessionId}`;
  const progressLastKey = `progress:last:${viewerId}:${id}:${sessionId}`;
  console.log("key", sessionKey);

  const sessionDataId = await redisClient.get(sessionKey);
  if (!sessionDataId) {
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
  // const { videoId, lastPosition } = req.body;
  const { videoId } = req.params;
  const { lastPosition, sessionId } = req.body;

  if (!videoId || !lastPosition) {
    throw new ApiError(400, "Video ID and last position are required");
  }

  const viewerId = req.user.id;

  const id = await Video.findOne({ videoId }).then((video) => video?.id);

  if (!id) {
    throw new ApiError(404, "Video not found");
  }

  const sessionKey = `session:${viewerId}:${id}:${sessionId}`;
  const progressKey = `progress:${viewerId}:${id}:${sessionId}`;
  const progressLastKey = `progress:last:${viewerId}:${id}:${sessionId}`;

  console.log("Sesson key ", sessionKey);

  const sessionDataId = await redisClient.get(sessionKey);
  if (!sessionDataId) {
    throw new ApiError(400, "No active viewing session found");
  }

  if (lastPosition < 0) {
    throw new ApiError(400, "Last position cannot be negative");
  }
  if (isNaN(lastPosition)) {
    throw new ApiError(400, "Last position must be a number");
  }

  // Update or create the View document
  const view = await View.findOneAndUpdate(
    { videoId: id, viewerId },
    { lastPosition, updatedAt: new Date() },
    { new: true, upsert: true }
  );

  // Update the ViewHistory document
  await ViewHistory.findByIdAndUpdate(sessionDataId, {
    endPosition: lastPosition,
    endedAt: new Date(),
  });

  // Clean up Redis keys
  await redisClient
    .multi()
    .del(sessionKey)
    .del(progressKey)
    .del(progressLastKey)
    .sRem("activeWatchers", `${viewerId}:${videoId}`)
    .exec();

  return res
    .status(201)
    .json(new ApiResponce(201, "View added successfully", view));
});
