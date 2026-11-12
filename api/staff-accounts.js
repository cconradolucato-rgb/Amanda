'use strict';
const store=require('../server/office-store'),access=require('../web/office-access');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 try{
  const {headers,user}=await store.access(req);access.requireAdmin(user);
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{},mode=body.mode||'list';
  if(!['list','approve'].includes(mode))return res.status(400).json({error:'Operação inválida.'});
  if(mode==='approve'&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id||'')||typeof body.email!=='string'||!access.role({email:body.email})))return res.status(400).json({error:'Selecione um cadastro autorizado.'});
  const rpc=mode==='list'?'office_staff_accounts':'office_approve_account';
  const r=await fetch('https://skujqujylfugqopsudrn.supabase.co/rest/v1/rpc/'+rpc,{method:'POST',headers,body:JSON.stringify(mode==='list'?{}:{p_user_id:body.id,p_email:body.email.trim().toLowerCase()}),signal:AbortSignal.timeout(20000)});
  if(r.status===404)return res.status(503).json({configured:false,error:'A aprovação no painel precisa ser ativada uma única vez no SQL Editor do Supabase.'});
  if(!r.ok){const v=await r.json().catch(()=>null);return res.status(r.status===401||r.status===403?403:502).json({error:v?.code==='42501'?'A conta não pode ser aprovada: confira o e-mail, a suspensão e a permissão de administrador.':'Não foi possível confirmar a operação. Atualize a lista antes de tentar novamente.'});}
  const result=await r.json();return res.json(mode==='list'?{configured:true,accounts:result}:{configured:true,approved:result});
 }catch(e){return res.status(e.status||502).json({error:e.status?e.message:'Não foi possível consultar os cadastros agora.'});}
};
