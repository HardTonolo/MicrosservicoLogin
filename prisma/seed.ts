import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed do banco do Auth Service...\n");

  // ============================================
  // 1. Validar variáveis de ambiente
  // ============================================
  const nome = process.env.SEED_ADMIN_NOME;
  const email = process.env.SEED_ADMIN_EMAIL;
  const senha = process.env.SEED_ADMIN_SENHA;
  const cpf = process.env.SEED_ADMIN_CPF;

  if (!nome || !email || !senha || !cpf) {
    throw new Error(
      "❌ Variáveis de seed ausentes. Confira no .env:\n" +
        "   SEED_ADMIN_NOME, SEED_ADMIN_EMAIL, SEED_ADMIN_SENHA, SEED_ADMIN_CPF"
    );
  }

  // ============================================
  // 2. Verificar se admin já existe (idempotente)
  // ============================================
  // Busca SEM filtrar deletado_em — porque `email` é @unique no schema.
  // Se existir um registro soft-deletado com esse email, tentar criar outro
  // violaria a constraint. Nesse caso, avisamos e paramos.
  const adminExistente = await prisma.usuarios.findFirst({
    where: { email },
  });

  if (adminExistente) {
    if (adminExistente.deletado_em) {
      console.log(
        `⚠️  Existe um admin soft-deletado com o email "${email}".\n` +
          `   Não é possível recriar por causa do @unique no schema.\n` +
          `   Para recriar, restaure o registro ou use outro email.\n` +
          `   Seed encerrado sem criar nada.`
      );
      return;
    }
    console.log(`ℹ️  Admin com email "${email}" já existe. Nada a fazer.\n`);
    return;
  }

  // ============================================
  // 3. Gerar hash da senha
  // ============================================
  const senhaHash = await bcrypt.hash(senha, 10);

  // ============================================
  // 4. Criar o admin
  // ============================================
  const admin = await prisma.usuarios.create({
    data: {
      nome,
      email,
      senha: senhaHash,
      cpf,
      permissao: "ADMIN",
      ativo: true,
    },
    select: {
      id: true,
      nome: true,
      email: true,
      cpf: true,
      permissao: true,
      ativo: true,
      criado_em: true,
    },
  });

  console.log("✅ Admin criado com sucesso!\n");
  console.log("   Detalhes (senha omitida por segurança):");
  console.log("   ────────────────────────────────────────");
  console.log(`   ID:        ${admin.id}`);
  console.log(`   Nome:      ${admin.nome}`);
  console.log(`   Email:     ${admin.email}`);
  console.log(`   CPF:       ${admin.cpf}`);
  console.log(`   Permissão: ${admin.permissao}`);
  console.log(`   Ativo:     ${admin.ativo}`);
  console.log(`   Criado em: ${admin.criado_em.toISOString()}`);
  console.log("   ────────────────────────────────────────\n");
  console.log("💡 Use esse email/senha para logar no microserviço Auth.");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });