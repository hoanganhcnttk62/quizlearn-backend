import { Response } from "express";
import db from "../models/index";
const User = db.User;

export const getUserById = async (id: string, res: Response) => {
    const user = await User.findByPk(id);
    if (user) {
        res.status(200).json({
            success: true,
            user
        });
    }
};
