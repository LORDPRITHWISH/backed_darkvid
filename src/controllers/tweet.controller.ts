import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandeler } from "../utils/asyncHandelers.js";
import { Tweet } from "../models/tweet.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponce } from "../utils/ApiResponce.js";

const createTweet = asyncHandeler(async (req, res) => {
  //TODO: create tweet
  const { title, content } = req.body;
  console.log("tweet content:", content);

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const tweet = await Tweet.create(
    [{ title, content, originator: req.user.id }],
    {
      lean: true,
    }
  );

  return res
    .status(201)
    .json(new ApiResponce(201, "Tweet created successfully", tweet));
});

const getUserTweets = asyncHandeler(async (req, res) => {
  // TODO: get user tweets
  const tweets = await Tweet.find({ originator: req.user.id });

  //   const tweets = await Tweet.aggregate([
  //     { $match: { originator: new mongoose.Types.ObjectId(req.params.userId) } },
  //     {
  //       $lookup: {
  //         from: "users",
  //         localField: "originator",
  //         foreignField: "_id",
  //         as: "originator",
  //       },
  //     },
  //     { $unwind: "$originator" },
  //     {
  //       $lookup: {
  //         from: "likes",
  //         let: { tweetId: "$_id" },
  //         pipeline: [
  //           {
  //             $match: {
  //               $expr: {
  //                 $and: [
  //                   { $eq: ["$likeableId", "$$tweetId"] },
  //                   { $eq: ["$onModel", "Tweet"] },
  //                 ],
  //               },
  //             },
  //           },
  //           { $count: "count" },
  //         ],
  //         as: "likes",
  //       },
  //     },
  //     {
  //       $addFields: {
  //         likesCount: { $ifNull: [{ $arrayElemAt: ["$likes.count", 0] }, 0] },
  //       },
  //     },
  //     {
  //       $project: {
  //         content: 1,
  //         createdAt: 1,
  //         updatedAt: 1,
  //         "originator._id": 1,
  //         "originator.username": 1,
  //         "originator.name": 1,
  //         "originator.avatar": 1,
  //       },
  //     },
  //     { $sort: { createdAt: -1 } },
  //   ]);

  return res
    .status(200)
    .json(new ApiResponce(200, "User tweets fetched successfully", tweets));
});

const updateTweet = asyncHandeler(async (req, res) => {
  //TODO: update tweet

  const { title, content } = req.body;

  if (!content && !title) {
    throw new ApiError(400, "Content or title is required");
  }

  const tweet = await Tweet.findByIdAndUpdate(
    req.params.tweetId,
    { title, content },
    { new: true, runValidators: true }
  );

  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "Tweet updated successfully", tweet));
});

const deleteTweet = asyncHandeler(async (req, res) => {
  //TODO: delete tweet
  const tweet = await Tweet.findByIdAndDelete(req.params.tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "Tweet deleted successfully", tweet));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
