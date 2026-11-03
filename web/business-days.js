'use strict';
(function(root){
 function iso(d){return d.toISOString().slice(0,10);}
 function easter(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return new Date(Date.UTC(year,Math.floor(n/31)-1,n%31+1));}
 const tjsp2026=new Set(['2026-02-16','2026-02-17','2026-04-02','2026-04-03','2026-04-20','2026-04-21','2026-05-01','2026-06-04','2026-06-05','2026-07-09','2026-07-10','2026-09-07','2026-10-12','2026-10-30','2026-11-02','2026-11-20','2026-12-07','2026-12-08']);
 const tjspSource='https://www.tjsp.jus.br/Download/Comunicacao/Marketing/Links/CALENDARIO-2026-final.pdf';
 function add(start,count,excluded=[],recess=false,calendar='national'){
  if(!['national','tjsp-2026'].includes(calendar))throw Error('Selecione um calendário válido.');
  const d=new Date(start+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(d.getTime())||iso(d)!==start||!Number.isInteger(count)||count<1||count>1000)throw Error('Informe uma data válida e um prazo entre 1 e 1000 dias úteis.');
  const custom=new Set(excluded);for(const v of custom){const t=new Date(v+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(t.getTime())||iso(t)!==v)throw Error('Informe feriados no formato AAAA-MM-DD.');}
  for(let n=0;n<count;){d.setUTCDate(d.getUTCDate()+1);const key=iso(d),md=key.slice(5),e=easter(d.getUTCFullYear());e.setUTCDate(e.getUTCDate()-2);const suspended=recess&&(md>='12-20'||md<='01-20'),tjsp=calendar==='tjsp-2026';if(tjsp&&d.getUTCFullYear()!==2026)throw Error('O calendário anual TJSP de '+d.getUTCFullYear()+' ainda não está cadastrado. Confira o prazo fatal manualmente ou escolha o calendário nacional com as exclusões locais verificadas.');const courtClosed=tjsp&&(tjsp2026.has(key)||md<='01-06'||md>='12-20'),partialBoundary=tjsp&&key==='2026-02-18'&&(n===0||n===count-1);if(courtClosed||partialBoundary||d.getUTCDay()===0||d.getUTCDay()===6||custom.has(key)||suspended||['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'].includes(md)||iso(e)===key)continue;n++;}return iso(d);
 }
 const api={add,tjspSource};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BusinessDays=api;
})(typeof window==='undefined'?globalThis:window);
