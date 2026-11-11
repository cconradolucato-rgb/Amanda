# Situação da automação de publicações

Verificação desta implementação: 10/11/2026, horário de Brasília. Não houve confirmação de novos downloads externos nesta etapa.

| Fonte | O que foi confirmado | O que falta |
|---|---|---|
| AASP | A página oficial de Intimações oferece uma API para entregar publicações ao gerenciador. A Amanda utiliza login e senha no portal para baixar PDFs. | Confirmar a habilitação da API nessa conta, obter documentação, credenciais e cobertura das OABs. O login do portal não foi fornecido e não comprova acesso à API. |
| DJEN / comunicações públicas | Tentativas de consultar documentação e comunicações no domínio oficial `comunicaapi.pje.jus.br` retornaram HTTP 403 neste ambiente. | Acesso permitido ao serviço e validação do contrato, cobertura dos tribunais, filtros, paginação e limites. O 403 não comprova ausência de publicações e não permite afirmar que a coleta esteja funcionando. |
| TJSP e-SAJ / eproc | Há históricos públicos previamente coletados e consultas manuais no site. | Uma fonte atual, autorizada e verificável para consulta periódica. A incorporação de um histórico salvo não é uma nova consulta diária. |
| TRF3 / PJe / TRT2 / TRT15 | Há links de consulta oficial. A cobertura dos históricos já salvos varia por tribunal. | Validar, por sistema, se existe API autorizada ou outra entrega automática. Não há um coletor completo e ativo para todos esses portais. |

Página oficial consultada: https://www.aasp.org.br/produto/intimacoes/ . Ela anuncia “API — Um recurso moderno que entregará as publicações diretamente no gerenciador do seu escritório”. Não foi obtida documentação autenticada da API nem confirmada a licença da conta.

O endpoint `/api/publication-ingest` já recebe lotes normalizados com autenticação própria, identificadores estáveis, preservação dos registros existentes e prevenção de repetição. Ele **não consulta a AASP nem os tribunais sozinho**. Precisa de uma fonte real conectada e de acesso de servidor ao banco. Um agendador de avisos por e-mail também não é um coletor de publicações.

Para solicitar a integração à AASP, confirmar: acesso à API para gerenciador próprio; forma de emissão das credenciais; documentação; OABs monitoradas; tribunais cobertos; consulta retroativa, especialmente 06 e 09/11/2026; paginação e limites; recuperação de indisponibilidades. Não compartilhar senhas ou tokens no chat.

Enquanto a fonte automática não estiver configurada e testada, os PDFs dos dias sem importação precisam ser incluídos manualmente. Dia vazio no calendário não confirma ausência de publicações. Publicações recebidas também não equivalem a prazo fatal calculado e conferido.
