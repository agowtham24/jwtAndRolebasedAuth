import { Request, Response } from "express";
import { UserRepository } from "../Repositories/Users";
import { RoleRepository } from "../Repositories/Roles";
import { MongoDB } from "../mongoDB-setup";
import { Bcrypt } from "../Utils/Bcrypt";
import { Jwt } from "../Utils/Jwt";

export class UserController {
  static async createUser(req: Request, res: Response) {
    try {
      const isExistingRole = await RoleRepository.getRole([
        {
          $match: { _id: await MongoDB.convertToObjectId(req.body.role) },
        },
        {
          $project: {
            role: 1,
          },
        },
      ]);
      if (isExistingRole.length === 0)
        return res.status(404).json({ message: "Role not found" });
      req.body.password = await Bcrypt.hashPassword(req.body.password);
      await UserRepository.addUser(req.body);
      return res.status(200).json({ message: "User added successfully" });
    } catch (error) {
      return res.status(500).json(error);
    }
  }
  static async getAllUsers(req: Request, res: Response) {
    try {
      const data = await UserRepository.getUser([
        {
          $lookup: {
            from: "roles",
            localField: "role",
            foreignField: "_id",
            as: "userRole",
          },
        },
        { $unwind: "$userRole" },
        {
          $project: {
            name: 1,
            email: 1,
            role: "$userRole.role",
            pagePermissions: "$userRole.pagePermissions",
          },
        },
      ]);
      console.log(data,"data")
      return res.status(200).json({ message: "Users Fetched", data });
    } catch (error) {
      return res.status(500).json(error);
    }
  }
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const isExistingUser = await UserRepository.getUser([
        {
          $match: { email },
        },
      ]);

      if (isExistingUser.length === 0)
        return res.status(404).json({ message: "No user found on that email" });

      const isPasswordMatched = await Bcrypt.comparePassword(
        password,
        isExistingUser[0].password
      );

      if (!isPasswordMatched)
        return res.status(404).json({ message: "Password mismatched" });

      const loginCount = isExistingUser[0].loginCount + 1;
      await UserRepository.updateUser(isExistingUser[0]._id, { loginCount });
      const token = await Jwt.generateToken({
        email: isExistingUser[0].email,
        loginCount,
      });
      return res.status(200).json({ message: "Login Successful", token });
    } catch (error) {
      return res.status(500).json(error);
    }
  }
}