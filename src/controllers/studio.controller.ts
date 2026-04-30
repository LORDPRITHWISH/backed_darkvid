import mongoose from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import { asyncHandeler } from "../utils/asyncHandelers.js"
import { User } from "../models/user.models.js"
import { Video } from "../models/video.models.js"

const getChannelStats = asyncHandeler(async (req, res) => {
    // TODO: Get the channel stats like total video views, total subscribers, total videos, total likes etc.
    const user = req.user
    if (!user) {
        throw new ApiError(401, "Unauthorized")
    }
    const userId = user._id
    console.log("USER ID:", userId)

    const stats = await User.aggregate([
        { $match: { _id: userId } },
        {
            $lookup: {
                from: "videos",
                localField: "_id",
                foreignField: "owner",
                as: "videos"
            }
        },
        { $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscribedTo",
            as: "subscriptions"
        }},
        {
            $project: {
                _id: 1,
                email: 1,
                name: 1,
                totalVideos: { $size: "$videos" },
                totalViews: { $sum: "$videos.views" },
                totalLikes: { $sum: "$videos.likes" },
                totalSubscribers: { $size: "$subscriptions" }
            }
        }
    ])

    res.status(200).json({
        success: true,
        data: stats
    })
})

const getChannelVideos = asyncHandeler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const user = req.user
    if (!user) {
        throw new ApiError(401, "Unauthorized")
    }
    const userId = user._id
    console.log("USER ID:", userId)

    const videos = await Video.find({ owner: userId }).select("-tags -__v -owner -description").sort({ createdAt: -1 })

    res.status(200).json({
        success: true,
        data: videos
    })
})

export {
    getChannelStats, 
    getChannelVideos,
}