import { Response } from "express";
import db from "../models/index";
const User = db.User;
const Role = db.Role;

export const getUserById = async (id: string, res: Response) => {
    const user = await User.findByPk(id, {
        include: [{ model: Role, as: "role" }],
        attributes: { exclude: ["password"] },
    });
    if (user) {
        res.status(200).json({
            success: true,
            user,
        });
    }
};
