# F11 — Edição de propostas em rascunho

## Escopo

- Reabrir uma proposta salva para ajustar cliente, título, validade, observações, serviços, quantidades e valores negociados.
- Recalcular os subtotais e o total no servidor com centavos inteiros.
- Substituir os itens dentro da mesma transação do cabeçalho para não deixar uma edição parcial.
- Permitir edição apenas enquanto o status estiver como rascunho; propostas inexistentes retornam 404 e propostas em outro status retornam 409.
- Revalidar cliente ativo e serviços e preservar os nomes/descrições dos serviços no momento da atualização.

## API

- `PUT /api/proposals/:id` — atualiza uma proposta em rascunho; exige autenticação e validação de origem.

## Interface

Na lista de propostas, abra “Detalhes” e escolha “Editar rascunho”. Ao salvar, a tela atualiza a lista e preserva os dados atualizados. Não envia a proposta ao cliente nem cria contrato.
