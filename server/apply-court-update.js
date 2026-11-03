'use strict';
const snapshotVersion=require('./court-version');
const key=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^\s*(?:dr|dra)\.?\s+/,'').trim().replace(/\s+/g,' ');
function applyCourtUpdate(current){
 const done=Array.isArray(current.officeUpdates)?current.officeUpdates:[];
 if(done.includes(snapshotVersion))return {data:current,changed:false};
 const snapshot=require('./court-snapshot');
 const data={...current,base:current.base.map(b=>({...b})),annotations:{...(current.annotations||{})},portfolios:current.portfolios.map(p=>({...p,clients:[...p.clients]}))};
 const identity={'282541SP':{name:'Dr. Danilo Dibbern',oab:'282541',uf:'SP',tokens:['danilo','dibbern']},'252604SP':{name:'Dra. Carina Dibbern',oab:'252604',uf:'SP',tokens:['carina','dibbern']}};
 const lawyerNames={};
 for(const [oab,person] of Object.entries(identity)){
  let p=data.portfolios.find(p=>person.tokens.every(t=>key(p.lawyer).split(' ').includes(t)));
  if(!p){p={lawyer:person.name,clients:[]};data.portfolios.push(p);}
  p.oab=person.oab;p.uf=person.uf;lawyerNames[oab]=p.lawyer;
 }
 let added=0,updated=0;
 for(const item of snapshot.cases){
  let base=data.base.find(b=>b.id===item.id);
  if(!base){base={...item};data.base.push(base);added++;}
  else{base.courtSources=[...(base.courtSources||[]).filter(s=>!item.courtSources.some(n=>n.key===s.key)),...item.courtSources];updated++;}
  const owners=[...new Set(item.courtSources.flatMap(s=>s.lawyers.map(l=>lawyerNames[l.oab]).filter(Boolean)))];
  const clients=[...new Set(item.courtSources.flatMap(s=>s.representedClients.map(c=>c.name)))];
  const prior=data.annotations[item.id]||{};
  data.annotations[item.id]={...prior};
  // A lawyer appearing in the court record is not the office's internal assignee.
  data.annotations[item.id].courtLawyers=owners;
  if(!prior.client?.trim()&&clients.length){data.annotations[item.id].client=clients.join(' / ');data.annotations[item.id].clientNames=clients;}

 }
 data.officeUpdates=[...done,snapshot.version];
 data.courtResearch={version:snapshot.version,consultedAt:snapshot.consultedAt,uniqueProcesses:snapshot.cases.length,added,updated,queries:snapshot.queries,coverage:snapshot.coverage,historyAudit:snapshot.historyAudit};
 return {data,changed:true};
}
module.exports={applyCourtUpdate};
