'use strict';
function report(data,env=process.env){
 const present=name=>typeof env[name]==='string'&&!!env[name].trim();
 const schedulerSettings=present('CRON_SECRET')&&present('SUPABASE_SERVICE_ROLE_KEY');
 const microsoftSettings=['OUTLOOK_CLIENT_ID','OUTLOOK_CLIENT_SECRET','OUTLOOK_TOKEN_ENCRYPTION_KEY'].every(present);
 const provider=env.PUBLICATIONS_EMAIL_PROVIDER==='resend'?'resend':'outlook';
 const senderSettings=provider==='resend'?present('RESEND_API_KEY')&&require('./publication-mail').validEmail(env.PUBLICATIONS_FROM_EMAIL):microsoftSettings&&data.outlookConnection?.email===require('./outlook-mail').sender&&!!data.outlookConnection?.encryptedCredentials;
 const portfolios=data.portfolios||[],oabs=new Set(portfolios.filter(p=>/^\d+[A-Z]?$/i.test(String(p.oab||'').trim())&&/^[A-Z]{2}$/i.test(p.uf||'')).map(p=>String(p.oab).trim().toUpperCase()+'/'+p.uf.toUpperCase()));
 const lastReceipt=(data.publicationIngestRuns||[]).at(-1),lastRun=(data.automationRuns||[]).at(-1),ingestSettings=present('PUBLICATIONS_INGEST_SECRET')&&present('SUPABASE_SERVICE_ROLE_KEY');
 const checks=[
  {id:'collection',label:'Busca automática de publicações',state:'blocked',detail:'A busca direta nos tribunais não está ativa. O recebimento automático já está preparado, mas falta conectar uma fonte real. AASP exige cadastro e autorização; DJEN exige validar e implementar seu adaptador.'},
  {id:'ingest',label:'Recebimento automático de publicações',state:ingestSettings?'unverified':'blocked',at:lastReceipt?.at||null,detail:ingestSettings?'Canal protegido configurado. O integrador precisa enviar os lotes no formato documentado; cadastro ou token sozinho não iniciam consultas na AASP ou nos tribunais.':'Canal protegido preparado. Falta liberar o acesso de servidor ao banco e conectar a fonte de publicações.'},
  {id:'worker',label:'Último processamento automático de avisos',state:lastRun?'info':'pending',at:lastRun?.finishedAt||lastRun?.startedAt||null,detail:lastRun?`Estado da execução: ${lastRun.state}. É processamento dos avisos já recebidos, não uma coleta de tribunais.`:'Nenhuma execução registrada. O processamento depende da liberação do banco e do remetente.'},
  {id:'scheduler',label:'Execução com o site fechado',state:schedulerSettings?'unverified':'blocked',detail:schedulerSettings?'Configuração de execução encontrada. Isso não comprova execução: falta comprovar a execução do processamento automático de avisos.':'Pendente de configurar o acesso seguro do agendador ao banco. A proteção do agendador já está preparada; o processamento de avisos de prazo e publicações recebidas aguarda essa liberação.'},
  {id:'email',label:'Envio automático de avisos por e-mail',state:senderSettings?'unverified':'blocked',detail:senderSettings?'Configuração de remetente encontrada. Aceite, entrega e eventuais falhas devem ser conferidos no histórico de envio.':'Remetente não habilitado para os envios automáticos. É necessário concluir a configuração e a autorização do Outlook ou habilitar um provedor de e-mail.'},
  {id:'registrations',label:'Cadastros para monitoramento',state:oabs.size?'pending':'blocked',detail:`${oabs.size} inscrição(ões) OAB/UF identificada(s) em ${portfolios.length} carteira(s). A lista precisa ser conferida antes de habilitar o monitoramento externo; cadastro não significa monitoramento ativo.`},
  {id:'history',label:'Última consulta dos tribunais incorporada',state:'info',at:data.courtResearch?.consultedAt||null,detail:'Dados já coletados e incorporados ao painel. Esta data não comprova consulta diária nem cobertura completa dos tribunais.'}
 ];
 return {checkedAt:new Date().toISOString(),automaticCollectionActive:false,checks,scope:'Diagnóstico das configurações deste painel. Não executa consultas externas nem confirma disponibilidade dos tribunais.'};
}
module.exports={report};
