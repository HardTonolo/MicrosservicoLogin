import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../utils/logger";

interface TokenPayload {
  id: number;
  email: string;
  permissao: string;
}

/**
 * Valida o JWT enviado no header Authorization: Bearer <token>.
 * Se válido, popula `req.user` com { id, email, permissao }.
 * Se inválido/expirado, retorna 401.
 *
 * NÃO consulta o banco — o JWT é a fonte de verdade (stateless).
 * Corrige o bug B8 (console.error → logger.error).
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Token não fornecido",
      code: "MISSING_TOKEN",
    });
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({
      error: "Token mal formatado",
      code: "MALFORMED_TOKEN",
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    logger.error("ERRO CRÍTICO: JWT_SECRET não configurado.");
    return res.status(500).json({
      error: "Erro interno de configuração do servidor",
      code: "CONFIG_ERROR",
    });
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;

    req.user = {
      id: decoded.id,
      email: decoded.email,
      permissao: decoded.permissao,
    };

    next();
  } catch {
    return res.status(401).json({
      error: "Token inválido ou expirado",
      code: "INVALID_TOKEN",
    });
  }
};