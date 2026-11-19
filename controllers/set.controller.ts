import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/CatchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import db from "../models/index";
import { v4 as uuidv4 } from "uuid";
import { Op, fn, col } from "sequelize";
const Set = db.Set;
const User = db.User;
const Card = db.Card;
const UserSession = db.UserSession;
const UserProgress = db.UserProgress;
const Folder = db.Folder;

interface CustomRequest extends Request {
  user?: any;
}
// Create Folder
export const createSet = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        title,
        description,
        folderId,
        isPublic,
        statusId,
        isDraft,
        cardCount,
      } = req.body;
      const userId = (req as CustomRequest).user.id;

      if (!title) {
        return next(new ErrorHandler("Title name is required", 400));
      }

      const set = await Set.create({
        id: uuidv4(), // Tạo UUID v4 cho folderId
        title,
        description,
        folderId,
        userId,
        isPublic,
        isDraft,
        statusId,
        cardCount,
      });

      const folder = await Folder.findByPk(folderId);
      if (folder) {
        folder.totalSets = folder.totalSets + 1;
        await folder.save();
      }

      res.status(201).json({
        success: true,
        set: set,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Get all sets
export const getAllSets = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sets = await Set.findAll();
      res.status(200).json({ success: true, sets });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
//Get Set by FolderId
export const getSetByFolderId = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { folderId } = req.body;

      const sets = await Set.findAll({
        where: { folderId: id },
        order: [["createdAt", "DESC"]],
      });
      if (!sets) {
        return next(new ErrorHandler("Folder not found", 404));
      }

      res.status(200).json({ success: true, sets });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Get Folder by ID
export const getSetByUserId = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as CustomRequest).user.id;
      const folders = await Set.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
      });
      if (!folders) {
        return next(new ErrorHandler("Folder not found", 404));
      }

      res.status(200).json({ success: true, folders });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Update Folder
export const updateSet = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, description, statusId, isPublic, userId, isDraft } =
        req.body;

      const set = await Set.findByPk(id);

      if (!set) {
        return next(new ErrorHandler("Folder not found", 404));
      }

      set.title = title ?? set.title;
      set.description = description ?? set.description;
      set.isPublic = isPublic ?? set.isPublic;
      set.statusId = statusId ?? set.statusId;
      set.userId = userId ?? set.userId;
      set.isDraft = isDraft ?? set.isDraft;
      await set.save();

      res.status(200).json({ success: true, set });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// // Delete Folder
// export const deleteFolder = CatchAsyncError(
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { id } = req.params;
//       const folder = await Folder.findByPk(id);

//       if (!folder) {
//         return next(new ErrorHandler("Folder not found", 404));
//       }

//       await folder.destroy();

//       res.status(200).json({ success: true, message: "Folder deleted" });
//     } catch (error: any) {
//       return next(new ErrorHandler(error.message, 500));
//     }
//   }
// );

export const GetStatOfSet = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.body;


      // const session = await UserSession.findOne({where:{
      //   sessionId:
      // }}});
      //   console.log("session", session);
      // session.completed = false;
      // await session.save();

      // const existingProgress = await UserProgress.findAll({
      //   where: {
      //     sessionId: sessionId,
      //   },
      // });
      // await Promise.all(
      //   existingProgress.map(async (progress: any) => {
      //     progress.isCorrect = false;
      //     progress.timesAnswered = 0;
      //     await progress.save();
      //   })
      // );
      // console.log(existingProgress);
      // console.log("is", existingProgress);

      // res.status(200).json({
      //   success: true,
      //   message: "restart successfully!",
      //   session,
      // });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Search flashcard sets by title/description (supports finding other users' public sets)
export const searchSets = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      const scope = (req.query.scope as string) || "all"; // 'all' | 'others' | 'mine'
      const currentUserId = (req as CustomRequest).user?.id;

      const andConditions: any[] = [{ statusId: { [Op.ne]: 3 } }];

      if (scope === "others" && currentUserId) {
        andConditions.push({ userId: { [Op.ne]: currentUserId }, isPublic: true });
      } else if (scope === "mine" && currentUserId) {
        andConditions.push({ userId: currentUserId });
      } else {
        // 'all': public sets from anyone OR current user's own sets
        andConditions.push(
          currentUserId
            ? { [Op.or]: [{ isPublic: true }, { userId: currentUserId }] }
            : { isPublic: true }
        );
      }

      if (q) {
        andConditions.push({
          [Op.or]: [
            { title: { [Op.iLike]: `%${q}%` } },
            { description: { [Op.iLike]: `%${q}%` } },
          ],
        });
      }

      const sets = await Set.findAll({
        where: { [Op.and]: andConditions },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "avatar"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 50,
      });

      // Single grouped query for card counts (avoids N+1 queries)
      const setIds = sets.map((s: any) => s.id);
      const countMap: Record<string, number> = {};
      if (setIds.length > 0) {
        const counts = await Card.findAll({
          attributes: ["setId", [fn("COUNT", col("id")), "count"]],
          where: { setId: { [Op.in]: setIds } },
          group: ["setId"],
          raw: true,
        });
        counts.forEach((row: any) => {
          countMap[row.setId] = Number(row.count || 0);
        });
      }

      const setsWithCounts = sets.map((s: any) => ({
        ...s.toJSON(),
        cardCount: countMap[s.id] || 0,
      }));

      res.status(200).json({
        success: true,
        total: setsWithCounts.length,
        sets: setsWithCounts,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

