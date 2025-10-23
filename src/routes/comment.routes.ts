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


router.post("/video/:videoId", CommentOnVideo);
router.post("/tweet/:tweetId",  CommentOnTweet);
router.post("/comment/:commentId",  CommentOnComment);

router.get("/video/:id", getCommentsForVideo);

export default router;

