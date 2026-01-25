
import { finalizeSession } from "../services/finalizeSession";
import { redisClient } from "../utils/redis";

const INTERVAL = 10_000; // 10 seconds

async function checkExpiredSessions() {
  try {

    // console.log("Hi There From Cron maybe")

    const sessions = await redisClient.keys("session:*");

    for (const sessionKey of sessions) {
      // session:{viewerId}:{videoId}:{sessionId}
      const [, viewerId, videoId, sessionId] = sessionKey.split(":");

      const progressKey = `progress:${viewerId}:${videoId}:${sessionId}`;
      const exists = await redisClient.exists(progressKey);

      if (!exists) {
        await finalizeSession(viewerId, videoId, sessionId);
      }
    }
  } catch (err) {
    console.error("[viewSessionFinalizer]", err);
  }
}

// start loop
setInterval(checkExpiredSessions, INTERVAL);

// optional: run immediately on boot
checkExpiredSessions();
