'use strict';
const crypto=require('node:crypto');
const hidden=/password|senha|token|secret|credential|authorization|cookie|session|code_verifier/i;
function safe(value,key='',depth=0){
 if(hidden.test(key))return '[protegido]';
 if(depth>8)return '[estrutura extensa]';
 if(typeof value==='string')return /^data:/i.test(value)?'[anexo incorporado]':value.slice(0,12000);
 if(Array.isArray(value))return value.slice(0,500).map(v=>safe(v,'',depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!hidden.test(k)).slice(0,150).map(([k,v])=>[k,safe(v,k,depth+1)]));
 return value??null;
}
function event(user,title,extra={}){return {id:crypto.randomUUID(),at:new Date().toISOString(),kind:'audit',actorId:user.id,actorName:user.user_metadata?.dibbern_profile?.name||user.email,actorEmail:user.email,title,...safe(extra),source:'server'};}
function append(data,entry){return {...data,activityLog:[...(data.activityLog||[]),entry]};}
module.exports={safe,event,append};
