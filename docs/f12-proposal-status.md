# F12 — Acompanhamento do status de propostas

## Escopo

- Registrar manualmente quando um rascunho foi enviado fora do CRM.
- Registrar aceite ou recusa somente após o status “Enviada”.
- Guardar cada transição, data e usuário autenticado em histórico consultável.
- Permitir apenas as transições Rascunho → Enviada → Aceita/Recusada; transições inválidas retornam conflito.
- O CRM não envia e-mail nem comunica o cliente nesta etapa.

## API

- `PUT /api/proposals/:id/status` — recebe `{ "status": "sent" | "accepted" | "rejected" }`; exige autenticação e validação de origem.
- `GET /api/proposals/:id` — inclui `statusHistory` ordenado cronologicamente.

## Banco

Execute a migração `007_proposal_status_history.sql` após `006_proposals.sql`. O script cria o histórico e insere uma linha de referência para propostas que já existiam, sem atribuir usuário retroativamente.
