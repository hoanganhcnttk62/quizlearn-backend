import { Request, Response, NextFunction } from "express";
import { Op } from "sequelize";
import { CatchAsyncError } from "../middleware/CatchAsyncError";
import ErrorHandler from "../utils/errorHandler";
import db from "../models/index";
import { Badge } from "../models/badge";

const User = db.User;
const Role = db.Role;
const Set = db.Set;
const Card = db.Card;
const Folder = db.Folder;

// 1. Thống kê tổng quan hệ thống cho Admin
export const getAdminStats = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [totalUsers, totalSets, totalCards, totalFolders, totalBadges] =
        await Promise.all([
          User.count(),
          Set.count(),
          Card.count(),
          Folder.count(),
          Badge.count().catch(() => 0),
        ]);

      // Lấy 5 user mới nhất
      const recentUsers = await User.findAll({
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "username", "email", "createdAt", "statusId"],
        include: [{ model: Role, as: "role", attributes: ["name"] }],
      });

      // Lấy 5 bộ thẻ mới nhất
      const recentSets = await Set.findAll({
        limit: 5,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "title", "description", "isPublic", "createdAt"],
        include: [{ model: User, as: "user", attributes: ["username", "email"] }],
      });

      res.status(200).json({
        success: true,
        stats: {
          totalUsers,
          totalSets,
          totalCards,
          totalFolders,
          totalBadges,
          recentUsers,
          recentSets,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 2. Danh sách tất cả người dùng (hỗ trợ phân trang, tìm kiếm)
export const getAdminUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = (req.query.search as string) || "";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const whereClause: any = {};
      if (search) {
        whereClause[Op.or] = [
          { username: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        include: [{ model: Role, as: "role", attributes: ["id", "name"] }],
        attributes: { exclude: ["password"] },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        users,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 3. Khóa hoặc kích hoạt tài khoản
export const toggleUserStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await User.findByPk(id);

      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Đảo trạng thái: nếu đang 1 (active) thì thành 0 (locked) và ngược lại
      const newStatus = user.statusId === 1 ? 0 : 1;
      user.statusId = newStatus;
      await user.save();

      res.status(200).json({
        success: true,
        message: newStatus === 1 ? "User unlocked successfully" : "User blocked successfully",
        user: {
          id: user.id,
          username: user.username,
          statusId: user.statusId,
        },
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 4. Danh sách tất cả bộ thẻ Flashcard (Sets) trên toàn hệ thống
export const getAdminSets = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = (req.query.search as string) || "";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const whereClause: any = {};
      if (search) {
        whereClause.title = { [Op.iLike]: `%${search}%` };
      }

      const { count, rows: sets } = await Set.findAndCountAll({
        where: whereClause,
        include: [
          { model: User, as: "user", attributes: ["id", "username", "email", "avatar"] },
          { model: Card, as: "cards", attributes: ["id"] },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      const formattedSets = sets.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        isPublic: s.isPublic,
        isDraft: s.isDraft,
        cardCount: s.cards ? s.cards.length : 0,
        createdAt: s.createdAt,
        user: s.user,
      }));

      res.status(200).json({
        success: true,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        sets: formattedSets,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 5. Xóa bộ thẻ vi phạm nội dung
export const deleteAdminSet = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const set = await Set.findByPk(id);

      if (!set) {
        return next(new ErrorHandler("Set not found", 404));
      }

      // Xóa tất cả các thẻ trong set trước
      await Card.destroy({ where: { setId: id } });
      await set.destroy();

      res.status(200).json({
        success: true,
        message: "Set and related cards deleted successfully",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// 6. Danh sách Thư mục (Folders)
export const getAdminFolders = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const folders = await Folder.findAll({
        include: [{ model: User, as: "user", attributes: ["id", "username", "email"] }],
        order: [["createdAt", "DESC"]],
      });

      res.status(200).json({
        success: true,
        folders,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
