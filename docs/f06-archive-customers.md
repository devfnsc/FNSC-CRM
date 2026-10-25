# F06 — Arquivamento reversível de clientes

## Escopo

- Arquivar clientes sem apagar seus dados e permitir restaurá-los posteriormente.
- A lista padrão mostra somente clientes ativos; também é possível filtrar arquivados ou todos.
- Clientes arquivados permanecem consultáveis e podem ser restaurados.
- As ações exigem autenticação e validação de origem.

## API

- `GET /api/customers?status=active|archived|all` — padrão `active`.
- `PATCH /api/customers/:id/archive` — marca a data de arquivamento.
- `PATCH /api/customers/:id/restore` — remove a marca de arquivamento.

## Banco

Execute após `003_customers.sql`:

`mysql -u SEU_USUARIO -p fnsc_crm < src/db/migrations/004_customer_archive.sql`

O arquivamento é reversível; exclusão definitiva não faz parte desta feature.
