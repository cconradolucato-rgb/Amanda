'use strict';
const store=require('./office-store'),mail=require('./publication-mail'),{today}=require('../web/daily-publications-core');
const RETRIES=3,STALE=2*60*1000;
async function processPublications(headers,actor={id:'scheduler',email:'Agendador do escritório'},options={}){
 const deadline=options.deadline||Date.now()+50000,maxJobs=options.maxJobs??3;
 let row=await store.update(headers,data=>{
  const dates=new Set([today(),...(data.publicationMail||[]).filter(j=>['queued','blocked_sender','blocked_recipient'].includes(j.status)).map(j=>j.date)]);let next=data;
  for(const date of dates)next=mail.queueMail(next,date,actor).data;
  const stale=(next.publicationMail||[]).filter(j=>j.status==='sending'&&Date.now()-Date.parse(j.startedAt)>STALE);if(!stale.length)return next;
  const at=new Date().toISOString(),ids=new Set(stale.map(j=>j.id));return {...next,publicationMail:next.publicationMail.map(j=>ids.has(j.id)?{...j,status:'unknown',updatedAt:at,error:'A execução anterior não concluiu o registro. Confira o provedor antes de reenviar.'}:j),activityLog:[...(next.activityLog||[]),...stale.map(j=>({id:'mail-stale-'+j.id,at,kind:'email',actorId:actor.id,actorName:actor.email,mailId:j.id,title:'Envio interrompido com resultado incerto',details:'Não será repetido automaticamente. Confira a caixa de enviados ou o provedor.',caseIds:[...new Set(j.items.map(i=>i.caseId))]}))]};
 });
 if(!mail.configured(row.data))return row;
 const candidates=(row.data.publicationMail||[]).filter(j=>(options.all!==false?j.date<=today():j.date===options.date&&(!options.lawyer||j.lawyer===options.lawyer))&&(j.status==='queued'||j.status==='failed'&&(j.attempts||0)<RETRIES&&j.nextAttemptAt&&Date.parse(j.nextAttemptAt)<=Date.now())).slice(0,maxJobs);
 for(const candidate of candidates){
  if(deadline-Date.now()<38000)break;let claimed=false;
  row=await store.update(headers,data=>{claimed=false;const j=(data.publicationMail||[]).find(j=>j.id===candidate.id);if(!j||!(j.status==='queued'||j.status==='failed'&&(j.attempts||0)<RETRIES&&j.nextAttemptAt&&Date.parse(j.nextAttemptAt)<=Date.now())||(j.attempts||0)>=RETRIES)return data;
   const at=new Date().toISOString(),portfolio=(data.portfolios||[]).find(p=>p.lawyer===j.lawyer),to=portfolio?.publicationEmail||portfolio?.email||'';
   if(!mail.validEmail(to)||!mail.configured(data))return {...data,publicationMail:data.publicationMail.map(v=>v.id===j.id?{...v,to,status:!mail.validEmail(to)?'blocked_recipient':'blocked_sender',updatedAt:at}:v)};
   claimed=true;return {...data,publicationMail:data.publicationMail.map(v=>v.id===j.id?{...v,to,status:'sending',startedAt:at,attempts:(v.attempts||0)+1}:v),activityLog:[...(data.activityLog||[]),{id:'mail-start-'+j.id+'-'+at,at,kind:'email',actorId:actor.id,actorName:actor.email,mailId:j.id,title:'Tentativa de envio de publicações iniciada',status:'sending',details:`Tentativa ${(j.attempts||0)+1} de ${RETRIES} · ${j.to}`,caseIds:[...new Set(j.items.map(i=>i.caseId))]}]};});
  if(!claimed)continue;const job=row.data.publicationMail.find(j=>j.id===candidate.id);let result,error;
  try{result=await mail.sendMail(job,row.data);}catch(e){error=e;}
  row=await store.update(headers,data=>{const at=new Date().toISOString(),status=error?(error.ambiguous?'unknown':'failed'):'accepted',canRetry=status==='failed'&&job.attempts<RETRIES,nextAttemptAt=canRetry?new Date(Date.now()+15*60*1000*2**(job.attempts-1)).toISOString():null;
   return {...data,...(result?.connection?{outlookConnection:result.connection}:{}),publicationMail:data.publicationMail.map(j=>j.id===job.id?{...j,status,updatedAt:at,nextAttemptAt,...(result?{acceptedAt:at,providerMessageId:result.provider==='outlook'?'':result.id,providerRequestId:result.provider==='outlook'?result.id:'',provider:result.provider||'resend',error:null}:{error:error.message})}:j),activityLog:[...(data.activityLog||[]),{id:'mail-result-'+job.id+'-'+at,at,kind:'email',actorId:actor.id,actorName:actor.email,mailId:job.id,status,title:error?(error.ambiguous?'Envio com resultado incerto — conferir no provedor':canRetry?'Envio recusado — nova tentativa programada':'Envio recusado — limite de tentativas atingido'):'Publicações aceitas pelo serviço de e-mail',details:`${job.to} · ${job.lawyer} · Tentativa ${job.attempts}. ${error?error.message:'Entrega e leitura não confirmadas.'}${nextAttemptAt?' Elegível para nova tentativa a partir de '+nextAttemptAt+'. A execução depende do agendador.':''}`,caseIds:[...new Set(job.items.map(i=>i.caseId))]}]};});
 }
 return row;
}
module.exports={processPublications};
