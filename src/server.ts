// A ordem dos imports aqui importa:
// 1) `env` primeiro — se faltar variável, o processo aborta ANTES de qualquer coisa.
// 2) `app` depois — monta o Express (que também usa env).
// 3) `prisma` e `logger` depois — usados no bootstrap abaixo.
import { env } from "./config/env";
import app from "./app";
import prisma from "./prisma/prismaClient";
import { logger } from "./utils/logger";
import { shutdownResilience } from "./utils/resilience";

async function bootstrap() {
  try {
    // ============================================
    // 1. Testa conexão com o banco (fail-fast)
    // ============================================
    // Se o MySQL estiver inacessível, preferimos falhar AQUI, no boot,
    // em vez de subir o servidor e descobrir no primeiro login.
    await prisma.$connect();
    logger.info("✅ Banco de dados conectado");

    // ============================================
    // 2. Sobe o servidor HTTP
    // ============================================
    const server = app.listen(env.PORT, () => {
      logger.info(
        `🚀 Auth Service rodando em http://localhost:${env.PORT} (${env.NODE_ENV})`
      );
      logger.info(`   Health:  http://localhost:${env.PORT}/health`);
      logger.info(`   Metrics: http://localhost:${env.PORT}/metrics`);
      logger.info(`   Login:   POST http://localhost:${env.PORT}/auth/login`);
    });

    // ============================================
    // 3. Graceful shutdown
    // ============================================
    // Quando Docker envia SIGTERM (docker stop) ou você aperta Ctrl+C (SIGINT),
    // fechamos HTTP, desconectamos o Prisma e encerramos os breakers.
    // Damos até 10s; se travar, força.
    const shutdown = async (signal: string) => {
      logger.info(`Recebido ${signal}. Encerrando o servidor...`);

      // Timeout de segurança: se algo travar, mata em 10s
      const forcedExit = setTimeout(() => {
        logger.error("⚠️ Shutdown forçado após 10s");
        process.exit(1);
      }, 10000);
      forcedExit.unref(); // não mantém o processo vivo por causa do timer

      server.close(async () => {
        logger.info("HTTP server fechado");

        await prisma.$disconnect();
        logger.info("Prisma desconectado");

        shutdownResilience();
        logger.info("Circuit breakers encerrados");

        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error("Erro ao iniciar o servidor:", error);
    process.exit(1);
  }
}

bootstrap();