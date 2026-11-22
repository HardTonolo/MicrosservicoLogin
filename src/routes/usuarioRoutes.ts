import { Router } from "express";
import { UsuarioController } from "../controllers/UsuarioController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { isAdmin } from "../middlewares/roleMiddleware";

const router = Router();
const usuarioController = new UsuarioController();

// ============================================
// Rotas do próprio admin (self-service)
// Resolvem o bug B17: sem :id na URL, sem colisão de IDs.
// ============================================
router.put(
  "/me",
  authMiddleware,
  usuarioController.atualizarMeuPerfil.bind(usuarioController)
);

router.delete(
  "/me",
  authMiddleware,
  usuarioController.deletarMeuPerfil.bind(usuarioController)
);

// ============================================
// Rotas de CRUD (todas exigem ADMIN)
// ============================================
router.post(
  "/",
  authMiddleware,
  isAdmin,
  usuarioController.criar.bind(usuarioController)
);

router.get(
  "/",
  authMiddleware,
  isAdmin,
  usuarioController.listar.bind(usuarioController)
);

router.put(
  "/:id",
  authMiddleware,
  isAdmin,
  usuarioController.atualizar.bind(usuarioController)
);

router.put(
  "/:id/senha",
  authMiddleware,
  isAdmin,
  usuarioController.alterarSenha.bind(usuarioController)
);

router.delete(
  "/:id",
  authMiddleware,
  isAdmin,
  usuarioController.deletar.bind(usuarioController)
);

export default router;