export interface UsuarioData {
  nome: string;
  email: string;
  senha: string;
  cpf: string;
  ativo?: boolean;
}

export interface UsuarioUpdateData {
  nome?: string;
  cpf?: string;
  senha?: string;
  ativo?: boolean;
}

export interface UsuarioResponse {
  id: number;
  nome: string | null;
  email: string | null;
  cpf: string | null;
  permissao: string | null;
  ativo: boolean | null;
  criado_em: Date;
  atualizado_em: Date;
}