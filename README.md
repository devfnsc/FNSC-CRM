# FNSC-CRM

CRM web para uma empresa independente de marketing e onboarding. O MVP reúne frontend em HTML/CSS/JavaScript puro, API em Node.js/Express e PostgreSQL compatível com Supabase.

## MVP implementado

- Acesso administrativo e perfil da empresa.
- Cadastro, consulta, edição e arquivamento reversível de clientes.
- Catálogo de serviços.
- Propostas, impressão/salvamento como PDF pelo navegador e histórico de status.
- Contratos com revisões, impressão e registro manual de status.
- Lançamentos financeiros manuais e resumo mensal.
- Checklist de onboarding e histórico de interações/follow-ups.

As features F01–F18 estão integradas na branch de MVP. A migração PostgreSQL/Supabase está em validação nesta branch. O CRM não está publicado ainda; veja [docs/supabase-free-deploy.md](docs/supabase-free-deploy.md) para preparar banco e hospedagem sem enviar segredos ao repositório.

## Executar a demonstração local

Com Docker Desktop:

```bash
docker compose up --build
```

Acesse http://127.0.0.1:3000. A demonstração usa PostgreSQL descartável, fica vinculada ao computador local e contém apenas uma conta fictícia. Não use os dados da demonstração como dados reais.

Para configurar PostgreSQL localmente e criar conta administrativa, consulte [docs/development.md](docs/development.md). O banco Supabase deve receber o esquema versionado antes do deploy.

## Qualidade e DevOps

GitHub Actions executa testes unitários, integração contra PostgreSQL, build da demonstração Docker e fluxo de navegador no Chromium. A imagem roda como usuário sem privilégios; sessões ficam em tabela PostgreSQL; o endpoint `GET /api/health` verifica aplicação e banco.

O planejamento Scrum/Kanban, backlog e histórias de usuário estão em [docs/agile-devops-delivery.md](docs/agile-devops-delivery.md).

Este MVP não possui cadastro público, assinatura eletrônica, integração bancária ou função contábil. O status de contrato assinado é registrado manualmente. Não publique credenciais ou dados pessoais/financeiros de clientes.
