import mongoose, { type PipelineStage } from "mongoose";
import { User } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { ApiResponce } from "../utils/ApiResponce";
import { asyncHandeler } from "../utils/asyncHandelers";
import { Video } from "../models/video.models";
import { getObjectPublicUrl } from "../utils/s3Helper";

type LookupPipelineStage = Exclude<
  PipelineStage,
  PipelineStage.Merge | PipelineStage.Out
>;

const asLookupPipeline = (stages: PipelineStage[]) =>
  stages as LookupPipelineStage[];

const asFacetPipeline = (stages: PipelineStage[]) =>
  stages as PipelineStage.FacetPipelineStage[];

const getPagination = (query: { page?: unknown; limit?: unknown }) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const toObjectId = (id: string, label: string) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, `Invalid ${label}`);
  }

  return mongoose.Types.ObjectId.createFromHexString(id);
};

const videoMatchById = (id: string) => {
  if (mongoose.isValidObjectId(id)) {
    return {
      $or: [
        { _id: mongoose.Types.ObjectId.createFromHexString(id) },
        { videoId: id },
      ],
    };
  }

  return { videoId: id };
};

const videoSummaryStages = (
  includeViewsByDay = false,
  includeOwner = true
): PipelineStage[] => {
  const stages: PipelineStage[] = [];

  if (includeOwner) {
    stages.push(
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails",
          pipeline: [
            {
              $project: {
                _id: 1,
                username: 1,
                email: 1,
                name: 1,
                channelname: 1,
                profilepic: 1,
                coverimage: 1,
                // bio: 1,
                // role: 1,
                // isVerified: 1,
                // isBanned: 1,
                // createdAt: 1,
                // updatedAt: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$ownerDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          let: { ownerId: "$owner" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$subscribedTo", "$$ownerId"] },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
          ],
          as: "ownerSubscriberStats",
        },
      },
      {
        $lookup: {
          from: "videos",
          let: { ownerId: "$owner" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$owner", "$$ownerId"] },
              },
            },
            {
              $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                publishedVideos: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$isPublished", true] },
                          { $ne: ["$deleted", true] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          as: "ownerVideoStats",
        },
      }
    );
  }

  stages.push(
    {
      $lookup: {
        from: "comments",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$videoId", "$$videoId"] },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              latestCommentAt: { $max: "$createdAt" },
            },
          },
        ],
        as: "commentStats",
      },
    },
    {
      $lookup: {
        from: "likes",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$videoId", "$$videoId"] },
            },
          },
          {
            $group: {
              _id: "$mode",
              count: { $sum: 1 },
            },
          },
        ],
        as: "reactionStats",
      },
    },
    {
      $lookup: {
        from: "views",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$videoId", "$$videoId"] },
            },
          },
          {
            $group: {
              _id: null,
              uniqueViews: { $sum: 1 },
              completedViews: {
                $sum: {
                  $cond: [{ $eq: ["$completed", true] }, 1, 0],
                },
              },
              totalWatchTime: {
                $sum: { $ifNull: ["$totalWatchTime", 0] },
              },
              averageLastPosition: {
                $avg: { $ifNull: ["$lastPosition", 0] },
              },
              latestViewAt: { $max: "$updatedAt" },
            },
          },
        ],
        as: "uniqueViewStats",
      },
    },
    {
      $lookup: {
        from: "viewhistories",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$videoId", "$$videoId"] },
            },
          },
          {
            $addFields: {
              sessionWatchTime: {
                $cond: [
                  { $gt: ["$endPosition", "$startPosition"] },
                  { $subtract: ["$endPosition", "$startPosition"] },
                  0,
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalViews: { $sum: 1 },
              firstViewedAt: { $min: "$viewedAt" },
              latestViewedAt: { $max: "$viewedAt" },
              totalSessionWatchTime: { $sum: "$sessionWatchTime" },
            },
          },
        ],
        as: "viewStats",
      },
    }
  );

  if (includeViewsByDay) {
    stages.push({
      $lookup: {
        from: "viewhistories",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$videoId", "$$videoId"] },
            },
          },
          {
            $addFields: {
              sessionWatchTime: {
                $cond: [
                  { $gt: ["$endPosition", "$startPosition"] },
                  { $subtract: ["$endPosition", "$startPosition"] },
                  0,
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$viewedAt",
                },
              },
              views: { $sum: 1 },
              watchTime: { $sum: "$sessionWatchTime" },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              date: "$_id",
              views: 1,
              watchTime: 1,
            },
          },
        ],
        as: "viewsByDay",
      },
    });
  }

  stages.push(
    {
      $addFields: {
        ownerDetails: {
          $cond: [
            { $ifNull: ["$ownerDetails._id", false] },
            {
              _id: "$ownerDetails._id",
              username: "$ownerDetails.username",
              email: "$ownerDetails.email",
              name: "$ownerDetails.name",
              channelname: "$ownerDetails.channelname",
              profilepic: "$ownerDetails.profilepic",
              coverimage: "$ownerDetails.coverimage",
              bio: "$ownerDetails.bio",
              role: "$ownerDetails.role",
              isVerified: "$ownerDetails.isVerified",
              isBanned: "$ownerDetails.isBanned",
              createdAt: "$ownerDetails.createdAt",
              updatedAt: "$ownerDetails.updatedAt",
              subscriberCount: {
                $ifNull: [
                  { $arrayElemAt: ["$ownerSubscriberStats.count", 0] },
                  0,
                ],
              },
              videoCount: {
                $ifNull: [
                  { $arrayElemAt: ["$ownerVideoStats.totalVideos", 0] },
                  0,
                ],
              },
              publishedVideoCount: {
                $ifNull: [
                  { $arrayElemAt: ["$ownerVideoStats.publishedVideos", 0] },
                  0,
                ],
              },
            },
            null,
          ],
        },
        comments: {
          $ifNull: [{ $arrayElemAt: ["$commentStats.count", 0] }, 0],
        },
        latestCommentAt: {
          $arrayElemAt: ["$commentStats.latestCommentAt", 0],
        },
        likes: {
          $let: {
            vars: {
              likeStat: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: "$reactionStats",
                        as: "reaction",
                        cond: { $eq: ["$$reaction._id", "like"] },
                      },
                    },
                  },
                  { count: 0 },
                ],
              },
            },
            in: "$$likeStat.count",
          },
        },
        dislikes: {
          $let: {
            vars: {
              dislikeStat: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: "$reactionStats",
                        as: "reaction",
                        cond: { $eq: ["$$reaction._id", "dislike"] },
                      },
                    },
                  },
                  { count: 0 },
                ],
              },
            },
            in: "$$dislikeStat.count",
          },
        },
        uniqueViews: {
          $ifNull: [{ $arrayElemAt: ["$uniqueViewStats.uniqueViews", 0] }, 0],
        },
        completedViews: {
          $ifNull: [{ $arrayElemAt: ["$uniqueViewStats.completedViews", 0] }, 0],
        },
        totalWatchTime: {
          $ifNull: [
            { $arrayElemAt: ["$uniqueViewStats.totalWatchTime", 0] },
            0,
          ],
        },
        averageLastPosition: {
          $ifNull: [
            { $arrayElemAt: ["$uniqueViewStats.averageLastPosition", 0] },
            0,
          ],
        },
        latestViewAt: {
          $ifNull: [
            { $arrayElemAt: ["$uniqueViewStats.latestViewAt", 0] },
            { $arrayElemAt: ["$viewStats.latestViewedAt", 0] },
          ],
        },
        views: {
          $ifNull: [{ $arrayElemAt: ["$viewStats.totalViews", 0] }, 0],
        },
        firstViewedAt: {
          $arrayElemAt: ["$viewStats.firstViewedAt", 0],
        },
        totalSessionWatchTime: {
          $ifNull: [
            { $arrayElemAt: ["$viewStats.totalSessionWatchTime", 0] },
            0,
          ],
        },
        ageInDays: {
          $max: [
            1,
            {
              $ceil: {
                $divide: [{ $subtract: ["$$NOW", "$createdAt"] }, 86400000],
              },
            },
          ],
        },
      },
    },
    {
      $addFields: {
        averageWatchTime: {
          $cond: [
            { $gt: ["$views", 0] },
            { $divide: ["$totalWatchTime", "$views"] },
            0,
          ],
        },
        averageWatchTimePerUniqueViewer: {
          $cond: [
            { $gt: ["$uniqueViews", 0] },
            { $divide: ["$totalWatchTime", "$uniqueViews"] },
            0,
          ],
        },
        viewsPerDayAverage: {
          $cond: [
            { $gt: ["$ageInDays", 0] },
            { $divide: ["$views", "$ageInDays"] },
            0,
          ],
        },
        completionRate: {
          $cond: [
            { $gt: ["$uniqueViews", 0] },
            { $divide: ["$completedViews", "$uniqueViews"] },
            0,
          ],
        },
        engagementRate: {
          $cond: [
            { $gt: ["$uniqueViews", 0] },
            {
              $divide: [
                { $add: ["$likes", "$dislikes", "$comments"] },
                "$uniqueViews",
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        summary: {
          owner: "$ownerDetails",
          comments: "$comments",
          likes: "$likes",
          dislikes: "$dislikes",
          views: "$views",
          uniqueViews: "$uniqueViews",
          completedViews: "$completedViews",
          totalWatchTime: "$totalWatchTime",
          totalSessionWatchTime: "$totalSessionWatchTime",
          averageWatchTime: "$averageWatchTime",
          averageWatchTimePerUniqueViewer: "$averageWatchTimePerUniqueViewer",
          averageLastPosition: "$averageLastPosition",
          viewsPerDayAverage: "$viewsPerDayAverage",
          completionRate: "$completionRate",
          engagementRate: "$engagementRate",
          firstViewedAt: "$firstViewedAt",
          latestViewAt: "$latestViewAt",
          latestCommentAt: "$latestCommentAt",
        },
      },
    },
    {
      $project: {
        __v: 0,
        ownerSubscriberStats: 0,
        ownerVideoStats: 0,
        commentStats: 0,
        reactionStats: 0,
        uniqueViewStats: 0,
        viewStats: 0,
        ageInDays: 0,
      },
    }
  );

  return stages;
};

const userSummaryStages = (includeRecentSessions = false): PipelineStage[] => {
  const stages: PipelineStage[] = [
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
        pipeline: asLookupPipeline([
          { $sort: { createdAt: -1 } },
          ...videoSummaryStages(false, false),
          {
            $project: {
              videoKey: 0,
              owner: 0,
              ownerDetails: 0,
              "summary.owner": 0,
            },
          },
        ]),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$subscribedTo", "$$userId"] },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
            },
          },
        ],
        as: "subscriberStats",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$subscriber", "$$userId"] },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
            },
          },
        ],
        as: "subscriptionStats",
      },
    },
    {
      $lookup: {
        from: "comments",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$originator", "$$userId"] },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              latestCommentAt: { $max: "$createdAt" },
            },
          },
        ],
        as: "commentActivityStats",
      },
    },
    {
      $lookup: {
        from: "likes",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$originator", "$$userId"] },
            },
          },
          {
            $group: {
              _id: "$mode",
              count: { $sum: 1 },
            },
          },
        ],
        as: "reactionActivityStats",
      },
    },
    {
      $lookup: {
        from: "sessions",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$user", "$$userId"] },
            },
          },
          {
            $sort: {
              loginAt: -1,
            },
          },
          {
            $project: {
              refreshToken: 0,
              __v: 0,
            },
          },
          {
            $limit: 1,
          },
        ],
        as: "latestSession",
      },
    },
    {
      $lookup: {
        from: "sessions",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$user", "$$userId"] },
            },
          },
          {
            $group: {
              _id: null,
              totalSessions: { $sum: 1 },
              activeSessions: {
                $sum: {
                  $cond: [{ $eq: ["$isActive", true] }, 1, 0],
                },
              },
              latestActiveAt: { $max: "$lastActiveAt" },
            },
          },
        ],
        as: "sessionStats",
      },
    },
  ];

  if (includeRecentSessions) {
    stages.push({
      $lookup: {
        from: "sessions",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$user", "$$userId"] },
            },
          },
          { $sort: { loginAt: -1 } },
          { $limit: 10 },
          {
            $project: {
              refreshToken: 0,
              __v: 0,
            },
          },
        ],
        as: "recentSessions",
      },
    });
  }

  stages.push(
    {
      $addFields: {
        videoCount: { $size: "$videos" },
        publishedVideoCount: {
          $size: {
            $filter: {
              input: "$videos",
              as: "video",
              cond: {
                $and: [
                  { $eq: ["$$video.isPublished", true] },
                  { $ne: ["$$video.deleted", true] },
                ],
              },
            },
          },
        },
        privateVideoCount: {
          $size: {
            $filter: {
              input: "$videos",
              as: "video",
              cond: { $eq: ["$$video.privacy", "private"] },
            },
          },
        },
        unlistedVideoCount: {
          $size: {
            $filter: {
              input: "$videos",
              as: "video",
              cond: { $eq: ["$$video.privacy", "unlisted"] },
            },
          },
        },
        deletedVideoCount: {
          $size: {
            $filter: {
              input: "$videos",
              as: "video",
              cond: { $eq: ["$$video.deleted", true] },
            },
          },
        },
        totalViews: { $sum: "$videos.summary.views" },
        totalUniqueViews: { $sum: "$videos.summary.uniqueViews" },
        totalWatchTime: { $sum: "$videos.summary.totalWatchTime" },
        totalSessionWatchTime: {
          $sum: "$videos.summary.totalSessionWatchTime",
        },
        totalLikes: { $sum: "$videos.summary.likes" },
        totalDislikes: { $sum: "$videos.summary.dislikes" },
        totalComments: { $sum: "$videos.summary.comments" },
        subscriberCount: {
          $ifNull: [{ $arrayElemAt: ["$subscriberStats.count", 0] }, 0],
        },
        subscribedToCount: {
          $ifNull: [{ $arrayElemAt: ["$subscriptionStats.count", 0] }, 0],
        },
        commentsMade: {
          $ifNull: [
            { $arrayElemAt: ["$commentActivityStats.count", 0] },
            0,
          ],
        },
        latestCommentAt: {
          $arrayElemAt: ["$commentActivityStats.latestCommentAt", 0],
        },
        likesGiven: {
          $let: {
            vars: {
              likeStat: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: "$reactionActivityStats",
                        as: "reaction",
                        cond: { $eq: ["$$reaction._id", "like"] },
                      },
                    },
                  },
                  { count: 0 },
                ],
              },
            },
            in: "$$likeStat.count",
          },
        },
        dislikesGiven: {
          $let: {
            vars: {
              dislikeStat: {
                $ifNull: [
                  {
                    $first: {
                      $filter: {
                        input: "$reactionActivityStats",
                        as: "reaction",
                        cond: { $eq: ["$$reaction._id", "dislike"] },
                      },
                    },
                  },
                  { count: 0 },
                ],
              },
            },
            in: "$$dislikeStat.count",
          },
        },
        latestSession: { $arrayElemAt: ["$latestSession", 0] },
        totalSessions: {
          $ifNull: [{ $arrayElemAt: ["$sessionStats.totalSessions", 0] }, 0],
        },
        activeSessions: {
          $ifNull: [{ $arrayElemAt: ["$sessionStats.activeSessions", 0] }, 0],
        },
        latestActiveAt: {
          $arrayElemAt: ["$sessionStats.latestActiveAt", 0],
        },
      },
    },
    {
      $addFields: {
        averageWatchTimePerView: {
          $cond: [
            { $gt: ["$totalViews", 0] },
            { $divide: ["$totalWatchTime", "$totalViews"] },
            0,
          ],
        },
        averageWatchTimePerUniqueViewer: {
          $cond: [
            { $gt: ["$totalUniqueViews", 0] },
            { $divide: ["$totalWatchTime", "$totalUniqueViews"] },
            0,
          ],
        },
        averageViewsPerVideo: {
          $cond: [
            { $gt: ["$videoCount", 0] },
            { $divide: ["$totalViews", "$videoCount"] },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        summary: {
          totalVideos: "$videoCount",
          publishedVideos: "$publishedVideoCount",
          privateVideos: "$privateVideoCount",
          unlistedVideos: "$unlistedVideoCount",
          deletedVideos: "$deletedVideoCount",
          totalViews: "$totalViews",
          totalUniqueViews: "$totalUniqueViews",
          totalWatchTime: "$totalWatchTime",
          totalSessionWatchTime: "$totalSessionWatchTime",
          totalLikes: "$totalLikes",
          totalDislikes: "$totalDislikes",
          totalComments: "$totalComments",
          subscriberCount: "$subscriberCount",
          subscribedToCount: "$subscribedToCount",
          commentsMade: "$commentsMade",
          likesGiven: "$likesGiven",
          dislikesGiven: "$dislikesGiven",
          totalSessions: "$totalSessions",
          activeSessions: "$activeSessions",
          latestActiveAt: "$latestActiveAt",
          latestCommentAt: "$latestCommentAt",
          averageWatchTimePerView: "$averageWatchTimePerView",
          averageWatchTimePerUniqueViewer:
            "$averageWatchTimePerUniqueViewer",
          averageViewsPerVideo: "$averageViewsPerVideo",
        },
      },
    },
    {
      $project: {
        password: 0,
        refreshToken: 0,
        __v: 0,
        subscriberStats: 0,
        subscriptionStats: 0,
        commentActivityStats: 0,
        reactionActivityStats: 0,
        sessionStats: 0,
      },
    }
  );

  return stages;
};

