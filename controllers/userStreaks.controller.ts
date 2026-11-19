import { CatchAsyncError } from "../middleware/CatchAsyncError";
import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/errorHandler";
import {
  getUserStreakStatus,
  restoreMissedStreak,
} from "../services/streak.service";

interface CustomRequest extends Request {
  user?: any;
}

export const getUserStreak = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as CustomRequest).user?.id;
      const data = await getUserStreakStatus(userId);

      res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, error.statusCode || 500));
    }
  }
);

export const restoreUserStreak = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as CustomRequest).user?.id;
      const data = await restoreMissedStreak(userId);

      res.status(200).json({
        success: true,
        message: "Khôi phục chuỗi streak thành công!",
        ...data,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, error.statusCode || 500));
    }
  }
);
