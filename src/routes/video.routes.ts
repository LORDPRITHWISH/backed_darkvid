import { Router } from "express";
import { upload } from "../middleware/multer.middleware";

import {
    createVideo, getVideo, updateVideo, deleteVideo, uploadVideo
} from "../controllers/video.controllers";
import { verifyJwt } from "../middleware/auth.middleware";

const router = Router();

router.post("/upload", upload.single("video"), verifyJwt, uploadVideo);
router.post("/upload/:id", verifyJwt, createVideo);
router.get("/edit/:id", verifyJwt, updateVideo);
router.put("/edit/:id", verifyJwt, updateVideo);
router.get("/:id", verifyJwt, getVideo);
router.delete("/:id", verifyJwt, deleteVideo);

export default router;