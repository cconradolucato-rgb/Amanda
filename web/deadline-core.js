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
 function hasDueDate(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))return false;const value=new Date(d.date+'T12:00:00Z');return Number.isFinite(value.getTime())&&value.toISOString().slice(0,10)===d.date;}
 function isDeadline(d){return hasDueDate(d)&&d.kind!=='followup';}
 function attention(data,today){return all(data).filter(d=>d.status==='pending'&&(!isDeadline(d)||d.date<=today)).sort((a,b)=>{const rank=d=>d.date&&d.date<=today?0:!d.date?1:2;return rank(a)-rank(b)||compareDue(a,b)||String(a.sentAt||a.createdAt||'').localeCompare(String(b.sentAt||b.createdAt||''));});}
 function importedTriage(data,stored){
  const out=[],receipts=new Map();
  for(const item of [...(data.imports||[]),...(data.activityLog||[]).filter(e=>e.kind==='import'&&e.importKey).map(e=>({...e,importedAt:e.at}))])for(const id of item.caseIds||[]){if(day(item.importedAt)&&(!receipts.has(id)||item.importedAt<receipts.get(id)))receipts.set(id,item.importedAt);}
  for(const b of data.base||[]){const list=b.importedPublications||[],active=list.filter(p=>!p.superseded&&!p.referenceOnly),groups=new Map();if(list.length&&!active.length)continue;
   for(const p of active){const at=p.importedAt||receipts.get(b.id),date=day(at);if(!date)continue;if(!groups.has(date)||at<groups.get(date))groups.set(date,at);}
   if(!groups.size&&receipts.has(b.id))groups.set(day(receipts.get(b.id)),receipts.get(b.id));
   for(const [date,at] of groups){if(stored.some(d=>!d.legacy&&d.caseId===b.id&&(d.importDay||day(d.sentAt||d.createdAt))===date))continue;out.push({id:'imported:'+date+':'+b.id,caseId:b.id,title:'Publicação importada — definir providência',date:'',sentAt:at,createdAt:at,importDay:date,owner:'',status:'pending',kind:'publication',imported:true});}
  }
  return out;
 }
 function all(data){const list=[...(data.deadlines||[])];for(const [caseId,note] of Object.entries(data.annotations||{}))if(note.due&&!list.some(d=>d.legacyCaseId===caseId))list.push({id:'legacy:'+caseId,caseId,title:'Prazo interno já registrado',date:note.due,time:'',owner:note.owners?.length===1?note.owners[0]:note.owners?.length>1?'':note.owner||'',status:note.status==='Providências concluídas'?'done':'pending',kind:'internal',legacy:true});return withResponsibles(data,[...list,...importedTriage(data,list)]);}

 function assign(previous,value,actor,at){
  const owner=String(value.owner||'').trim(),prior=String(previous?.owner||'').trim(),history=[...(previous?.assignmentHistory||[])];
  if(owner===prior)return {...value,owner,assignedAt:previous?.assignedAt||null,assignedBy:previous?.assignedBy||null,assignedByName:previous?.assignedByName||null,assignmentHistory:history};
  history.push({id:at+'-'+history.length,at,from:prior||null,to:owner||null,by:actor.id,byName:actor.user_metadata?.dibbern_profile?.name||actor.email||'Equipe'});
  return {...value,owner,assignedAt:owner?at:null,assignedBy:owner?actor.id:null,assignedByName:owner?(actor.user_metadata?.dibbern_profile?.name||actor.email||'Equipe'):null,assignmentHistory:history};
 }
 function compareDue(a,b){return (a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')||(a.time||'23:59:59').localeCompare(b.time||'23:59:59')||String(a.caseId||'').localeCompare(String(b.caseId||''))||String(a.id||'').localeCompare(String(b.id||''));}
 function counts(list){const count={all:list.length,waiting:0,distributed:0,done:0,cancelled:0};for(const d of list)count[state(d)]++;return count;}
 function forImportDay(data,date){
  const imported=typeof module!=='undefined'&&module.exports?require('./imported-day-core'):root.ImportedDay;
  const cases=imported.cases(data,date),ids=new Set(cases.map(b=>b.id)),repeatedDays=new Map(cases.map(b=>[b.id,new Set(imported.publications(data,b.id,date).map(p=>day(p.importedAt)))]));
  const records=all(data).map(d=>{const {resolvedOwners,ownerAutomatic,resolvedClients,...raw}=d;return ownerAutomatic?{...raw,owner:''}:raw;}).filter(d=>{const recordDay=d.importDay||day(d.sentAt||d.createdAt);return !d.legacy&&ids.has(d.caseId)&&(recordDay===date||repeatedDays.get(d.caseId)?.has(recordDay));});
  for(const b of cases)if(!records.some(d=>d.caseId===b.id))records.push({id:'imported:'+date+':'+b.id,caseId:b.id,title:'Publicação importada — definir providência',date:'',sentAt:(b.importedPublications||[]).filter(p=>(day(p.importedAt)===date||day(p.lastImportedAt)===date)).at(-1)?.lastImportedAt||(b.importedPublications||[]).filter(p=>day(p.importedAt)===date).at(-1)?.importedAt||'',owner:'',status:'pending',kind:'publication',imported:true});
  return withResponsibles(data,records);
 }
 function calculateDeadline(data,target,value,actor,at){
  const math=typeof module!=='undefined'&&module.exports?require('./business-days'):root.BusinessDays;
  const date=math.add(value.publicationDate,Number(value.businessDays),value.excludedDates,value.excludeRecess,value.calendar);
  let record=(data.deadlines||[]).find(d=>d.id===target.id),materialized=false;
  if(!record&&target.imported){const importDay=target.viewDate||target.importDay||day(target.sentAt),matches=forImportDay(data,importDay).filter(d=>d.caseId===target.caseId);if(matches.length!==1)throw Error('Este processo recebeu novos prazos. Confira o registro antes de salvar o cálculo.');const latest=matches[0];record=(data.deadlines||[]).find(d=>d.id===latest.id);if(!record){const {imported,resolvedOwners,resolvedClients,ownerAutomatic,...raw}=latest;record={...raw,owner:ownerAutomatic?'':raw.owner,createdAt:at,importDay};materialized=true;}}
  if(!record&&target.legacy){const latest=all(data).find(d=>d.id===target.id&&d.caseId===target.caseId);if(latest){const {legacy,resolvedOwners,resolvedClients,ownerAutomatic,...raw}=latest;record={...raw,owner:ownerAutomatic?'':raw.owner,legacyCaseId:target.caseId,createdAt:at};materialized=true;}}
  if(!record||record.caseId!==target.caseId||record.status!=='pending')throw Error('Este prazo foi concluído, cancelado ou alterado. Confira o registro antes de salvar.');
  if(!materialized){const changed=['publicationDate','businessDays','calendar','excludedDates','excludeRecess','date','manualDate'].some(k=>JSON.stringify(record[k]??null)!==JSON.stringify(target[k]??null));if(changed)throw Error('Outra pessoa alterou o cálculo deste prazo. Seus campos foram mantidos; confira a versão atual em Abrir / editar.');}
  const next={...record,publicationDate:value.publicationDate,businessDays:Number(value.businessDays),excludedDates:[...(value.excludedDates||[])],excludeRecess:!!value.excludeRecess,calendar:value.calendar,date,manualDate:false,validatedAt:null,validatedBy:null,validatedByName:null,calculatedAt:at,calculatedBy:actor.id,updatedAt:at};
  return {...data,deadlines:materialized?[...(data.deadlines||[]),next]:data.deadlines.map(d=>d.id===record.id?next:d)};
 }
 function validateReport(report){
  if(report&&(typeof report.text!=="string"||report.text.length>10000||!Array.isArray(report.images)||report.images.length>3||report.images.some(i=>typeof i.name!=="string"||i.name.length>200||typeof i.data!=="string"||i.data.length>200000||!/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(i.data))))throw Error("Confira as anotações e imagens da conclusão.");
 }
 function addCompletionNote(data,target,actor,at,entry){
  validateReport(entry);if(!entry.id||(!entry.text.trim()&&!entry.images.length))throw Error('Escreva uma observação ou anexe uma imagem.');const record=(data.deadlines||[]).find(d=>d.id===target.id&&d.caseId===target.caseId);if(!record||record.status!=='done')throw Error('Este prazo não está mais concluído. A observação foi mantida para você conferir.');if((record.completionNotes||[]).some(n=>n.id===entry.id))return data;const note={...entry,at,by:actor.id,byName:actor.user_metadata?.dibbern_profile?.name||actor.email||'Equipe'};return {...data,deadlines:data.deadlines.map(d=>d.id===record.id?{...d,completionNotes:[...(d.completionNotes||[]),note],updatedAt:at}:d)};
 }
 function complete(data,target,actor,at,report){
  validateReport(report);
  let record=(data.deadlines||[]).find(d=>d.id===target.id),materialized=false;
  if(!record&&target.imported){const date=target.viewDate||target.importDay||day(target.sentAt),matches=forImportDay(data,date).filter(d=>d.caseId===target.caseId);if(matches.length!==1)throw Error('Este processo foi atualizado e possui mais de um prazo ou saiu deste lote. Atualize a lista e selecione o prazo novamente.');const latest=matches[0];record=(data.deadlines||[]).find(d=>d.id===latest.id);if(!record){const {imported,resolvedOwners,resolvedClients,ownerAutomatic,...raw}=latest;record={...raw,owner:ownerAutomatic?'':raw.owner,createdAt:at,importDay:date};materialized=true;}}
  if(!record||record.caseId!==target.caseId)throw Error('O prazo foi alterado ou removido por outra pessoa. Atualize a lista antes de concluir.');
  if(record.status==='done'){if(report&&JSON.stringify(record.completionReport)!==JSON.stringify(report))throw Error('Este prazo já foi concluído por outra pessoa. Suas anotações foram mantidas nesta janela; confira a conclusão antes de continuar.');return data;}
  if(record.status!=='pending')throw Error('Este prazo está cancelado ou não está mais pendente. Confira o registro antes de concluir.');
  const value={...record,...(report?{completionReport:report}:{}),status:'done',completedAt:at,completedBy:actor.id,completedByName:actor.user_metadata?.dibbern_profile?.name||actor.email||'Equipe',updatedAt:at};
  return {...data,deadlines:materialized?[...(data.deadlines||[]),value]:(data.deadlines||[]).map(d=>d.id===record.id?value:d)};
 }
 const api={state,day,all,assign,counts,forImportDay,withResponsibles,complete,addCompletionNote,calculateDeadline,compareDue,hasDueDate,isDeadline,attention};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DeadlineFlow=api;
})(typeof window==='undefined'?globalThis:window);
