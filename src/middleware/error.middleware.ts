import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError";
import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";

const errorHandeler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode =
      (error as any).statusCode ||
      (error instanceof mongoose.Error ? 400 : 500);

    const message = error.message || "Something went wrong";
    error = new ApiError(
      statusCode,
      message,
      (error as any).errors || [],
      err.stack
    );
  }

  const responce = {
    ...error,
    message: error.message,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  res.status((error as any).statusCode).json(responce);
};

export { errorHandeler };
