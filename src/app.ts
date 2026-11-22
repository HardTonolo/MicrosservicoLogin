import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { observabilityMiddleware } from "./middlewares/observabilityMiddleware";
import { errorMiddleware } from "./middlewares/errorMiddleware";
import authRoutes from "./routes/authRoutes";
import usuarioRoutes from "./routes/usuarioRoutes";
import healthRoutes from "./routes/healthRoutes";
import metricsRoutes from "./routes/metricsRoutes";

const app = express();

// ============================================
// 1. OBSERVABILIDADE PRIMEIRO
// ============================================
// Deve ser o primeiro da cadeia para capturar TODA requisição,
// inclusive erros e preflight de CORS.
app.use(observabilityMiddleware);

// ============================================
// 2. CORS RESTRITO (não aberto como o backend)
// ============================================
// Lê a lista de origens do .env (separada por vírgula).
// credentials: true permite cookies/headers especiais no futuro.
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  })
);

// ============================================
// 3. PARSER DE JSON
// ============================================
// Sem isso, req.body fica undefined e o login quebra.
app.use(express.json());

// ============================================
// 4. ROTA RAIZ (informativa, pública)
// ============================================
app.get("/", (_req, res) => {
  res.json({
    service: "auth",
    status: "ok",
    message: "Auth Service funcionando",
    endpoints: ["/health", "/metrics", "/auth/login", "/usuarios"],
  });
});

// ============================================
// 5. ROTAS
// ============================================
// Públicas primeiro (health, metrics, login):
app.use("/health", healthRoutes);
app.use("/metrics", metricsRoutes);
app.use("/auth", authRoutes);

// Protegidas (authMiddleware dentro do router):
app.use("/usuarios", usuarioRoutes);

// ============================================
// 6. MIDDLEWARE DE ERRO — SEMPRE POR ÚLTIMO
// ============================================
// Express só reconhece error middleware se for declarado DEPOIS de todas
// as rotas. Se ficar antes, erros das rotas não chegam nele.
app.use(errorMiddleware);

export default app;