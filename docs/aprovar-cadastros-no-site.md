# Aprovar primeiro acesso no próprio site

Esta opção permite que Amanda (`assistente2`), Carina e Danilo aprovem uma conta da equipe no painel, inclusive cadastros anteriores presos na confirmação por e-mail. Nenhuma conta é confirmada automaticamente, e os advogados não conseguem aprovar o próprio acesso.

## Ativação única

1. No SQL Editor do projeto Supabase `skujqujylfugqopsudrn`, execute todo o arquivo `migrations/20261112_account_approval.sql`.
2. Aguarde a mensagem `Aprovação de cadastros no painel: versão 1`.
3. Reabra o site no login da Amanda e clique em **Cadastros**.
4. Confira nome, e-mail, foto e demais dados do integrante, marque a conferência e clique em **Aprovar acesso**.
5. O advogado poderá entrar com o e-mail profissional e a senha criada no primeiro acesso.

A função confirma somente os oito e-mails autorizados. Não altera senha, carteira, processos, suspensões ou perfis de acesso. Cada aprovação é registrada em tabela privada com autor e data. Aprovar de novo um cadastro já confirmado não cria outra aprovação.

A configuração de envio de e-mails do Supabase não é modificada: a mensagem automática ainda pode chegar, mas o advogado não precisa usar o link após a aprovação no painel. A confirmação por e-mail existente continua disponível como alternativa.

A migração não foi aplicada automaticamente porque não há credencial administrativa do Supabase configurada neste ambiente. Ela usa a conta autenticada do administrador para as próximas aprovações e não exige colocar uma chave privilegiada no navegador.
