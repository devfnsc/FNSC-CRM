# F03 — Cadastro de clientes

## Escopo

- Registrar nome do contato e, opcionalmente, empresa, e-mail, telefone e observações.
- Exigir pelo menos um meio de contato: e-mail ou telefone.
- Proteger a rota com autenticação e validação de origem; usar parâmetros preparados no SQL.
- Consulta, edição, exclusão e listagem ficam para features posteriores.

## API

- `POST /api/customers` — cria um cliente e retorna HTTP 201 com o registro criado.
- Campos: `name` (obrigatório), `companyName`, `email`, `phone`, `notes`.

Observações devem conter apenas contexto necessário para o atendimento. Não registrar senhas, dados de pagamento ou outros dados sensíveis.

## Banco

Execute a migração após as anteriores:

`mysql -u SEU_USUARIO -p fnsc_crm < src/db/migrations/003_customers.sql`

A tabela guarda dados pessoais de contato, então o MVP não deve receber dados reais antes da revisão de hospedagem, backups e controles de acesso.
