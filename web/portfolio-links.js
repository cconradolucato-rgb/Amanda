'use strict';
(function(root){
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 function observations(base,prior={}){
  const structured=(base.courtSources||[]).flatMap(s=>[...(s.parties||[]).map(p=>p.name),...(s.representedClients||[]).map(p=>p.name)]);
  const names=[prior.client,...(prior.clientNames||[]),...structured,...(structured.length?[]:String(base.parties||'').split(/\s+[×/|]\s+|\s+x\s+/i).map(n=>n.replace(/^[^:]{1,35}:\s*/,'')))];
  return [...new Map(names.filter(Boolean).map(name=>[normalize(name),name])).values()];
 }
 function suggestClientLinks(current){
  const common=new Set(['de','da','do','das','dos','e','o','a','condominio','cond','residencial','associacao','ass','edificio','clube','bairro','bairros']);
  const tokens=name=>normalize(name).split(' ').filter(t=>t.length>1&&!common.has(t));
  const clients=[...new Map((current.portfolios||[]).flatMap(p=>p.clients.map(client=>[normalize(client),client]))).values()];
  const known=new Set((current.clientAliases||[]).map(a=>normalize(a.alias))),dismissed=new Set(current.clientAliasDismissals||[]),groups=new Map();
  for(const base of current.base||[])for(const name of observations(base,current.annotations?.[base.id])){
   const key=normalize(name);if(!key||known.has(key)||clients.some(c=>normalize(c)===key))continue;
   const words=tokens(name);if(!words.length)continue;
   for(const client of clients){
    const target=tokens(client),shared=target.filter(t=>words.includes(t));
    if(shared.length<2||shared.length/Math.max(target.length,words.length)<0.6)continue;
    const pair=key+'|'+normalize(client);if(dismissed.has(pair))continue;
    if(!groups.has(pair))groups.set(pair,{key:pair,alias:name,client,caseIds:[],lawyers:(current.portfolios||[]).filter(p=>p.clients.some(c=>normalize(c)===normalize(client))).map(p=>p.lawyer)});
    const item=groups.get(pair);if(!item.caseIds.includes(base.id))item.caseIds.push(base.id);
   }
  }
  return [...groups.values()].sort((a,b)=>b.caseIds.length-a.caseIds.length||a.alias.localeCompare(b.alias,'pt-BR'));
 }
 function applyPortfolioLinks(current){
  const portfolios=(current.portfolios||[]).map(p=>({lawyer:p.lawyer,clients:p.clients.map(name=>({name,key:normalize(name)})).filter(c=>c.key)}));
  let changed=false;const annotations={...(current.annotations||{})};
  for(const base of current.base||[]){
   const prior=annotations[base.id]||{},texts=[base.parties,prior.client,...(prior.clientNames||[]),...(base.courtSources||[]).flatMap(s=>[...(s.parties||[]).map(p=>p.name),...(s.representedClients||[]).map(p=>p.name)])].filter(Boolean).map(value=>' '+normalize(value)+' ');
   const owners=new Set(),clients=new Map();
   const aliases=(current.clientAliases||[]).filter(a=>a.alias&&a.client&&texts.some(text=>text.includes(' '+normalize(a.alias)+' ')));
   for(const alias of aliases)texts.push(' '+normalize(alias.client)+' ');
   for(const p of portfolios)for(const client of p.clients)if(texts.some(text=>text.includes(' '+client.key+' '))){owners.add(p.lawyer);if(!clients.has(client.key))clients.set(client.key,client.name);}
   const portfolioOwners=[...owners].sort((a,b)=>a.localeCompare(b,'pt-BR')),portfolioClients=[...clients.values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));
   if(JSON.stringify(portfolioOwners)!==JSON.stringify(prior.portfolioOwners||[])||JSON.stringify(portfolioClients)!==JSON.stringify(prior.portfolioClients||[])){annotations[base.id]={...prior,portfolioOwners,portfolioClients};changed=true;}
  }
  return {data:changed?{...current,annotations}:current,changed};
 }
 const api={applyPortfolioLinks,normalize,suggestClientLinks,observations};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PortfolioLinks=api;
})(typeof window==='undefined'?globalThis:window);