export const GetAllUsers = asyncHandeler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const pipeline: PipelineStage[] = [
    { $match: {} },
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...userSummaryStages(false),
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
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

  const userId = toObjectId(id, "user id");
  const [user] = await User.aggregate([
    { $match: { _id: userId } },
    ...userSummaryStages(true),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "User fetched successfully", user));
});

export const GetAllVideos = asyncHandeler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const pipeline: PipelineStage[] = [
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...videoSummaryStages(false),
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    },
  ];

  const videos = await Video.aggregate(pipeline);

  const result = videos[0];
  if (result && result.data) {
    result.data.forEach((video: any) => {
      if (video.thumbnailID) {
        video.thumbnailUrl = getObjectPublicUrl(
          `thumbnails/${video.thumbnailID}.jpg`
        );
      }
    });
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "Videos fetched successfully", videos));
});

export const GetVideo = asyncHandeler(async (req, res) => {
  const id = req.params.id || req.params.videoid;

  if (!id) {
    throw new ApiError(400, "Video id is required");
  }

  const [video] = await Video.aggregate([
    { $match: videoMatchById(id) },
    ...videoSummaryStages(true),
    {
      $lookup: {
        from: "comments",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$videoId", "$$videoId"] },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 20 },
          {
            $lookup: {
              from: "users",
              localField: "originator",
              foreignField: "_id",
              as: "originatorDetails",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    name: 1,
                    channelname: 1,
                    profilepic: 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$originatorDetails",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              __v: 0,
            },
          },
        ],
        as: "recentComments",
      },
    },
    {
      $lookup: {
        from: "likes",
        let: { videoId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$videoId", "$$videoId"] },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 20 },
          {
            $lookup: {
              from: "users",
              localField: "originator",
              foreignField: "_id",
              as: "originatorDetails",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    name: 1,
                    channelname: 1,
                    profilepic: 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$originatorDetails",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              __v: 0,
            },
          },
        ],
        as: "recentReactions",
      },
    },
  ]);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.thumbnailID) {
    video.thumbnailUrl = getObjectPublicUrl(
      `thumbnails/${video.thumbnailID}.jpg`
    );
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "Video fetched successfully", video));
});

