import { Router } from 'express';
import {
    getSubscribedChannels,
    getUserChannelSubscribers,
    mySubscribedChannels,
    toggleSubscription,
    // SubscribeToChannel
} from "../controllers/subscription.controller.js"
import { verifyJwt } from '../middleware/auth.middleware.js';

const router = Router();
router.use(verifyJwt); 

router.route("/me").get(mySubscribedChannels);

router
    .route("/c/:channelId")
    .get(getUserChannelSubscribers) // get subscribers of a channel
    .post(toggleSubscription);

router.route("/u/:channelId").get(getSubscribedChannels) // get channels subscribed by user

// router.route("/to/:channelId").post(SubscribeToChannel); //the channels I subscribed to

export default router