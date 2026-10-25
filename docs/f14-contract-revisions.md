# F14 — Histórico de versões dos contratos

## Objetivo
Preservar cada versão salva do rascunho para consulta, sem sobrescrever o texto anterior.

## Comportamento
- A criação do contrato gera a versão 1 com os dados da proposta.
- Uma edição diferente cria uma versão completa com data e usuário responsável.
- Salvar sem mudanças não cria outra versão.
- O histórico aparece em ordem cronológica e é somente para consulta.
- Contratos permanecem rascunhos; isso não constitui assinatura ou aprovação jurídica.

## Banco e operação
Aplicar `009_contract_revisions.sql` depois de `008_contract_drafts.sql`. A migração registra contratos existentes como versão 1, sem atribuir usuário retroativamente. Fazer backup antes da aplicação.
