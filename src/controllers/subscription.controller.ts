import mongoose, { isValidObjectId } from "mongoose";
// import {User} from "../models/user.model.js"
// import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js";
// import {ApiResponse} from "../utils/ApiResponse.js"
import { asyncHandeler } from "../utils/asyncHandelers.js";
import { ApiResponce } from "../utils/ApiResponce.js";
import { User } from "../models/user.models.js";
import { Subscription } from "../models/subscription.models.js";
import { redisClient } from "../utils/redis.js";
// import {asyncHandler} from "../utils/asyncHandler.js"

const toggleSubscription = asyncHandeler(async (req, res) => {
  const { channelId } = req.params;
  if (!channelId) {
    throw new ApiError(400, "Channel ID is required");
  }

  if (channelId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot subscribe to your own channel");
  }

  const existingSubscription = await Subscription.findOne({
    subscriber: req.user._id,
    subscribedTo: channelId,
  });

  if (existingSubscription) {
    await Subscription.findByIdAndDelete(existingSubscription._id);
    await redisClient.decr(`subCount:${channelId}`);
    return res
      .status(200)
      .json(new ApiResponce(200, "Unsubscribed from channel successfully", {}));
  }

  const subscription = await Subscription.create({
    subscriber: req.user._id,
    subscribedTo: channelId,
  });
  await redisClient.incr(`subCount:${channelId}`);
  if (!subscription) {
    throw new ApiError(500, "Subscription failed");
  }

  return res
    .status(201)
    .json(
      new ApiResponce(201, "Subscribed to channel successfully", subscription)
    );
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandeler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const subscribers = await Subscription.find({
    subscribedTo: channelId,
  }).populate("subscriber", "username profilePic");

  return res
    .status(200)
    .json(
      new ApiResponce(
        200,
        "Channel subscribers fetched successfully",
        subscribers
      )
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandeler(async (req, res) => {
  const { channelId } = req.params;
  if (!channelId) {
    throw new ApiError(400, "Channel ID is required");
  }
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const subscriptions = await Subscription.find({
    subscriber: channelId,
  }).populate("subscribedTo", "title");

  return res
    .status(200)
    .json(
      new ApiResponce(
        200,
        "Subscribed channels fetched successfully",
        subscriptions
      )
    );
});

const mySubscribedChannels = asyncHandeler(async (req, res) => {
  const userId = req.user._id;
  const subscriptions = await Subscription.aggregate([
    { $match: { subscriber: userId } },
    {
      $lookup: {
        from: "users",
        localField: "subscribedTo",
        foreignField: "_id",
        as: "channelInfo",
      },
    },
    { $unwind: "$channelInfo" },
    {
      $replaceRoot: { newRoot: "$channelInfo" }, // flatten, only channelInfo
    },
    {
      $project: {
        _id: 1,
        username: 1,
        profilepic: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponce(
        200,
        "Subscribed channels fetched successfully",
        subscriptions
      )
    );
});

export {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
  mySubscribedChannels,
  // SubscribeToChannel
};
