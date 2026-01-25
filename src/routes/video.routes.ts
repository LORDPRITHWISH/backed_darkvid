import { Router } from "express";
// import { upload } from "../middleware/multer.middleware";

import {
  getVideo,
  updateVideo,
  deleteVideo,
  SuggestedVideos,
  UsersVideos,
  initVideoUpload,
  getVideoSignedUrl,
  completeVideoUpload,
  getPlaybackUrl,
  getVideoDetails,
  uploadThumbnail,
  userStudioVideos,
  videoSpecificSuggestion,
} from "../controllers/video.controller";
import { verifyJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/", verifyJwt, SuggestedVideos);

router.get("/:id", verifyJwt, getVideo);
router.delete("/:id", verifyJwt, deleteVideo);

router.get("/:videoId/related", verifyJwt, videoSpecificSuggestion);

router.get("/setthumbnail/:videoId", verifyJwt, uploadThumbnail);

router.get("/upload/initiate", verifyJwt, initVideoUpload);
router.post("/upload/getsignlink", verifyJwt, getVideoSignedUrl);
router.post("/upload/complete", verifyJwt, completeVideoUpload);

router.post("/setdata/:videoId", verifyJwt, updateVideo);

router.get("/fetch/:videoId", verifyJwt, getPlaybackUrl);
// router.put("/edit/:id", verifyJwt, updateVideo);
router.get("/studio", verifyJwt, userStudioVideos);
router.get("/user/:id", verifyJwt, UsersVideos);
router.get("/details/:id", verifyJwt, getVideoDetails);



export default router;
