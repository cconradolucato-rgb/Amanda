'use strict';
const store=require('../server/office-store'),audit=require('../server/audit');
const allowed=new Set(['navigation','attempt','error','session','export','connection']);
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 try{
  const {headers,user}=await store.access(req);const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(!allowed.has(b.category)||typeof b.title!=='string'||b.title.length>200)return res.status(400).json({error:'Registro inválido.'});
  if(typeof b.eventId!=='string'||!/^[a-zA-Z0-9-]{20,80}$/.test(b.eventId))return res.status(400).json({error:'Identificador inválido.'});
  const entry=audit.event(user,b.title,{category:b.category,status:['success','failure','pending','info'].includes(b.status)?b.status:'info',details:String(b.details||'').slice(0,4000),caseIds:Array.isArray(b.caseIds)?b.caseIds.filter(x=>typeof x==='string'&&x.length<100).slice(0,50):[],context:audit.safe(b.context||{}),reportedBy:'browser'});
  entry.id='browser:'+user.id+':'+b.eventId;
  let baseRevision;const row=await store.update(headers,(data,current)=>{baseRevision=current.revision;return (data.activityLog||[]).some(e=>e.id===entry.id)?data:audit.append(data,entry);});return res.json({rows:[row],eventId:entry.id,baseRevision});
 }catch(e){return res.status(e.status||502).json({error:e.status?e.message:'Não foi possível gravar o histórico. Tente novamente.'});}
};
