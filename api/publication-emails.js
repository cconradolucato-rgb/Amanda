'use strict';
const store=require('../server/office-store'),mail=require('../server/publication-mail'),outlook=require('../server/outlook-mail'),{today}=require('../web/daily-publications-core'),{isoDate}=require('../web/publication-core');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 try{
  const {headers,user}=await store.access(req),body=typeof req.body==='string'?JSON.parse(req.body):req.body||{},date=body.date||today();if(!isoDate(date))return res.status(400).json({error:'Data inválida.'});
  let row=await store.read(headers);
  if(body.mode==='status')return res.json({rows:[row],mail:{connected:mail.configured(row.data),oauthReady:outlook.ready(),sender:outlook.sender}});
  require('../web/office-access').requireAdmin(user);
  // Automatic calls use today's date. An explicit click may prepare another date.
  row=await store.update(headers,data=>mail.queueMail(data,date,user,undefined,body.mode==='prepare'?body.lawyer||'':'').data);
  if(body.mode==='auto')for(const pendingDate of new Set((row.data.publicationMail||[]).filter(j=>['blocked_sender','blocked_recipient','queued'].includes(j.status)).map(j=>j.date)))row=await store.update(headers,data=>mail.queueMail(data,pendingDate,user).data);
  row=await require('../server/publication-delivery').processPublications(headers,user,{all:body.mode==='auto',date,lawyer:body.lawyer||'',maxJobs:1});
  return res.json({rows:[row],pending:(row.data.publicationMail||[]).filter(j=>j.status==='queued').length,mail:{connected:mail.configured(row.data),oauthReady:outlook.ready(),sender:outlook.sender}});
 }catch(error){return res.status(error.status||502).json({error:error.status?error.message:'Não foi possível atualizar os envios. Tente novamente.'});}
};
