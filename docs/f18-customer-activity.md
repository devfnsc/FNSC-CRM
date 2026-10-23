# F18 — Histórico de interações com clientes

- Registra reuniões, ligações, e-mails, mensagens e outros contatos em uma linha do tempo do cliente.
- Cada registro contém resumo e data; pode incluir uma data para o próximo acompanhamento.
- O acompanhamento pode ser marcado como concluído uma única vez. O registro original da interação permanece preservado.
- Clientes arquivados continuam com histórico consultável, mas não aceitam novos registros.
- O histórico é limitado a 300 atividades por cliente nesta versão; não há notificações automáticas.
- Aplicar `013_customer_activities.sql` depois das migrações anteriores e fazer backup antes.
