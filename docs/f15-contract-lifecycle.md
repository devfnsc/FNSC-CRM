# F15 — Ciclo de vida do contrato

- Permite registrar manualmente um rascunho como assinado ou cancelado.
- A transição é confirmada pelo usuário, registrada no histórico com data e responsável e não pode ser desfeita pela interface.
- Contratos assinados ou cancelados ficam bloqueados para edição; a ação não cria uma assinatura eletrônica.
- `010_contract_status_history.sql` cria o histórico e registra o status atual dos contratos existentes. Faça backup antes da migração.
