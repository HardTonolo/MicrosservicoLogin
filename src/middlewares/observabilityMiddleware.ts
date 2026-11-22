import { Request, Response, NextFunction } from "express";
import client from "prom-client";
import { logger } from "../utils/logger";

// Inicializa métricas padrão do Node (CPU, memória, event loop, etc.)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Histograma de duração das requisições HTTP
export const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duração das requisições HTTP em segundos",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5], // SLO de 300ms
});

// Contador de requisições HTTP
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total de requisições HTTP",
  labelNames: ["method", "route", "status_code"],
});

/**
 * Middleware de observabilidade.
 *
 * - Coleta métricas Prometheus (duração + contador) de toda requisição.
 * - Registra no logger apenas requisições anormais (status >= 400 ou duração > 500ms).
 *
 * Correção em relação ao backend principal:
 *   - `process.hrtime` retorna [segundos, nanossegundos]. O backend original
 *     pegava só o índice [1] (nanossegundos), o que fazia requisições acima
 *     de 1s aparecerem como <1s nas métricas. Corrigido aqui.
 */
export const observabilityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationInSeconds = seconds + nanoseconds / 1e9;

    // `req.route` só existe DEPOIS que o Express casou a rota.
    // Como este middleware roda no topo, quase sempre cai no `req.path`.
    const route = req.route ? req.route.path : req.path;

    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode.toString())
      .observe(durationInSeconds);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();

    if (res.statusCode >= 400 || durationInSeconds > 0.5) {
      logger.warn(
        `Requisição anormal: ${req.method} ${route} status=${res.statusCode} duration=${(durationInSeconds * 1000).toFixed(2)}ms ip=${req.ip}`
      );
    }
  });

  next();
};