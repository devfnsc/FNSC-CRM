# Preparação para hospedagem

O Dockerfile inicia o servidor da aplicação em modo de produção e executa o processo com o usuário sem privilégios da imagem Node. O Docker Compose é separado: ele substitui o comando para aplicar o bootstrap da demonstração local e usa credenciais descartáveis. Não publique a configuração do Compose como produção.

## Configuração exigida no host

Defina as variáveis no painel privado do provedor, nunca no repositório:

- `NODE_ENV=production`
- `PORT` conforme a porta indicada pelo provedor (o padrão é 3000)
- `APP_ORIGIN` com a origem pública HTTPS exata, sem caminho, por exemplo `https://crm.exemplo.com`
- `TRUST_PROXY_HOPS=1` se o provedor encerrar HTTPS em um proxy reverso diretamente à frente da aplicação; ajuste à topologia documentada pelo provedor. Se a aplicação receber HTTPS diretamente, deixe a variável vazia.
- `SESSION_SECRET` com pelo menos 32 bytes aleatórios
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` para um MySQL 8 acessível somente pela aplicação

O cadastro público não existe. Antes do primeiro login, o esquema e as migrações precisam estar aplicados e a conta administrativa precisa ser criada. Use a sequência de migrações de [desenvolvimento local](development.md), mas conectada ao banco do host. Faça e verifique um backup antes de cada mudança de esquema.

Para criar a conta, execute `node scripts/create-admin.js` em um terminal interativo com as variáveis do banco apontadas para o banco remoto. O script pede a senha sem exibi-la. Guarde os segredos em um gerenciador apropriado; não os passe como argumentos de linha de comando.

## O que já está e o que falta

A imagem está apta a iniciar o servidor separado do bootstrap demo, e a CI valida os padrões da imagem, a demonstração Docker e a configuração de proxy para cookies HTTPS. Ainda não há provedor escolhido, banco persistente remoto, pipeline de deploy, domínio, backups automatizados ou revisão de privacidade. Portanto, isso é preparação técnica, não publicação nem autorização para inserir dados reais.

Antes de usar dados de clientes ou informações financeiras, configure HTTPS, controle de acesso ao banco, backups com teste de restauração, monitoramento e política de privacidade. Use apenas dados fictícios enquanto esses itens não forem concluídos.
