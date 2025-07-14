import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError";
import type { Request, Response, NextFunction } from "express";

const errorHandeler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode =
      (error as any).statusCode ||
      (error instanceof mongoose.Error ? 400 : 500);

    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, (error as any).errors || [], err.stack);
  }

  const responce = {
    ...error,
    message: error.message,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  return res.status(error?.statusCode).json(responce);
};

export { errorHandeler };

// import mongoose from "mongoose";
// import { ApiError } from "../utils/ApiError";
// import type { Request, Response, NextFunction } from "express";

// const errorHandler = (
//   err: Error,
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   let error = err;

//   if (!(error instanceof ApiError)) {
//     const statusCode =
//       (error as any).statusCode ||
//       (error instanceof mongoose.Error ? 400 : 500);
//     error = new ApiError(
//       statusCode,
//       error.message || "Something went wrong",
//       error?.errors || [],
//       err.stack
//     );
//   }

//   const response = {
//     status: (error as ApiError).statusCode,
//     message: error.message,
//     errors: (error as ApiError).errors,
//     ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
//   };

//   res.status((error as ApiError).statusCode).json(response);
// };

// export { errorHandler };

