import bcrypt from "bcryptjs";
import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { UsuarioValidator } from "../validators/UsuarioValidator";
import { UsuarioData, UsuarioUpdateData, UsuarioResponse } from "../types/usuario";
import {
  getPaginationParams,
  formatPaginatedResponse,
} from "../utils/pagination";
import { AppError } from "../utils/AppError";

export class UsuarioService {
  private repository: UsuarioRepository;

  constructor() {
    this.repository = new UsuarioRepository();
  }

  async listarComPaginacao(page?: number, limit?: number) {
    const { page: pageNum, limit: limitNum, skip } = getPaginationParams({
      page,
      limit,
    });

    const [usuarios, total] = await Promise.all([
      this.repository.findAllPaginated(skip, limitNum),
      this.repository.countAll(),
    ]);

    return formatPaginatedResponse(usuarios, total, pageNum, limitNum);
  }

  async criar(data: UsuarioData): Promise<UsuarioResponse> {
    UsuarioValidator.validateCreate(data);

    // Checagem de unicidade considera soft-deleted (bug B9 corrigido aqui)
    await this.verificarEmailUnico(data.email);
    await this.verificarCpfUnico(data.cpf);

    const senhaHash = await this.gerarHashSenha(data.senha);
    const usuario = await this.repository.create(
      this.montarDadosCriacao(data, senhaHash)
    );

    return this.removerSenha(usuario);
  }

  async atualizar(
    id: number,
    data: UsuarioUpdateData
  ): Promise<UsuarioResponse> {
    // Garante que o usuário existe (e não está soft-deleted)
    await this.buscarPorIdOuFalhar(id);

    UsuarioValidator.validateUpdate(data);

    // Se o CPF mudou, checa unicidade (considerando soft-deleted)
    await this.verificarCpfUnicoAtualizacao(data.cpf, id);

    // Se a senha mudou, gera hash novo
    const senhaHash = data.senha
      ? await this.gerarHashSenha(data.senha)
      : undefined;

    const usuario = await this.repository.update(
      id,
      this.montarDadosAtualizacao(data, senhaHash)
    );

    return this.removerSenha(usuario);
  }

  async deletar(id: number) {
    await this.buscarPorIdOuFalhar(id);
    await this.repository.softDelete(id);
    return { message: "Usuário deletado com sucesso" };
  }

  async alterarSenha(id: number, senhaAtual: string, novaSenha: string) {
    const usuario = await this.repository.findById(id);

    if (!usuario) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }

    if (!usuario.senha) {
      throw new AppError(
        "Usuário não possui senha cadastrada",
        400,
        "NO_PASSWORD"
      );
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
      throw new AppError("Senha atual incorreta", 401, "WRONG_PASSWORD");
    }

    if (!this.senhaPassaNivel(novaSenha)) {
      throw new AppError(
        "A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, uma minúscula, um número e um caractere especial (@$!%*?&)",
        400,
        "WEAK_PASSWORD"
      );
    }

    const novaSenhaHash = await this.gerarHashSenha(novaSenha);
    await this.repository.update(id, { senha: novaSenhaHash });

    return { message: "Senha alterada com sucesso" };
  }

  // ============================================
  // Métodos auxiliares (private)
  // ============================================

  /**
   * Retorna o usuário (com senha) ou lança 404.
   * `private` — só uso interno do service (corrige bug B10: não expor hash).
   */
  private async buscarPorIdOuFalhar(id: number) {
    const usuario = await this.repository.findById(id);
    if (!usuario) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }
    return usuario;
  }

  /**
   * Verifica unicidade do email CONSIDERANDO soft-deleted (bug B9).
   * Se um registro soft-deleted tem esse email, o MySQL rejeitaria o insert
   * com constraint violation. Avisamos antes com 409.
   */
  private async verificarEmailUnico(email: string) {
    const existe = await this.repository.findByEmail(email, true);
    if (existe) {
      throw new AppError(
        "Email já cadastrado (pode pertencer a uma conta deletada)",
        409,
        "EMAIL_CONFLICT"
      );
    }
  }

  /**
   * Verifica unicidade do CPF no update (consulta com soft-deleted).
   */
  private async verificarCpfUnicoAtualizacao(cpf: string | undefined, id: number) {
    if (!cpf) return;
    const existe = await this.repository.findByCpf(cpf, true);
    if (existe && existe.id !== id) {
      throw new AppError(
        "CPF já cadastrado (pode pertencer a uma conta deletada)",
        409,
        "CPF_CONFLICT"
      );
    }
  }

  /**
   * Verifica unicidade do CPF no create.
   */
  private async verificarCpfUnico(cpf: string) {
    const existe = await this.repository.findByCpf(cpf, true);
    if (existe) {
      throw new AppError(
        "CPF já cadastrado (pode pertencer a uma conta deletada)",
        409,
        "CPF_CONFLICT"
      );
    }
  }

  private async gerarHashSenha(senha: string) {
    return bcrypt.hash(senha, 10);
  }

  /**
   * Valida nível de senha sem lançar — retorna boolean.
   * Reaproveita o validator de utils para não duplicar regex.
   */
  private senhaPassaNivel(senha: string): boolean {
    const { validarNivelSenha } = require("../utils/validators");
    return validarNivelSenha(senha);
  }

  private montarDadosCriacao(data: UsuarioData, senhaHash: string) {
    return {
      nome: data.nome,
      email: data.email,
      senha: senhaHash,
      cpf: data.cpf,
      permissao: "ADMIN", // Todo usuário do Auth é ADMIN por definição
      ativo: data.ativo ?? true,
    };
  }

  private montarDadosAtualizacao(
    data: UsuarioUpdateData,
    senhaHash?: string
  ) {
    return {
      nome: data.nome,
      senha: senhaHash,
      cpf: data.cpf,
      ativo: data.ativo,
      atualizado_em: new Date(),
    };
  }

  /**
   * Remove o campo `senha` do objeto antes de devolver.
   * Garante que o hash nunca vaze para o controller/front (bug B10).
   */
  private removerSenha(usuario: any): UsuarioResponse {
    const { senha: _senha, ...resto } = usuario;
    return resto as UsuarioResponse;
  }
}