import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { errorHandler } from "./middleware/error.middleware";

import videoRouter from "./routes/video.routes";
import healthcheakrouter from "./routes/healthcheak.routes";
import userrouter from "./routes/user.routes";
import commentRouter from "./routes/comment.routes";
import SubscriptionRoute from "./routes/subscription.routes";
import actionRoute from "./routes/action.routes";
import playlistRoute from "./routes/playlist.routes";
import studioRoute from "./routes/studio.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import likeRouter from "./routes/like.routes.js";
import viewRoter from "./routes/view.routes";

const app = express();

const origins = process.env.CORS_ORIGIN?.split(",");

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);


// app.use(
//   cors({
//     origin: process.env.CORS_ORIGIN,
//     credentials: true,
//   })
// );

app.use(cookieParser());

//common middlewares
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

app.use("/api/v1/healthcheak", healthcheakrouter);
app.use("/api/v1/users", userrouter);
app.use("/api/v1/video", videoRouter);
app.use("/api/v1/comment", commentRouter);
app.use("/api/v1/sub", SubscriptionRoute);
app.use("/api/v1/action", actionRoute);
app.use("/api/v1/playlist", playlistRoute);
app.use("/api/v1/studio", studioRoute);
app.use("/api/v1/tweet", tweetRouter);
app.use("/api/v1/like", likeRouter);
app.use("/api/v1/view", viewRoter);

// Error handling middleware

app.use(errorHandler);

export { app };

