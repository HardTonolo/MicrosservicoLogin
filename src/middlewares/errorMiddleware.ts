import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

/**
 * Middleware global de tratamento de erros.
 *
 * Captura TUDO que for lançado em controllers/services assíncronos
 * (o Express 5 encaminha automaticamente erros de handlers async).
 *
 * Regras:
 *   1. `AppError`   → usa `statusCode` e `message` (erro esperado, controlado).
 *   2. Erro Prisma  → 500 com mensagem genérica + log completo.
 *   3. Erro qualquer → 500 com mensagem genérica + log completo.
 *
 * Nunca devolve stack trace, nome de tabela, IP de banco ou detalhes
 * internos para o cliente — só `logger.error` guarda isso.
 *
 * Corrige os bugs B5 (sem middleware) e B6 (vazamento de error.message).
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // `next` precisa existir com 4 parâmetros para o Express
  // reconhecer como error middleware. Mesmo não usando, mantenho.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  // ============================================
  // 1. Erro controlado (AppError) — mensagem vai pro cliente
  // ============================================
  if (err instanceof AppError) {
    logger.warn(
      `[${err.statusCode}] ${err.code} — ${err.message} — ${req.method} ${req.originalUrl}`
    );
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // ============================================
  // 2. Erro desconhecido — mensagem genérica pro cliente
  // ============================================
  // Log completo (com stack) fica APENAS no logger, nunca na resposta.
  const detalhe =
    err instanceof Error
      ? { message: err.message, stack: err.stack, name: err.name }
      : { message: String(err) };

  logger.error(
    `Erro não tratado em ${req.method} ${req.originalUrl}:`,
    detalhe
  );

  return res.status(500).json({
    error: "Erro interno do servidor",
    code: "INTERNAL_ERROR",
  });
}