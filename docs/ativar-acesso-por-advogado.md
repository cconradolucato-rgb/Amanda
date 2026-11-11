# Ativação das permissões por advogado

A versão do site deve conter `web/office-access.js` e as proteções dos endpoints antes da execução desta migração. As contas individuais recusam dados não filtrados até a ativação no banco; os administradores continuam acessando a carteira.

1. Entre no projeto **Dibbern Advogados** do Supabase, referência `skujqujylfugqopsudrn`.
2. Abra **SQL Editor → New query**.
3. Copie **todo** o arquivo `migrations/20261111_office_access.sql` e execute em uma única operação com **Run**.
4. O resultado esperado contém `Permissões por conta: versão 1` e o número de documentos preservados. Em caso de erro, a transação é revertida; envie apenas o texto do erro, sem senhas ou dados de clientes.
5. Reabra o site nas contas de teste. `assistente2`, `carina` e `danilo` devem ver todas as carteiras. As contas `assistente1`, `assistente3`, `assistente9`, `assistente10` e `assistente6` devem ver somente a própria carteira, publicações, processos e vencimentos.

O arquivo preserva os dados existentes, cria a cópia privada `office_private.dashboard_backup_20261111` e mantém o documento original em `office_private.dashboards`. O endereço público `dashboards` passa a ser uma visão filtrada pelo e-mail autenticado; alterações normais são aplicadas somente aos registros autorizados, com controle de revisão. Não há exclusão de processos nesta migração.

O teste local executou o SQL em PostgreSQL (PGlite), incluindo oito contas, leitura e escrita, tentativa de alterar outra carteira, tentativa de elevar o acesso, preservação dos colegas, notas e conclusão, CAS e reexecução da migração. Também testou o navegador com as cinco contas individuais e um administrador. Isso não substitui a verificação na instância real após aplicar o SQL.

A autorização no chat não fornece uma conexão ao Supabase. Para aplicação pelo assistente, é necessário configurar acesso administrativo seguro à API de gerenciamento do Supabase no ambiente. Não envie tokens no chat nem inclua chaves no SQL ou no código do navegador.

Depois de aplicado, o RPC público `office_access_version` retorna `1`. Ele informa somente a versão da proteção, sem processos, dados pessoais ou credenciais.

Para repetir os testes de banco: `npm install --prefix tests` e `npm test --prefix tests`. Os testes usam apenas dados fictícios em um PostgreSQL local, sem acessar a produção.
