import prisma from "../prisma/prismaClient";

// Campos que SAEM em leituras normais (nunca inclui senha)
const SELECT_SEM_SENHA = {
  id: true,
  nome: true,
  email: true,
  cpf: true,
  permissao: true,
  ativo: true,
  criado_em: true,
  atualizado_em: true,
} as const;

// Campos que SAEM apenas quando precisamos validar senha (login/alterar senha)
const SELECT_COM_SENHA = {
  ...SELECT_SEM_SENHA,
  senha: true,
} as const;

export class UsuarioRepository {
  async findAll() {
    return prisma.usuarios.findMany({
      where: { deletado_em: null },
      select: SELECT_SEM_SENHA,
      orderBy: { criado_em: "desc" },
    });
  }

  async findAllPaginated(skip: number, limit: number) {
    return prisma.usuarios.findMany({
      where: { deletado_em: null },
      skip,
      take: limit,
      select: SELECT_SEM_SENHA,
      orderBy: { criado_em: "desc" },
    });
  }

  async countAll() {
    return prisma.usuarios.count({ where: { deletado_em: null } });
  }

  async findById(id: number) {
    return prisma.usuarios.findFirst({
      where: { id, deletado_em: null },
      select: SELECT_COM_SENHA,
    });
  }

  /**
   * Busca por email.
   *
   * O parâmetro `includeDeleted` controla se registros soft-deleted
   * devem ser considerados:
   *   - `false` (padrão): ignora soft-deleted → uso para LOGIN
   *   - `true`: inclui soft-deleted → uso para CHECAGEM DE UNICIDADE
   *
   * Por que essa distinção?
   * O MySQL mantém `email` como @unique MESMO em registros soft-deleted.
   * Se criarmos um novo com o mesmo email de um soft-deleted, o MySQL
   * rejeita com constraint violation (erro cru do Prisma). Então a
   * checagem de unicidade precisa "ver" o soft-deleted para avisar antes.
   *
   * Corrige o bug B9 da auditoria.
   */
  async findByEmail(email: string, includeDeleted = false) {
    return prisma.usuarios.findFirst({
      where: {
        email,
        ...(includeDeleted ? {} : { deletado_em: null }),
      },
      select: SELECT_COM_SENHA,
    });
  }

  /**
   * Mesma lógica do findByEmail, mas para CPF.
   * Ver bug B9 da auditoria.
   */
  async findByCpf(cpf: string, includeDeleted = false) {
    return prisma.usuarios.findFirst({
      where: {
        cpf,
        ...(includeDeleted ? {} : { deletado_em: null }),
      },
    });
  }

  /**
   * Cria usuário.
   * O tipo é explícito (não `any`) para evitar erros silenciosos
   * e alinhar com a rubrica de tipagem estrita. Ver bug B12.
   */
  async create(data: {
    nome: string;
    email: string;
    senha: string;
    cpf: string;
    permissao?: string;
    ativo?: boolean;
  }) {
    return prisma.usuarios.create({ data });
  }

  /**
   * Atualiza usuário.
   * NÃO aceita `email` nem `permissao` — são imutáveis por regra de negócio
   * (ver bug B13). Tipagem explícita (não `any`). Ver bug B12.
   */
  async update(
    id: number,
    data: {
      nome?: string;
      senha?: string;
      cpf?: string;
      ativo?: boolean;
      atualizado_em?: Date;
    }
  ) {
    return prisma.usuarios.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: number) {
    return prisma.usuarios.update({
      where: { id },
      data: {
        deletado_em: new Date(),
        ativo: false,
      },
    });
  }
}