export const getVideo = GetVideo;

export const GetUserVideos = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "User id is required");
  }
  const userId = toObjectId(id, "user id");

  const matchStage: any = { owner: userId };
  if (search && typeof search === 'string') {
    matchStage.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...videoSummaryStages(false),
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    },
  ];

  const videos = await Video.aggregate(pipeline);
  const result = videos[0];
  if (result && result.data) {
    result.data.forEach((video: any) => {
      if (video.thumbnailID) {
        video.thumbnailUrl = getObjectPublicUrl(
          `thumbnails/${video.thumbnailID}.jpg`
        );
      }
    });
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "User videos fetched successfully", videos));
});

export const GetUserSubscribers = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "User id is required");
  }
  const userId = toObjectId(id, "user id");

  const pipeline: PipelineStage[] = [
    { $match: { subscribedTo: userId } },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriberDetails",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              name: 1,
              channelname: 1,
              profilepic: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$subscriberDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (search && typeof search === 'string') {
    pipeline.push({
      $match: {
        $or: [
          { "subscriberDetails.username": { $regex: search, $options: "i" } },
          { "subscriberDetails.name": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    }
  );

  const subscribers = await mongoose.model("Subscription").aggregate(pipeline);

  return res
    .status(200)
    .json(new ApiResponce(200, "User subscribers fetched successfully", subscribers));
});

export const GetUserSubscriptions = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "User id is required");
  }
  const userId = toObjectId(id, "user id");

  const pipeline: PipelineStage[] = [
    { $match: { subscriber: userId } },
    {
      $lookup: {
        from: "users",
        localField: "subscribedTo",
        foreignField: "_id",
        as: "subscribedToDetails",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              name: 1,
              channelname: 1,
              profilepic: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$subscribedToDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (search && typeof search === 'string') {
    pipeline.push({
      $match: {
        $or: [
          { "subscribedToDetails.username": { $regex: search, $options: "i" } },
          { "subscribedToDetails.name": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    }
  );

  const subscriptions = await mongoose.model("Subscription").aggregate(pipeline);

  return res
    .status(200)
    .json(new ApiResponce(200, "User subscriptions fetched successfully", subscriptions));
});

export const GetVideoPlayableUrl = asyncHandeler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, "Video id is required");
  }

  const video = await Video.findOne(videoMatchById(id));
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const playableUrl = getObjectPublicUrl(video.videoKey);

  return res
    .status(200)
    .json(new ApiResponce(200, "Video playable URL fetched successfully", { playableUrl }));
});

export const GetVideoLikes = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "Video id is required");
  }
  
  // Try treating id as a valid ObjectId first or fallback to querying Video by videoId
  let videoId: mongoose.Types.ObjectId;
  if (mongoose.isValidObjectId(id)) {
    videoId = mongoose.Types.ObjectId.createFromHexString(id);
  } else {
    const video = await Video.findOne({ videoId: id });
    if (!video) {
      throw new ApiError(404, "Video not found");
    }
    videoId = video._id as mongoose.Types.ObjectId;
  }

  const pipeline: PipelineStage[] = [
    { $match: { videoId: videoId, mode: "like" } },
    {
      $lookup: {
        from: "users",
        localField: "originator",
        foreignField: "_id",
        as: "originatorDetails",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              name: 1,
              channelname: 1,
              profilepic: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$originatorDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (search && typeof search === 'string') {
    pipeline.push({
      $match: {
        $or: [
          { "originatorDetails.username": { $regex: search, $options: "i" } },
          { "originatorDetails.name": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    }
  );

  const likes = await mongoose.model("Like").aggregate(pipeline);

  return res
    .status(200)
    .json(new ApiResponce(200, "Video likes fetched successfully", likes));
});

export const GetVideoDislikes = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "Video id is required");
  }
  
  let videoId: mongoose.Types.ObjectId;
  if (mongoose.isValidObjectId(id)) {
    videoId = mongoose.Types.ObjectId.createFromHexString(id);
  } else {
    const video = await Video.findOne({ videoId: id });
    if (!video) {
      throw new ApiError(404, "Video not found");
    }
    videoId = video._id as mongoose.Types.ObjectId;
  }

  const pipeline: PipelineStage[] = [
    { $match: { videoId: videoId, mode: "dislike" } },
    {
      $lookup: {
        from: "users",
        localField: "originator",
        foreignField: "_id",
        as: "originatorDetails",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              name: 1,
              channelname: 1,
              profilepic: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$originatorDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (search && typeof search === 'string') {
    pipeline.push({
      $match: {
        $or: [
          { "originatorDetails.username": { $regex: search, $options: "i" } },
          { "originatorDetails.name": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    }
  );

  const dislikes = await mongoose.model("Like").aggregate(pipeline);

  return res
    .status(200)
    .json(new ApiResponce(200, "Video dislikes fetched successfully", dislikes));
});

export const GetVideoComments = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "Video id is required");
  }
  
  let videoId: mongoose.Types.ObjectId;
  if (mongoose.isValidObjectId(id)) {
    videoId = mongoose.Types.ObjectId.createFromHexString(id);
  } else {
    const video = await Video.findOne({ videoId: id });
    if (!video) {
      throw new ApiError(404, "Video not found");
    }
    videoId = video._id as mongoose.Types.ObjectId;
  }

  const pipeline: PipelineStage[] = [
    { $match: { videoId: videoId } },
    {
      $lookup: {
        from: "users",
        localField: "originator",
        foreignField: "_id",
        as: "originatorDetails",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              name: 1,
              channelname: 1,
              profilepic: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$originatorDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (search && typeof search === 'string') {
    pipeline.push({
      $match: {
        $or: [
          { content: { $regex: search, $options: "i" } },
          { "originatorDetails.username": { $regex: search, $options: "i" } },
          { "originatorDetails.name": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    }
  );

  const comments = await mongoose.model("Comment").aggregate(pipeline);

  return res
    .status(200)
    .json(new ApiResponce(200, "Video comments fetched successfully", comments));
});

export const GetVideoViewers = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "Video id is required");
  }
  
  let videoId: mongoose.Types.ObjectId;
  if (mongoose.isValidObjectId(id)) {
    videoId = mongoose.Types.ObjectId.createFromHexString(id);
  } else {
    const video = await Video.findOne({ videoId: id });
    if (!video) {
      throw new ApiError(404, "Video not found");
    }
    videoId = video._id as mongoose.Types.ObjectId;
  }

  const pipeline: PipelineStage[] = [
    { $match: { videoId: videoId } },
    {
      $lookup: {
        from: "users",
        localField: "viewerId",
        foreignField: "_id",
        as: "viewerDetails",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              name: 1,
              channelname: 1,
              profilepic: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: {
        path: "$viewerDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  if (search && typeof search === 'string') {
    pipeline.push({
      $match: {
        $or: [
          { "viewerDetails.username": { $regex: search, $options: "i" } },
          { "viewerDetails.name": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  pipeline.push(
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { viewedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    }
  );

  const viewers = await mongoose.model("ViewHistory").aggregate(pipeline);

  return res
    .json(new ApiResponce(200, "Video viewers fetched successfully", viewers));
});

export const GetUserLikedVideos = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "User id is required");
  }
  const userId = toObjectId(id, "user id");

  const pipeline: PipelineStage[] = [
    { $match: { originator: userId, mode: "like", videoId: { $exists: true } } },
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "videos",
              localField: "videoId",
              foreignField: "_id",
              as: "videoDetails",
              pipeline: videoSummaryStages(false),
            },
          },
          { $unwind: "$videoDetails" },
          { $replaceRoot: { newRoot: "$videoDetails" } },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    },
  ];

  const videos = await mongoose.model("Like").aggregate(pipeline);
  const result = videos[0];
  if (result && result.data) {
    result.data.forEach((video: any) => {
      if (video.thumbnailID) {
        video.thumbnailUrl = getObjectPublicUrl(
          `thumbnails/${video.thumbnailID}.jpg`
        );
      }
    });
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "User liked videos fetched successfully", videos));
});

export const GetUserDislikedVideos = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "User id is required");
  }
  const userId = toObjectId(id, "user id");

  const pipeline: PipelineStage[] = [
    { $match: { originator: userId, mode: "dislike", videoId: { $exists: true } } },
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "videos",
              localField: "videoId",
              foreignField: "_id",
              as: "videoDetails",
              pipeline: videoSummaryStages(false),
            },
          },
          { $unwind: "$videoDetails" },
          { $replaceRoot: { newRoot: "$videoDetails" } },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    },
  ];

  const videos = await mongoose.model("Like").aggregate(pipeline);
  const result = videos[0];
  if (result && result.data) {
    result.data.forEach((video: any) => {
      if (video.thumbnailID) {
        video.thumbnailUrl = getObjectPublicUrl(
          `thumbnails/${video.thumbnailID}.jpg`
        );
      }
    });
  }

  return res
    .status(200)
    .json(new ApiResponce(200, "User disliked videos fetched successfully", videos));
});

export const GetUserComments = asyncHandeler(async (req, res) => {
  const { id } = req.params;
  const { search } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!id) {
    throw new ApiError(400, "User id is required");
  }
  const userId = toObjectId(id, "user id");

  const matchStage: any = { originator: userId };
  if (search && typeof search === "string") {
    matchStage.content = { $regex: search, $options: "i" };
  }

  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $facet: {
        data: asFacetPipeline([
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "videos",
              localField: "videoId",
              foreignField: "_id",
              as: "videoDetails",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    title: 1,
                    videoId: 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: {
              path: "$videoDetails",
              preserveNullAndEmptyArrays: true,
            },
          },
        ]),
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        page: { $literal: page },
        limit: { $literal: limit },
        totalPages: {
          $ceil: {
            $divide: [
              { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
              limit,
            ],
          },
        },
      },
    },
  ];

  const comments = await mongoose.model("Comment").aggregate(pipeline);

  return res
    .status(200)
    .json(new ApiResponce(200, "User comments fetched successfully", comments));
});
