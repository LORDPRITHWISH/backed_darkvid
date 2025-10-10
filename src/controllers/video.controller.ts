import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";
import { Video } from "../models/video.models";
import { uploadFile, deleteFile } from "../utils/cloudinay";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import {
  completeMultipartUpload,
  getPresignedUrl,
  getVideoUrl,
  initMultipartUpload,
  uploadImage,
} from "../utils/s3Helper";

const initVideoUpload = asyncHandeler(async (req, res) => {
  try {
    const videoId = uuidv4();
    const key = `videos/${videoId}.mp4`;

    const { uploadId, videoUrl } = await initMultipartUpload(key, "video/mp4");

    const video = await Video.create({
      videoKey: videoId,
      videoUrl,
      status: "uploading",
      owner: req.user.id,
    });

    return res.status(200).json(
      new ApiResponce(200, "Upload initiated", {
        uploadId,
        videoId: video.videoId,
      })
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json(new ApiError(500, "Failed to init upload"));
  }
});

const getVideoSignedUrl = asyncHandeler(async (req, res) => {
  try {
    const { videoId, uploadId, partNumber } = req.body;

    const video = await Video.findOne({ videoId, owner: req.user.id });
    if (!video) {
      return res.status(404).json(new ApiError(404, "Video not found"));
    }

    const key = `videos/${video.videoKey}.mp4`;

    const signedUrl = await getPresignedUrl(key, uploadId, partNumber);

    return res
      .status(200)
      .json(new ApiResponce(200, "Signed URL fetched", { signedUrl }));
  } catch (err) {
    console.error(err);
    return res.status(500).json(new ApiError(500, "Failed to get signed URL"));
  }
});

export const completeVideoUpload = asyncHandeler(async (req, res) => {
  try {
    const { videoId, uploadId, parts } = req.body;

    // console.log("Invalid parts array:", parts);
    if (!Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json(new ApiError(400, "Parts array is required"));
    }

    const video = await Video.findOne({ videoId, owner: req.user.id });
    if (!video) {
      return res.status(404).json(new ApiError(404, "Video not found"));
    }

    const key = `videos/${video.videoKey}.mp4`;

    // Complete multipart upload

    const videoUrl = await completeMultipartUpload(key, uploadId, parts);

    if (!videoUrl) {
      video.status = "failed";
      await video.save();
      return res
        .status(500)
        .json(new ApiError(500, "Failed to complete upload"));
    }

    video.status = "completed";
    await video.save();

    return res
      .status(200)
      .json(new ApiResponce(200, "Upload completed", { videoUrl }));
  } catch (err) {
    console.error(err);
    return res.status(500).json(new ApiError(500, "Failed to complete upload"));
  }
});

export const uploadThumbnail = asyncHandeler(async (req, res) => {
  const { videoId } = req.params;

  const thumbnailID = uuidv4();

  const key = `thumbnails/${thumbnailID}.jpg`;

  const uploadURL = await uploadImage(key, "image/jpeg");

  // console.log("Thumbnail URL:", uploadURL);

  try {
    const video = await Video.findOneAndUpdate(
      { videoId },
      { thumbnailID },
      { new: true }
    );

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    const thumbnailURL = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.status(200).json(
      new ApiResponce(200, "Thumbnail uploaded successfully", {
        uploadURL,
        thumbnailURL,
      })
    );
  } catch (error) {
    console.error("Error uploading thumbnail:", error);
    throw new ApiError(500, "Failed to upload thumbnail");
  }
});

export const getPlaybackUrl = asyncHandeler(async (req, res) => {
  try {
    const { videoId } = req.params;
    // console.log(videoId);
    const key = `videos/${videoId}.mp4`;
    const playbackUrl = await getVideoUrl(key);
    // const playbackUrl = "lol";

    return res
      .status(200)
      .json(new ApiResponce(200, "Playback URL fetched", { playbackUrl }));
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json(new ApiError(500, "Failed to get playback URL"));
  }
});

const getVideo = asyncHandeler(async (req, res) => {
  // console.log("Fetching video with ID:", req.params.id);

  const video = await Video.aggregate([
    {
      $match: {
        videoId: req.params.id,
        // isPublished: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
      },
    },
    {
      $unwind: "$ownerDetails",
    },
    {
      $lookup: {
        from: "subscriptions",
        let: { ownerId: "$owner" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$subscribedTo", "$$ownerId"] },
                  {
                    $eq: [
                      "$subscriber",
                      mongoose.Types.ObjectId.createFromHexString(req.user.id),
                    ],
                  },
                ],
              },
            },
          },
        ],
        as: "subscriptions",
      },
    },
    {
      $addFields: {
        isSubscribed: { $gt: [{ $size: "$subscriptions" }, 0] },
      },
    },
    {
      $project: {
        __v: 0,
        updatedAt: 0,
        isPublished: 0,
        subscriptions: 0,
        owner: 0,
        "ownerDetails.password": 0,
        "ownerDetails.__v": 0,
        "ownerDetails.updatedAt": 0,
        "ownerDetails.email": 0,
        "ownerDetails.bio": 0,
        "ownerDetails.coverimage": 0,
        "ownerDetails.refereshToken": 0,
        "ownerDetails.watchHistory": 0,
        "ownerDetails.createdAt": 0,
        "ownerDetails.name": 0,
        "ownerDetails.isAdmin": 0,
        "ownerDetails.isBanned": 0,
      },
    },
  ]);
  const result = video[0];
  
  if (!result) {
    throw new ApiError(404, "Video not found");
  }

  const playbackUrl = await getVideoUrl(`videos/${result.videoKey}.mp4`);
  if (result) {
    result.playbackUrl = playbackUrl;
  }

  if (result.thumbnailID) {
    result.thumbnailUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/thumbnails/${result.thumbnailID}.jpg`;
  }

  if (result.ownerDetails._id.toString() === req.user.id) {
    result.isOwner = true;
  }

  const responce = { ...result, playbackUrl };


  if (!result.isPublished && !result.isOwner) {
    return res
      .status(403)
      .json(new ApiError(403, "You are not authorized to view this video"));
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "Video fetched successfully", responce));
});

const getVideoDetails = asyncHandeler(async (req, res) => {
  console.log("Fetching video with ID:", req.params.id);

  const video = await Video.findOne({
    videoId: req.params.id,
    // isPublished: true,
  });
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user.id) {
    // console.log("Not the owner");
    return res
      .status(403)
      .json(new ApiError(403, "You are not the owner of this video"));
  }

  const playbackUrl = await getVideoUrl(`videos/${video.videoKey}.mp4`);

  const thumbnailUrl = video.thumbnailID
    ? `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/thumbnails/${video.thumbnailID}.jpg`
    : null;

  const responce = { ...video.toObject(), playbackUrl, thumbnailUrl };

  return res
    .status(200)
    .json(new ApiResponce(200, "Video fetched successfully", responce));
});

const updateVideo = asyncHandeler(async (req, res) => {

  const videoId = req.params.videoId;
  if (!videoId) {
    return res.status(400).json(new ApiError(400, "Video ID is required"));
  }

  const video = await Video.findOne({ videoId });
  if (!video) {
    return res.status(404).json(new ApiError(404, "Video not found"));
  }

  if (video.owner.toString() !== req.user.id) {
    return res
      .status(403)
      .json(new ApiError(403, "You are not the owner of this video"));
  }

  const { title, description, tags, isPublished, duration, privacy } = req.body;

  console.log("Update video payload:", req.body);

  if (title !== undefined) video.title = title;
  if (description !== undefined) video.description = description;
  if (tags !== undefined) video.tags = tags;
  if (isPublished !== undefined) video.isPublished = isPublished;
  if (duration !== undefined) video.duration = duration;
  if (privacy !== undefined) video.privacy = privacy;

  await video.save();

  return res
    .status(200)
    .json(new ApiResponce(200, "Video updated successfully", video));
});

const deleteVideo = asyncHandeler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponce(200, "Video deleted successfully", req.params.id));
});

const SuggestedVideos = asyncHandeler(async (req, res) => {
  // Video.find({ isPublished: true })
  //   .sort({ createdAt: -1 })
  //   .limit(10)
  //   .then((videos) => {

  //   });

  const videos = await Video.aggregate([
    { $match: { isPublished: true } },
    { $sample: { size: 30 } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
      },
    },
    {
      $unwind: "$ownerDetails",
    },
    {
      $project: {
        _id: 0,
        __v: 0,
        updatedAt: 0,
        isPublished: 0,
        owner: 0,
        tags: 0,
        description: 0,
        videoKey: 0,
        // videoURL: 0,
        dislikes: 0,
        comments: 0,

        // createdAt: 0,

        "ownerDetails.password": 0,
        "ownerDetails.__v": 0,
        "ownerDetails.updatedAt": 0,
        "ownerDetails.email": 0,
        "ownerDetails.bio": 0,
        "ownerDetails.coverimage": 0,
        "ownerDetails.refereshToken": 0,
        "ownerDetails.watchHistory": 0,
        "ownerDetails.createdAt": 0,
        "ownerDetails.name": 0,
      },
    },
  ]);

  if (!videos || videos.length === 0) {
    return res
      .status(404)
      .json(new ApiResponce(404, "No suggested videos found", {}));
  }

  videos.forEach((video) => {
    if (video.thumbnailID) {
      video.thumbnailUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/thumbnails/${video.thumbnailID}.jpg`;
    }
  });

  return res
    .status(200)
    .json(
      new ApiResponce(200, "Suggested videos fetched successfully", videos)
    );
});

