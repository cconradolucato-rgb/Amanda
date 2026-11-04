'use strict';
// Only publication headers identify a process in a structured AASP report.
(function(root){
 const numberSource='\\b(\\d{7})\\s*-\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\s*\\.\\s*(\\d)\\s*\\.\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\b';
 const cnj=m=>`${m[1]}-${m[2]}.${m[3]}.${m[4]}.${m[5]}.${m[6]}`;
 const normalized=text=>String(text||'').replace(/\s+/g,' ').trim();
 function legacy(text){const matches=[...text.matchAll(new RegExp(numberSource,'g'))],groups=new Map();matches.forEach((m,i)=>{const id=cnj(m),block=text.slice(m.index,matches[i+1]?.index??text.length).trim();if(!groups.has(id))groups.set(id,{id,texts:[]});const group=groups.get(id);if(!group.texts.includes(block))group.texts.push(block);});return [...groups.values()].map(g=>({...g,text:g.texts.join('\n\n')}));}
 function dateOf(text){const m=text.match(/data\s+de\s+disponibiliza[çc][aã]o\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/i);return m?`${m[3]}-${m[2]}-${m[1]}`:'';}
 function parse(text){
  const cleaned=String(text).replace(/\r/g,'').trim();if(cleaned.length>1000000)throw Error('O relatório contém texto demais. Divida-o em arquivos menores.');
  const old=legacy(cleaned);if(!old.length)throw Error('Nenhum número de processo no padrão CNJ foi identificado. Envie um PDF com texto selecionável ou um arquivo TXT.');
  const headers=[...cleaned.matchAll(new RegExp('(?:^|\\n)[\\t ]*Processo\\s*:\\s*'+numberSource,'gi'))].filter(m=>/Data\s+de\s+disponibiliza[çc][aã]o\s*:|Tipo\s+de\s+comunica[çc][aã]o\s*:/i.test(cleaned.slice(m.index,m.index+700)));
  let result;
  if(headers.length){
   const refs=[...cleaned.matchAll(/(?:^|\n)[\t ]*Publica[çc][aã]o\s*:\s*(\d+)/gi)],sections=[...cleaned.matchAll(/(?:^|\n)[\t ]*\d+\s*\.\s*D\s*J\s*E\s*N\s*[-–][^\n]*/gi)];
   const primaryHeaders=sections.length?sections.map((section,i)=>headers.find(h=>h.index>section.index&&h.index<(sections[i+1]?.index??cleaned.length))):headers;if(primaryHeaders.some(h=>!h))throw Error('Não foi possível identificar o processo principal de todas as publicações. Confira o arquivo antes de importar.');
   const anchors=primaryHeaders.map((h,i)=>{const floor=primaryHeaders[i-1]?.index??-1,ref=refs.filter(r=>r.index>floor&&r.index<h.index).at(-1),section=sections.filter(r=>r.index>floor&&r.index<h.index).at(-1);return {header:h,ref,start:ref?.index??h.index,section:section?.index};});
   const groups=new Map();
   anchors.forEach((a,i)=>{const id=cnj(a.header),next=anchors[i+1],end=next?(next.section??next.start):cleaned.length,block=cleaned.slice(a.start,end).replace(/^[ \t]*Página:[ \t]*\d+[ \t]*$/gmi,'').replace(/^[ \t]*(?:Gerado em|Associado):[^\n]*$/gmi,'').replace(/^[ \t]*OAB:[ \t]*\d+[ \t]*$/gmi,'').replace(/^[ \t]*_{5,}[ \t]*$/gm,'').trim(),parts=block.match(/Parte\s*\(s\)\s*:\s*([\s\S]*?)(?=\n\s*Advogado\s*\(s\)|$)/i)?.[1]?.trim()||'',court=block.match(/[ÓO]rg[aã]o:\s*([^\n]+)/i)?.[1]?.trim()||'';
    if(!groups.has(id))groups.set(id,{id,publications:[],parties:new Set(),court});const group=groups.get(id);for(const p of parts.split('\n').map(s=>s.trim()).filter(Boolean))group.parties.add(p);group.publications.push({text:block,publicationRef:a.ref?.[1]||'',availabilityDate:dateOf(block)});
   });
   result=[...groups.values()].map(g=>({id:g.id,publications:g.publications,text:g.publications.map(p=>p.text).join('\n\n'),legacyTexts:old.filter(e=>e.id===g.id).map(e=>e.text),event:'Publicação AASP — conferir',parties:[...g.parties].join(' / ')||'A conferir no relatório',court:g.court||'A conferir no relatório',dates:'Conferir datas no texto de origem'}));
   const primary=new Set(result.map(g=>g.id));result.referenceEntries=old.filter(e=>!primary.has(e.id)).map(e=>({...e,sourceCaseIds:result.filter(g=>g.publications.some(p=>[...p.text.matchAll(new RegExp(numberSource,'g'))].some(m=>cnj(m)===e.id))).map(g=>g.id)}));
  }else result=old.map(g=>({...g,event:'Publicação AASP — conferir',parties:'A conferir no relatório',court:'A conferir no relatório',dates:'Conferir datas no texto de origem'}));
  if(result.length>200)throw Error('Foram encontrados mais de 200 processos. Divida o relatório antes de importar.');return result;
 }
 function merge(current,entries,file,now,options={}){
  const next={...current,base:current.base.map(row=>({...row})),imports:[...(current.imports||[])]};let added=0,updated=0,duplicates=0,publicationCount=0,newPublications=0,repeatedPublications=0;const caseIds=[],publicationKeys=[],correctedReferenceCaseIds=[];
  for(const entry of entries){
   let found=next.base.find(row=>row.id===entry.id);const existed=!!found;
   if(!found){found={id:entry.id,event:entry.event,parties:entry.parties,court:entry.court,dates:entry.dates,note:'Importação do relatório AASP. Conferência jurídica e vínculo com cliente pendentes.',priority:'Média',tasks:['Conferir publicação importada e definir providências.'],source:'',importedPublications:[]};next.base.push(found);}
   if(existed){for(const field of ['parties','court'])if((!found[field]||found[field]==='A conferir no relatório')&&entry[field]&&entry[field]!=='A conferir no relatório')found[field]=entry[field];}
   let publications=[...(found.importedPublications||[])],allRepeated=true;
   const incoming=entry.publications?.length?entry.publications:[entry],legacyGroup=entry.publications?.length?publications.find(p=>!p.superseded&&(entry.legacyFingerprints||[]).includes(p.fingerprint)):null;
   for(const item of incoming){
    publicationCount++;const date=entry.reviewedAvailabilityDate||item.availabilityDate||entry.availabilityDate||'',externalKey=item.publicationRef&&date?'aasp:'+date+':'+item.publicationRef+':'+entry.id:'',fingerprint=item.fingerprint;
    const index=publications.findIndex(p=>!p.superseded&&(p.fingerprint===fingerprint||externalKey&&p.externalKey===externalKey));
    publicationKeys.push({caseId:entry.id,fingerprint});
    if(index>=0){const p=publications[index],changed=normalized(p.text)!==normalized(item.text),priorFingerprints=[...new Set([...(p.previousFingerprints||[]),...(p.fingerprint!==fingerprint?[p.fingerprint]:[])])];publications[index]={...p,fingerprint,text:item.text,lastImportedAt:now,lastImportedFile:file,...(date?{availabilityDate:date}:{}),...(externalKey?{externalKey,publicationRef:item.publicationRef}:{}),...(priorFingerprints.length?{previousFingerprints:priorFingerprints}:{}),...(changed?{previousVersions:[...(p.previousVersions||[]),{text:p.text,fingerprint:p.fingerprint,replacedAt:now}]}:{})};repeatedPublications++;continue;}
    if(!legacyGroup){newPublications++;allRepeated=false;}else repeatedPublications++;
    publications.push({fingerprint,text:item.text,file:legacyGroup?.file||file,importedAt:legacyGroup?.importedAt||now,...(legacyGroup?{lastImportedAt:now,lastImportedFile:file}:{}),...(date?{availabilityDate:date}:{}),...(externalKey?{externalKey,publicationRef:item.publicationRef}:{})});
    const origin=`Relatório AASP: ${file}\nImportado em: ${now}\n\n${item.text}`;found.source=(found.source?found.source+'\n\n--- Nova publicação importada ---\n':'')+origin;
   }
   if(legacyGroup){const replacements=incoming.map(p=>p.fingerprint);publications=publications.map(p=>p===legacyGroup?{...p,superseded:true,replacementFingerprints:replacements,supersededAt:now}:p);}
   found.importedPublications=publications;caseIds.push(entry.id);if(existed){updated++;if(allRepeated)duplicates++;}else added++;
  }
  const selected=new Set(caseIds);
  for(const ref of options.referenceEntries||[]){if(!ref.sourceCaseIds?.length||!ref.sourceCaseIds.every(id=>selected.has(id)))continue;const found=next.base.find(b=>b.id===ref.id);if(!found)continue;let changed=false;const corrected=(found.importedPublications||[]).map(p=>{if(p.fingerprint!==ref.fingerprint||p.referenceOnly)return p;changed=true;return {...p,referenceOnly:true,referenceClassifiedAt:now,referenceSourceCases:ref.sourceCaseIds};});if(changed){found.importedPublications=corrected;correctedReferenceCaseIds.push(ref.id);}}
  if(added||updated)next.imports.push({file,importedAt:now,added,updated,duplicates,caseIds,publicationCount,newPublications,repeatedPublications,publicationKeys,correctedReferenceCaseIds});
  return {next,added,updated,duplicates,publicationCount,newPublications,repeatedPublications};
 }
 const api={parse,merge};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AASPImport=api;
})(typeof window==='undefined'?globalThis:window);
