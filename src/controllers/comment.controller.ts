import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";
import { Video } from "../models/video.models";
import { Comment } from "../models/comment.models";

const CommentOnVideo = asyncHandeler(async (req, res) => {
    const { content, videoId } = req.body;
    if (!content || !videoId) {
        throw new ApiError(400, "Content and videoId are required");
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

export {
    CommentOnVideo,
    CommentOnTweet,
    CommentOnComment
};
