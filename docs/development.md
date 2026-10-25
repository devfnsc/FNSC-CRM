# Desenvolvimento local

## Requisitos

- Node.js 20 ou superior
- Docker Desktop (recomendado) ou PostgreSQL 16

## Demonstração isolada

1. Inicie Docker Desktop.
2. Execute `docker compose up --build`.
3. Acesse http://127.0.0.1:3000.
4. Entre com os dados fictícios descritos em [local-demo.md](local-demo.md).

A demonstração cria seu banco PostgreSQL local e descartável. Não coloque dados reais nela.

## Configurar desenvolvimento manual

1. Instale dependências: `npm install`.
2. Copie `.env.example` para `.env` e informe uma URL PostgreSQL local.
3. Gere um segredo de sessão aleatório com pelo menos 32 bytes.
4. Aplique o esquema: `npm run migrate`.
5. Crie a conta inicial: `node scripts/create-admin.js`.
6. Inicie o servidor: `npm run dev`.
7. Teste: `npm test`.

O comando `npm run migrate` aplica `src/db/schema.sql` ao banco indicado em `DATABASE_URL`. No Supabase, use a URL do pooler em modo Session para hospedagens IPv4-only e mantenha TLS ativo. Nunca cole a URL com senha em issues, PRs, mensagens ou arquivos versionados.

## Segurança

- `.env` é ignorado pelo Git. Não compartilhe senhas ou dados reais.
- Em produção, use `NODE_ENV=production`, HTTPS, origem correta e conexão TLS verificada.
- Crie uma credencial de banco dedicada com permissões mínimas para a aplicação.
- O plano gratuito do Supabase pode pausar projetos inativos e não oferece backups automáticos; mantenha cópias independentes antes de dados reais.
