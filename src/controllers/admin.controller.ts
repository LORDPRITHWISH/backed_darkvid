import mongoose, { type PipelineStage } from "mongoose";
import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { Video } from "../models/video.models";
import { Session } from "../models/sesson.models";

export const GetAllUsers = asyncHandeler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const pipeline: PipelineStage[] = [
    { $match: {} },
    {
      $facet: {
        // Branch 1: paginated data
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "videos",
              pipeline: [
                { $match: {} },
                {
                  $project: {
                    videoKey: 1,
                    thumbnailID: 1,
                    title: 1,
                    description: 1,
                    tags: 1,
                    privacy: 1,
                    duration: 1,
                    isPublished: 1,
                    owner: 1,
                    status: 1,
                    deleted: 1,
                    createdAt: 1,
                    updatedAt: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              videoCount: { $size: "$videos" }, // count per owner
            },
          },
          {
            $lookup: {
              from: "sessions",
              localField: "_id",
              foreignField: "user",
              as: "latestSession",
              pipeline: [
                { $sort: { loginAt: -1 } },
                { $limit: 1 }
              ]
            }
          },
          {
            $addFields: {
              latestSession: { $arrayElemAt: ["$latestSession", 0] }
            }
          },
          // {
          //   $unwind: {
          //     path: "$videos",
          //     preserveNullAndEmptyArrays: true,
          //   },
          // },
        ],

        // Branch 2: total count
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $arrayElemAt: ["$total.count", 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [{ $arrayElemAt: ["$total.count", 0] }, limit],
          },
        },
      },
    },
  ];
  const users = await User.aggregate(pipeline);
  return res
    .status(200)
    .json(new ApiResponce(200, "Users fetched successfully", users));
});

export const GetUser = asyncHandeler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "User id is required");
  }

  const user = await User.findById(id).lean();
  const latestSession = await Session.findOne({ user: id }).sort({ loginAt: -1 }).lean();
  
  const userData = user ? { ...user, latestSession } : null;

  return res
    .status(200)
    .json(new ApiResponce(200, "User fetched successfully", userData));
});

export const GetAllVideos = asyncHandeler(async (req, res) => {
  const pipeline: PipelineStage[] = [];
  const users = Video.aggregate(pipeline);
  return res
    .status(200)
    .json(new ApiResponce(200, "Users fetched successfully", users));
});

export const getVideo = asyncHandeler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Video id is required");
  }

  const video = await Video.findById(id);

  return res
    .status(200)
    .json(new ApiResponce(200, "Video fetched successfully", video));
});
