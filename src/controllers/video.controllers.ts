import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { ApiError } from "../utils/ApiError";
import { Video } from "../models/video.models";
// import fs from "fs/promises";
import { uploadVideo as cloudinaryVidUpload , deleteVideo as CloudinaryVidDelete , uploadImage } from "../utils/cloudinay";



const uploadVideo = asyncHandeler(async(req, res) => {
    //   res.send("Upload Video");
    // console.log(req)
    if (!req.file) {
        throw new ApiError(400, "No video file uploaded");
    }

    // console.log("Video file uploaded:", req.file);
    console.log("Video file uploaded: ", req.file.path);

    const videoFilePath = req.file?.path;

    // const videoUrl = "http://localhost:3000/videos/"

    let videoURL;

    try {
      if (videoFilePath) videoURL = await uploadImage(videoFilePath);
      console.log("video uploaded", videoURL);
    } catch (error) {
      console.log(error);
      throw new ApiError(500, "Video not uploaded");
    }

    console.log("Video URL:", videoURL);
 
      // if (videoFilePath) {
      //   try {
      //     await fs.unlink(videoFilePath);
      //   } catch (err) {
      //     console.error("Failed to delete local video file:", err);
      //   }
      // }

    res.status(200).json(new ApiResponce(200, "Video uploaded successfully", { videoURL }));

    // try{
    //     const video = await Video.create({
    //       videoURL: videoURL,
    //       thumbnailURL: "https://upload.wikimedia.org/wikipedia/en/4/47/Iron_Man_%28circa_2018%29.png",
    //       title: req.file.originalname,
    //       description: "lol",
    //       tags: ["example", "video"],
    //       views: 0,
    //       likes: 0,
    //       dislikes: 0,
    //       comments: 0,
    //       duration: "1000",
    //       isPublished: true,
    //       owner: req.user.id,
    //     });
    
    //     const createdVideo = await Video.findById(video._id)
    
    //     return res
    //     .status(200)
    //     .json(new ApiResponce(200, "Video uploaded successfully", createdVideo));
    // }
    // catch (error) {
    //     // if (videoURL) {
    //     //   await deleteVideo(videoURL.);
    //     // }
    //     console.error("Error uploading video:", error);
    //     throw new ApiError(500, "Failed to upload video");
    // }
})

const createVideo = asyncHandeler(async (req, res) => {
  return res
    .status(201)
    .json(new ApiResponce(201, "Video created successfully", req.body));
});

const getVideo = asyncHandeler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponce(200, "Video fetched successfully", req.params.id));
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

export { createVideo, getVideo, updateVideo, deleteVideo, uploadVideo };