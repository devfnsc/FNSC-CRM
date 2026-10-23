# Preparação para hospedagem

O Dockerfile inicia o servidor da aplicação em modo de produção e executa o processo com o usuário sem privilégios da imagem Node. O Docker Compose é separado: ele substitui o comando para aplicar o bootstrap da demonstração local e usa credenciais descartáveis. Não publique a configuração do Compose como produção.

## Configuração exigida no host

O arquivo [`render.yaml`](../render.yaml) prepara uma demonstração temporária no Render: Docker, região Virginia, plano gratuito, endpoint de saúde e deploy automático somente após as verificações de CI. O endpoint `/api/health` verifica a conectividade com MySQL e responde `503` sem expor detalhes se o banco estiver indisponível. Ao conectar o repositório ao Render, informe no painel as variáveis `DB_*` e o certificado CA de `DB_SSL_CA`; o segredo de sessão é gerado pelo Blueprint. O servidor usa `RENDER_EXTERNAL_URL` como origem pública quando `APP_ORIGIN` não é definido.

Para uma base MySQL compatível, o plano gratuito do Aiven pode ser conectado por TLS fornecendo o certificado CA em `DB_SSL_CA`. O `mysql2` valida certificados quando recebe essa CA. A configuração usa MySQL remoto, fora do Render, e o tráfego conta como saída da aplicação.

Defina as variáveis no painel privado do provedor, nunca no repositório:

- `NODE_ENV=production`
- `PORT` conforme a porta indicada pelo provedor (o padrão é 3000)
- `APP_ORIGIN` com a origem pública HTTPS exata, sem caminho, por exemplo `https://crm.exemplo.com`
- `TRUST_PROXY_HOPS=1` se o provedor encerrar HTTPS em um proxy reverso diretamente à frente da aplicação; ajuste à topologia documentada pelo provedor. Se a aplicação receber HTTPS diretamente, deixe a variável vazia.
- `SESSION_SECRET` com pelo menos 32 bytes aleatórios
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` para o MySQL; `DB_SSL_CA` com o certificado CA PEM para verificar a conexão TLS

O cadastro público não existe. Antes do primeiro login, o esquema e as migrações precisam estar aplicados e a conta administrativa precisa ser criada. Use a sequência de migrações de [desenvolvimento local](development.md), mas conectada ao banco do host. Faça e verifique um backup antes de cada mudança de esquema.

Para criar a conta, execute `node scripts/create-admin.js` em um terminal interativo com as variáveis do banco apontadas para o banco remoto. O script pede a senha sem exibi-la. Guarde os segredos em um gerenciador apropriado; não os passe como argumentos de linha de comando.

## Sequência para publicar a demonstração

1. Crie o serviço MySQL no provedor escolhido e guarde host, porta, nome do banco, usuário, senha e CA TLS no gerenciador de senhas.
2. Conecte o repositório ao Render usando o Blueprint `render.yaml`. Faça isso apenas depois de decidir qual branch será publicada; a configuração aguarda as verificações do CI.
3. No painel privado do Render, preencha `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `DB_SSL_CA`. Mantenha `SESSION_SECRET` gerado pelo Blueprint e `TRUST_PROXY_HOPS=1`. Não coloque esses valores em issues, commits ou mensagens.
4. Antes de criar a conta inicial, aplique `src/db/schema.sql` e todas as migrações `002` a `013`, em ordem, ao banco remoto. Use conexão TLS com a CA do provedor e confirme que cada comando terminou sem erro.
5. Com as mesmas variáveis de banco carregadas com segurança em um terminal interativo, execute `node scripts/create-admin.js`. Escolha senha forte e única; o script não aceita execução sem terminal justamente para não expor a senha.
6. Aguarde o deploy, abra `/api/health` e confirme `200` com `{"status":"ok"}`. Faça login e valide o fluxo usando somente dados fictícios.
7. Antes de qualquer uso prolongado, configure exportação/backup fora do serviço e teste uma restauração. Documente data, resultado e responsável.

Se o banco ou deploy não estiver pronto, use a demonstração local de [docs/local-demo.md](local-demo.md). Ela já cobre uma apresentação sem depender de conta de hospedagem.

## O que já está e o que falta

A imagem está apta a iniciar o servidor separado do bootstrap demo, e a CI valida os padrões da imagem, a demonstração Docker e a configuração de proxy para cookies HTTPS. A Blueprint prepara o fluxo, mas ainda não existe serviço Render/Aiven conectado, banco provisionado ou deploy público. O plano gratuito do Render suspende a aplicação após 15 minutos sem tráfego (o primeiro acesso pode levar cerca de um minuto); a documentação da plataforma diz para não usar instâncias gratuitas em produção. O MySQL gratuito do Aiven tem 1 GB de armazenamento e não oferece SLA; serviços sem atividade contínua podem ser desligados. Isso serve para a apresentação acadêmica com dados fictícios, não para guardar dados reais.

Antes de usar dados de clientes ou informações financeiras, configure HTTPS, controle de acesso ao banco, backups com teste de restauração, monitoramento e política de privacidade. Use apenas dados fictícios enquanto esses itens não forem concluídos.


## Limites oficiais dos planos gratuitos

- [Render — limitações de serviços gratuitos](https://render.com/docs/free)
- [Aiven — MySQL Free Tier](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier)
- [Aiven — certificados TLS/SSL](https://aiven.io/docs/platform/concepts/tls-ssl-certificates)
