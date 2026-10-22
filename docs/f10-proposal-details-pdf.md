# F10 — Consulta e impressão de propostas

## Escopo

- Consultar os dados completos de uma proposta salva, incluindo cliente, observações e fotografia dos serviços/valores.
- Abrir uma versão de impressão com identificação do rascunho, validade, itens, subtotais e total.
- Usar a opção de impressão do navegador para imprimir ou salvar como PDF.
- Exigir sessão autenticada para detalhes e documento; respostas não ficam em cache.
- Não envia a proposta, não altera status e não constitui documento contratual.

## API

- `GET /api/proposals/:id` — retorna detalhes e itens de uma proposta.
- `GET /api/proposals/:id/print` — apresenta documento HTML pronto para impressão e geração de PDF pelo navegador.

## Revisão

Abra “PDF / imprimir” na lista de propostas e, na nova aba, escolha “Imprimir / salvar como PDF”. A aparência final depende do navegador e das opções de impressão escolhidas.
