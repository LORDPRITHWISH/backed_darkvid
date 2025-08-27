import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";
import { Video } from "../models/video.models";
// import fs from "fs/promises";
import { uploadFile , deleteFile } from "../utils/cloudinay";



const uploadVideo = asyncHandeler(async(req, res) => {
    if (!req.file) {
        throw new ApiError(400, "No video file uploaded");
    }

    console.log("Video file uploaded: ", req.file.path);

    const videoFilePath = req.file?.path;

    let videoURL;

    try {
      if (videoFilePath) videoURL = await uploadFile(videoFilePath);
      console.log("video uploaded", videoURL);
    } catch (error) {
      console.log(error);
      throw new ApiError(500, "Video not uploaded");
    }

    console.log("Video URL:", videoURL);
 
    try{
        const video = await Video.create({
          videoURL: videoURL?.secure_url,
          thumbnailURL: "https://upload.wikimedia.org/wikipedia/en/4/47/Iron_Man_%28circa_2018%29.png",
          title: req.file.originalname,
          description: "lol",
          tags: ["example", "video"],
          views: 0,
          likes: 0,
          dislikes: 0,
          comments: 0,
          duration: "1000",
          isPublished: true,
          owner: req.user.id,
        });
    
        const createdVideo = await Video.findById(video._id)
    
        return res
        .status(200)
        .json(new ApiResponce(200, "Video uploaded successfully", createdVideo));
    }
    catch (error) {
        if (videoURL) {
          await deleteFile(videoURL.public_id);
        }
        console.error("Error uploading video:", error);
        throw new ApiError(500, "Failed to upload video");
    }
})

const getVideo = asyncHandeler(async (req, res) => {
  console.log("Fetching video with ID:", req.params.id);
  const video = await Video.findOne({
    videoId: req.params.id,
    isPublished: true,
  }).select("-__v -updatedAt -isPublished ");
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  return res
    .status(200)
    .json(new ApiResponce(200, "Video fetched successfully", video));
});
const getVideoDetails = asyncHandeler(async (req, res) => {
  console.log("Fetching video with ID:", req.params.id);
  const video = await Video.findOne({
    videoId: req.params.id,
    isPublished: true,
  });
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  return res
    .status(200)
    .json(new ApiResponce(200, "Video fetched successfully", video));
});

const updateVideo = asyncHandeler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponce(200, "Video updated successfully", req.params.id));
});

const deleteVideo = asyncHandeler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponce(200, "Video deleted successfully", req.params.id));
});

const SuggestedVideos = asyncHandeler(async (req, res) => {

  Video.find({ isPublished: true })
    .sort({ createdAt: -1 })
    .limit(10)
    .then((videos) => {
      return res
        .status(200)
        .json(new ApiResponce(200, "Suggested videos fetched successfully", videos));
    });
});

export {  getVideo, updateVideo, deleteVideo, uploadVideo, SuggestedVideos , getVideoDetails };