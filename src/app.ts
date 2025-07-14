import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import healthcheakrouter from "./routes/healthcheak.routes";
import userrouter from "./routes/user.routes";
import { errorHandeler } from "./middleware/error.middleware";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());

//common middlewares
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

app.use("/api/v1/healthcheak", healthcheakrouter);
app.use("/api/v1/users", userrouter);

app.use(errorHandeler);

export { app };

