# F08 — Edição do catálogo de serviços

## Escopo

- Editar nome, descrição e valor de referência de um serviço cadastrado.
- Reutilizar as validações do cadastro.
- Proteger a atualização com sessão autenticada e validação de origem.
- Permitir cancelamento da edição pela interface.

## API

- `PUT /api/services/:id` — atualiza o serviço e retorna os dados salvos.
- Responde 400 para ID/dados inválidos e 404 quando o serviço não existe.

A edição pode ser iniciada pela ação “Editar” na linha do serviço.
