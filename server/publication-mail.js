'use strict';
const outlook=require('./outlook-mail');
const crypto=require('node:crypto');const {forLawyer,prepare}=require('../web/daily-publications-core');
const validEmail=value=>typeof value==='string'&&value.length<255&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
function configured(data={}){if(process.env.PUBLICATIONS_EMAIL_PROVIDER!=='resend')return outlook.ready()&&data.outlookConnection?.email===outlook.sender&&!!data.outlookConnection?.encryptedCredentials;return process.env.PUBLICATIONS_EMAIL_PROVIDER==='resend'&&!!process.env.RESEND_API_KEY&&validEmail(process.env.PUBLICATIONS_FROM_EMAIL);}
function mailText(job,data){if(job.text)return job.text;const deadlines=data?require('../web/deadline-core').all(data):[];return [`Publicações do dia ${job.date.split('-').reverse().join('/')} — ${job.lawyer}`,`Destinatário: ${job.to}`,`${job.items.length} registro(s) em ${new Set(job.items.map(i=>i.caseId)).size} processo(s).`,'',...job.items.flatMap(i=>[`Processo: ${i.caseId}`,`Cliente: ${i.client||'A confirmar'}`,`Tribunal / fonte: ${i.court||i.source}`,`Publicação: ${i.title}`,...(i.dateKind?['Tipo de data: '+i.dateKind]:[]),...(i.dateWarning?['CONFERIR: '+i.dateWarning]:[]),...(i.refs?.length?['Referências: '+i.refs.join(', ')]:[]),String(i.text||''),...(i.url?['Consulta: '+i.url]:[]),...deadlines.filter(d=>d.caseId===i.caseId).map(require('./forward-content').deadlineText),'']), 'Acesse o painel: https://dibbernjuridico.vercel.app/controladoria', 'Consulte o painel para conferir responsáveis, providências e prazos. As datas das publicações não substituem a conferência do prazo.'].join('\n');}
function queueMail(data,date,actor,at=new Date().toISOString(),onlyLawyer=''){
 const prepared=prepare(data);let changed=false;const jobs=[...(data.publicationMail||[])],events=[];
 for(const p of data.portfolios){if(onlyLawyer&&p.lawyer!==onlyLawyer)continue;
  const all=forLawyer(data,date,p.lawyer,prepared);
  const handled=new Set(jobs.filter(j=>j.date===date&&j.lawyer===p.lawyer&&['accepted','sending','unknown'].includes(j.status)).flatMap(j=>j.items.map(i=>i.key)));
  const items=all.filter(i=>!handled.has(i.key));if(!items.length){for(let n=0;n<jobs.length;n++)if(jobs[n].date===date&&jobs[n].lawyer===p.lawyer&&['queued','blocked_sender','blocked_recipient','failed'].includes(jobs[n].status)){jobs[n]={...jobs[n],status:'superseded',updatedAt:at};changed=true;}continue;}
  const key=crypto.createHash('sha256').update(p.lawyer+'|'+date+'|'+items.map(i=>i.key).sort().join('|')).digest('hex');
  for(let n=0;n<jobs.length;n++)if(jobs[n].date===date&&jobs[n].lawyer===p.lawyer&&jobs[n].id!==key&&['queued','blocked_sender','blocked_recipient','failed'].includes(jobs[n].status)){jobs[n]={...jobs[n],status:'superseded',updatedAt:at};changed=true;}
  const to=p.publicationEmail||p.email||'',status=!validEmail(to)?'blocked_recipient':!configured(data)?'blocked_sender':'queued';const existing=jobs.find(j=>j.id===key);
  if(existing){if(existing.status==='failed')continue;if(['accepted','sending','unknown'].includes(existing.status))continue;if(existing.to!==to||existing.status!==status){const index=jobs.indexOf(existing);jobs[index]={...existing,to,status,error:undefined,from:process.env.PUBLICATIONS_EMAIL_PROVIDER==='resend'?(process.env.PUBLICATIONS_FROM_EMAIL||''):outlook.sender,updatedAt:at};changed=true;}continue;}
  const job={id:key,date,lawyer:p.lawyer,to,from:process.env.PUBLICATIONS_EMAIL_PROVIDER==='resend'?(process.env.PUBLICATIONS_FROM_EMAIL||''):outlook.sender,items,status,createdAt:at,updatedAt:at,triggeredBy:actor?.id};jobs.push(job);changed=true;
  events.push({id:'mail-queued-'+key,kind:'email',at,actorId:actor?.id,actorName:actor?.user_metadata?.dibbern_profile?.name||actor?.email||'Sistema',title:'Envio de publicações preparado',recipientLawyer:p.lawyer,caseIds:[...new Set(items.map(i=>i.caseId))],mailId:key,details:`${p.lawyer} · ${to||'E-mail não cadastrado'} · ${items.length} registro(s) de ${date.split('-').reverse().join('/')}. ${status==='blocked_sender'?'Pendente: conectar remetente.':status==='blocked_recipient'?'Pendente: cadastrar destinatário.':'Aguardando envio.'}`});
 }
 return {data:changed?{...data,publicationMail:jobs,activityLog:[...(data.activityLog||[]),...events]}:data,changed};
}
async function sendMail(job,data){
 if(!configured(data))throw Error('Remetente ainda não conectado.');
 if(process.env.PUBLICATIONS_EMAIL_PROVIDER!=='resend')return outlook.send(job,data.outlookConnection,mailText(job,data));
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'dibbern-publications-'+job.id},body:JSON.stringify({from:process.env.PUBLICATIONS_FROM_EMAIL,to:[job.to],subject:job.subject||`Publicações ${job.date.split('-').reverse().join('/')} — ${job.lawyer}`,text:mailText(job,data)}),signal:AbortSignal.timeout(20000)});
  const body=await response.json();if(!response.ok||!body.id){const error=Error('O serviço de e-mail recusou o envio. Confira a configuração do remetente.');error.knownFailure=response.status>=400&&response.status<500&&![408,409].includes(response.status);if(!error.knownFailure)error.message='O serviço não confirmou o resultado do envio. Confira no provedor antes de repetir.';throw error;}
  return {id:body.id};
 }catch(error){if(!error.knownFailure)error.ambiguous=true;throw error;}
}
module.exports={queueMail,mailText,sendMail,configured,validEmail};
