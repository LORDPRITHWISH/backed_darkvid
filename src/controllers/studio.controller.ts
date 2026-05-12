import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandeler } from "../utils/asyncHandelers.js";
import { ApiResponce } from "../utils/ApiResponce.js";
import { User } from "../models/user.models.js";
import { Video } from "../models/video.models.js";
import { Comment } from "../models/comment.models.js";
import { Like } from "../models/likes.models.js";
import { View } from "../models/view.models.js";
import { ViewHistory } from "../models/viewhistory.models.js";
import { Subscription } from "../models/subscription.models.js";
import { getObjectPublicUrl } from "../utils/s3Helper.js";
import { redisClient } from "../utils/redis.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getCached = async <T>(key: string): Promise<T | null> => {
  try {
    const val = await redisClient.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
};

const setCache = async (key: string, data: unknown, ttlSeconds: number) => {
  try {
    await redisClient.set(key, JSON.stringify(data), { EX: ttlSeconds });
  } catch {}
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * GET /studio/dashboard
 * Aggregated channel stats (subscribers, views, likes, videos).
 * Redis-cached for 5 minutes per user.
 */
const getDashboardStats = asyncHandeler(async (req, res) => {
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");

  const userId = user._id;
  const cacheKey = `studio:dashboard:${userId}`;

  const cached = await getCached<object>(cacheKey);
  if (cached) {
    return res
      .status(200)
      .json(new ApiResponce(200, "Dashboard stats (cached)", cached));
  }

  const stats = await User.aggregate([
    { $match: { _id: userId } },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
        pipeline: [{ $match: { deleted: { $ne: true } } }],
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscribedTo",
        as: "subscriptions",
      },
    },
    {
      $lookup: {
        from: "likes",
        let: { uid: "$_id" },
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "videoId",
              foreignField: "_id",
              as: "video",
            },
          },
          { $unwind: "$video" },
          {
            $match: {
              $expr: { $eq: ["$video.owner", "$$uid"] },
              mode: "like",
            },
          },
        ],
        as: "totalLikesOnVideos",
      },
    },
    {
      $lookup: {
        from: "viewhistories",
        let: { uid: "$_id" },
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "videoId",
              foreignField: "_id",
              as: "video",
            },
          },
          { $unwind: "$video" },
          { $match: { $expr: { $eq: ["$video.owner", "$$uid"] } } },
          {
            $group: {
              _id: null,
              totalViews: { $sum: 1 },
              totalWatchTime: {
                $sum: {
                  $cond: [
                    { $gt: ["$endPosition", "$startPosition"] },
                    { $subtract: ["$endPosition", "$startPosition"] },
                    0,
                  ],
                },
              },
            },
          },
        ],
        as: "viewAggregate",
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        username: 1,
        channelname: 1,
        profilepic: 1,
        coverimage: 1,
        bio: 1,
        totalVideos: { $size: "$videos" },
        totalSubscribers: { $size: "$subscriptions" },
        totalLikes: { $size: "$totalLikesOnVideos" },
        totalViews: {
          $ifNull: [{ $arrayElemAt: ["$viewAggregate.totalViews", 0] }, 0],
        },
        totalWatchTime: {
          $ifNull: [{ $arrayElemAt: ["$viewAggregate.totalWatchTime", 0] }, 0],
        },
      },
    },
  ]);

  // Latest video performance
  const latestVideo = await Video.findOne({ owner: userId, deleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .select("videoId videoKey thumbnailID title duration createdAt privacy isPublished status")
    .lean() as any;

  let latestVideoStats = null;
  if (latestVideo) {
    const [viewStats, likeStats, commentCount] = await Promise.all([
      View.aggregate([
        { $match: { videoId: latestVideo._id } },
        {
          $group: {
            _id: null,
            uniqueViews: { $sum: 1 },
            totalWatchTime: { $sum: { $ifNull: ["$totalWatchTime", 0] } },
          },
        },
      ]),
      Like.countDocuments({ videoId: latestVideo._id, mode: "like" }),
      Comment.countDocuments({ videoId: latestVideo._id }),
    ]);

    latestVideoStats = {
      ...latestVideo,
      thumbnailUrl: latestVideo.thumbnailID
        ? getObjectPublicUrl(latestVideo.thumbnailID)
        : null,
      uniqueViews: viewStats[0]?.uniqueViews ?? 0,
      totalWatchTime: viewStats[0]?.totalWatchTime ?? 0,
      likes: likeStats,
      comments: commentCount,
    };
  }

  const result = {
    channelStats: stats[0] ?? {},
    latestVideo: latestVideoStats,
  };

  await setCache(cacheKey, result, 300); // 5 min

  return res
    .status(200)
    .json(new ApiResponce(200, "Dashboard stats fetched", result));
});

