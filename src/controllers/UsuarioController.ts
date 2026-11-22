import { Request, Response } from "express";
import { UsuarioService } from "../services/UsuarioService";
import { AppError } from "../utils/AppError";

const usuarioService = new UsuarioService();

export class UsuarioController {
  async listar(req: Request, res: Response) {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const resultado = await usuarioService.listarComPaginacao(page, limit);
    res.json(resultado);
  }

  async criar(req: Request, res: Response) {
    const usuario = await usuarioService.criar(req.body);
    res.status(201).json({
      data: usuario,
      message: "Administrador criado com sucesso",
    });
  }

  async atualizar(req: Request, res: Response) {
    const id = this.parseId(req.params.id);
    const usuario = await usuarioService.atualizar(id, req.body);
    res.json({ data: usuario, message: "Usuário atualizado com sucesso" });
  }

  async alterarSenha(req: Request, res: Response) {
    const id = this.parseId(req.params.id);
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      throw new AppError(
        "Senha atual e nova senha são obrigatórias",
        400,
        "MISSING_FIELDS"
      );
    }

    const resultado = await usuarioService.alterarSenha(
      id,
      senhaAtual,
      novaSenha
    );
    res.json(resultado);
  }

  async deletar(req: Request, res: Response) {
    const id = this.parseId(req.params.id);
    const resultado = await usuarioService.deletar(id);
    res.json(resultado);
  }

  // --------------------------------------------
  // Rotas /me (admin edita/deleta o próprio perfil)
  // Resolvem o bug B17 da auditoria (colisão de IDs).
  // --------------------------------------------

  async atualizarMeuPerfil(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError("Usuário não autenticado", 401, "UNAUTHENTICATED");
    }
    const usuario = await usuarioService.atualizar(req.user.id, req.body);
    res.json({ data: usuario, message: "Seu perfil foi atualizado" });
  }

  async deletarMeuPerfil(req: Request, res: Response) {
    if (!req.user) {
      throw new AppError("Usuário não autenticado", 401, "UNAUTHENTICATED");
    }
    const resultado = await usuarioService.deletar(req.user.id);
    res.json(resultado);
  }

  // --------------------------------------------
  // Helper
  // --------------------------------------------

  private parseId(raw: string | string[] | undefined): number {
    const id = Number(raw);
    if (isNaN(id) || id <= 0) {
      throw new AppError("ID inválido", 400, "INVALID_ID");
    }
    return id;
  }
}