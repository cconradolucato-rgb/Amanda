'use strict';
const crypto=require('node:crypto'),P=require('../web/publication-core'),{applyPortfolioLinks}=require('../web/portfolio-links'),{queueMail}=require('./publication-mail');
function invalid(message,status=400){throw Object.assign(Error(message),{status});}
function text(value,name,max,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))invalid('Campo inválido: '+name);return value.trim();}
function normalize(body){
 if(!body||!['aasp','djen','authorized-provider'].includes(body.source))invalid('Fonte inválida.');
 const batchId=text(body.batchId,'batchId',100);if(!/^[\w.-]+$/.test(batchId))invalid('Identificador de lote inválido.');
 if(!Array.isArray(body.publications)||body.publications.length>100)invalid('Envie no máximo 100 publicações por lote.');
 if(typeof body.complete!=='boolean')invalid('Informe se o lote é completo ou parcial.');
 const from=P.isoDate(body.window?.from),to=P.isoDate(body.window?.to);if(!from||!to||from>to)invalid('Período de consulta inválido.');
 const publications=body.publications.map(p=>{
  if(!p||typeof p!=='object')invalid('Publicação inválida.');
  const externalId=text(p.externalId,'externalId',200),digits=text(p.caseNumber,'caseNumber',40).replace(/\D/g,'');if(digits.length!==20)invalid('Número CNJ inválido.');
  const caseId=digits.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,'$1-$2.$3.$4.$5.$6'),date=P.isoDate(p.date);if(!date||date<from||date>to)invalid('Data da publicação fora do período informado.');
  if(!['publication','availability'].includes(p.dateKind))invalid('Informe o significado da data.');
  const title=text(p.title,'title',600),content=text(p.text,'text',200000),court=text(p.court,'court',200);
  let url='';if(p.url){url=text(p.url,'url',2000);let parsed;try{parsed=new URL(url);}catch{invalid('URL inválida.');}if(parsed.protocol!=='https:'||parsed.username||parsed.password)invalid('Use uma URL HTTPS sem credenciais.');}
  return {externalId,caseId,date,dateKind:p.dateKind,title,text:content,court,url};
 });
 const seen=new Set();for(const p of publications){if(seen.has(p.externalId))invalid('Identificador externo repetido no lote.');seen.add(p.externalId);}
 const normalized={source:body.source,batchId,complete:body.complete,window:{from,to},publications:publications.sort((a,b)=>a.externalId.localeCompare(b.externalId))};
 return {...normalized,digest:crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')};
}
function merge(data,batch,at=new Date().toISOString()){
 const receiptId=batch.source+':'+batch.batchId,prior=(data.publicationIngestRuns||[]).find(r=>r.id===receiptId);
 if(prior){if(prior.digest!==batch.digest)invalid('O lote já existe com outro conteúdo. Envie um novo identificador de lote.',409);return {data,receipt:prior,replayed:true};}
 const base=data.base.map(b=>({...b,importedPublications:[...(b.importedPublications||[])]})),byId=new Map(base.map(b=>[b.id,b]));let added=0,received=0,duplicates=0;const caseIds=[],dates=new Set();
 const known=new Map(base.flatMap(b=>(b.importedPublications||[]).map(p=>[p.fingerprint,p])));
 const label={aasp:'AASP — integração',djen:'DJEN — integração','authorized-provider':'Fonte autorizada — integração'}[batch.source];
 for(const p of batch.publications){
  const fingerprint='external-'+crypto.createHash('sha256').update(batch.source+'|'+p.externalId).digest('hex'),contentDigest=crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');let b=byId.get(p.caseId);
  const existing=known.get(fingerprint);
  if(existing){if(existing.contentDigest!==contentDigest)invalid('Uma publicação existente mudou de conteúdo. Exige revisão antes de substituir.',409);duplicates++;continue;}
  if(!b){b={id:p.caseId,event:p.title,court:p.court,priority:'Média',tasks:['Conferir a publicação recebida e definir as providências internas.'],dates:p.date.split('-').reverse().join('/'),note:'Publicação recebida por integração. Prazo jurídico não calculado.',source:'',parties:'A confirmar',importedPublications:[]};base.push(b);byId.set(p.caseId,b);added++;}
  b.importedPublications.push({fingerprint,contentDigest,externalId:p.externalId,source:batch.source,sourceUrl:p.url,file:label,text:p.title+'\n'+p.text,importedAt:at,...(p.dateKind==='availability'?{availabilityDate:p.date}:{publicationDate:p.date})});
  if(!b.latestPublicationDate||p.date>=b.latestPublicationDate){b.latestPublicationDate=p.date;b.event=p.title;}
  caseIds.push(p.caseId);dates.add(p.date);received++;
 }
 const receipt={id:receiptId,source:batch.source,batchId:batch.batchId,digest:batch.digest,at,window:batch.window,state:batch.complete?'received':'partial',completeness:'declared_by_integrator',received,duplicates,added,caseIds:[...new Set(caseIds)]};
 let next={...data,base,publicationIngestRuns:[...(data.publicationIngestRuns||[]),receipt],activityLog:[...(data.activityLog||[]),{id:'ingest-'+receiptId,at,kind:'import',actorId:'publication-integrator',actorName:'Integração de publicações',title:batch.complete?'Lote de publicações recebido':'Lote parcial de publicações recebido',caseIds:receipt.caseIds,source:batch.source,batchId:batch.batchId,status:receipt.state,details:`${received} registro(s) recebido(s), ${duplicates} repetido(s), ${added} processo(s) novo(s). Período ${batch.window.from} a ${batch.window.to}. Completude declarada pelo integrador; não é prova de cobertura de todos os tribunais.`}]};
 next=applyPortfolioLinks(next).data;
 for(const date of dates)next=queueMail(next,date,{id:'publication-integrator',email:'Integração de publicações'},at).data;
 return {data:next,receipt,replayed:false};
}
module.exports={normalize,merge};
