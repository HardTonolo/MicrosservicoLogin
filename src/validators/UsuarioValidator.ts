import { validarEmail, validarCPF, validarNivelSenha } from "../utils/validators";
import { AppError } from "../utils/AppError";
import { UsuarioData, UsuarioUpdateData } from "../types/usuario";

const MSG_SENHA_FRACA =
  "A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, uma minúscula, um número e um caractere especial (@$!%*?&)";

export class UsuarioValidator {
  static validateCreate(data: UsuarioData): true {
    if (!data.nome || !data.email || !data.senha || !data.cpf) {
      throw new AppError(
        "Nome, email, senha e CPF são obrigatórios",
        400,
        "MISSING_FIELDS"
      );
    }

    if (!validarEmail(data.email)) {
      throw new AppError("Email inválido", 400, "INVALID_EMAIL");
    }

    if (!validarCPF(data.cpf)) {
      throw new AppError("CPF inválido", 400, "INVALID_CPF");
    }

    if (!validarNivelSenha(data.senha)) {
      throw new AppError(MSG_SENHA_FRACA, 400, "WEAK_PASSWORD");
    }

    return true;
  }

  static validateUpdate(data: UsuarioUpdateData): true {
    // Defesa em profundidade: o tipo UsuarioUpdateData NÃO tem `email`
    // nem `permissao`, mas o controller recebe req.body (any em runtime).
    // Alguém malicioso pode mandar esses campos — bloqueamos mesmo assim.
    const raw = data as UsuarioUpdateData & {
      email?: unknown;
      permissao?: unknown;
    };

    if (raw.email !== undefined) {
      throw new AppError(
        "Não é permitido alterar o email",
        400,
        "EMAIL_IMMUTABLE"
      );
    }

    if (raw.permissao !== undefined) {
      throw new AppError(
        "Não é permitido alterar a permissão",
        400,
        "PERMISSION_IMMUTABLE"
      );
    }

    if (data.cpf && !validarCPF(data.cpf)) {
      throw new AppError("CPF inválido", 400, "INVALID_CPF");
    }

    if (data.senha && !validarNivelSenha(data.senha)) {
      throw new AppError(MSG_SENHA_FRACA, 400, "WEAK_PASSWORD");
    }

    return true;
  }
}