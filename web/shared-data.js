'use strict';
(function(root){
 const missing=Symbol('missing'),plain=v=>v&&typeof v==='object'&&!Array.isArray(v),same=(a,b)=>a===b||JSON.stringify(a)===JSON.stringify(b),value=(o,k)=>Object.hasOwn(o,k)&&o[k]!==undefined?o[k]:missing;
 function conflict(path){const error=Error('Outra pessoa alterou o mesmo campo ('+path.join(' → ')+'). Suas alterações foram mantidas no formulário. Confira a versão atual antes de salvar.');error.code='EDIT_CONFLICT';throw error;}
 function identity(list,path){if(!list.length)return null;if(list.every(v=>plain(v)&&v.id!==undefined))return v=>'id:'+v.id;if(path.at(-1)==='portfolios'&&list.every(v=>plain(v)&&v.lawyer))return v=>'lawyer:'+v.lawyer;if(path.at(-1)==='clientAliases'&&list.every(v=>plain(v)&&v.alias))return v=>'alias:'+v.alias;if(path.at(-1)==='deadlineReviews'&&list.every(v=>plain(v)&&v.at))return v=>JSON.stringify([v.at,v.by,v.owner]);return null;}
 function merge(base,desired,latest,path=[]){
  if(same(base,desired))return latest;if(same(base,latest)||same(desired,latest))return desired;
  if(['confirmedAt','confirmedBy','confirmedByName'].includes(path.at(-1)))return latest;
  if(['portfolioOwners','portfolioClients'].includes(path.at(-1)))return latest;
  if(/^(updatedAt|validatedAt|validatedBy|validatedByName|processStateUpdatedAt|processStateUpdatedBy|processStateUpdatedByName)$/.test(path.at(-1)||''))return desired;
  if((plain(base)||base===missing)&&plain(desired)&&plain(latest)){
   const out={},keys=new Set([...Object.keys(base===missing?{}:base),...Object.keys(desired),...Object.keys(latest)]),deriveOwner=Array.isArray(desired.owners)&&desired.owner===desired.owners.join(' / ');
   for(const k of keys){if(k==='owner'&&deriveOwner)continue;const v=merge(base===missing?missing:value(base,k),value(desired,k),value(latest,k),[...path,k]);if(v!==missing)Object.defineProperty(out,k,{value:v,writable:true,enumerable:true,configurable:true});}
   if(deriveOwner)out.owner=(out.owners||[]).join(' / ');return out;
  }
  if(Array.isArray(desired)&&Array.isArray(latest)&&(Array.isArray(base)||base===missing)){
   const before=base===missing?[]:base,combined=[...before,...desired,...latest];
   if(combined.every(v=>v===null||typeof v!=='object')){const removed=new Set(before.filter(v=>!desired.includes(v))),added=desired.filter(v=>!before.includes(v));if(path.at(-1)==='owners'&&removed.size&&added.length&&before.some(v=>!latest.includes(v))&&latest.some(v=>!before.includes(v)))conflict(path);return [...new Set([...latest.filter(v=>!removed.has(v)),...added])];}
   const key=identity(combined,path);if(key){const maps=[before,desired,latest].map(list=>{const m=new Map(list.map(v=>[key(v),v]));if(m.size!==list.length)conflict(path);return m;}),order=[...new Set([...maps[2].keys(),...maps[1].keys()])],out=[];for(const id of order){const v=merge(maps[0].has(id)?maps[0].get(id):missing,maps[1].has(id)?maps[1].get(id):missing,maps[2].has(id)?maps[2].get(id):missing,[...path,id]);if(v!==missing)out.push(v);}return out;}
  }
  return conflict(path);
 }
 const api={merge:(base,desired,latest)=>merge(base,desired,latest),same};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SharedData=api;
})(typeof window==='undefined'?globalThis:window);
