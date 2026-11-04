'use strict';
(function(root){
 const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
 function state(d){return d.status==='done'?'done':d.status==='cancelled'?'cancelled':d.owner?.trim()?'distributed':'waiting';}
 function day(at){const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(at||'')?at+'T12:00:00-03:00':at);if(!at||!Number.isFinite(d.getTime()))return '';const p=Object.fromEntries(dayFormatter.formatToParts(d).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
 const linkCache=new WeakMap();
 function withResponsibles(data,list){
  const links=typeof module!=='undefined'&&module.exports?require('./portfolio-links'):root.PortfolioLinks;
  if(!linkCache.has(data))linkCache.set(data,links.applyPortfolioLinks(data).data.annotations||{});const annotations=linkCache.get(data);
  return list.map(d=>{const a=annotations[d.caseId]||{},explicit=!!d.owner?.trim(),cleared=d.responsibleOverride||d.assignmentHistory?.at(-1)?.to===null;
   const owners=explicit?[d.owner]:cleared?[]:[...new Set([...(a.owners?.length?a.owners:a.owner?[a.owner]:[]),...(a.portfolioOwners||[])])];
   return {...d,owner:owners.join(' / '),resolvedOwners:owners,ownerAutomatic:!explicit&&owners.length>0,resolvedClients:[...new Set([...(a.clientNames||[]),...(a.portfolioClients||[]),...(a.client?[a.client]:[])])]};
  });
 }
 function all(data){const list=[...(data.deadlines||[])];for(const [caseId,note] of Object.entries(data.annotations||{}))if(note.due&&!list.some(d=>d.legacyCaseId===caseId))list.push({id:'legacy:'+caseId,caseId,title:'Prazo interno já registrado',date:note.due,time:'',owner:note.owners?.length===1?note.owners[0]:note.owners?.length>1?'':note.owner||'',status:note.status==='Providências concluídas'?'done':'pending',kind:'internal',legacy:true});return withResponsibles(data,list);}
 function assign(previous,value,actor,at){
  const owner=String(value.owner||'').trim(),prior=String(previous?.owner||'').trim(),history=[...(previous?.assignmentHistory||[])];
  if(owner===prior)return {...value,owner,assignedAt:previous?.assignedAt||null,assignedBy:previous?.assignedBy||null,assignedByName:previous?.assignedByName||null,assignmentHistory:history};
  history.push({id:at+'-'+history.length,at,from:prior||null,to:owner||null,by:actor.id,byName:actor.user_metadata?.dibbern_profile?.name||actor.email||'Equipe'});
  return {...value,owner,assignedAt:owner?at:null,assignedBy:owner?actor.id:null,assignedByName:owner?(actor.user_metadata?.dibbern_profile?.name||actor.email||'Equipe'):null,assignmentHistory:history};
 }
 function counts(list){const count={all:list.length,waiting:0,distributed:0,done:0,cancelled:0};for(const d of list)count[state(d)]++;return count;}
 function forImportDay(data,date){
  const imported=typeof module!=='undefined'&&module.exports?require('./imported-day-core'):root.ImportedDay;
  const cases=imported.cases(data,date),ids=new Set(cases.map(b=>b.id)),repeatedDays=new Map(cases.map(b=>[b.id,new Set(imported.publications(data,b.id,date).map(p=>day(p.importedAt)))]));
  const records=all(data).map(d=>{const {resolvedOwners,ownerAutomatic,resolvedClients,...raw}=d;return ownerAutomatic?{...raw,owner:''}:raw;}).filter(d=>{const recordDay=d.importDay||day(d.sentAt||d.createdAt);return !d.legacy&&ids.has(d.caseId)&&(recordDay===date||repeatedDays.get(d.caseId)?.has(recordDay));});
  for(const b of cases)if(!records.some(d=>d.caseId===b.id))records.push({id:'imported:'+date+':'+b.id,caseId:b.id,title:'Publicação importada — definir providência',date:'',sentAt:(b.importedPublications||[]).filter(p=>(day(p.importedAt)===date||day(p.lastImportedAt)===date)).at(-1)?.lastImportedAt||(b.importedPublications||[]).filter(p=>day(p.importedAt)===date).at(-1)?.importedAt||'',owner:'',status:'pending',kind:'publication',imported:true});
  return withResponsibles(data,records);
 }
 const api={state,day,all,assign,counts,forImportDay,withResponsibles};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DeadlineFlow=api;
})(typeof window==='undefined'?globalThis:window);
