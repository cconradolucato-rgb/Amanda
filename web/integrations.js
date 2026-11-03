'use strict';
(function(){
 const dialog=$('integrations-dialog');
 const portals=[
 ['TJSP e-SAJ','https://esaj.tjsp.jus.br/','Há dados públicos coletados no painel. A consulta oficial pode conter informações mais recentes.'],
 ['TJSP eproc','https://eproc1g.tjsp.jus.br/','A consulta pública exige número do processo e CAPTCHA. A conexão automática deste painel ainda não está configurada.'],
 ['TRF3 PJe','https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam','A consulta pública por OAB exige verificação humana. A conexão automática deste painel ainda não está configurada.'],
 ['TRT15 PJe','https://pje.trt15.jus.br/consultaprocessual/','A coleta deste painel recebeu bloqueio HTTP 403. O advogado pode tentar a consulta diretamente no portal.']
 ];
 $('integration-courts').innerHTML=portals.map(([name,url,status])=>`<section><strong>${esc(name)}</strong><p>${esc(status)}</p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir portal oficial</a></section>`).join('');
 let statusRequest=0;
 async function checkAutomation(){
  const current=++statusRequest;$('automation-status-list').innerHTML='';$('automation-status-message').textContent='Verificando configurações no servidor…';$('refresh-automation-status').disabled=true;
  try{const response=await fetch('/api/automation-status',{headers:{Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(15000)}),result=await response.json();if(!response.ok||!Array.isArray(result.checks))throw Error(result.error||'Resposta de diagnóstico inválida.');if(current!==statusRequest)return;
   const labels={blocked:'Pendente de habilitação',unverified:'Configuração encontrada — execução não comprovada',pending:'Conferência pendente',info:'Informação histórica'};
   $('automation-status-list').innerHTML=result.checks.map(c=>`<article class="activity-entry"><strong>${esc(c.label)}</strong><p>${esc(labels[c.state]||'Verificação pendente')}</p><p>${esc(c.detail)}</p>${c.at?`<p>Data registrada: ${esc(new Date(c.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</p>`:''}</article>`).join('');
   $('automation-status-message').textContent=(result.automaticCollectionActive?'Consulte os resultados de coleta abaixo.':'Coleta automática de publicações ainda não ativa.')+' Configuração verificada em '+new Date(result.checkedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+'.';
  }catch(error){$('automation-status-message').textContent='Diagnóstico indisponível. '+error.message+' Nenhuma coleta foi confirmada por esta verificação.';}
  finally{if(current===statusRequest)$('refresh-automation-status').disabled=false;}
 }
 $('refresh-automation-status').onclick=checkAutomation;
 $('open-integrations').onclick=()=>{dialog.showModal();checkAutomation();};$('close-integrations').onclick=()=>dialog.close();
 window.addEventListener('dashboard-ready',()=>{$('open-integrations').hidden=false;});if(session&&documentData)$('open-integrations').hidden=false;
})();
