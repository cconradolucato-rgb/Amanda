'use strict';
(function(root){
 const safe=(v,k='')=>/password|senha|token|secret|credential|authorization|cookie/i.test(k)?'[protegido]':typeof v==='string'?(/^data:/i.test(v)?'[anexo incorporado]':v.slice(0,12000)):Array.isArray(v)?v.map(x=>safe(x)):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!/password|senha|token|secret|credential|authorization|cookie/i.test(k)).map(([k,x])=>[k,safe(x,k)])):v;
 const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
 function recordActivity(before,next,actor={},at=new Date().toISOString()){
  const events=[],author=actor.user_metadata?.dibbern_profile?.name||actor.email||'Integrante do escritório';
  const add=(kind,title,extra={})=>events.push({id:at+'-'+events.length+'-'+(actor.id||'office'),at,actorId:actor.id,actorName:author,kind,title,...safe(extra)});
  for(const item of (next.imports||[]).slice((before.imports||[]).length))add('import','Relatório AASP importado',{file:item.file,importKey:item.file+'|'+item.importedAt,details:`${item.added||0} processo(s) novo(s), ${item.updated||0} atualizado(s)`,caseIds:Array.isArray(item.caseIds)?item.caseIds:(next.base||[]).filter(b=>(b.importedPublications||[]).some(p=>p.file===item.file&&p.importedAt===item.importedAt)).map(b=>b.id)});
  if(next.courtResearch?.version&&next.courtResearch.version!==before.courtResearch?.version){const ids=new Set((before.base||[]).map(b=>b.id));add('import','Consultas públicas dos tribunais incorporadas',{caseIds:(next.base||[]).filter(b=>!ids.has(b.id)).map(b=>b.id),details:`${next.courtResearch.added||0} processo(s) novo(s), ${next.courtResearch.updated||0} atualizado(s)`});}
  const fields={priority:'Prioridade alterada',priorityEmailDate:'Data do aviso por e-mail alterada',client:'Cliente alterado',owner:'Responsável alterado',owners:'Encaminhamentos alterados',due:'Prazo interno alterado',status:'Acompanhamento alterado',processState:'Situação do processo alterada',checked:'Providências conferidas',notes:'Observações do processo atualizadas'};
  for(const [id,note] of Object.entries(next.annotations||{})){
   const prior=before.annotations?.[id]||{};
   for(const field of new Set([...Object.keys(prior),...Object.keys(note)])){if(/password|senha|token|secret|credential|authorization|cookie/i.test(field))continue;const title=fields[field]||'Dados do processo alterados: '+field;if(!same(prior[field],note[field])&&!(prior[field]===undefined&&['','A validar'].includes(note[field]))){
    if(field==='notes'&&!(note.notes?.length||prior.notes?.length))continue;
    if(field==='checked'&&!(note.checked?.length||prior.checked?.length))continue;
    add('activity',title,{caseIds:[id],...(field==='notes'?{noteIds:(note.notes||[]).filter(n=>!(prior.notes||[]).some(p=>p.id===n.id)).map(n=>n.id).filter(Boolean)}:{}),field,before:prior[field]??null,after:note[field]??null,details:field==='notes'?`${note.notes?.length||0} observação(ões) no processo`:field==='checked'?`${note.checked?.length||0} providência(s) marcada(s)`:String(note[field]||'Removido / usar dados do tribunal')});
   }}
  }
  for(const [id,prior] of Object.entries(before.annotations||{}))if(!Object.hasOwn(next.annotations||{},id))add('activity','Dados internos do processo removidos',{caseIds:[id],before:prior,after:null});
  for(const deadline of next.deadlines||[]){const prior=(before.deadlines||[]).find(d=>d.id===deadline.id);if(!same(prior,deadline))add('activity',!prior?'Prazo cadastrado':deadline.status==='done'&&prior.status!=='done'?'Prazo marcado como cumprido':'Prazo atualizado',{caseIds:[deadline.caseId],before:prior||null,after:deadline,details:deadline.title+' · '+deadline.date});}
  for(const review of (next.deadlineReviews||[]).slice((before.deadlineReviews||[]).length))add('activity','Conferência diária da controladoria registrada',{details:review.date||''});
  for(const deadline of before.deadlines||[])if(!(next.deadlines||[]).some(d=>d.id===deadline.id))add('activity','Prazo removido',{caseIds:[deadline.caseId],before:deadline,after:null});
  if(!same(before.clientAliases||[],next.clientAliases||[]))add('activity','Vínculos de clientes atualizados',{before:before.clientAliases||[],after:next.clientAliases||[]});
  if(!same(before.clientAliasDismissals||[],next.clientAliasDismissals||[]))add('activity','Sugestões de vínculo revisadas',{before:before.clientAliasDismissals||[],after:next.clientAliasDismissals||[]});
  if(!same(before.portfolios,next.portfolios))add('activity','Carteiras e cadastros dos responsáveis atualizados',{before:before.portfolios,after:next.portfolios});
  return events.length?{...next,activityLog:[...new Map([...(before.activityLog||[]),...(next.activityLog||[]),...events].map(e=>[e.id,e])).values()]}:next;
 }
 const api={recordActivity};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OfficeActivity=api;
})(typeof window==='undefined'?globalThis:window);
