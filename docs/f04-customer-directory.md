# F04 — Listagem e consulta de clientes

## Escopo

- Listar clientes cadastrados em ordem do mais recente para o mais antigo.
- Buscar por nome, empresa, e-mail ou telefone.
- Paginar os resultados (20 por padrão; máximo de 100 por página).
- Abrir os detalhes de um cliente, incluindo observações e datas de criação/atualização.
- Todas as rotas exigem autenticação; os dados da carteira não são públicos.

## API

- `GET /api/customers?page=1&limit=20&q=texto` — retorna `customers`, `page`, `limit` e `hasMore`.
- `GET /api/customers/:id` — consulta um cliente por ID; responde 404 quando não existe.

A listagem não inclui as observações para manter a tabela compacta. A consulta individual retorna os campos completos.

## Limites desta entrega

A F04 não inclui edição, exclusão, exportação nem filtros avançados; essas ações podem ser priorizadas depois da validação do fluxo básico.
