'use strict';
(function(){
 const control=$('control-dialog'),editor=$('deadline-dialog');let activeId=null,busy=false,selectedLawyer='';
 const zone='America/Sao_Paulo';
 function nowBR(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
 function localInput(value){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
 function allDeadlines(){return DeadlineFlow.all(documentData||{});}
 function overdue(d,now){return d.status==='pending'&&!!d.date&&(d.date<now.date||d.date===now.date&&d.time&&d.time<now.time);}
 function dayLabel(value){return value?value.split('-').reverse().join('/'):'Sem data';}
 function ownerNames(){return [...new Set([...(documentData?.portfolios||[]).map(p=>p.lawyer),...allDeadlines().map(d=>d.owner).filter(Boolean)])].sort((a,b)=>a.replace(/^dra?\.?\s+/i,'').localeCompare(b.replace(/^dra?\.?\s+/i,''),'pt-BR'));}
 function options(){const previous=$('control-owner').value;$('control-owner').innerHTML='<option value="">Todos os responsáveis</option>'+ownerNames().map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');$('control-owner').value=previous;}
 function todayForLawyer(lawyer){
  const date=nowBR().date,linked=PortfolioLinks.applyPortfolioLinks(documentData).data;
  return allDeadlines().filter(d=>{if(d.status!=='pending'||d.date!==date)return false;const a=linked.annotations?.[d.caseId]||{},owners=d.legacy?[...new Set([...(a.owners?.length?a.owners:a.owner?[a.owner]:[]),...(a.portfolioOwners||[])])]:[d.owner];return owners.includes(lawyer);});
 }
 window.openLawyerTodayDeadlines=lawyer=>{
  if(!documentData)return;const deadlines=todayForLawyer(lawyer),ids=[...new Set(deadlines.map(d=>d.caseId))];
  if(ids.length===1&&documentData.base.some(b=>b.id===ids[0])){openDashboardCase(ids[0]);return;}
  $('today-deadlines-title').textContent='Prazos de hoje — '+lawyer;
  $('today-deadlines-list').innerHTML=ids.map(id=>{const b=documentData.base.find(b=>b.id===id),a=documentData.annotations?.[id]||{};return `<article class="deadline-item"><strong>${esc(id)}</strong><p>${esc(a.client||a.portfolioClients?.join(' / ')||b?.event||'Cliente a confirmar')}</p>${deadlines.filter(d=>d.caseId===id).map(d=>`<p>${esc(d.title)}${d.time?' · '+esc(d.time):' · Horário não definido'}</p>`).join('')}<button type="button" data-today-deadline-case="${esc(id)}" ${b?'':'disabled'}>Abrir processo</button>${b?'':'<p>Processo não localizado no painel.</p>'}</article>`;}).join('')||'<p>Nenhum prazo pendente vence hoje para este advogado.</p>';
  $('today-deadlines-dialog').showModal();
 };
 $('close-today-deadlines').onclick=()=>$('today-deadlines-dialog').close();
 $('today-deadlines-list').onclick=e=>{const b=e.target.closest('[data-today-deadline-case]');if(b){$('today-deadlines-dialog').close();openDashboardCase(b.dataset.todayDeadlineCase);}};
 function refreshPortfolioDeadlines(){
  if(!documentData)return;const date=nowBR().date,counts=new Map(),linked=PortfolioLinks.applyPortfolioLinks(documentData).data;
  for(const deadline of allDeadlines()){
   if(deadline.status!=='pending'||deadline.date!==date)continue;
   const note=linked.annotations?.[deadline.caseId]||{},owners=deadline.legacy?[...new Set([...(note.owners?.length?note.owners:note.owner?[note.owner]:[]),...(note.portfolioOwners||[])])]:[deadline.owner];
   for(const owner of owners.filter(Boolean))counts.set(owner,(counts.get(owner)||0)+1);
  }
  for(const card of document.querySelectorAll('[data-deadline-lawyer]')){const count=counts.get(card.dataset.deadlineLawyer)||0,badge=card.querySelector('.lawyer-deadline-badge');card.classList.toggle('has-deadlines-today',count>0);if(badge){badge.hidden=!count;badge.textContent=count?`${count} ${count===1?'prazo hoje':'prazos hoje'}`:'';badge.setAttribute('aria-label',`Abrir processos de ${card.dataset.deadlineLawyer}: ${count} prazos pendentes vencem hoje`);}}
 }
 window.refreshPortfolioDeadlines=refreshPortfolioDeadlines;
 function showAlerts(){refreshPortfolioDeadlines();
  const active=!!session&&!!documentData;$('open-control').hidden=!active;if(!active)return;
  const now=nowBR(),pending=allDeadlines().filter(d=>d.status==='pending'),late=pending.filter(d=>overdue(d,now)).length,today=pending.filter(d=>d.date===now.date&&!overdue(d,now)).length,missing=pending.filter(d=>!d.owner).length;
  $('deadline-alerts').classList.toggle('has-overdue',late>0);$('open-control').classList.toggle('has-overdue',late>0);$('control-badge').textContent=late+today||'';$('deadline-alerts').hidden=!pending.length;
  $('deadline-alert-title').textContent='Controladoria de prazos';$('deadline-alert-text').textContent=`${late} vencido(s) · ${today} vence(m) hoje · ${pending.length} pendente(s)${missing?` · ${missing} sem responsável definido`:''}. Confira os prazos e registre a revisão diária.`;
 }
 function stamp(value){const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('pt-BR',{timeZone:zone}):'Data não registrada';}
 function recordDetails(d){
  const b=documentData.base.find(b=>b.id===d.caseId),batch=$('control-import-date').value,publications=(b?.importedPublications||[]).filter(p=>!batch||ImportedDay.day(p.importedAt)===batch);
  const history=d.assignmentHistory||[],reminders=d.id.startsWith('case-priority:')?(documentData.priorityReminders||[]).filter(j=>j.caseId===d.caseId):[];
  const labels={pending:'Agendado',blocked_sender:'Pendente: conectar remetente',blocked_recipient:'Pendente: cadastrar destinatário',accepted:'Aceito pelo serviço — entrega não confirmada',sending:'Em processamento',unknown:'Resultado não confirmado',failed:'Falha no envio',cancelled:'Cancelado'};
  return `${publications.length?`<details><summary>Ler publicação AASP (${publications.length})</summary>${publications.map(p=>`<p class="muted">${esc(p.file||'Relatório AASP')} · Importado em ${esc(stamp(p.importedAt))}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(p.text)}</pre>`).join('')}</details>`:''}<details><summary>Histórico / referência</summary>${d.reference?`<p class="deadline-record-details">${esc(d.reference)}</p>`:''}<p class="muted">${d.validatedByName?'Conferido por '+esc(d.validatedByName):'Registro anterior: conferir dados na edição.'}${d.updatedAt?' · Atualizado em '+esc(stamp(d.updatedAt)):''}</p><strong>Distribuição no painel</strong>${history.length?`<ol class="deadline-distribution-history">${history.map(h=>`<li>${esc(stamp(h.at))} · ${esc(h.from||'Não atribuído')} → ${esc(h.to||'Não atribuído')} · ${esc(h.byName||'Equipe')}</li>`).join('')}</ol>`:`<p>${d.owner?(d.assignedAt?'Distribuído em '+esc(stamp(d.assignedAt)):'Responsável já registrado; a data original da distribuição não está disponível.'):'Aguardando definição do responsável.'}</p>`}${reminders.length?`<strong>Avisos de e-mail deste prazo</strong>${reminders.map(j=>`<p>${esc(dayLabel(j.date))} · ${esc(labels[j.status]||j.status)}${j.to?' · '+esc(j.to):''}${j.acceptedAt?' · Aceite em '+esc(stamp(j.acceptedAt)):''}${j.error?' · '+esc(j.error):''}</p>`).join('')}`:''}</details>`;
 }
 function deadlineTable(list,now,individual=false){
  if(!list.length)return '<p class="control-empty">'+(individual?'Nenhum prazo direcionado a este advogado nos critérios selecionados.':'Nenhum prazo corresponde aos filtros.')+'</p>';
  return `<table class="deadline-table"><thead><tr><th scope="col">Processo / partes</th><th scope="col">Publicação / envio / vencimento</th>${individual?'':'<th scope="col">Responsável</th>'}<th scope="col">Status</th><th scope="col">Distribuído em</th><th scope="col">Ações</th></tr></thead><tbody>${list.map(d=>{
   const b=documentData.base.find(b=>b.id===d.caseId),a=documentData.annotations?.[d.caseId]||{},status=DeadlineFlow.state(d),late=overdue(d,now),today=d.date===now.date&&d.status==='pending';
   const label={waiting:'Aguardando distribuição',distributed:'Distribuído',done:'Concluído',cancelled:'Cancelado'}[status];
   return `<tr data-deadline-row="${esc(d.id)}" class="${late?'overdue':today?'today':''}"><td><strong>${esc(d.caseId||'Processo não informado')}</strong><small>${esc(a.client||a.portfolioClients?.join(' / ')||b?.parties||'Parte a confirmar')}</small></td><td><strong>${esc(d.title)}</strong><small>Envio da publicação: ${esc(dayLabel(DeadlineFlow.day(d.sentAt)))}</small><small>Vence: ${esc(d.date?dayLabel(d.date):'Não definido')}${d.time?' às '+esc(d.time):''}</small><small>${d.kind==='publication'?'Publicação para triagem':d.kind==='internal'?'Prazo interno':'Prazo judicial'}</small>${recordDetails(d)}</td>${individual?'':`<td>${d.owner?`<button type="button" data-select-deadline-lawyer="${esc(d.owner)}">${esc(d.owner)}</button>`:'Não atribuído'}</td>`}<td><span class="badge ${status==='done'?'ok':''}">${esc(label)}</span>${d.readAt?'<small>Lido</small>':''}${late?'<small class="deadline-overdue-label">Vencido — verificar</small>':today?'<small>Vence hoje</small>':''}</td><td>${d.owner?esc(stamp(d.assignedAt)):'—'}</td><td><div class="deadline-row-actions"><button type="button" data-edit-deadline="${esc(d.id)}">${d.owner?'Abrir / editar':'Distribuir / editar'}</button>${!d.legacy?`<button type="button" data-read-deadline="${esc(d.id)}">${d.readAt?'Desmarcar lido':'Marcar como lido'}</button>${d.owner?`<button type="button" data-undo-deadline="${esc(d.id)}">Desfazer encaminhamento</button>`:''}`:''}${d.status==='pending'&&!d.legacy&&!d.imported?`<button type="button" data-complete-deadline="${esc(d.id)}">Concluir</button>`:''}${b?`<button type="button" data-view-case="${esc(d.caseId)}">Abrir processo</button>`:''}</div></td></tr>`;
  }).join('')}</tbody></table>`;
 }
 function renderLawyer(all,now){
  const names=ownerNames();if(!names.includes(selectedLawyer))selectedLawyer=names[0]||'';
  $('deadline-lawyer-tabs').innerHTML=names.map((owner,i)=>`<button id="deadline-lawyer-tab-${i}" type="button" role="tab" data-deadline-lawyer-tab="${esc(owner)}" aria-controls="deadline-lawyer-panel" aria-selected="${owner===selectedLawyer}" tabindex="${owner===selectedLawyer?'0':'-1'}">${esc(owner.replace(/^dra?\.?\s+/i,''))}<small>(${all.filter(d=>d.owner===owner).length})</small></button>`).join('');
  const index=names.indexOf(selectedLawyer);if(index>=0)$('deadline-lawyer-panel').setAttribute('aria-labelledby','deadline-lawyer-tab-'+index);else $('deadline-lawyer-panel').setAttribute('aria-label','Prazos por advogado');
  const date=$('deadline-distribution-date').value,list=all.filter(d=>d.owner===selectedLawyer&&(!date||DeadlineFlow.day(d.assignedAt)===date));
  $('deadline-lawyer-count').textContent=selectedLawyer?`${list.length} prazo(s) de ${selectedLawyer}${date?' distribuído(s) em '+dayLabel(date):' · todas as datas'}.`:'Cadastre um responsável para consultar seus prazos nesta seção.';
  $('deadline-lawyer-list').innerHTML=deadlineTable(list,now,true);
 }
 function render(){
  if(!documentData)return;showAlerts();const now=nowBR(),owner=$('control-owner').value,status=$('control-status').value,query=$('control-search').value.trim().toLocaleLowerCase('pt-BR');
  const batchDate=$('control-import-date').value;const all=(batchDate?DeadlineFlow.forImportDay(documentData,batchDate):allDeadlines()).sort((a,b)=>(a.date+(a.time||'23:59')).localeCompare(b.date+(b.time||'23:59'))),counts=DeadlineFlow.counts(all);
  const batchCases=batchDate?ImportedDay.cases(documentData,batchDate):[];$('control-batch-summary').textContent=batchDate?`Lote de ${dayLabel(batchDate)}: ${batchCases.length} processo(s) importado(s) · ${all.length} registro(s) nesta visão. Processos e prazos antigos ficam no arquivo completo.`:'Arquivo completo: inclui registros antigos.';
  $('control-overview-stats').innerHTML=[['all','Prazos cadastrados','Registros nesta visão'],['waiting','Aguardando distribuição','Sem advogado definido'],['distributed','Distribuídos','Direcionados à equipe'],['done','Concluídos','Providência finalizada']].map(([key,title,subtitle])=>`<button type="button" data-deadline-stat="${key}" aria-pressed="${status===key&&!owner&&!query}"><span>${title}</span><b>${counts[key]}</b><small>${subtitle}</small></button>`).join('');
  const list=all.filter(d=>{
   const b=documentData.base.find(b=>b.id===d.caseId),a=documentData.annotations?.[d.caseId]||{},match=status==='all'||status==='pending'&&d.status==='pending'||status==='overdue'&&overdue(d,now)||status==='today'&&d.status==='pending'&&d.date===now.date||DeadlineFlow.state(d)===status;
   return (!owner||d.owner===owner)&&match&&(!query||[d.caseId,d.title,d.owner,d.reference,a.client,...(a.portfolioClients||[]),b?.parties,b?.event,b?.source,...(b?.importedPublications||[]).map(p=>p.text)].join(' ').toLocaleLowerCase('pt-BR').includes(query));
  });
  $('export-control').disabled=!list.length;
  $('export-control').onclick=()=>{
   const rows=[['Lote importado em','Processo','Cliente / partes','Publicação / providência','Advogado responsável','Data de envio','Vencimento','Horário','Distribuído em','Status','Lido em','Referência','Texto AASP'],...list.map(d=>{
    const b=documentData.base.find(b=>b.id===d.caseId),a=documentData.annotations?.[d.caseId]||{};
    return [batchDate,d.caseId,a.client||a.portfolioClients?.join(' / ')||b?.parties||'',d.title,d.owner,DeadlineFlow.day(d.sentAt),d.date,d.time,d.assignedAt?stamp(d.assignedAt):'',{waiting:'Aguardando distribuição',distributed:'Distribuído',done:'Concluído',cancelled:'Cancelado'}[DeadlineFlow.state(d)],d.readAt?stamp(d.readAt):'',d.reference,(b?.importedPublications||[]).filter(p=>!batchDate||ImportedDay.day(p.importedAt)===batchDate).map(p=>p.text).join('\n\n')];
   })];
   const csv='\ufeff'+rows.map(row=>row.map(value=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"').join(';')).join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='controladoria-'+(batchDate||'arquivo-completo')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const pending=list.filter(d=>d.status==='pending'),late=pending.filter(d=>overdue(d,now)),today=pending.filter(d=>d.date===now.date&&!overdue(d,now));
  $('control-count').textContent=`${list.length} de ${all.length} prazo(s) cadastrado(s).${counts.cancelled?' '+counts.cancelled+' cancelado(s) no total.':''}`;
  $('control-stats').innerHTML=`<span><b>${late.length}</b> vencido(s)</span><span><b>${today.length}</b> vence(m) hoje</span><span><b>${pending.length}</b> pendente(s) nesta visão</span>`;
  const review=(documentData.deadlineReviews||[]).filter(r=>r.date===now.date&&r.owner===owner).at(-1);
  $('control-review-status').textContent=review?`Conferência registrada hoje por ${review.byName} às ${new Date(review.at).toLocaleTimeString('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'})}.`:'Conferência diária pendente para esta visão.';
  $('control-list').innerHTML=deadlineTable(list,now);renderLawyer(all,now);
 }
 function lock(value){busy=value;editor.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=value);control.querySelectorAll('button').forEach(el=>el.disabled=value);}
 function name(){return session.user?.user_metadata?.dibbern_profile?.name||session.user?.email||'Equipe';}
 function openDeadline(caseId,deadline){
  if(!documentData||busy)return;activeId=deadline?.id||null;$('deadline-form').reset();$('deadline-message').textContent='';$('deadline-title').textContent=deadline?'Editar prazo':'Cadastrar prazo';
  $('deadline-cases').innerHTML=documentData.base.map(b=>`<option value="${esc(b.id)}">${esc(b.event)}</option>`).join('');
  const names=ownerNames();if(deadline?.owner&&!names.includes(deadline.owner))names.push(deadline.owner);
  $('deadline-owner').innerHTML='<option value="">Aguardando distribuição</option>'+names.map(n=>`<option>${esc(n)}</option>`).join('');
  const annotation=documentData.annotations?.[caseId]||{};
  $('deadline-case').value=deadline?.caseId||caseId||'';$('deadline-description').value=deadline?.title||'';$('deadline-date').value=deadline?.date||'';$('deadline-time').value=deadline?.time||'';$('deadline-owner').value=deadline?(deadline.owner||''):((annotation.owners?.length===1?annotation.owners[0]:annotation.owners?.length>1?'':annotation.owner)||'');$('deadline-kind').value=deadline?.kind==='publication'?'judicial':deadline?.kind||'judicial';$('deadline-sent').value=deadline?DeadlineFlow.day(deadline.sentAt):nowBR().date;$('deadline-assigned').value=localInput(deadline?.assignedAt);$('deadline-status').value=deadline?.status||'pending';$('deadline-reference').value=deadline?.reference||'';$('deadline-validated').checked=!!deadline?.validatedAt;
  if(!editor.open)editor.showModal();
 }
 $('close-deadline').onclick=()=>{if(!busy)editor.close();};editor.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 let currentPage='publications',publicationsScroll=0,routeRequest=0;
 const controlPath=()=>location.pathname.replace(/\/+$/,'')==='/controladoria';
 function navigate(show,push=true){
  if(!documentData||!session)return false;
  if(busy||editor.open){$('deadline-message').textContent='Salve ou feche a edição antes de trocar de página.';return false;}
  if(currentPage==='publications'&&show)publicationsScroll=window.scrollY;
  const previousPage=currentPage;currentPage=show?'control':'publications';control.hidden=!show;$('publications-page').hidden=show;
  if(push&&location.pathname!==(show?'/controladoria':'/'))history.pushState({page:currentPage},'',show?'/controladoria':'/');
  if(show)$('open-control').setAttribute('aria-current','page');else $('open-control').removeAttribute('aria-current');
  document.title=show?'Controladoria · Dibbern Sociedade de Advogados':'Dibbern Sociedade de Advogados • Gestão do escritório';
  if(previousPage!==currentPage)window.auditEvent?.('navigation',show?'Página da controladoria aberta':'Retorno à página de publicações',{status:'success',context:{route:show?'/controladoria':'/'}});
  if(show){options();render();$('control-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}else{$('open-control').focus({preventScroll:true});window.scrollTo({top:publicationsScroll,behavior:'instant'});}
  return true;
 }
 async function openControl(push=true){
  if(!navigate(true,push))return;const task=++routeRequest;$('control-message').textContent='';
  try{const rows=await request('/rest/v1/dashboards?id=eq.1&select=data,revision');if(task!==routeRequest||currentPage!=='control')return;if(rows?.length===1&&rows[0].revision!==revision&&!busy&&!editor.open){documentData=await PublicationData.hydrate(rows[0].data);revision=rows[0].revision;mountDashboard();options();render();}}
  catch(error){if(task===routeRequest&&currentPage==='control')$('control-message').textContent='Não foi possível atualizar a visão da nuvem: '+error.message;}
 }
 $('close-control').onclick=event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();routeRequest++;navigate(false);};
 $('open-control').onclick=event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();openControl();};
 window.addEventListener('popstate',()=>{
  if(busy||editor.open){history.pushState({page:currentPage},'',currentPage==='control'?'/controladoria':'/');$('deadline-message').textContent='Salve ou feche a edição antes de trocar de página.';return;}
  routeRequest++;if(controlPath())openControl(false);else navigate(false,false);
 });
 $('review-deadlines').onclick=()=>$('open-control').click();$('control-owner').onchange=render;$('control-status').onchange=render;$('new-deadline').onclick=()=>openDeadline();$('case-new-deadline').onclick=()=>openDeadline($('title').textContent);
 $('control-search').addEventListener('input',render);
 $('control-overview-stats').onclick=event=>{const b=event.target.closest('[data-deadline-stat]');if(b&&!busy){$('control-status').value=b.dataset.deadlineStat;$('control-owner').value='';$('control-search').value='';render();}};
 $('deadline-distribution-date').onchange=render;$('deadline-all-dates').onclick=()=>{$('deadline-distribution-date').value='';render();};
 $('deadline-lawyer-tabs').onclick=event=>{const b=event.target.closest('[data-deadline-lawyer-tab]');if(b&&!busy){selectedLawyer=b.dataset.deadlineLawyerTab;render();}};
 $('deadline-lawyer-tabs').onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const names=ownerNames();if(!names.length)return;event.preventDefault();const i=names.indexOf(selectedLawyer),next=event.key==='Home'?0:event.key==='End'?names.length-1:(i+(event.key==='ArrowRight'?1:-1)+names.length)%names.length;selectedLawyer=names[next];render();$('deadline-lawyer-tab-'+next).focus();};
 for(const id of ['deadline-case','deadline-description','deadline-date','deadline-time','deadline-owner','deadline-kind'])$(id).addEventListener('input',()=>$('deadline-validated').checked=false);
 $('deadline-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const caseId=$('deadline-case').value.trim(),owner=$('deadline-owner').value,date=$('deadline-date').value,title=$('deadline-description').value.trim();
  if(!documentData.base.some(b=>b.id===caseId)){$('deadline-message').textContent='Selecione um processo cadastrado no painel.';return;}
  if(!title||!$('deadline-validated').checked){$('deadline-message').textContent='Preencha a providência e confirme a conferência dos dados.';return;}
  const existing=[...allDeadlines(),...DeadlineFlow.forImportDay(documentData,$('control-import-date').value||nowBR().date)].find(d=>d.id===activeId),now=new Date().toISOString();
  let value={...(existing&&!existing.legacy&&!existing.imported?existing:{}),id:existing&&!existing.legacy&&!existing.imported?existing.id:crypto.randomUUID(),caseId,title,owner,date,importDay:existing?.importDay||$('control-import-date').value||nowBR().date,sentAt:$('deadline-sent').value?$('deadline-sent').value+'T12:00:00-03:00':null,time:$('deadline-time').value,kind:$('deadline-kind').value,status:$('deadline-status').value,reference:$('deadline-reference').value.trim(),createdAt:existing?.createdAt||now,updatedAt:now,validatedAt:now,validatedBy:session.user.id,validatedByName:name()};
  value=DeadlineFlow.assign(existing,value,session.user,now);const assigned=$('deadline-assigned').value;if(owner&&assigned){const corrected=new Date(assigned+':00-03:00').toISOString();if(corrected!==value.assignedAt){value.assignmentHistory=[...(value.assignmentHistory||[]),{at:now,from:owner,to:owner,by:session.user.id,byName:name(),previousAssignedAt:value.assignedAt,correctedAssignedAt:corrected}];value.assignedAt=corrected;}}
  if(existing?.legacy)value.legacyCaseId=caseId;
  const deadlines=[...(documentData.deadlines||[]).filter(d=>d.id!==value.id),value];
  lock(true);$('deadline-message').textContent='Salvando prazo…';
  try{await saveDashboard({...documentData,deadlines});editor.close();options();render();}catch(error){$('deadline-message').textContent=error.message;}finally{lock(false);}
 };
 async function rowAction(event){
  if(busy)return;const edit=event.target.closest('[data-edit-deadline]'),complete=event.target.closest('[data-complete-deadline]'),view=event.target.closest('[data-view-case]');
  if(edit){const d=allDeadlines().find(d=>d.id===edit.dataset.editDeadline);if(d)openDeadline(d.caseId,d);else {const item=DeadlineFlow.forImportDay(documentData,$('control-import-date').value).find(d=>d.id===edit.dataset.editDeadline);if(item)openDeadline(item.caseId,item);}return;}
  if(view){openDashboardCase(view.dataset.viewCase);return;}
  const lawyer=event.target.closest('[data-select-deadline-lawyer]');if(lawyer){selectedLawyer=lawyer.dataset.selectDeadlineLawyer;$('deadline-distribution-date').value='';render();$('deadline-lawyer-panel').scrollIntoView({block:'start'});return;}
  const read=event.target.closest('[data-read-deadline]'),undo=event.target.closest('[data-undo-deadline]');if(read||undo){const id=read?read.dataset.readDeadline:undo.dataset.undoDeadline,now=new Date().toISOString();let source=[...(documentData.deadlines||[])];if(read&&!source.some(d=>d.id===id)){const imported=DeadlineFlow.forImportDay(documentData,$('control-import-date').value).find(d=>d.id===id);if(!imported)return;const {imported:transient,...record}=imported;source.push({...record,id,createdAt:now,importDay:$('control-import-date').value});}const deadlines=source.map(d=>d.id!==id?d:read?{...d,readAt:d.readAt?null:now,readBy:d.readAt?null:session.user.id,updatedAt:now}:DeadlineFlow.assign(d,{...d,owner:'',updatedAt:now},session.user,now));lock(true);try{await saveDashboard({...documentData,deadlines});render();}catch(error){$('control-message').textContent=error.message;}finally{lock(false);}return;}
  if(complete){const deadlines=(documentData.deadlines||[]).map(d=>d.id===complete.dataset.completeDeadline?{...d,status:'done',completedAt:new Date().toISOString(),completedBy:session.user.id,updatedAt:new Date().toISOString()}:d);lock(true);try{await saveDashboard({...documentData,deadlines});render();}catch(error){$('control-message').textContent=error.message;}finally{lock(false);}}
 };
 $('control-list').onclick=rowAction;$('deadline-lawyer-list').onclick=rowAction;
 $('record-daily-review').onclick=async()=>{
  if(busy)return;const now=nowBR(),owner=$('control-owner').value,review={date:now.date,owner,at:new Date().toISOString(),by:session.user.id,byName:name(),pendingIds:allDeadlines().filter(d=>d.status==='pending'&&(!owner||d.owner===owner)).map(d=>d.id)};
  lock(true);try{await saveDashboard({...documentData,deadlineReviews:[...(documentData.deadlineReviews||[]),review].slice(-1000)});$('control-message').textContent='Conferência diária registrada. O registro não marca os prazos como cumpridos.';render();}catch(error){$('control-message').textContent=error.message;}finally{lock(false);}
 };
 window.showControlImportDay=date=>{$('control-import-date').value=date;$('control-status').value='all';$('control-owner').value='';$('control-search').value='';$('deadline-distribution-date').value='';render();};
 $('control-import-date').value=nowBR().date;$('control-import-date').onchange=render;$('control-today').onclick=()=>{$('control-import-date').value=nowBR().date;render();};$('control-archive').onclick=()=>{$('control-import-date').value='';render();};
 window.addEventListener('dashboard-ready',()=>{options();showAlerts();if(controlPath())openControl(false);});window.addEventListener('dashboard-saved',()=>{showAlerts();if(!control.hidden)render();});setInterval(()=>{if(document.visibilityState==='visible'){showAlerts();if(!control.hidden)render();}},60000);showAlerts();if(session&&documentData&&controlPath())openControl(false);
})();
