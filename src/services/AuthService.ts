import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { validarEmail } from "../utils/validators";
import { executeWithResilience } from "../utils/resilience";
import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { ClientAuthClient } from "./ClientAuthClient";

interface LoginResult {
  usuario: {
    id: number;
    nome: string | null;
    email: string | null;
    cpf?: string | null;
    permissao: string;
    ativo: boolean | null;
  };
  token: string;
}

interface AdminInterno {
  id: number;
  nome: string | null;
  email: string | null;
  senha: string | null;
  cpf: string | null;
  permissao: string | null;
  ativo: boolean | null;
  deletado_em: Date | null;
}

export class AuthService {
  private usuarioRepository: UsuarioRepository;
  private clientAuthClient: ClientAuthClient;

  constructor() {
    this.usuarioRepository = new UsuarioRepository();
    this.clientAuthClient = new ClientAuthClient();
  }

  /**
   * Fluxo completo do login:
   *   1. Valida formato do email.
   *   2. Tenta buscar admin no banco local (com resiliência).
   *   3. Se achou → valida senha local, emite JWT ADMIN.
   *   4. Se NÃO achou → chama backend principal para validar cliente.
   *   5. Backend confirma → emite JWT CLIENTE.
   *
   * Correções em relação ao authService original:
   *   - Todos os erros viram AppError com statusCode + code corretos
   *   - `ativo !== true` rejeita null/undefined (não só `=== false`)
   *   - Verifica `deletado_em` no admin (soft delete realmente bloqueia)
   *   - Logger estruturado em vez de throw genérico
   */
  async login(email: string, senha: string): Promise<LoginResult> {
    if (!validarEmail(email)) {
      throw new AppError("Email inválido", 400, "INVALID_EMAIL");
    }

    const admin = (await executeWithResilience(
      () => this.usuarioRepository.findByEmail(email, false),
      "AuthService_BuscaAdmin"
    )) as AdminInterno | null;

    if (admin) {
      return this.loginAdmin(admin, senha);
    }

    return this.loginCliente(email, senha);
  }

  // ============================================
  // Login de ADMIN (validação local)
  // ============================================

  private async loginAdmin(
    admin: AdminInterno,
    senha: string
  ): Promise<LoginResult> {
    // Defesa em profundidade: findByEmail já filtra deletado_em,
    // mas garantimos aqui também.
    if (admin.deletado_em) {
      throw new AppError(
        "Email ou senha inválidos",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    // `ativo !== true` rejeita false, null, undefined — mais seguro
    // que o original, que só rejeitava `=== false` e deixava passar null.
    if (admin.ativo !== true) {
      throw new AppError(
        "Usuário desativado. Contate o administrador.",
        403,
        "USER_DISABLED"
      );
    }

    if (!admin.senha) {
      throw new AppError(
        "Usuário sem senha cadastrada",
        400,
        "NO_PASSWORD"
      );
    }

    const senhaValida = await bcrypt.compare(senha, admin.senha);
    if (!senhaValida) {
      throw new AppError(
        "Email ou senha inválidos",
        401,
        "INVALID_CREDENTIALS"
      );
    }

    const token = this.gerarToken({
      id: admin.id,
      email: admin.email ?? "",
      permissao: admin.permissao ?? "ADMIN",
    });

    const { senha: _senha, deletado_em: _del, ...usuarioSemSenha } = admin;

    return {
      usuario: {
        id: usuarioSemSenha.id,
        nome: usuarioSemSenha.nome,
        email: usuarioSemSenha.email,
        cpf: usuarioSemSenha.cpf,
        permissao: usuarioSemSenha.permissao ?? "ADMIN",
        ativo: usuarioSemSenha.ativo,
      },
      token,
    };
  }

  // ============================================
  // Login de CLIENTE (delega ao backend principal)
  // ============================================

  private async loginCliente(
    email: string,
    senha: string
  ): Promise<LoginResult> {
    const cliente = await this.clientAuthClient.validateCredentials(
      email,
      senha
    );

    if (cliente.ativo !== true) {
      throw new AppError(
        "Usuário desativado. Contate o administrador.",
        403,
        "USER_DISABLED"
      );
    }

    const token = this.gerarToken({
      id: cliente.id,
      email: cliente.email,
      permissao: cliente.permissao ?? "CLIENTE",
    });

    return {
      usuario: {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        permissao: cliente.permissao ?? "CLIENTE",
        ativo: cliente.ativo,
      },
      token,
    };
  }

  // ============================================
  // Helper
  // ============================================

  private gerarToken(payload: {
    id: number;
    email: string;
    permissao: string;
  }): string {
    if (!env.JWT_SECRET) {
      logger.error("ERRO CRÍTICO: JWT_SECRET não configurado.");
      throw new AppError(
        "Erro interno de configuração do servidor",
        500,
        "CONFIG_ERROR"
      );
    }

    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1d" });
  }
}