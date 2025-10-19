import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError";
import type { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode =
      (error as any).statusCode ||
      (error instanceof mongoose.Error ? 400 : 500);

    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, (error as any).errors || [], err.stack);
  }

  const response = {
    success: false,
    statusCode: (error as ApiError).code,
    message: error.message,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  res
    .status((error as ApiError).code || 500)
    .json(response);
  return;
};

export { errorHandler };
