import mongoose, { isValidObjectId } from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandeler } from "../utils/asyncHandelers.js";
import { Like } from "../models/likes.models.js";
import { ApiResponce } from "../utils/ApiResponce.js";
import { Video } from "../models/video.models.js";
import { Tweet } from "../models/tweet.models.js";
import { Comment } from "../models/comment.models.js";
import { redisClient } from "../utils/redis.js";

const toggleVideoLike = asyncHandeler(async (req, res) => {
  //TODO: toggle like on video
  const { videoId } = req.params;
  const { mode } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (mode && !["like", "dislike"].includes(mode)) {
    throw new ApiError(400, "Mode must be 'like' or 'dislike' or null");
  }

  const existingLike = await Like.findOne({
    videoId: videoId,
    originator: req.user._id,
  });

  if (existingLike) {
    if (!mode) {
      await existingLike.deleteOne();
      const results = await redisClient.hIncrBy(
        `videoMeta:${videoId}`,
        existingLike.mode === "like" ? "likes" : "dislikes",
        -1
      );
      console.log("the redis details", results);
      return res
        .status(200)
        .json(new ApiResponce(200, `Video preference neutralized`, null));
    }
    if (existingLike.mode === mode) {
      // If like already exists with same mode, remove it (unlike)
      await existingLike.deleteOne();
      const results = await redisClient.hIncrBy(
        `videoMeta:${videoId}`,
        mode === "like" ? "likes" : "dislikes",
        -1
      );
      console.log("the redis details", results);
      return res
        .status(200)
        .json(new ApiResponce(200, `Video un${mode}d successfully`, null));
    } else {
      existingLike.mode = mode;
      await existingLike.save();
      const results = await redisClient
        .multi()
        .hIncrBy(
          `videoMeta:${videoId}`,
          mode === "like" ? "likes" : "dislikes",
          1
        )
        .hIncrBy(
          `videoMeta:${videoId}`,
          mode === "like" ? "dislikes" : "likes",
          -1
        )
        .exec();
      console.log("the redis details", results);

      return res
        .status(200)
        .json(
          new ApiResponce(200, `Video ${mode}d successfully`, existingLike)
        );
    }
  }

  if (!mode) {
    return res
      .status(200)
      .json(new ApiResponce(200, `Video neither liked nor disliked`, null));
  }

  // If like doesn't exist, create a new one
  const like = await Like.create({
    videoId: videoId,
    originator: req.user._id,
    mode: mode,
  });

  const results = await redisClient.hIncrBy(
    `videoMeta:${videoId}`,
    mode === "like" ? "likes" : "dislikes",
    1
  );
  console.log("the redis details", results);

  return res
    .status(200)
    .json(new ApiResponce(200, `Video ${mode}d successfully`, like));
});

const toggleCommentLike = asyncHandeler(async (req, res) => {
  //TODO: toggle like on comment
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid commentId");
  }

  // Assuming Comment model exists
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const existingLike = await Like.findOne({
    commentId: commentId,
    originator: req.user._id,
  });

  if (existingLike) {
    // If like already exists, remove it (unlike)
    comment.likes = Math.max(0, comment.likes - 1);
    await comment.save();

    await existingLike.deleteOne();
    return res
      .status(200)
      .json(new ApiResponce(200, "Comment unliked successfully", null));
  }

  // If like doesn't exist, create a new one
  const like = await Like.create({
    commentId: commentId,
    originator: req.user._id,
  });

  comment.likes += 1;
  await comment.save();

  return res
    .status(200)
    .json(new ApiResponce(200, "Comment like toggled successfully", like));
});

const toggleTweetLike = asyncHandeler(async (req, res) => {
  //TODO: toggle like on tweet
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweetId");
  }

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  const existingLike = await Like.findOne({
    tweetId: tweetId,
    originator: req.user._id,
  });

  if (existingLike) {
    // If like already exists, remove it (unlike)
    tweet.likes = Math.max(0, tweet.likes - 1);
    await tweet.save();

    await existingLike.deleteOne();
    return res
      .status(200)
      .json(new ApiResponce(200, "Tweet unliked successfully", null));
  }

  // If like doesn't exist, create a new one
  const like = await Like.create({
    tweetId: tweetId,
    originator: req.user._id,
  });

  tweet.likes += 1;
  await tweet.save();

  return res
    .status(200)
    .json(new ApiResponce(200, "Tweet like toggled successfully", like));
});

const getLikedVideos = asyncHandeler(async (req, res) => {

  const likedVideos = await Like.aggregate([
    { $match: { originator: new mongoose.Types.ObjectId(req.user._id) } },
    {
      $lookup: {
        from: "videos",
        localField: "videoId",
        foreignField: "_id",
        as: "videoDetails",
      },
    },
    { $unwind: "$videoDetails" },
    {
      $project: {
        _id: 0,
        videoId: "$videoDetails._id",
        title: "$videoDetails.title",
        //   description: "$videoDetails.description",
        videoURL: "$videoDetails.videoURL",
        thumbnailURL: "$videoDetails.thumbnailURL",
        //   tags: "$videoDetails.tags",
        views: "$videoDetails.views",
        likes: "$videoDetails.likes",
        dislikes: "$videoDetails.dislikes",
        //   comments: "$videoDetails.comments",
        duration: "$videoDetails.duration",
        //   isPublished: "$videoDetails.isPublished",
        owner: "$videoDetails.owner",
        //   createdAt: "$videoDetails.createdAt",
        //   updatedAt: "$videoDetails.updatedAt",
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponce(200, "Liked videos fetched successfully", likedVideos)
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
