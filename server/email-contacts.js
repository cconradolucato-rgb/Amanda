'use strict';
const {normalize}=require('../web/portfolio-links');
function syncEmailContacts(data,user){
 const profileName=normalize(user.user_metadata?.dibbern_profile?.name||'').split(' ');const candidates=data.portfolios.filter(p=>!p.profileUserId&&normalize(p.lawyer).replace(/^dra? /,'').split(' ').every(word=>profileName.includes(word)));
 const defaults=[{name:'carina dibbern',email:'carina@dibbernadvogados.com.br'},{name:'danilo dibbern',email:'danilo@dibbernadvogados.com.br'}];let changed=false;
 const portfolios=data.portfolios.map(p=>{const name=normalize(p.lawyer).replace(/^dra? /,''),fallback=defaults.find(d=>d.name===name),own=(p.profileUserId===user.id||candidates.length===1&&p===candidates[0])&&user.email;const email=own||p.email||fallback?.email;if(email&&(email!==p.email||own&&p.profileUserId!==user.id)){changed=true;return {...p,email,...(own?{profileUserId:user.id}:{})};}return p;});
 return {data:changed?{...data,portfolios}:data,changed};
}
module.exports={syncEmailContacts};