// ─── Content / Videos ─────────────────────────────────────────────────────────

/**
 * GET /studio/videos?page=1&limit=20&q=searchTerm&privacy=public
 * All channel videos with rich stats. Redis-cached per user (2 min).
 */
const getChannelVideos = asyncHandeler(async (req, res) => {
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");

  const userId = user._id;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const q = (req.query.q as string) || "";
  const privacy = req.query.privacy as string | undefined;

  const cacheKey = `studio:videos:${userId}:${page}:${limit}:${q}:${privacy ?? "all"}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) {
    return res
      .status(200)
      .json(new ApiResponce(200, "Channel videos (cached)", cached));
  }

  const matchStage: Record<string, unknown> = {
    owner: userId,
    deleted: { $ne: true },
  };
  if (q) matchStage.title = { $regex: q, $options: "i" };
  if (privacy) matchStage.privacy = privacy;

  const pipeline: mongoose.PipelineStage[] = [
    { $match: matchStage },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "views",
        localField: "_id",
        foreignField: "videoId",
        as: "viewDocs",
        pipeline: [
          {
            $group: {
              _id: null,
              uniqueViews: { $sum: 1 },
              totalWatchTime: { $sum: { $ifNull: ["$totalWatchTime", 0] } },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "viewhistories",
        localField: "_id",
        foreignField: "videoId",
        as: "viewHistoryDocs",
        pipeline: [
          {
            $group: {
              _id: null,
              totalViews: { $sum: 1 },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "videoId",
        as: "likeDocs",
        pipeline: [
          { $group: { _id: "$mode", count: { $sum: 1 } } },
        ],
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "videoId",
        as: "commentDocs",
        pipeline: [{ $count: "count" }],
      },
    },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $addFields: {
              thumbnailUrl: {
                $cond: [
                  { $ifNull: ["$thumbnailID", false] },
                  {
                    $concat: [
                      process.env.OBJECT_STORAGE_PUBLIC_BASE_URL ?? "",
                      "/",
                      "$thumbnailID",
                    ],
                  },
                  null,
                ],
              },
              uniqueViews: {
                $ifNull: [{ $arrayElemAt: ["$viewDocs.uniqueViews", 0] }, 0],
              },
              totalWatchTime: {
                $ifNull: [{ $arrayElemAt: ["$viewDocs.totalWatchTime", 0] }, 0],
              },
              totalViews: {
                $ifNull: [
                  { $arrayElemAt: ["$viewHistoryDocs.totalViews", 0] },
                  0,
                ],
              },
              likes: {
                $ifNull: [
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$likeDocs",
                          as: "l",
                          cond: { $eq: ["$$l._id", "like"] },
                        },
                      },
                      0,
                    ],
                  },
                  { count: 0 },
                ],
              },
              dislikes: {
                $ifNull: [
                  {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$likeDocs",
                          as: "l",
                          cond: { $eq: ["$$l._id", "dislike"] },
                        },
                      },
                      0,
                    ],
                  },
                  { count: 0 },
                ],
              },
              commentCount: {
                $ifNull: [{ $arrayElemAt: ["$commentDocs.count", 0] }, 0],
              },
            },
          },
          {
            $project: {
              __v: 0,
              viewDocs: 0,
              viewHistoryDocs: 0,
              likeDocs: 0,
              commentDocs: 0,
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const result = await Video.aggregate(pipeline);
  const videos = result[0]?.data ?? [];
  const total = result[0]?.total[0]?.count ?? 0;

  // Resolve thumbnailUrl with s3Helper for accuracy
  const videosWithUrls = videos.map((v: Record<string, unknown>) => ({
    ...v,
    likes: (v.likes as { count?: number })?.count ?? 0,
    dislikes: (v.dislikes as { count?: number })?.count ?? 0,
    thumbnailUrl: v.thumbnailID
      ? getObjectPublicUrl(v.thumbnailID as string)
      : null,
  }));

  const responseData = {
    videos: videosWithUrls,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };

  await setCache(cacheKey, responseData, 120); // 2 min

  return res
    .status(200)
    .json(new ApiResponce(200, "Channel videos fetched", responseData));
});

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * GET /studio/analytics?period=28  (days)
 * Channel-level analytics: views/day, watch time, top videos.
 * Redis-cached for 10 minutes per user per period.
 */
const getChannelAnalytics = asyncHandeler(async (req, res) => {
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");

  const userId = user._id;
  const period = Math.min(Math.max(Number(req.query.period) || 28, 1), 365);
  const cacheKey = `studio:analytics:${userId}:${period}`;

  const cached = await getCached<object>(cacheKey);
  if (cached) {
    return res
      .status(200)
      .json(new ApiResponce(200, "Analytics (cached)", cached));
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - period);

  // Get all video IDs owned by user
  const videoIds = await Video.find({ owner: userId, deleted: { $ne: true } })
    .select("_id")
    .lean()
    .then((vs) => vs.map((v) => v._id));

  const [
    viewsByDay,
    watchTimeByDay,
    topVideos,
    subHistory,
    overallStats,
  ] = await Promise.all([
    // Views per day in period
    ViewHistory.aggregate([
      {
        $match: {
          videoId: { $in: videoIds },
          viewedAt: { $gte: sinceDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$viewedAt" },
          },
          views: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", views: 1 } },
    ]),

    // Watch time per day
    ViewHistory.aggregate([
      {
        $match: {
          videoId: { $in: videoIds },
          viewedAt: { $gte: sinceDate },
        },
      },
      {
        $addFields: {
          sessionTime: {
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
            $dateToString: { format: "%Y-%m-%d", date: "$viewedAt" },
          },
          watchTime: { $sum: "$sessionTime" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", watchTime: 1 } },
    ]),

    // Top videos in period
    ViewHistory.aggregate([
      {
        $match: {
          videoId: { $in: videoIds },
          viewedAt: { $gte: sinceDate },
        },
      },
      {
        $group: {
          _id: "$videoId",
          views: { $sum: 1 },
          watchTime: {
            $sum: {
              $cond: [
                { $gt: ["$endPosition", "$startPosition"] },
                { $subtract: ["$endPosition", "$startPosition"] },
                0,
              ],
            },
          },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "videos",
          localField: "_id",
          foreignField: "_id",
          as: "video",
          pipeline: [
            {
              $project: {
                videoId: 1,
                title: 1,
                thumbnailID: 1,
                duration: 1,
                privacy: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: "$video", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          videoId: "$video.videoId",
          title: "$video.title",
          thumbnailID: "$video.thumbnailID",
          duration: "$video.duration",
          privacy: "$video.privacy",
          createdAt: "$video.createdAt",
          views: 1,
          watchTime: 1,
        },
      },
    ]),

    // Subscriber growth in period (count subscriptions created in each day)
    Subscription.aggregate([
      {
        $match: {
          subscribedTo: userId,
          createdAt: { $gte: sinceDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          newSubs: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", newSubs: 1 } },
    ]),

    // Overall period totals
    ViewHistory.aggregate([
      {
        $match: {
          videoId: { $in: videoIds },
          viewedAt: { $gte: sinceDate },
        },
      },
      {
        $addFields: {
          sessionTime: {
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
          totalWatchTime: { $sum: "$sessionTime" },
        },
      },
    ]),
  ]);

  const totalSubscribers = await Subscription.countDocuments({
    subscribedTo: userId,
  });

  const analyticsData = {
    period,
    sinceDate: sinceDate.toISOString(),
    totalSubscribers,
    overallPeriod: overallStats[0] ?? { totalViews: 0, totalWatchTime: 0 },
    viewsByDay,
    watchTimeByDay,
    subHistory,
    topVideos: topVideos.map((v) => ({
      ...v,
      thumbnailUrl: v.thumbnailID ? getObjectPublicUrl(v.thumbnailID) : null,
    })),
  };

  await setCache(cacheKey, analyticsData, 600); // 10 min

  return res
    .status(200)
    .json(new ApiResponce(200, "Channel analytics fetched", analyticsData));
});

// ─── Community – Comments ─────────────────────────────────────────────────────

/**
 * GET /studio/community/comments?page=1&limit=20&videoId=xyz&status=unresponded
 * All comments on the creator's videos, paginated.
 * Redis-cached for 60 seconds per user.
 */
const getStudioComments = asyncHandeler(async (req, res) => {
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");

  const userId = user._id;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;
  const videoIdFilter = req.query.videoId as string | undefined;

  const cacheKey = `studio:comments:${userId}:${page}:${limit}:${videoIdFilter ?? "all"}`;
  const cached = await getCached<object>(cacheKey);
  if (cached) {
    return res
      .status(200)
      .json(new ApiResponce(200, "Comments (cached)", cached));
  }

  // Collect this user's video _ids
  const videoQuery: Record<string, unknown> = { owner: userId, deleted: { $ne: true } };
  if (videoIdFilter) videoQuery.videoId = videoIdFilter;

  const userVideoIds = await Video.find(videoQuery)
    .select("_id videoId title thumbnailID")
    .lean() as any[];

  const videoIdMap: Record<string, { videoId: string; title: string; thumbnailID?: string }> =
    {};
  userVideoIds.forEach((v) => {
    videoIdMap[v._id.toString()] = {
      videoId: v.videoId,
      title: v.title ?? "",
      thumbnailID: v.thumbnailID,
    };
  });

  const videoMongoIds = userVideoIds.map((v) => v._id);

  const pipeline: mongoose.PipelineStage[] = [
    {
      $match: {
        videoId: { $in: videoMongoIds },
        commentId: { $exists: false }, // top-level only
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "originator",
              foreignField: "_id",
              as: "author",
              pipeline: [
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profilepic: 1,
                    name: 1,
                  },
                },
              ],
            },
          },
          {
            $unwind: { path: "$author", preserveNullAndEmptyArrays: true },
          },
          {
            $lookup: {
              from: "comments",
              let: { parentId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$commentId", "$$parentId"] },
                  },
                },
                { $count: "count" },
              ],
              as: "replyCount",
            },
          },
          {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "commentId",
              as: "likeDocs",
              pipeline: [
                { $match: { mode: "like" } },
                { $count: "count" },
              ],
            },
          },
          {
            $addFields: {
              replyCount: {
                $ifNull: [{ $arrayElemAt: ["$replyCount.count", 0] }, 0],
              },
              likeCount: {
                $ifNull: [{ $arrayElemAt: ["$likeDocs.count", 0] }, 0],
              },
            },
          },
          {
            $project: {
              __v: 0,
              likeDocs: 0,
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const result = await Comment.aggregate(pipeline);
  const comments = (result[0]?.data ?? []).map(
    (c: Record<string, unknown>) => ({
      ...c,
      video: videoIdMap[String(c.videoId)] ?? null,
      thumbnailUrl:
        videoIdMap[String(c.videoId)]?.thumbnailID
          ? getObjectPublicUrl(
              videoIdMap[String(c.videoId)]!.thumbnailID as string
            )
          : null,
    })
  );

  const total = result[0]?.total[0]?.count ?? 0;

  const responseData = {
    comments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };

  await setCache(cacheKey, responseData, 60); // 1 min

  return res
    .status(200)
    .json(new ApiResponce(200, "Studio comments fetched", responseData));
});

/**
 * POST /studio/community/comments/:commentId/reply
 * Creator replies to a comment.
 * Invalidates the comments cache for this user.
 */
const replyToComment = asyncHandeler(async (req, res) => {
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");

  const { commentId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) throw new ApiError(400, "Reply content is required");
  if (!mongoose.isValidObjectId(commentId))
    throw new ApiError(400, "Invalid comment ID");

  const parentComment = await Comment.findById(commentId).lean() as any;
  if (!parentComment) throw new ApiError(404, "Comment not found");

  // Verify the comment is on a video owned by this user
  if (parentComment.videoId) {
    const video = await Video.findOne({
      _id: parentComment.videoId,
      owner: user._id,
    }).lean();
    if (!video) throw new ApiError(403, "Forbidden");
  }

  const reply = await Comment.create({
    content: content.trim(),
    commentId: parentComment._id,
    videoId: parentComment.videoId,
    originator: user._id,
  });

  // Invalidate studio comments cache for this user (all pages)
  try {
    const pattern = `studio:comments:${user._id}:*`;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) await redisClient.del(keys);
  } catch {}

  return res
    .status(201)
    .json(new ApiResponce(201, "Reply posted", reply));
});

/**
 * DELETE /studio/community/comments/:commentId
 * Creator deletes any comment on their video.
 */
const deleteCommentFromStudio = asyncHandeler(async (req, res) => {
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");

  const { commentId } = req.params;
  if (!mongoose.isValidObjectId(commentId))
    throw new ApiError(400, "Invalid comment ID");

  const comment = await Comment.findById(commentId).lean() as any;
  if (!comment) throw new ApiError(404, "Comment not found");

  // Allow if it's on their video OR they own the comment
  let allowed = comment.originator.toString() === user._id.toString();
  if (!allowed && comment.videoId) {
    const video = await Video.findOne({
      _id: comment.videoId,
      owner: user._id,
    }).lean();
    allowed = !!video;
  }

  if (!allowed) throw new ApiError(403, "Forbidden");

  await Comment.findByIdAndDelete(commentId);
  // Also delete nested replies
  await Comment.deleteMany({ commentId: comment._id });

  // Invalidate cache
  try {
    const keys = await redisClient.keys(`studio:comments:${user._id}:*`);
    if (keys.length > 0) await redisClient.del(keys);
  } catch {}

  return res.status(200).json(new ApiResponce(200, "Comment deleted", {}));
});

// ─── Channel Stats (legacy compat) ───────────────────────────────────────────

const getChannelStats = asyncHandeler(async (req, res) => {
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");
  const userId = user._id;

  const stats = await User.aggregate([
    { $match: { _id: userId } },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscribedTo",
        as: "subscriptions",
      },
    },
    {
      $project: {
        _id: 1,
        email: 1,
        name: 1,
        totalVideos: { $size: "$videos" },
        totalViews: { $sum: "$videos.views" },
        totalLikes: { $sum: "$videos.likes" },
        totalSubscribers: { $size: "$subscriptions" },
      },
    },
  ]);

  res.status(200).json({ success: true, data: stats });
});

export {
  getDashboardStats,
  getChannelVideos,
  getChannelAnalytics,
  getStudioComments,
  replyToComment,
  deleteCommentFromStudio,
  getChannelStats,
};