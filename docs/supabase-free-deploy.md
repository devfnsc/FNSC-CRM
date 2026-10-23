# Preparar Supabase e Render em planos gratuitos

Esta configuração é para demonstração acadêmica. Plano gratuito não significa disponibilidade contínua nem backup gerenciado.

## 1. Banco PostgreSQL no Supabase

1. Crie um projeto no plano Free, escolhendo uma região próxima da hospedagem.
2. No painel, obtenha a URI de conexão em **Connect → Session pooler**. Em hospedagens IPv4, prefira o pooler; conexões diretas do plano Free podem exigir IPv6.
3. Use TLS. O aplicativo valida o certificado do servidor. Não coloque a senha aqui, no GitHub, em Trello ou em mensagens.
4. Aplique o esquema em `src/db/schema.sql` pelo SQL Editor do Supabase, ou execute `npm run migrate` localmente com `DATABASE_URL` configurada de forma privada.
5. Crie uma credencial própria para o CRM com permissões mínimas em vez de usar uma credencial administrativa do projeto. Guarde sua senha fora do repositório.
6. Confirme que a tabela `user_sessions` e as tabelas do CRM existem antes de publicar.

## 2. Aplicação no Render

1. Crie um Web Service a partir da branch aprovada; use o plano Free.
2. O arquivo `render.yaml` prepara Docker, health check e variáveis necessárias. Não conecte a branch até a PR ser revisada e os checks passarem.
3. Configure `DATABASE_URL` no painel do Render com a URI do Session pooler, nunca com uma chave `service_role` ou anon key.
4. Gere `SESSION_SECRET` aleatório com ao menos 32 bytes no painel do host.
5. Mantenha `DB_POOL_MAX=3) ou menor para respeitar a capacidade compartilhada do banco.
6. Confirme `NODE_ENV=production`, proxy confiável e HTTPS. O Render fornece a origem pública usada pelo health check.
7. Faça deploy e verifique `/api/health), login e criação/consulta de cliente sem usar dados reais.

## Limites e cuidados

- Supabase Free tem cotas e pode pausar projeto após período de inatividade; não oferece backups automáticos.
- Serviços gratuitos de aplicação podem suspender o processo quando ocioso; o primeiro acesso pode demorar para acordar.
- Antes de uso real, configure backups independentes, credencial de banco restrita, política de privacidade e domínio próprio se necessário.
- Não há migração automática de dados MySQL nesta entrega. A configuração pressupõe banco PostgreSQL novo e vazio.
- Nunca inclua URL de conexão, senha, sessão, dados de cliente ou financeiros em commits, capturas públicas ou logs.
