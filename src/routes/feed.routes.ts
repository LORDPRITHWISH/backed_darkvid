import { Router } from 'express';

import { verifyJwt } from '../middleware/auth.middleware.js';
import {
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
} from '../controllers/feed.controller.js';

const router = Router();

router.use(verifyJwt);

router.route("/").get(getHomePageVideos);
router.route("/subscriptions").get(getSubscriptionsVideos);
router.route("/explore").get(getExploreVideos);
router.route("/trending").get(getTrendingVideos);
router.route("/history").get(getHistoryVideos);
router.route("/watchlater").get(getWatchLaterVideos);
router.route("/liked").get(getLikedVideos);
router.route("/playlists").get(getPlaylists);
router.route("/uploads").get(getUploadsVideos);
router.route("/profile").get(getProfile);
router.route("/community").get(getCommunityPosts);
router.route("/shorts").get(getShortsVideos);
router.route("/podcasts").get(getPodcasts);
router.route("/live").get(getLiveVideos);
router.route("/music").get(getMusicVideos);

export default router