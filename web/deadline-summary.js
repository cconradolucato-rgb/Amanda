'use strict';
(function(root){
 const F=typeof module!=='undefined'&&module.exports?require('./deadline-core'):root.DeadlineFlow;
 const I=typeof module!=='undefined'&&module.exports?require('./imported-day-core'):root.ImportedDay;
 const P=typeof module!=='undefined'&&module.exports?require('./publication-core'):root.PublicationData;
 const owners=d=>[...new Set(d.resolvedOwners||[d.owner])].filter(Boolean);
 function names(data,list){return [...new Set([...(data.portfolios||[]).map(p=>p.lawyer),...(data.officeAccess?.scope==='own'?[]:list.flatMap(owners))])].sort((a,b)=>a.localeCompare(b,'pt-BR'));}
 function due(data,date){const list=F.all(data).filter(d=>F.isDeadline(d)&&d.status!=='cancelled'&&d.date===date),rows=names(data,list).map(lawyer=>{const records=list.filter(d=>owners(d).includes(lawyer));return {lawyer,total:records.length,open:records.filter(d=>d.status==='pending').length,done:records.filter(d=>d.status==='done').length};});return {date,rows,total:list.length,open:list.filter(d=>d.status==='pending').length,done:list.filter(d=>d.status==='done').length,unassigned:list.filter(d=>!owners(d).length).length,shared:list.some(d=>owners(d).length>1)};}
 function noticeCount(data,caseId,date){return I.publications(data,caseId,date).reduce((n,p)=>n+(p.publicationRef?1:P.references(p.text).length||1),0);}
 function imported(data,date){const list=F.forImportDay(data,date),cases=I.cases(data,date),rows=names(data,list).map(lawyer=>{const records=list.filter(d=>owners(d).includes(lawyer)),ids=[...new Set(records.map(d=>d.caseId))];return {lawyer,processes:ids.length,publications:ids.reduce((n,id)=>n+noticeCount(data,id,date),0),scheduled:records.filter(d=>F.isDeadline(d)&&d.status!=='cancelled').length,triage:records.filter(d=>!F.isDeadline(d)&&d.status==='pending').length};});return {date,rows,processes:cases.length,publications:cases.reduce((n,b)=>n+noticeCount(data,b.id,date),0),scheduled:list.filter(d=>F.isDeadline(d)&&d.status!=='cancelled').length,triage:list.filter(d=>!F.isDeadline(d)&&d.status==='pending').length,unassigned:list.filter(d=>!owners(d).length&&d.status==='pending').length,shared:list.some(d=>owners(d).length>1)};}
 const importCache=new WeakMap();function importDays(data){if(importCache.has(data))return importCache.get(data);const dates=new Set((data.imports||[]).map(i=>F.day(i.importedAt)));for(const b of data.base||[])for(const p of b.importedPublications||[])if(!p.superseded&&!p.referenceOnly){dates.add(F.day(p.importedAt));dates.add(F.day(p.lastImportedAt));}for(const e of data.activityLog||[])if(e.kind==='import'&&e.importKey)dates.add(F.day(e.at));dates.delete('');const counts=new Map([...dates].map(date=>[date,I.cases(data,date).length]));importCache.set(data,counts);return counts;}
 function effective(d){return d.status==='done'&&d.kind!=='followup'&&d.completionReport?.type!=='acknowledgement'&&!!F.day(d.completedAt);}
 function monthly(data,month){
  const list=F.all(data),received=new Map(),rows=names(data,list).map(lawyer=>({lawyer,publications:0,effective:0,open:0,done:0,total:0})),byName=new Map(rows.map(row=>[row.lawyer,row]));
  const count=(lawyers,field)=>{for(const lawyer of lawyers){const row=byName.get(lawyer);if(row)row[field]++;}};
  if(!/^\d{4}-\d{2}$/.test(month||''))return {month,rows,publications:0,effective:0,open:0,done:0};
  for(const [date] of importDays(data)){if(!date.startsWith(month+'-'))continue;const records=F.forImportDay(data,date);for(const b of I.cases(data,date)){const lawyers=[...new Set(records.filter(d=>d.caseId===b.id).flatMap(owners))];for(const pub of I.publications(data,b.id,date)){const key=b.id+'|'+(pub.fingerprint||((pub.publicationRef||'')+'|'+(pub.text||'')));if(!received.has(key))received.set(key,{lawyers,count:pub.publicationRef?1:P.references(pub.text).length||1});else received.get(key).lawyers=[...new Set([...received.get(key).lawyers,...lawyers])];}}}
  let publications=0,completed=0,open=0,done=0;
  for(const item of received.values()){publications+=item.count;for(let n=0;n<item.count;n++)count(item.lawyers,'publications');}
  for(const d of list){if(effective(d)&&F.day(d.completedAt).startsWith(month+'-')){completed++;count(owners(d),'effective');}if(F.isDeadline(d)&&d.status!=='cancelled'&&d.date.startsWith(month+'-')){if(d.status==='pending'){open++;count(owners(d),'open');}else if(d.status==='done'){done++;count(owners(d),'done');}count(owners(d),'total');}}
  return {month,rows,publications,effective:completed,open,done};
 }
 const api={due,imported,importDays,monthly,effective};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DeadlineSummary=api;
})(typeof window==='undefined'?globalThis:window);
