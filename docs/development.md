# Desenvolvimento local

## Requisitos

- Node.js 20 ou superior
- MySQL 8

## Preparar o ambiente

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env` e preencha a conexão local do MySQL.
3. Gere um segredo de sessão com `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` e coloque o resultado em `SESSION_SECRET`.
4. Crie o banco e um usuário MySQL dedicado, com permissões somente no banco do CRM.
5. Execute o esquema inicial: `mysql -u SEU_USUARIO -p fnsc_crm < src/db/schema.sql`.
6. Execute as migrações ainda não aplicadas, em ordem: `002_company_profile.sql`, `003_customers.sql`, `004_customer_archive.sql`, `005_services.sql`, `006_proposals.sql`, `007_proposal_status_history.sql`, `008_contract_drafts.sql`, `009_contract_revisions.sql`, `010_contract_status_history.sql`, `011_finance_transactions.sql` e `012_onboarding_tasks.sql`.
7. Crie a conta inicial: `node scripts/create-admin.js`.
8. Inicie o servidor com `npm run dev` e abra `http://localhost:3000`.
9. Rode os testes com `npm test`.

O armazenamento de sessões usa a tabela `sessions`, criada pelo driver quando ele inicia. O usuário do banco precisa poder criar essa tabela no banco do CRM. A conta inicial é provisionada pelo script local; não existe cadastro público.

## Segurança e dados

- Nunca envie `.env`, senhas, chaves ou dados reais de clientes ao GitHub.
- Em produção, use HTTPS, defina `NODE_ENV=production`, configure `APP_ORIGIN` com a origem HTTPS correta e injete os segredos pelo painel do provedor.
- Faça cópias de segurança do banco antes de atualizações de esquema.
- Este MVP ainda não deve receber dados financeiros ou pessoais reais até a hospedagem, backups, controle de acesso e política de privacidade serem revisados.
