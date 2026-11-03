'use strict';
const snapshot=require('../server/court-snapshot');
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 const token=req.headers.authorization;if(typeof token!=='string'||!/^Bearer [^\s]+$/.test(token))return res.status(401).json({error:'Entre com sua conta.'});
 const headers={apikey:'sb_publishable_A8654c9DYy4VVMsJDr1M0g_zoBmwu5K',Authorization:token};
 try{
  const user=await fetch('https://skujqujylfugqopsudrn.supabase.co/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
  if(!user.ok)return res.status(401).json({error:'Sessão inválida.'});
  const permission=await fetch('https://skujqujylfugqopsudrn.supabase.co/rest/v1/dashboards?id=eq.1&select=id',{headers,signal:AbortSignal.timeout(10000)});
  if(!permission.ok)return res.status(403).json({error:'Conta sem acesso ao painel.'});const rows=await permission.json();if(!Array.isArray(rows)||rows.length!==1)return res.status(403).json({error:'Conta sem acesso ao painel.'});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  const sources=snapshot.histories[body?.id];if(!sources)return res.status(404).json({error:'Não há histórico coletado para este processo.'});
  const offset=body.offset??0;if(!Number.isSafeInteger(offset)||offset<0)return res.status(400).json({error:'Página inválida.'});const selected=body.sourceKey?sources.filter(s=>s.key===body.sourceKey):sources;if(!selected.length)return res.status(404).json({error:'Histórico não encontrado.'});
  return res.status(200).json({sources:selected.map(source=>{const movements=source.movements||[],end=offset+100;return {...source,movements:movements.slice(offset,end),totalMovements:movements.length,hasMore:end<movements.length,nextOffset:end<movements.length?end:null};}),coverage:snapshot.coverage});
 }catch{return res.status(502).json({error:'Não foi possível carregar o histórico. Tente novamente.'});}
};