const UsersVideos = asyncHandeler(async (req, res) => {
  const userId = req.params.id;
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  console.log("Fetching videos for user ID:", userId);

  const videos = await Video.find({ owner: userId }).select({
    __v: 0,
    updatedAt: 0,
    isPublished: 0,
    owner: 0,
    tags: 0,
    description: 0,
    dislikes: 0,
    comments: 0,
  });
  return res
    .status(200)
    .json(new ApiResponce(200, "User's videos fetched successfully", videos));
});

// export const userStudioVideos = asyncHandeler(async (req, res) => {
const userStudioVideos = asyncHandeler(async (req, res) => {

  // console.log("hello");

  const userId = req.user.id;

  // console.log("Fetching all videos for user ID:", userId);

  const videos = await Video.find({ owner: userId }).select({
    __v: 0,
    updatedAt: 0,
    owner: 0,
    // tags: 0,
    description: 0,
    // dislikes: 0,
    comments: 0,
  });
  return res
    .status(200)
    .json(new ApiResponce(200, "Studio videos fetched successfully", videos));
    // .json(new ApiResponce(200, "Studio videos fetched successfully", []));
});

export {
  getVideo,
  updateVideo,
  userStudioVideos,
  // uploadVideo,
  deleteVideo,
  SuggestedVideos,
  getVideoDetails,
  UsersVideos,
  initVideoUpload,
  getVideoSignedUrl,
};
