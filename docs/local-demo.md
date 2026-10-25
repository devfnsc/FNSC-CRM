# Demonstração local

A demonstração executa o CRM e um PostgreSQL em containers locais via Docker Compose. O banco não é compartilhado nem público e pode ser descartado; use apenas dados fictícios.

- URL: http://127.0.0.1:3000
- E-mail: demo@fnsc.local
- Senha: local-demo-password-123

Iniciar: `docker compose up --build`

Encerrar os containers: `Ctrl+C`

A demonstração guarda seu volume local entre execuções. Para recriar a demonstração do zero, remova somente o volume `fnsc-crm_fnsc_crm_demo_data` no Docker Desktop. Essa ação apaga os registros fictícios locais.

O deploy remoto não usa esta conta, senha ou banco. Configure segredos independentes no host e banco real; nunca envie credenciais ao GitHub.
