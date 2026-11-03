'use strict';
(function(root){
 function day(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
 function cases(data,date){const ids=new Set();for(const b of data.base||[])if((b.importedPublications||[]).some(p=>p.importedAt&&day(p.importedAt)===date))ids.add(b.id);for(const event of data.activityLog||[])if(event.kind==='import'&&event.importKey&&day(event.at)===date)for(const id of event.caseIds||[])ids.add(id);return (data.base||[]).filter(b=>ids.has(b.id));}
 const api={day,cases};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ImportedDay=api;
})(typeof window==='undefined'?globalThis:window);
