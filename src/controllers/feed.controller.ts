import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandeler } from "../utils/asyncHandelers.js";
import { User } from "../models/user.models.js";
import { Video } from "../models/video.models.js";

const getHomePageVideos = asyncHandeler(async (req, res) => {

  

  return res.status(200).json({
    success: true,
    message: "Home page videos fetched successfully",
  });
});

const getSubscriptionsVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Subscriptions videos fetched successfully",
  });
});

const getExploreVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Explore videos fetched successfully",
  });
});

const getTrendingVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Trending videos fetched successfully",
  });
});

const getHistoryVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "History videos fetched successfully",
  });
});

const getWatchLaterVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Watch later videos fetched successfully",
  });
});

const getLikedVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Liked videos fetched successfully",
  });
});

const getPlaylists = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Playlists fetched successfully",
  });
});

const getUploadsVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Uploads videos fetched successfully",
  });
});

const getProfile = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
  });
});

const getCommunityPosts = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Community posts fetched successfully",
  });
});

const getShortsVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Shorts videos fetched successfully",
  });
});

const getPodcasts = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Podcasts fetched successfully",
  });
});

const getLiveVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Live videos fetched successfully",
  });
});

const getMusicVideos = asyncHandeler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Music videos fetched successfully",
  });
});

export {
  getHomePageVideos,
  getSubscriptionsVideos,
  getExploreVideos,
  getTrendingVideos,
  getHistoryVideos,
  getWatchLaterVideos,
  getLikedVideos,
  getPlaylists,
  getUploadsVideos,
  getProfile,
  getCommunityPosts,
  getShortsVideos,
  getPodcasts,
  getLiveVideos,
  getMusicVideos
};
