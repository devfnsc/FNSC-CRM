# F09 — Propostas comerciais em rascunho

## Escopo

- Criar uma proposta vinculada a um cliente ativo.
- Adicionar de 1 a 20 serviços, com quantidade de 1 a 1.000 e valor unitário negociado.
- Salvar validade opcional, observações e os nomes/descrições dos serviços como fotografia no momento da criação.
- Calcular subtotais e total no servidor com aritmética decimal exata.
- Listar as 100 propostas mais recentes.
- Propostas ficam em rascunho; envio ao cliente, edição, status de negociação, contratos e PDF não estão nesta etapa.

## API

- `GET /api/proposals` — lista propostas recentes com cliente, status, prazo e total.
- `POST /api/proposals` — cria uma proposta e seus itens em uma transação; exige autenticação e validação de origem.

## Banco

Execute após `005_services.sql`:

`mysql -u SEU_USUARIO -p fnsc_crm < src/db/migrations/006_proposals.sql`

Os valores registrados são uma proposta comercial e não um lançamento financeiro.
