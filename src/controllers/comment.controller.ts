import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";
import { Video } from "../models/video.models";
import { Comment } from "../models/comment.models";
import { Tweet } from "../models/tweet.models";
import mongoose from "mongoose";
import type{ PipelineStage } from "mongoose";


const CommentOnVideo = asyncHandeler(async (req, res) => {

    const { content, videoId } = req.body;
    if (!content || !videoId) {
        throw new ApiError(400, "Content and videoId are required");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const comment = new Comment({
        content,
        videoId,
        originator: req.user.id,
    });
    
    await comment.save();
    
    return res
        .status(201)
        .json(new ApiResponce(201, "Comment added successfully", comment));

    });

const CommentOnTweet = asyncHandeler(async (req, res) => {
    const { content, tweetId } = req.body;
    if (!content || !tweetId) {
        throw new ApiError(400, "Content and tweetId are required");
    }
    

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    const comment = new Comment({
        content,
        tweetId,
        originator: req.user.id,
    });
    
    await comment.save();
    
    return res
        .status(201)
        .json(new ApiResponce(201, "Comment added successfully", comment));
});

const CommentOnComment = asyncHandeler(async (req, res) => {
    const { content, commentId } = req.body;
    if (!content || !commentId) {
        throw new ApiError(400, "Content and commentId are required");
    }

    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
        throw new ApiError(404, "Parent comment not found");
    }

    const comment = new Comment({
        content,
        commentId,
        originator: req.user.id,
    });
    
    await comment.save();
    
    
    return res
        .status(201)
        .json(new ApiResponce(201, "Comment added successfully", comment));
});

const getCommentsForVideo = asyncHandeler(async (req, res) => {
    const { id } = req.params;

    const pipeline: PipelineStage[] = [
        {
          $match: { videoId: new mongoose.Types.ObjectId(id) }
        },
        {
          $lookup: {
            from: "users",
            localField: "originator",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $lookup: {
            from: "comments",
            let: { parentId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$commentId", "$$parentId"] }
                }
              },
              {
                $lookup: {
                  from: "users",
                  localField: "originator",
                  foreignField: "_id",
                  as: "user"
                }
              },
              { $unwind: "$user" },
              {
                $project: {
                  _id: 1,
                  content: 1,
                  likes: 1,
                  createdAt: 1,
                  "user._id": 1,
                  "user.username": 1,
                  "user.email": 1
                }
              },
              { $sort: { createdAt: -1 } }
            ],
            as: "replies"
          }
        },
        {
          $addFields: {
            replyCount: { $size: "$replies" }
          }
        },
        {
          $project: {
            content: 1,
            likes: 1,
            replyCount: 1,
            createdAt: 1,
            "user._id": 1,
            "user.username": 1,
            "user.email": 1,
            replies: 1
          }
        },
        { $sort: { createdAt: -1 } }
      ];

    const comments = await Comment.aggregate(pipeline);
  
    return res
      .status(200)
      .json(new ApiResponce(200, "Comments fetched successfully", comments));

    });

export {
    CommentOnVideo,
    CommentOnTweet,
    CommentOnComment,
    getCommentsForVideo
};
