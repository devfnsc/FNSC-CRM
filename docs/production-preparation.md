# Preparação de publicação temporária

O CRM agora está preparado para PostgreSQL/Supabase e o serviço web temporário do Render. Esta configuração ainda exige que o proprietário crie/autorize os recursos gratuitos e cadastre os segredos diretamente nos painéis. Nenhuma credencial deve entrar no GitHub.

## Variáveis do serviço

- `DATABASE_URL`: URI PostgreSQL de **Session pooler** do Supabase, com TLS. Não use chave anon nem `service_role`.
- `SESSION_SECRET`: segredo aleatório de pelo menos 32 bytes, guardado apenas no painel do Render.
- `DB_POOL_MAX`: 3 para esta instância gratuita.
- `NODE_ENV=production` e `TRUST_PROXY_HOPS=1`.

O `render.yaml` declara um Web Service Docker gratuito com health check em `/api/health` e deploy após os checks. A URL pública e HTTPS são fornecidos pelo Render. O host gratuito pode suspender a aplicação quando ociosa; o primeiro acesso pode levar mais tempo.

## Banco

Aplique o esquema `src/db/schema.sql` em um projeto PostgreSQL vazio antes do primeiro deploy. Pode usar o SQL Editor do Supabase ou executar `npm run migrate` localmente com `DATABASE_URL` definida apenas no ambiente local. A migração cria as tabelas funcionais, índices e tabela de sessões. O login administrativo é criado separadamente por `node scripts/create-admin.js`.

Esta configuração não transfere dados de um MySQL existente. O CRM ainda não tem dados de produção conhecidos; se isso mudar, planeje exportação, conversão, validação e rollback antes de migrar.

## Verificação de entrega

1. A CI #291 passou no commit `4aad379`: testes automatizados, PostgreSQL 16, demonstração Docker e jornada Chromium aprovados.
2. Crie projeto Supabase no plano Free e aplique o esquema em banco vazio.
3. Crie o Web Service Render a partir da branch revisada, sem publicar a branch até a CI passar.
4. Cadastre URL de conexão e segredo de sessão nos campos secretos do host.
5. Confirme `/api/health` respondendo `200`, login e CRUD de cliente com dados fictícios.
6. Registre o endereço público, resultado da CI e evidência de execução para a apresentação.

## Limites para uso real

O Supabase Free tem cotas, pode pausar projetos inativos e não oferece backups automáticos. O Render Free também pode suspender serviços ociosos. Isso atende uma demonstração acadêmica com dados fictícios; antes de dados reais, configure cópias de segurança independentes e teste a restauração, revise permissões e privacidade, e escolha um plano que atenda à disponibilidade necessária.

Referências oficiais: [limites e planos do Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase), [pausa de projetos gratuitos](https://supabase.com/docs/guides/platform/free-project-pausing), [conexão ao PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres) e [limites do Render Free](https://render.com/docs/free).
