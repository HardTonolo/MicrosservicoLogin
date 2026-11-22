import { Router } from "express";
import { LoginController } from "../controllers/LoginController";

const router = Router();
const loginController = new LoginController();

// Endpoint público de login (admin ou cliente — o AuthService resolve)
router.post("/login", loginController.login.bind(loginController));

export default router;