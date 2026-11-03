'use strict';
(function(root){
 const P=typeof module!=='undefined'&&module.exports?require('./publication-core'):root.PublicationData;
 const L=typeof module!=='undefined'&&module.exports?require('./portfolio-links'):root.PortfolioLinks;
 function today(now=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;}
 function prepare(data){return {linked:L.applyPortfolioLinks(data).data,base:new Map(data.base.map(b=>[b.id,b])),reports:P.collectPublications(data),court:P.courtPublications(data)};}
 function forDay(data,date,prepared){
  const {linked,base,reports,court}=prepared||prepare(data);
  const result=[];
  for(const report of reports.filter(p=>p.on===date))for(const item of report.cases){const a=linked.annotations?.[item.id]||{},b=base.get(item.id);result.push({key:report.id+'|'+item.id,caseId:item.id,date,source:report.title,dateKind:report.dateKind,title:item.title,refs:item.refs,count:item.refs.length||1,text:item.text,client:[...new Set([...(a.clientNames||[]),...(a.portfolioClients||[]),...(a.client?[a.client]:[])])].join(' / '),court:b?.court||'',url:b?.courtSources?.[0]?.url||''});}
  for(const p of court){if(p.on!==date)continue;const a=linked.annotations?.[p.caseId]||{};result.push({key:p.id,caseId:p.caseId,date,source:p.system,dateKind:p.dateKind,dateWarning:p.dateWarning||'',title:p.title,refs:[],count:1,text:p.text,client:[...new Set([...(a.clientNames||[]),...(a.portfolioClients||[]),...(a.client?[a.client]:[])])].join(' / '),court:p.system,url:p.url||''});}
  return result;
 }
 function forLawyer(data,date,lawyer,prepared){
  const context=prepared||prepare(data);
  return forDay(data,date,context).filter(item=>{const a=context.linked.annotations?.[item.caseId]||{};return [...(a.owners?.length?a.owners:a.owner?[a.owner]:[]),...(a.portfolioOwners||[])].includes(lawyer);});
 }
 const api={today,forDay,forLawyer,prepare};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DailyPublications=api;
})(typeof window==='undefined'?globalThis:window);
