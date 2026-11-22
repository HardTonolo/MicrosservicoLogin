import { Request, Response } from "express";
import { AuthService } from "../services/AuthService";
import { AppError } from "../utils/AppError";

const authService = new AuthService();

export class LoginController {
  async login(req: Request, res: Response) {
    const { email, senha } = req.body;

    if (!email || !senha) {
      throw new AppError(
        "E-mail e senha são obrigatórios.",
        400,
        "MISSING_FIELDS"
      );
    }

    const resultado = await authService.login(email, senha);

    return res.json(resultado);
  }
}