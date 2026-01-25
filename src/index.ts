// import dotenv from "dotenv";
// import express from "express";
import { app } from "./app";
import connectDB from "./db";
import "./workers/viewSessionFinalizer";

// dotenv.config({
//   path: "./.env",
// });
const port = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.send("Hello Worlds!");
});

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Listening on port ${port}...`);
    });
  })
  .catch((error) => {
    console.error("DB connection error", error);
    process.exit(1);
  });
