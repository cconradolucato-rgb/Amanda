'use strict';
(function(root){
 const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
 function day(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const p=Object.fromEntries(dayFormatter.formatToParts(d).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
 function cases(data,date){const ids=new Set();for(const item of data.imports||[])if(day(item.importedAt)===date)for(const id of item.caseIds||[])ids.add(id);for(const b of data.base||[])if((b.importedPublications||[]).some(p=>(p.importedAt&&day(p.importedAt)===date)||(p.lastImportedAt&&day(p.lastImportedAt)===date)))ids.add(b.id);for(const event of data.activityLog||[])if(event.kind==='import'&&event.importKey&&day(event.at)===date)for(const id of event.caseIds||[])ids.add(id);return (data.base||[]).filter(b=>ids.has(b.id));}
 function publications(data,caseId,date){const list=(data.base||[]).find(b=>b.id===caseId)?.importedPublications||[];if(!date)return list;const keys=new Set((data.imports||[]).filter(item=>day(item.importedAt)===date).flatMap(item=>item.publicationKeys||[]).filter(item=>item.caseId===caseId).map(item=>item.fingerprint));return list.filter(p=>day(p.importedAt)===date||day(p.lastImportedAt)===date||p.fingerprint&&keys.has(p.fingerprint));}
 const api={day,cases,publications};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ImportedDay=api;
})(typeof window==='undefined'?globalThis:window);
