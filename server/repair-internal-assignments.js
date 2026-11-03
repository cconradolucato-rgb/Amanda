'use strict';
const {normalize}=require('../web/portfolio-links');
const version='restore-original-internal-portfolios-20261030-v1';
function repairInternalAssignments(current){
 const updates=current.officeUpdates||[];if(updates.includes(version))return {data:current,changed:false};
 const importedBefore=updates.some(id=>/^court-oab-danilo-carina-20261030-v[12]$/.test(id));
 const data={...current,portfolios:current.portfolios.map(p=>({...p,clients:[...p.clients]})),annotations:{...(current.annotations||{})}};
 const partners=[{oab:'252604SP',words:['carina','dibbern'],keep:4},{oab:'282541SP',words:['danilo','dibbern'],keep:7}];
 if(importedBefore){
  const snapshot=require('./court-snapshot');
  for(const person of partners){
   const p=data.portfolios.find(p=>person.words.every(word=>normalize(p.lawyer).split(' ').includes(word)));if(!p)continue;
   const autoClients=new Set(snapshot.cases.flatMap(c=>c.courtSources.flatMap(s=>s.representedClients.filter(client=>client.lawyers.some(l=>l.oab===person.oab)).map(client=>normalize(client.name)))));
   p.clients=p.clients.filter((name,index)=>index<person.keep||!autoClients.has(normalize(name)));
  }
  const knownCases=new Set(snapshot.cases.map(c=>c.id)),partnerNames=data.portfolios.filter(p=>partners.some(person=>person.words.every(word=>normalize(p.lawyer).split(' ').includes(word)))).map(p=>p.lawyer);
  for(const [id,prior] of Object.entries(data.annotations)){
   if(!knownCases.has(id))continue;
   const owners=prior.owners?.length?prior.owners:prior.owner?[prior.owner]:[];
   if(owners.length&&owners.every(name=>partnerNames.includes(name))){data.annotations[id]={...prior,owner:'',owners:[],assignmentOrigin:'portfolio-client-match'};}
  }
 }
 data.officeUpdates=[...updates,version];return {data,changed:true};
}
module.exports={repairInternalAssignments};
