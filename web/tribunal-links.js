'use strict';
(function(root){
 const states=['ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','se','sp','to'];
 function official(value){try{const u=new URL(value);return u.protocol==='https:'&&/(^|\.)jus\.br$/i.test(u.hostname)?u.href:'';}catch{return '';}}
 function forCase(record){
  for(const source of record.courtSources||[]){const url=official(source.url);if(url)return {url,label:'Abrir no tribunal',direct:true,system:source.system||'Tribunal'};}
  const match=String(record.id||'').match(/^\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}$/);let url='',system='';
  if(match){const branch=Number(match[1]),region=Number(match[2]);if(branch===8&&region>=1&&region<=27){system='TJ'+states[region-1].toUpperCase();url=region===13?'https://www.tjmg.jus.br/portal-tjmg/processos/consulta-processual/':`https://www.tj${states[region-1]}.jus.br/`;}
   else if(branch===4&&region>=1&&region<=6){system='TRF'+region;url=`https://www.trf${region}.jus.br/`;}
   else if(branch===5&&region>=1&&region<=24){system='TRT'+region;url=`https://www.trt${region}.jus.br/`;}
   else if(branch===1){system='STF';url='https://www.stf.jus.br/';}else if(branch===3){system='STJ';url='https://www.stj.jus.br/';}else if(branch===5&&region===0){system='TST';url='https://www.tst.jus.br/';}else if(branch===6){system='Justiça Eleitoral';url='https://www.tse.jus.br/';}else if(branch===7){system='Justiça Militar da União';url='https://www.stm.jus.br/';}else if(branch===9&&[13,21,26].includes(region)){system='Justiça Militar Estadual';url=region===13?'https://www.tjmmg.jus.br/':region===21?'https://www.tjmrs.jus.br/':'https://www.tjmsp.jus.br/';}
  }
  return {url:url||'https://www.cnj.jus.br/',label:url?'Abrir no tribunal':'Abrir portal do Judiciário',direct:false,system:system||'CNJ'};
 }
 const api={forCase,official};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TribunalLinks=api;
})(typeof window==='undefined'?globalThis:window);
