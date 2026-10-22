# F07 — Catálogo de serviços

## Escopo

- Cadastrar serviços oferecidos, com nome obrigatório e descrição opcional.
- Guardar valor de referência opcional; sem valor, a interface exibe “Sob consulta”.
- Listar o catálogo em área autenticada.
- Edição, desativação e uso dos serviços em propostas ficam para features posteriores.

## API

- `GET /api/services` — lista os serviços por nome.
- `POST /api/services` — cadastra um serviço; nome até 120 caracteres, descrição até 2.000 e valor decimal opcional até duas casas.

Todas as rotas exigem sessão autenticada; a criação também valida a origem da requisição.

## Banco

Execute após a migração `004_customer_archive.sql`:

`mysql -u SEU_USUARIO -p fnsc_crm < src/db/migrations/005_services.sql`

Os valores são apenas referências para apoiar cotações. Não representam transação financeira nem preço final de proposta.
