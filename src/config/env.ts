import "dotenv/config";

/**
 * Validação e tipagem das variáveis de ambiente.
 *
 * Toda variável obrigatória é verificada AQUI, no boot do servidor.
 * Se faltar alguma, o processo falha imediatamente com mensagem clara,
 * em vez de quebrar no meio de um login em runtime.
 */

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || valor.trim() === "") {
    console.error(`\n❌ Variável de ambiente obrigatória ausente: ${nome}\n`);
    console.error(
      "   Verifique o arquivo .env na raiz do ProjetoConcessionariaAuth.\n"
    );
    process.exit(1);
  }
  return valor;
}

function opcional(nome: string, padrao: string): string {
  return process.env[nome] ?? padrao;
}

export const env = {
  // Servidor
  NODE_ENV: opcional("NODE_ENV", "development"),
  PORT: Number(opcional("PORT", "3002")),

  // Banco de dados
  DATABASE_URL: obrigatoria("DATABASE_URL"),

  // JWT (precisa ser IGUAL ao do backend principal)
  JWT_SECRET: obrigatoria("JWT_SECRET"),

  // Integração com backend principal
  BACKEND_MAIN_URL: obrigatoria("BACKEND_MAIN_URL"),
  INTERNAL_API_KEY: obrigatoria("INTERNAL_API_KEY"),

  // CORS
  CORS_ORIGIN: opcional(
    "CORS_ORIGIN",
    "http://localhost:3001,http://localhost"
  ),
} as const;

// Validações específicas
if (isNaN(env.PORT) || env.PORT <= 0 || env.PORT > 65535) {
  console.error(`\n❌ PORT inválida: ${env.PORT}. Deve ser um número entre 1 e 65535.\n`);
  process.exit(1);
}

if (env.JWT_SECRET.length < 16) {
  console.error(
    `\n❌ JWT_SECRET muito curto (${env.JWT_SECRET.length} caracteres).\n` +
      "   Use pelo menos 16 caracteres. E precisa ser IGUAL ao do backend.\n"
  );
  process.exit(1);
}

if (env.INTERNAL_API_KEY.length < 16) {
  console.error(
    `\n❌ INTERNAL_API_KEY muito curto (${env.INTERNAL_API_KEY.length} caracteres).\n` +
      "   Use pelo menos 16 caracteres.\n"
  );
  process.exit(1);
}

// Aviso (não bloqueia) se NODE_ENV não for production e o JWT_SECRET for o de dev
if (
  env.NODE_ENV !== "production" &&
  env.JWT_SECRET === "seu_segredo_super_secreto_aqui"
) {
  console.warn(
    "\n⚠️  Aviso: você está usando o JWT_SECRET de desenvolvimento.\n" +
      "   Troque por uma string longa e aleatória ANTES de entregar o projeto.\n"
  );
}

export default env;