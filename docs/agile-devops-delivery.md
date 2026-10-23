# Processo ágil e práticas DevOps — FNSC-CRM

## Produto e objetivo

O FNSC-CRM é um sistema web para uma empresa independente de marketing e onboarding, inicialmente operada por uma única pessoa. O MVP concentra cadastro e acompanhamento de clientes, serviços, propostas, contratos, onboarding e lançamentos financeiros informativos.

Como blueprint de produto existente, usamos o HubSpot CRM como referência conceitual para organização de contatos e pipeline comercial. A página oficial do produto destaca gestão de contatos, pipeline de negócios e dashboard de relatórios. O FNSC-CRM reduz esse escopo para a rotina da empresa e acrescenta propostas, contratos e onboarding; não replica a plataforma nem integra com ela: [HubSpot CRM — produto oficial](https://www.hubspot.com/products/crm).

## Processo de trabalho

O projeto aplica Scrum de forma enxuta e compatível com uma equipe de uma pessoa, apoiado por um quadro Kanban no Trello.

- Product Owner: Gustavo, responsável por definir necessidades, prioridade e aceitar cada entrega.
- Desenvolvimento: Gustavo implementa e valida o produto; o assistente é apoio de programação e documentação, não substitui as decisões nem a validação do PO.
- Planejamento: selecionar itens de maior prioridade e dependências para um incremento pequeno.
- Acompanhamento: mover cada cartão no quadro conforme o estado real; registrar bloqueios e critérios de aceite.
- Revisão: demonstrar o incremento e obter aceite do PO antes de tratá-lo como concluído.
- Retrospectiva: registrar o que funcionou, falhas e uma melhoria para o próximo ciclo.

Fluxo recomendado do cartão: Product Backlog → A Fazer → Em andamento → Revisão/Testes → Concluído. Um cartão só chega a Concluído quando os critérios de aceite passam, o fluxo automatizado relevante passa e a documentação aplicável está atualizada.

## Product backlog priorizado

A ordem abaixo segue dependências do sistema: primeiro acesso e dados-base, depois operação comercial e, por fim, continuidade do atendimento e visão financeira. F01–F18 são os itens funcionais implementados no MVP.

| Ordem | Feature | Prioridade | Resultado esperado |
|---:|---|---|---|
| 1 | F01 — Acesso administrativo | P0 | Proteger o CRM com autenticação e sessão |
| 2 | F02 — Perfil da empresa | P1 | Configurar os dados básicos da empresa |
| 3 | F03 — Cadastro de clientes | P1 | Registrar contatos com meios de contato |
| 4 | F04 — Listagem e consulta de clientes | P1 | Localizar e consultar clientes |
| 5 | F05 — Edição de cadastro de cliente | P1 | Corrigir dados do cliente |
| 6 | F06 — Arquivamento reversível de clientes | P1 | Retirar clientes da operação sem apagar o histórico |
| 7 | F07 — Catálogo de serviços | P1 | Manter os serviços oferecidos |
| 8 | F08 — Edição do catálogo de serviços | P1 | Atualizar nome, descrição e valor de referência |
| 9 | F09 — Propostas comerciais em rascunho | P1 | Montar proposta para cliente com itens e valores |
| 10 | F10 — Consulta e impressão de propostas | P1 | Consultar e imprimir/salvar a proposta em PDF pelo navegador |
| 11 | F11 — Edição de propostas em rascunho | P1 | Ajustar proposta antes de avançar seu status |
| 12 | F12 — Acompanhamento do status de propostas | P1 | Registrar manualmente envio, aceite ou recusa |
| 13 | F13 — Contratos em rascunho | P2 | Criar contrato a partir de proposta aceita |
| 14 | F14 — Histórico de versões dos contratos | P2 | Preservar revisões do texto contratual |
| 15 | F15 — Ciclo de vida do contrato | P2 | Registrar manualmente assinatura ou cancelamento |
| 16 | F16 — Entradas, saídas e saldo mensal | P2 | Consultar lançamentos informativos por mês |
| 17 | F17 — Checklist de onboarding | P2 | Acompanhar tarefas após contrato assinado |
| 18 | F18 — Histórico de interações com clientes | P2 | Registrar contatos e próximos acompanhamentos |

P0/P1/P2 expressam prioridade relativa do MVP, não estimativa de esforço. Cada feature possui especificação técnica individual em `docs/f02-...` até `docs/f18-...`; o acesso administrativo está descrito em autenticação e nos testes do projeto.

## Três histórias de usuário e critérios de aceite

### F03 — Cadastrar cliente

Como pessoa administradora do CRM, quero cadastrar um cliente com nome e pelo menos um meio de contato, para centralizar as informações necessárias ao atendimento.

Critérios de aceite:

1. O cadastro exige nome e e-mail ou telefone.
2. Dados inválidos são rejeitados com mensagem compreensível e não criam registro.
3. Após salvar, o cliente aparece na listagem sem recarregar a aplicação.
4. A rota exige autenticação e só aceita requisição da origem configurada.

### F09 — Criar proposta

Como pessoa administradora, quero montar uma proposta para um cliente ativo selecionando serviços e valores negociados, para registrar o que será oferecido após uma reunião.

Critérios de aceite:

1. A proposta exige cliente ativo e ao menos um item válido.
2. O servidor calcula subtotais e total; o navegador não é fonte confiável dos valores.
3. Nome, descrição e valores dos itens ficam registrados como fotografia da proposta, mesmo que o catálogo mude depois.
4. A proposta recém-criada pode ser consultada e impressa/salva em PDF pelo navegador.

### F16 — Consultar entradas e saídas

Como pessoa administradora, quero registrar entradas e despesas e filtrar por mês, para ter uma visão simples do movimento financeiro do negócio.

Critérios de aceite:

1. Cada lançamento informa tipo, descrição, valor positivo e data válida.
2. A consulta mensal exibe totais de entradas, saídas e saldo líquido.
3. A tela deixa claro que são registros manuais informativos, sem integração bancária nem finalidade contábil.
4. As rotas exigem autenticação e validação de origem.

## Arquitetura e DevOps implementados

- Frontend: HTML, CSS e JavaScript sem framework.
- Backend: Node.js 20 e Express 5, API REST.
- Persistência: PostgreSQL compatível com Supabase; esquema SQL idempotente versionado em `src/db/schema.sql`.
- Versionamento: Git e GitHub; alterações do MVP agrupadas na PR [#19](https://github.com/devfnsc/FNSC-CRM/pull/19).
- CI: GitHub Actions executa testes automatizados, integração contra PostgreSQL 16, build da imagem Docker, smoke test local e jornada ponta a ponta no Chromium.
- Segurança básica: cabeçalhos Helmet, sessão HttpOnly/SameSite, limite de tentativas de login, validação de origem, segredos fora do repositório e container com usuário sem privilégios. A quantidade e o resultado dos testes devem ser conferidos na execução de CI vinculada ao commit entregue.
- Infraestrutura local: Docker Compose provisiona a demonstração e um banco descartável; não é o banco de produção.
- Monitoramento disponível: logs básicos do processo e endpoint `GET /api/health`. Esse endpoint confirma resposta da aplicação e conexão PostgreSQL, mas não substitui monitoramento de disponibilidade de produção.

## Situação do CD e limites

A imagem inicia o servidor normalmente, separada do bootstrap da demonstração. O Blueprint prepara Render Free e a conexão PostgreSQL/Supabase, mas deploy público depende de criar/configurar os recursos, guardar segredos no painel e validar health check e login. A migração PostgreSQL está em validação; até CI aprovada e deploy testado, a evidência não comprova publicação.

O ambiente demonstrativo usa credenciais e dados descartáveis. Não registrar dados reais de clientes nem informações financeiras até configurar hospedagem, HTTPS, backups com teste de restauração, acesso ao banco e política de privacidade. Contratos e assinatura permanecem operações manuais; o CRM não substitui aconselhamento jurídico ou contábil.

## Evidência automatizada

A versão MySQL anterior tinha CI e jornada de demonstração aprovadas. A branch de migração precisa gerar uma nova execução PostgreSQL antes de afirmar que a persistência PostgreSQL está validada. Consulte o [GitHub Actions](https://github.com/devfnsc/FNSC-CRM/actions) e registre o resultado correspondente ao commit entregue.
