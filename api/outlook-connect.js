'use strict';
const crypto=require('node:crypto'),store=require('../server/office-store'),outlook=require('../server/outlook-mail');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Método não permitido.'});
 try{
  const {user,headers}=await store.access(req);await store.read(headers);const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};if(body.mode==='start'&&!body.personal&&user.email?.toLowerCase()!==outlook.sender)return res.status(403).json({error:'Entre com a conta da Amanda para conectar o Outlook remetente.'});
  if(!outlook.ready())return res.status(409).json({error:'O aplicativo Microsoft do escritório ainda precisa ser configurado pelo administrador. Não há autorização Outlook ativa.'});
  if(body.mode==='start'){
   if(req.headers.host&&req.headers.host.split(':')[0]!=='dibbernjuridico.vercel.app')return res.status(409).json({error:'Conecte o Outlook pelo endereço principal https://dibbernjuridico.vercel.app, entrando com sua conta.'});
   const verifier=crypto.randomBytes(40).toString('base64url'),nonce=crypto.randomBytes(24).toString('base64url');
   res.setHeader('Set-Cookie',`outlook_auth=${outlook.seal({userId:user.id,personal:!!body.personal,email:body.personal?user.email.toLowerCase():outlook.sender,nonce,verifier,expires:Date.now()+10*60*1000})}; HttpOnly; Secure; SameSite=Lax; Path=/api/outlook-connect; Max-Age=600`);
   const params=new URLSearchParams({client_id:process.env.OUTLOOK_CLIENT_ID,response_type:'code',redirect_uri:outlook.redirect(),response_mode:'query',scope:'openid profile offline_access User.Read Mail.Send',state:nonce,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',login_hint:body.personal?user.email.toLowerCase():outlook.sender,prompt:'consent'});
   return res.json({url:`https://login.microsoftonline.com/${outlook.tenant()}/oauth2/v2.0/authorize?${params}`});
  }
  if(body.mode!=='finish'||typeof body.code!=='string'||typeof body.state!=='string')return res.status(400).json({error:'Resposta de autorização inválida.'});
  const cookie=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('outlook_auth='));if(!cookie)return res.status(400).json({error:'A autorização expirou. Inicie a conexão novamente.'});
  let state;try{state=outlook.unseal(cookie.slice('outlook_auth='.length));}catch{return res.status(400).json({error:'Autorização inválida. Inicie novamente.'});}
  if(state.userId!==user.id||state.nonce!==body.state||state.expires<Date.now())return res.status(400).json({error:'A autorização expirou ou não corresponde à sua conta.'});
  res.setHeader('Set-Cookie','outlook_auth=; HttpOnly; Secure; SameSite=Lax; Path=/api/outlook-connect; Max-Age=0');
  const token=await outlook.tokens({grant_type:'authorization_code',code:body.code,redirect_uri:outlook.redirect(),code_verifier:state.verifier});if(!token.refresh_token)throw Error('A Microsoft não concedeu acesso para os próximos envios.');
  const response=await fetch('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Não foi possível verificar a conta Outlook.');const account=await response.json();if(![account.mail,account.userPrincipalName].some(e=>e?.toLowerCase()===(state.email||outlook.sender)))return res.status(403).json({error:'Conecte o Outlook correspondente à conta usada para iniciar a autorização.'});
  const at=new Date().toISOString(),email=state.email||outlook.sender,connection={email,connectedAt:at,connectedBy:user.id,encryptedCredentials:outlook.seal({refreshToken:token.refresh_token,accountId:account.id})};await store.update(headers,data=>({...data,...(state.personal?{outlookConnections:{...(data.outlookConnections||{}),[user.id]:connection}}:{outlookConnection:connection}),activityLog:[...(data.activityLog||[]),{id:'outlook-connect-'+at,at,kind:'email',actorId:user.id,actorName:user.user_metadata?.dibbern_profile?.name||user.email,title:'Outlook remetente conectado',details:email}]}));
  return res.json({connected:true,email});
 }catch(error){return res.status(error.status||502).json({error:error.status?error.message:'Não foi possível concluir a conexão Outlook. Tente novamente.'});}
};
