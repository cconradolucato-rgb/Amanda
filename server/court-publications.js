'use strict';
const snapshotVersion=require('./court-version');const {isoDate}=require('../web/publication-core');
const version=snapshotVersion+'-publications-v4';
function publicationDates(movement){
 const title=String(movement.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),text=String(movement.details||'');
 if(!/publica|disponibiliza/.test(title))return [];
 if(/^data da publicacao sidap/.test(title)){const on=isoDate(movement.date);return on?[{on,dateKind:'Publicação',dateEvidence:'Data do campo de publicação SIDAP do tribunal'}]:[];}
 const header=text.split(/Teor do ato\s*:|Considera-se que|Processo\s+\d{7}-/i)[0].slice(0,700);
 const result=[];
 for(const match of header.matchAll(/(?:data\s+(?:da|de)\s+)?(disponibiliza(?:[çc][aã]o|d[oa])|publica(?:[çc][aã]o|d[oa]))\s*(?:em\s*)?[:\-]?\s*(\d{2}[./-]\d{2}[./-]\d{4})/gi)){const on=isoDate(match[2]);if(on)result.push({on,dateKind:/^disponibil/i.test(match[1])?'Disponibilização':'Publicação',dateEvidence:'Data expressa no cabeçalho da movimentação'});}
 if(!result.length&&/^(?:publicad|disponibilizad|disponibilizacao|publicacao|data da publicacao sidap)/.test(title)){const on=isoDate(movement.date);if(on)result.push({on,dateKind:/^disponibiliz/.test(title)?'Disponibilização':'Publicação',dateEvidence:'Data da movimentação de publicação no tribunal'});}
 return [...new Map(result.map(item=>[item.on+'|'+item.dateKind,item])).values()];
}
function indexCourtPublications(data){
 if(data.courtPublicationsVersion===version)return {data,changed:false};
 const snapshot=require('./court-snapshot');
 const entries=[],seen=new Set(),unresolved=[],warnings=[];
 for(const [caseId,sources] of Object.entries(snapshot.histories))for(const source of sources)for(const movement of source.movements||[]){const dates=publicationDates(movement);if(!dates.length&&/^(?:Certid[aã]o de Publica|Confirma[çc][aã]o da Publica|Publicado|Disponibiliz)/i.test(movement.title||''))unresolved.push({caseId,movementDate:isoDate(movement.date),title:movement.title,system:source.system,url:source.url});for(const event of dates){
  const key=[caseId,event.on,event.dateKind,movement.title,movement.details||''].join('|');if(seen.has(key))continue;seen.add(key);
  const dateWarning=event.dateKind==='Publicação'&&[0,6].includes(new Date(event.on+'T12:00:00Z').getUTCDay())?'A data de publicação informada pela fonte cai em fim de semana. Conferir na fonte antes de utilizar na contagem de prazo.':'';if(dateWarning)warnings.push({caseId,on:event.on,movementDate:isoDate(movement.date),title:movement.title,reason:dateWarning});
  entries.push({...(dateWarning?{dateWarning}:{}),id:'court-publication-'+require('node:crypto').createHash('sha256').update(key).digest('hex').slice(0,24),caseId,...event,movementDate:isoDate(movement.date),title:movement.title,text:movement.details||'',system:source.system,url:source.url,consultedAt:source.consultedAt,links:movement.links||[]});
 }}
 const next={...data,courtPublicationAudit:{indexedRecords:entries.length,unresolved,warnings},courtPublicationsPacked:require('node:zlib').gzipSync(JSON.stringify(entries)).toString('base64'),courtPublicationsVersion:version};delete next.courtPublications;Object.defineProperty(next,'courtPublications',{value:entries,enumerable:false});return {data:next,changed:true};
}
module.exports={indexCourtPublications,publicationDates};
