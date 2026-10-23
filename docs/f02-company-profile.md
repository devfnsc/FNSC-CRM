# F02 — Perfil da empresa

## Escopo

- Exibir e atualizar um único perfil da empresa, disponível somente após autenticação.
- Guardar nome empresarial, nome fantasia, e-mail, telefone, site e fuso horário.
- Validar os campos antes de gravar; o site aceita somente endereços HTTP ou HTTPS.
- Não inclui CNPJ, endereço, contratos, proposta ou dados de clientes nesta etapa.

## API

- `GET /api/company` — retorna `{ "profile": null }` se ainda não houver perfil.
- `PUT /api/company` — cria ou atualiza o perfil; exige sessão autenticada e origem configurada.

Exemplo do corpo aceito:

```json
{
  "businessName": "FNSC Marketing",
  "tradeName": "FNSC",
  "contactEmail": "contato@example.com",
  "phone": "+55 11 99999-0000",
  "website": "https://example.com",
  "timezone": "America/Sao_Paulo"
}
```

## Banco

Execute a migração após aplicar o esquema inicial:

`mysql -u SEU_USUARIO -p fnsc_crm < src/db/migrations/002_company_profile.sql`

O perfil é singleton, para o modelo inicial de uma pessoa administradora. Dados reais da empresa devem ser adicionados apenas depois que a implantação e as medidas de proteção de dados estiverem revisadas.
