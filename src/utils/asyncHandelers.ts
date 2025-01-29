// import { Request, Response, NextFunction } from 'express';

// const asyncHandeler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
//   Promise.resolve(fn(req, res, next)).catch(next);
// }

import type { Request, Response, NextFunction } from 'express';

const asyncHandeler = (requestHandler: (req: Request, res: Response, next: NextFunction) => Promise<any> | void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(requestHandler(req, res, next)).catch((error) => {
      next(error);
    });
  };
};
export {asyncHandeler};