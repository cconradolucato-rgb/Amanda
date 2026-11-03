'use strict';
// Server-only office update. Never ship client names in public frontend assets.
const supabaseURL='https://skujqujylfugqopsudrn.supabase.co';
const publicKey='sb_publishable_A8654c9DYy4VVMsJDr1M0g_zoBmwu5K';
const {syncEmailContacts}=require('../server/email-contacts');
const {queueMail}=require('../server/publication-mail');
const {today}=require('../web/daily-publications-core');
const {indexCourtPublications}=require('../server/court-publications');
const {backfillLegacyPublications}=require('../server/legacy-publications');
const {recordActivity}=require('../web/activity-core');
const {syncProfileOAB}=require('../server/sync-profile-oab');
const {repairInternalAssignments}=require('../server/repair-internal-assignments');
const {applyPortfolioLinks}=require('../web/portfolio-links');
const {applyCourtUpdate}=require('../server/apply-court-update');
const updateId='danilo-portfolio-20261029';
const addition={lawyer:'Dr. Danilo Dibbern',clients:['Condomínio Bem Viver','Distrito Industrial Pref. Sebastião Fumagalli','Associaçao Monte Real','Condomínio Park Life','Associação Porto Fino','Associação San Pietro','Associação Solar dos Nobres']};
const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const lawyerName=value=>normalize(value).replace(/^(?:dr|dra)\.?\s+/,'');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
  const authorization=req.headers.authorization;
  if(typeof authorization!=='string'||!/^Bearer [^\s]+$/.test(authorization))return res.status(401).json({error:'Entre com sua conta.'});
  const headers={apikey:publicKey,Authorization:authorization,'Content-Type':'application/json'};
  try{
    const userResponse=await fetch(supabaseURL+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
    if(!userResponse.ok)return res.status(401).json({error:'Sessão inválida.'});
    const user=await userResponse.json();if(!user?.id)return res.status(401).json({error:'Sessão inválida.'});
    for(let attempt=0;attempt<3;attempt++){
      // Both reads and writes use the caller's token and existing database RLS.
      const response=await fetch(supabaseURL+'/rest/v1/dashboards?id=eq.1&select=data,revision',{headers,signal:AbortSignal.timeout(10000)});
      if(!response.ok)return res.status(response.status===401?401:403).json({error:'Sem permissão para acessar a carteira.'});
      const rows=await response.json();if(!Array.isArray(rows)||rows.length!==1)return res.status(403).json({error:'Sem permissão para acessar a carteira.'});
      const current=rows[0];
      if(!Number.isSafeInteger(current.revision)||!Array.isArray(current.data?.portfolios)||!Array.isArray(current.data?.base))return res.status(502).json({error:'Carteira inválida.'});
      const updates=Array.isArray(current.data.officeUpdates)?current.data.officeUpdates:[];
      const courtUpdate=applyCourtUpdate(current.data);
      const repaired=repairInternalAssignments(courtUpdate.data);
      const publications=indexCourtPublications(repaired.data);
      const legacy=backfillLegacyPublications(publications.data);
      const registered=syncProfileOAB(legacy.data,user);
      const contacts=syncEmailContacts(registered.data,user);
      const linked=applyPortfolioLinks(contacts.data);
      const queued=queueMail(linked.data,today(),user);
      const portfolioUpdate={data:queued.data,changed:linked.changed||contacts.changed||queued.changed};
      if(updates.includes(updateId)&&!courtUpdate.changed&&!repaired.changed&&!publications.changed&&!legacy.changed&&!registered.changed&&!portfolioUpdate.changed)return res.status(200).json({rows,updated:false});
      const portfolios=portfolioUpdate.data.portfolios.map(p=>({...p,clients:[...p.clients]}));
      const existing=portfolios.find(p=>lawyerName(p.lawyer)===lawyerName(addition.lawyer));let changed=false;
      if(existing){const known=new Set(existing.clients.map(normalize));for(const client of addition.clients)if(!known.has(normalize(client))){existing.clients.push(client);known.add(normalize(client));changed=true;}}
      else{portfolios.push({...addition,clients:[...addition.clients]});changed=true;}
      
      const next=recordActivity(current.data,{...portfolioUpdate.data,portfolios,officeUpdates:[...new Set([...(portfolioUpdate.data.officeUpdates||[]),updateId])]},user);
      const write=await fetch(supabaseURL+`/rest/v1/dashboards?id=eq.1&revision=eq.${current.revision}`,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({data:next,revision:current.revision+1}),signal:AbortSignal.timeout(10000)});
      if(!write.ok)return res.status(403).json({error:'Sem permissão para atualizar a carteira.'});
      const saved=await write.json();if(Array.isArray(saved)&&saved.length===1)return res.status(200).json({rows:saved,updated:true});
    }
    return res.status(409).json({error:'A carteira mudou em outra janela. Recarregue para sincronizar.'});
  }catch{return res.status(502).json({error:'Não foi possível sincronizar a carteira. Tente novamente.'});}
};
