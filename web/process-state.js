'use strict';
(function(){
 const dialog=$('process-state-dialog'),choice=$('case-state-choice'),message=$('process-state-message');let activeId=null,busy=false;
 const defaults=['Em andamento','Suspenso','Arquivado','Em recurso','Julgado','Extinto','Encerrado','Arquivado definitivamente'];
 function close(){if(!busy)dialog.close();}
 $('close-process-state').onclick=close;$('cancel-process-state').onclick=close;dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 choice.onchange=()=>{$('custom-state-field').hidden=choice.value!=='__custom__';if(choice.value==='__custom__')$('custom-state-name').focus();};
 window.openProcessState=id=>{
  if(!documentData||busy)return;const record=documentData.base.find(r=>r.id===id);if(!record)return;activeId=id;
  const annotation=documentData.annotations?.[id]||{},labels=[...new Set([...defaults,...(documentData.processStateLabels||[]),...Object.values(documentData.annotations||{}).map(a=>a.processState).filter(Boolean)])];
  choice.innerHTML='<option value="">Usar situação do tribunal</option>'+labels.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')+'<option value="__custom__">+ Criar etiqueta personalizada</option>';
  choice.value=annotation.processState||'';$('custom-state-field').hidden=true;$('custom-state-name').value='';message.textContent='';$('process-state-id').textContent='Processo '+id;
  $('process-state-official').textContent=(record.courtSources||[]).map(s=>`${s.system||'Tribunal'}: ${s.fields?.situacaoProcesso||'Situação não informada'}${s.consultedAt?' · Consulta: '+new Date(s.consultedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):''}`).join('\n')||'Situação não informada nos dados do tribunal disponíveis.';
  dialog.showModal();
 };
 $('process-state-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!activeId)return;
  const creating=choice.value==='__custom__',value=creating?$('custom-state-name').value.trim().replace(/\s+/g,' '):choice.value;
  if(creating&&(!value||value.length>60||value==='__custom__')){message.textContent='Digite uma etiqueta com até 60 caracteres.';return;}
  const actor=session.user||{},prior=documentData.annotations?.[activeId]||{};
  const labels=[...(documentData.processStateLabels||[])];if(creating&&!labels.some(l=>PortfolioLinks.normalize(l)===PortfolioLinks.normalize(value)))labels.push(value);
  const canonical=labels.find(l=>PortfolioLinks.normalize(l)===PortfolioLinks.normalize(value))||value;
  const next={...documentData,processStateLabels:labels,annotations:{...(documentData.annotations||{}),[activeId]:{...prior,processState:canonical,processStateUpdatedAt:new Date().toISOString(),processStateUpdatedBy:actor.id,processStateUpdatedByName:actor.user_metadata?.dibbern_profile?.name||actor.email||'Integrante do escritório'}}};
  busy=true;dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);message.textContent='Salvando situação…';
  try{await saveDashboard(next);window.refreshCaseStatus(activeId);dialog.close();}catch(error){message.textContent=error.message;}
  finally{busy=false;dialog.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);}
 };
})();
