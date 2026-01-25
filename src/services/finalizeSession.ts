// import { redisClient as redis } from "../lib/redis";
// import { View } from "../models/View";
// import { ViewHistory } from "../models/ViewHistory";
// import { Video } from "../models/Video";
import { Video } from "../models/video.models";
import { View } from "../models/view.models";
import { ViewHistory } from "../models/viewhistory.models";
import { redisClient } from "../utils/redis";

export async function finalizeSession(
  viewerId: string,
  videoId: string,
  sessionId: string
) {
  const baseKey = `${viewerId}:${videoId}:${sessionId}`;

  const sessionKey = `session:${baseKey}`;
  const progressKey = `progress:${baseKey}`;
  const progressLastKey = `progress:last:${baseKey}`;

  // 1️⃣ Check if session exists (idempotent)
  const historyId = await redisClient.get(sessionKey);
  if (!historyId) return;

  // 2️⃣ Get last known position
  const last = await redisClient.get(progressLastKey);
  const endPosition = last ? Number(last) : 0;

  // 3️⃣ Load history (startPosition)
  const history = await ViewHistory.findById(historyId);
  if (!history) {
    // cleanup just in case
    // await redisClient.del(sessionKey, progressKey, progressLastKey);
    await redisClient
      .multi()
      .del(sessionKey)
      .del(progressKey)
      .del(progressLastKey)
      .sRem("activeWatchers", baseKey)
      .exec();
    return;
  }

  const startPosition = history.startPosition ?? 0;
  const watchTime = Math.max(0, endPosition - startPosition);

  // 4️⃣ Determine completion
  let completedUpdate = {};
  const video = await Video.findById(videoId, { duration: 1 });
  if (video && endPosition >= video.duration * 0.9) {
    completedUpdate = {
      completed: true,
      completedAt: new Date(),
    };
  }

  // 5️⃣ Update View (resume + analytics)
  await View.findOneAndUpdate(
    { viewerId, videoId },
    {
      $inc: { totalWatchTime: watchTime },
      $set: {
        lastPosition: endPosition,
        ...completedUpdate,
      },
    },
    { upsert: true }
  );

  // 6️⃣ Close ViewHistory
  await ViewHistory.findByIdAndUpdate(historyId, {
    endPosition,
  });

  // 7️⃣ Cleanup Redis keys
  await redisClient
    .multi()
    .del(sessionKey)
    .del(progressKey)
    .del(progressLastKey)
    .sRem("activeWatchers", baseKey)
    .exec();
}
