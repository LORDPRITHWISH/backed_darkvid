import { Router } from "express";
import {
    CommentOnVideo,
    CommentOnTweet,
    CommentOnComment,
    getCommentsForVideo
} from "../controllers/comment.controller";
import { verifyJwt } from "../middleware/auth.middleware";


const router = Router();

router.use(verifyJwt);


router.post("/video", CommentOnVideo);
router.post("/tweet",  CommentOnTweet);
router.post("/comment",  CommentOnComment);

router.get("/video/:id", getCommentsForVideo);

export default router;

