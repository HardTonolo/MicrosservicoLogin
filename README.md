# 🔐 ProjetoConcessionariaAuth

Microserviço de **autenticação** do Sistema de Gestão para Concessionária de Veículos.

Extraído do backend principal seguindo a estratégia **Strangler Fig** (substituição gradual sem reescrever o sistema inteiro).

## 🎯 Responsabilidade

- Emitir tokens JWT (login de **administradores** e **clientes**)
- Gerenciar o CRUD de **usuários administradores**
- Validar credenciais de clientes via chamada interna ao backend principal

## 🏗️ Arquitetura

- **Banco de dados próprio** (MySQL isolado, porta 3307)
- **Porta própria** (3002)
- **JWT stateless** — o backend principal valida o token sem consultar o Auth
- Comunicação com o backend principal **apenas** no login de cliente (endpoint interno protegido por API Key)

## 📦 Stack

- Node.js + TypeScript
- Express 5
- Prisma ORM + MySQL 8
- JWT (jsonwebtoken) + Bcrypt
- Opossum (Circuit Breaker)
- Winston (logger)
- Docker + Docker Compose

## 🚀 Como rodar

### Pré-requisitos

- Node.js 18+
- Docker + Docker Compose
- O backend principal rodando (para login de cliente funcionar)

### 1. Instalar dependências

```bash
npm install