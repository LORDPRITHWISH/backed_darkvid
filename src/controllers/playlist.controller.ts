import mongoose, {isValidObjectId} from "mongoose"
// import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
// import {ApiResponse} from "../utils/ApiResponse.js"
import { asyncHandeler } from "../utils/asyncHandelers.js"
import { Playlist } from "../models/playlist.models.js"
import { Video } from "../models/video.models.js"
// import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandeler(async (req, res) => {
    //TODO: create playlist

    const {title, description, isPublic} = req.body

    // console.log("Creating playlist:", title)

    if (!title) {
        throw new ApiError(400, "Title is required")
    }

    const playlist = await Playlist.create({
        title,
        description,
        isPublic,
        owner: req.user._id
    })

    res.status(201).json({
        success: true,
        data: playlist
    })
})

const getMyPlaylists = asyncHandeler(async (req, res) => {
    //TODO: get user playlists
    const userId = req.user._id


    const playlists = await Playlist.find({owner: userId }).select("-videos -__v -owner")

    res.status(200).json({
        success: true,
        data: playlists
    })
})


const getUserPlaylists = asyncHandeler(async (req, res) => {
    //TODO: get user playlists
    const {userId} = req.params

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Invalid user ID")
    }

    const playlists = await Playlist.find({owner: userId, isPublic: true}).select("-videos -isPublic -owner -__v")

    res.status(200).json({
        success: true,
        data: playlists
    })
})

const getPlaylistById = asyncHandeler(async (req, res) => {
    //TODO: get playlist by id
    const {playlistId} = req.params
    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid playlist ID")
    }

    const playlist = await Playlist.findById(playlistId).select("-__v")

    if(!playlist){
        throw new ApiError(404, "Playlist not found")
    }

    res.status(200).json({
        success: true,
        data: playlist
    })
})

const addVideoToPlaylist = asyncHandeler(async (req, res) => {
    const {playlistId, videoId} = req.params
    
    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid playlist ID")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID")
    }
    

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(404, "Playlist not found")
    }

    if(playlist.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not authorized to add videos to this playlist")
    }

    playlist.videos.push(videoId)
    await playlist.save()

    res.status(200).json({
        success: true,
        data: playlist
    })
})

const removeVideoFromPlaylist = asyncHandeler(async (req, res) => {
    // TODO: remove video from playlist
    const {playlistId, videoId} = req.params
    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid playlist ID")
    }

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID")
    }

    const playlist = await Playlist.findById(playlistId)

    if(!playlist){
        throw new ApiError(404, "Playlist not found")
    }

    if(playlist.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "You are not authorized to remove videos from this playlist")
    }

    playlist.videos = playlist.videos.filter((vId: mongoose.Types.ObjectId) => vId.toString() !== videoId)
    await playlist.save()

    res.status(200).json({
        success: true,
        data: playlist
    })

})

const deletePlaylist = asyncHandeler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
})

const updatePlaylist = asyncHandeler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist
})

export {
    createPlaylist,
    getMyPlaylists,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}