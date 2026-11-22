import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Exige que o usuário autenticado tenha permissão ADMIN.
 * Deve ser usado DEPOIS do authMiddleware (que popula req.user).
 *
 * Corrige o bug B7 (elimina `(req as any).user`) e adiciona
 * log de acesso negado para observabilidade.
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Usuário não autenticado",
      code: "UNAUTHENTICATED",
    });
  }

  if (req.user.permissao !== "ADMIN") {
    logger.warn(
      `Acesso negado: usuário ${req.user.email} (id=${req.user.id}) tentou acessar ${req.method} ${req.originalUrl}`
    );
    return res.status(403).json({
      error: "Acesso negado. Apenas administradores podem acessar este recurso",
      code: "FORBIDDEN",
    });
  }

  next();
};