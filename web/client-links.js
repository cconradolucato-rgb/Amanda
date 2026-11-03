'use strict';
(function(){
 const dialog=$('client-links-dialog'),message=$('client-links-message');let busy=false,suggestions=[];
 function draw(){
  suggestions=PortfolioLinks.suggestClientLinks(documentData);
  $('client-link-suggestions').innerHTML=suggestions.length?suggestions.map((item,index)=>`<section class="client-link-item"><p><strong>Nome no processo:</strong> ${esc(item.alias)}</p><p><strong>Cliente da carteira:</strong> ${esc(item.client)}</p><p><strong>Responsável:</strong> ${item.lawyers.map(esc).join(' / ')}</p><details><summary>Conferir ${item.caseIds.length} processo(s) encontrado(s)</summary><p>${item.caseIds.map(esc).join('<br>')}</p></details><div class="client-link-actions"><button type="button" class="primary" data-confirm-client-link="${index}">Confirmar vínculo</button><button type="button" data-dismiss-client-link="${index}">Não corresponde</button></div></section>`).join(''):'<p class="muted">Nenhuma correspondência pendente encontrada. Nomes sem semelhança suficiente podem ser atribuídos em “Gerenciar / detalhes”.</p>';
  $('client-links-confirmed').innerHTML=(documentData.clientAliases||[]).map((item,index)=>`<section class="client-link-item"><p><strong>${esc(item.alias)}</strong> → ${esc(item.client)}</p><p class="muted">Confirmado por ${esc(item.confirmedByName||'integrante do escritório')}${item.confirmedAt?` em ${esc(new Date(item.confirmedAt).toLocaleString('pt-BR'))}`:''}</p><button type="button" data-remove-client-link="${index}">Desfazer vínculo</button></section>`).join('')||'<p class="muted">Nenhum vínculo confirmado ainda.</p>';
 }
 function close(){if(!busy)dialog.close();}
 $('open-client-links').onclick=()=>{if(!documentData)return;message.textContent='';draw();dialog.showModal();};
 $('close-client-links').onclick=close;dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.onclick=async event=>{
  const button=event.target.closest('[data-confirm-client-link],[data-dismiss-client-link],[data-remove-client-link]');if(!button||busy)return;
  const aliases=[...(documentData.clientAliases||[])],dismissals=[...(documentData.clientAliasDismissals||[])];let success='';
  if(button.hasAttribute('data-remove-client-link')){aliases.splice(Number(button.dataset.removeClientLink),1);success='Vínculo desfeito. As atribuições manuais foram preservadas.';}
  else{
   const item=suggestions[Number(button.dataset.confirmClientLink??button.dataset.dismissClientLink)];if(!item)return;
   if(button.hasAttribute('data-dismiss-client-link')){dismissals.push(item.key);success='Sugestão descartada. Nenhum processo foi atribuído.';}
   else{
    const actor=session.user||{},profile=actor.user_metadata?.dibbern_profile||{};
    aliases.push({alias:item.alias,client:item.client,confirmedBy:actor.id,confirmedByName:profile.name||actor.email||'Integrante do escritório',confirmedAt:new Date().toISOString()});
    success='Vínculo confirmado e aplicado aos processos correspondentes. As próximas importações também usarão esse vínculo.';
   }
  }
  busy=true;dialog.querySelectorAll('button').forEach(el=>el.disabled=true);message.textContent='Salvando vínculo…';
  try{
   await saveDashboard(PortfolioLinks.applyPortfolioLinks({...documentData,clientAliases:aliases,clientAliasDismissals:[...new Set(dismissals)]}).data);
   mountDashboard();draw();message.textContent=success;
  }catch(error){message.textContent=error.message;}
  finally{busy=false;dialog.querySelectorAll('button').forEach(el=>el.disabled=false);}
 };
})();
