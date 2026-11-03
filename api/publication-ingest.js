'use strict';
const store=require('../server/office-store'),auth=require('../server/automation-auth'),ingest=require('../server/publication-ingest');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 if(!auth.authorized(req.headers.authorization,process.env.PUBLICATIONS_INGEST_SECRET))return res.status(401).json({error:'Integração não autorizada.'});
 try{const headers=auth.databaseHeaders();if(Number(req.headers['content-length']||0)>2500000)return res.status(413).json({error:'Lote muito grande.'});const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(Buffer.byteLength(JSON.stringify(body||{}))>2500000)return res.status(413).json({error:'Lote muito grande.'});const batch=ingest.normalize(body);let outcome;
  await store.update(headers,data=>{outcome=ingest.merge(data,batch);return outcome.data;});
  return res.json({ok:true,replayed:outcome.replayed,receipt:outcome.receipt});
 }catch(e){if(e instanceof SyntaxError)return res.status(400).json({error:'JSON inválido.'});return res.status(e.status||502).json({error:e.status?e.message:'Não foi possível confirmar o recebimento do lote. Reenvie com o mesmo identificador para conferir sem duplicar.'});}
};
