'use strict';
const {normalize}=require('../web/portfolio-links');const states=new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
function parseOAB(value){const input=String(value||'').toUpperCase().replace(/\bOAB\b/g,'').replace(/[^A-Z0-9]/g,'');let match=input.match(/^([A-Z]{2})(\d{1,7})$/);if(match&&states.has(match[1]))return {uf:match[1],oab:match[2]};match=input.match(/^(\d{1,7})([A-Z]{2})$/);return match&&states.has(match[2])?{uf:match[2],oab:match[1]}:null;}
function syncProfileOAB(data,user){
 const profile=user?.user_metadata?.dibbern_profile,registration=parseOAB(profile?.oab);if(!registration||!profile?.name)return {data,changed:false};
 const name=normalize(profile.name).split(' '),candidates=data.portfolios.filter(p=>p.profileUserId===user.id||normalize(p.lawyer).replace(/^dra? /,'').split(' ').every(word=>name.includes(word)));
 if(candidates.length!==1)return {data,changed:false};const selected=candidates[0];
 if(selected.oab===registration.oab&&selected.uf===registration.uf&&selected.profileUserId===user.id)return {data,changed:false};
 return {data:{...data,portfolios:data.portfolios.map(p=>p===selected?{...p,...registration,profileUserId:user.id}:p)},changed:true};
}
module.exports={syncProfileOAB,parseOAB};
