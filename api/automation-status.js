'use strict';
const store=require('../server/office-store'),{report}=require('../server/automation-status');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
 try{const {headers}=await store.access(req),row=await store.read(headers);return res.json(report(row.data));}
 catch(error){return res.status(error.status||502).json({error:error.status?error.message:'Não foi possível verificar as configurações da automação.'});}
};
