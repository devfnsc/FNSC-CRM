# FNSC-CRM

CRM web para uma empresa independente de marketing e onboarding. O MVP reúne frontend em HTML/CSS/JavaScript puro, API em Node.js/Express e banco MySQL.

## O que já está implementado

- Acesso administrativo e perfil da empresa.
- Cadastro, consulta, edição e arquivamento reversível de clientes.
- Catálogo de serviços com edição.
- Propostas em rascunho, edição, histórico de status e versão imprimível para salvar em PDF pelo navegador.
- Contratos gerados a partir de propostas aceitas, com revisões, impressão e registro manual de status.
- Lançamentos de entradas e saídas com consulta mensal.
- Checklist de onboarding vinculado a contratos e histórico de interações/follow-ups por cliente.

As funcionalidades F01–F18 estão agrupadas na branch de integração. O CI valida 29 testes automatizados, migrações e fluxos de API contra MySQL 8, a demonstração Docker e uma jornada ponta a ponta no Chromium (login, clientes, interações, serviços, proposta, contrato, onboarding, financeiro e logout). O último resultado aprovado está no [GitHub Actions](https://github.com/devfnsc/FNSC-CRM/actions/runs/39964643304). A imagem da demonstração também executa o processo com usuário sem privilégios administrativos. Isso valida o MVP local; não significa que esteja publicado ou conectado a um banco de produção.

## Ver a demonstração local

Com Docker Desktop aberto, execute `docker compose up --build` e acesse [http://127.0.0.1:3000](http://127.0.0.1:3000). A configuração cria um banco MySQL isolado e uma conta descartável, sem dados reais. Veja credenciais, limites e detalhes em [docs/local-demo.md](docs/local-demo.md).

Para desenvolvimento manual com Node.js e MySQL instalados, siga [docs/development.md](docs/development.md).

Comandos de desenvolvimento e testes:

```bash
npm install
npm run dev
npm test
```

## CI, publicação e segurança

O GitHub Actions instala as dependências e executa os testes em pushes para `main` e branches `feature/**`. Ainda não há deploy automático nem endereço público do CRM: a configuração de hospedagem, banco remoto, segredos, HTTPS e backups precisa ser feita antes de usar dados reais.

Não existe cadastro público. O status “assinado” de um contrato é um registro manual, não uma assinatura digital. A impressão de propostas/contratos usa a função de impressão do navegador. Este MVP não substitui um sistema contábil ou orientação jurídica.

Nunca publique arquivos `.env`, credenciais ou dados pessoais/financeiros de clientes.
