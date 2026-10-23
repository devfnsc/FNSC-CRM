# Executar a demonstração local

A demonstração usa Docker Compose para iniciar o CRM e um MySQL 8 local, aplicar as migrações e criar uma conta de demonstração. Ela não publica nada na internet nem usa dados reais.

## Requisitos

- Docker Desktop instalado e em execução (inclui Docker Compose).
- Porta local 3000 disponível.

## Iniciar

Na pasta do repositório, execute:

```sh
docker compose up --build
```

Quando aparecer `FNSC-CRM listening on port 3000`, abra [http://127.0.0.1:3000](http://127.0.0.1:3000) e entre com:

- E-mail: `demo@fnsc.local`
- Senha: `local-demo-password-123`

A conta e as credenciais são apenas para essa demonstração local. Não as reutilize fora do Docker Compose nem cadastre dados reais. O banco fica no volume local `fnsc_crm_demo_data`; parar os containers não apaga esse volume.

Para parar, use `Ctrl+C`. Para iniciar novamente em outro momento, execute `docker compose up`.

Se a porta 3000 estiver ocupada, altere apenas o lado esquerdo do mapeamento em `docker-compose.yml` (por exemplo, `127.0.0.1:3001:3000`) e abra a nova porta no navegador.

## Verificação automatizada

O GitHub Actions também sobe a mesma composição local e verifica login, dashboard protegido, cadastro, busca, arquivamento/restauração de cliente e logout. Esses dados ficam restritos ao banco efêmero do job.
