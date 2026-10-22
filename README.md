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

As funcionalidades F01–F18 estão agrupadas na branch de integração. Os testes automatizados mais recentes passaram no GitHub Actions. Isso valida a suíte automatizada; não significa que o sistema já esteja publicado ou conectado a um banco de produção.

## Rodar localmente

Requisitos: Node.js 20+ e MySQL 8.

Siga o passo a passo em [docs/development.md](docs/development.md) para configurar o banco, aplicar as migrações, criar o usuário administrador e iniciar o servidor em `http://localhost:3000`.

Comandos principais:

```bash
npm install
npm run dev
npm test
```

## CI, publicação e segurança

O GitHub Actions instala as dependências e executa os testes em pushes para `main` e branches `feature/**`. Ainda não há deploy automático nem endereço público do CRM: a configuração de hospedagem, banco remoto, segredos, HTTPS e backups precisa ser feita antes de usar dados reais.

Não existe cadastro público. O status “assinado” de um contrato é um registro manual, não uma assinatura digital. A impressão de propostas/contratos usa a função de impressão do navegador. Este MVP não substitui um sistema contábil ou orientação jurídica.

Nunca publique arquivos `.env`, credenciais ou dados pessoais/financeiros de clientes.
