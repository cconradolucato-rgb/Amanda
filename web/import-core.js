'use strict';
// Conservative extraction: no client, lawyer or legal deadline is inferred.
(function(root){
  const numberPattern=/\b(\d{7})\s*-\s*(\d{2})\s*\.\s*(\d{4})\s*\.\s*(\d)\s*\.\s*(\d{2})\s*\.\s*(\d{4})\b/g;
  function parse(text){
    const cleaned=String(text).replace(/\r/g,'').trim();
    if(cleaned.length>1000000)throw Error('O relatório contém texto demais. Divida-o em arquivos menores.');
    const matches=[...cleaned.matchAll(numberPattern)];
    if(!matches.length)throw Error('Nenhum número de processo no padrão CNJ foi identificado. Envie um PDF com texto selecionável ou um arquivo TXT.');
    const groups=new Map();
    matches.forEach((match,index)=>{
      const id=`${match[1]}-${match[2]}.${match[3]}.${match[4]}.${match[5]}.${match[6]}`;
      const block=cleaned.slice(match.index,matches[index+1]?.index??cleaned.length).trim();
      if(!groups.has(id))groups.set(id,{id,texts:[]});
      const group=groups.get(id);if(!group.texts.includes(block))group.texts.push(block);
    });
    if(groups.size>200)throw Error('Foram encontrados mais de 200 processos. Divida o relatório antes de importar.');
    return [...groups.values()].map(g=>({...g,text:g.texts.join('\n\n'),event:'Publicação AASP — conferir',parties:'A conferir no relatório',court:'A conferir no relatório',dates:'Conferir datas no texto de origem'}));
  }
  function merge(current,entries,file,now){
    const next={...current,base:current.base.map(row=>({...row})),imports:[...(current.imports||[])]};
    let added=0,updated=0,duplicates=0;const caseIds=[];
    for(const entry of entries){
      const found=next.base.find(row=>row.id===entry.id);
      const publications=found?.importedPublications||[];
      if(publications.some(p=>p.fingerprint===entry.fingerprint)){
        found.importedPublications=publications.map(p=>p.fingerprint!==entry.fingerprint?p:{...p,lastImportedAt:now,lastImportedFile:file,...(entry.availabilityDate?{availabilityDate:entry.availabilityDate}:{})});
        caseIds.push(entry.id);duplicates++;updated++;continue;
      }
      caseIds.push(entry.id);
      const publication={fingerprint:entry.fingerprint,text:entry.text,file,importedAt:now,...(entry.availabilityDate?{availabilityDate:entry.availabilityDate}:{})};
      const origin=`Relatório AASP: ${file}\nImportado em: ${now}\n\n${entry.text}`;
      if(found){
        found.importedPublications=[...publications,publication];
        found.source=(found.source?found.source+'\n\n--- Nova publicação importada ---\n':'')+origin;
        updated++;
      }else{
        next.base.push({id:entry.id,event:entry.event,parties:entry.parties,court:entry.court,dates:entry.dates,note:'Importação do relatório AASP. Conferência jurídica e vínculo com cliente pendentes.',priority:'Média',tasks:['Conferir publicação importada e definir providências.'],source:origin,importedPublications:[publication]});added++;
      }
    }
    if(added||updated)next.imports.push({file,importedAt:now,added,updated,caseIds});
    return {next,added,updated,duplicates};
  }
  root.AASPImport={parse,merge};
})(typeof window==='undefined'?globalThis:window);
