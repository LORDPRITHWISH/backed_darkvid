import { Router } from "express";
import { upload } from "../middleware/multer.middleware";

import {
    createVideo, getVideo, updateVideo, deleteVideo, uploadVideo, SuggestedVideos
} from "../controllers/video.controller";
import { verifyJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/", verifyJwt, SuggestedVideos);
router.post("/upload", upload.single("video"), verifyJwt, uploadVideo);
router.post("/upload/:id", verifyJwt, updateVideo);
router.get("/fetch/:id", verifyJwt, getVideo);
// router.put("/edit/:id", verifyJwt, updateVideo);
router.get("/:id", verifyJwt, getVideo);
router.delete("/:id", verifyJwt, deleteVideo);

export default router;