import { Router } from 'express';

import { verifyJwt } from '../middleware/auth.middleware.js';
import {
  GetAllUsers,
  GetAllVideos,
  GetUser,
  GetVideo,
  GetUserVideos,
  GetUserSubscribers,
  GetUserSubscriptions,
  GetVideoPlayableUrl,
  GetVideoLikes,
  GetVideoDislikes,
  GetVideoComments,
  GetVideoViewers,
  GetUserLikedVideos,
  GetUserDislikedVideos,
  GetUserComments,
} from "../controllers/admin.controller.js";


const router = Router();

router.use(verifyJwt);

router.route("/users").get(GetAllUsers);
router.route("/user/:id").get(GetUser);
router.route("/user/:id/videos").get(GetUserVideos);
router.route("/user/:id/subscribers").get(GetUserSubscribers);
router.route("/user/:id/subscriptions").get(GetUserSubscriptions);
router.route("/user/:id/liked-videos").get(GetUserLikedVideos);
router.route("/user/:id/disliked-videos").get(GetUserDislikedVideos);
router.route("/user/:id/comments").get(GetUserComments);

router.route("/videos").get(GetAllVideos);
router.route("/video/:id").get(GetVideo);
router.route("/video/:id/player").get(GetVideoPlayableUrl);
router.route("/video/:id/like").get(GetVideoLikes);
router.route("/video/:id/dislike").get(GetVideoDislikes);
router.route("/video/:id/comments").get(GetVideoComments);
router.route("/video/:id/viewers").get(GetVideoViewers);

export default router
