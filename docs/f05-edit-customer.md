# F05 — Edição de cadastro de cliente

## Escopo

- Permitir que a pessoa administradora atualize nome, empresa, e-mail, telefone e observações.
- Reutilizar as regras de validação do cadastro e exigir e-mail ou telefone.
- Proteger a atualização com sessão autenticada e validação de origem.
- Retornar 404 para clientes inexistentes; não remover registros nesta feature.

## API

- `PUT /api/customers/:id` — atualiza os campos do cliente e retorna o cadastro completo.
- Responde 400 para ID/campos inválidos e 404 quando o ID não existe.

Na interface, a edição começa pelo painel de detalhes do cliente. É possível cancelar e voltar ao formulário de cadastro.
