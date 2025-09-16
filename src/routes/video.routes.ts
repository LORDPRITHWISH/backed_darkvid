import { Router } from "express";
import { upload } from "../middleware/multer.middleware";

import {
    getVideo, updateVideo, deleteVideo, uploadVideo, SuggestedVideos,
    UsersVideos,
    initVideoUpload,
    getVideoSignedUrl,
    completeVideoUpload,
    getPlaybackUrl,
} from "../controllers/video.controller";
import { verifyJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/", verifyJwt, SuggestedVideos);
router.post("/uploadCloudinary", upload.single("video"), verifyJwt, uploadVideo);

// router.get("/upload", verifyJwt, initiateUpload);
router.get("/upload/initiate", verifyJwt, initVideoUpload);
router.post("/upload/getsignlink", verifyJwt, getVideoSignedUrl);
router.post("/upload/complete", verifyJwt, completeVideoUpload);

router.post("/upload/:id", verifyJwt, updateVideo);

router.get("/fetch/:videoId", verifyJwt, getPlaybackUrl);
// router.put("/edit/:id", verifyJwt, updateVideo);
router.get("/:id", verifyJwt, getVideo);
router.delete("/:id", verifyJwt, deleteVideo);
router.get("/user/:id", verifyJwt, UsersVideos);

export default router;
