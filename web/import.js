'use strict';
(function(){
  let candidates=[],fileName='',busy=false,fromControl=false;
  const dialog=$('import-dialog'),fileInput=$('report-file'),message=$('import-message'),review=$('import-review'),save=$('confirm-import');
  const announce=text=>{message.textContent=text;$('import-footer-message').textContent=text;};
  function openImport(control=false){
    if(busy){if(!dialog.open)dialog.showModal();announce('A importação está em andamento. Aguarde a conclusão.');return;}
    fromControl=control;
    candidates=[];$('import-publication-date').value='';fileInput.value='';review.replaceChildren();save.disabled=true;fileInput.disabled=!session||!documentData;announce(!session?'Feche esta janela e entre com sua conta para importar o relatório.':!documentData?'Seu acesso foi confirmado. Aguarde o painel terminar de carregar para selecionar o arquivo.':'Selecione o relatório baixado da AASP. Nada será salvo antes da confirmação.');if(!dialog.open)dialog.showModal();
  };
  $('import-report').onclick=()=>openImport(false);$('control-import-aasp').onclick=()=>openImport(true);
  window.addEventListener('dashboard-ready',()=>{if(dialog.open&&!busy){fileInput.disabled=false;announce('Painel carregado. Selecione o relatório AASP para importar.');}});
  $('cancel-import').onclick=()=>{if(!busy)dialog.close();};
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  async function readPDF(file){
    const pdfjs=await import('./pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.min.mjs',new URL('/import.js',location.origin)).href;
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true,disableFontFace:true});
    let pdf;
    try{
      pdf=await task.promise;
      if(pdf.numPages>100)throw Error('O PDF tem mais de 100 páginas. Divida-o antes de importar.');
      let text='';
      for(let i=1;i<=pdf.numPages;i++){
        announce(`Lendo página ${i} de ${pdf.numPages}…`);
        const page=await pdf.getPage(i),content=await page.getTextContent();let lastY=null;
        for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];text+=(lastY!==null&&Math.abs(y-lastY)>3?'\n':' ')+item.str+(item.hasEOL?'\n':'');lastY=y;}
        text+='\n';page.cleanup();
        if(text.length>1000000)throw Error('O relatório contém texto demais. Divida-o em arquivos menores.');
      }
      if(text.trim().length<30)throw Error('Este PDF parece ser uma imagem digitalizada. Envie a versão com texto selecionável ou um TXT; OCR ainda não está disponível.');
      return text;
    }finally{await task.destroy();}
  }
  fileInput.onchange=async()=>{
    const file=fileInput.files[0];if(!file||busy)return;
    candidates=[];review.replaceChildren();save.disabled=true;save.textContent='Confirmar importação';
    if(file.size>10*1024*1024){announce('Selecione um arquivo de até 10 MB.');return;}
    const ext=file.name.split('.').pop().toLowerCase();
    if(!['pdf','txt'].includes(ext)){announce('Formato não suportado. Selecione um relatório PDF ou TXT.');return;}
    busy=true;save.textContent='Lendo arquivo…';fileInput.disabled=true;$('cancel-import').disabled=true;announce('Lendo o relatório…');fileName=file.name;
    try{
      const text=ext==='pdf'?await readPDF(file):await file.text();
      $('import-publication-date').value=PublicationData.availabilityDate(text);
      candidates=AASPImport.parse(text);
      const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text).replace(/\s+/g,' ').trim()))),b=>b.toString(16).padStart(2,'0')).join('');
      for(const entry of candidates){entry.fingerprint=await digest(entry.text);entry.legacyFingerprints=await Promise.all((entry.legacyTexts||[]).map(digest));for(const publication of entry.publications||[])publication.fingerprint=await digest(publication.text);}
      for(const ref of candidates.referenceEntries||[])ref.fingerprint=await digest(ref.text);
      review.innerHTML=candidates.map((entry,index)=>{
        const current=documentData.base.find(row=>row.id===entry.id),duplicate=(entry.publications?.length?entry.publications:[entry]).every(p=>current?.importedPublications?.some(stored=>!stored.superseded&&(stored.fingerprint===p.fingerprint||p.publicationRef&&p.availabilityDate&&stored.externalKey==='aasp:'+p.availabilityDate+':'+p.publicationRef+':'+entry.id)))||current?.importedPublications?.some(p=>(entry.legacyFingerprints||[]).includes(p.fingerprint));
        return `<article class="import-entry"><label class="import-select"><input type="checkbox" data-import-index="${index}" checked> ${esc(entry.id)}${entry.publications?.length?` <small>${entry.publications.length} publicação(ões)</small>`:''} <span class="badge">${duplicate?'Atualizar existente, sem duplicar':current?'Adicionar publicação ao processo':'Novo processo'}</span></label><p class="muted">${current?'O acompanhamento e os vínculos existentes serão preservados.':'Confira os campos antes de incluir. Cliente e responsável serão atribuídos em Gerenciar / detalhes.'}</p>${current?'':`<label>Evento / publicação<input data-field="event" data-index="${index}" value="${esc(entry.event)}" maxlength="300"></label><label>Partes<input data-field="parties" data-index="${index}" value="${esc(entry.parties)}" maxlength="1000"></label><label>Tribunal / vara<input data-field="court" data-index="${index}" value="${esc(entry.court)}" maxlength="300"></label><label>Datas da fonte<input data-field="dates" data-index="${index}" value="${esc(entry.dates)}" maxlength="300"></label>`}<details><summary>Conferir texto extraído</summary><pre class="import-source">${esc(entry.text)}</pre></details></article>`;
      }).join('');
      announce(`${candidates.length} processo(s) ${candidates.some(e=>e.publications)?'principais · '+candidates.reduce((n,e)=>n+(e.publications?.length||1),0)+' publicação(ões)':''}${candidates.referenceEntries?.length?' · '+candidates.referenceEntries.length+' processo(s) apenas citado(s) no texto, sem criar itens separados':''}. Revise os números e os textos; desmarque referências que não devam ser importadas. Datas e prazos não são calculados automaticamente.`);
      updateSelection();
    }catch(error){fileInput.value='';const readerUnavailable=/worker|fetch|dynamically imported module/i.test(error.message||'');announce(error.name==='PasswordException'?'PDF protegido por senha. Envie uma cópia desbloqueada.':error.name==='InvalidPDFException'?'O PDF está inválido ou incompleto. Baixe o arquivo novamente na AASP e tente importar.':readerUnavailable?'Não foi possível carregar o leitor de PDF. Atualize a página e selecione o arquivo novamente.':error.message||'Não foi possível ler o relatório.');}
    finally{busy=false;fileInput.disabled=false;$('cancel-import').disabled=false;updateSelection();}
  };
  function updateSelection(){if(busy)return;const n=review.querySelectorAll('[data-import-index]:checked').length;save.disabled=!n;save.textContent=`Confirmar importação${n?` (${n})`:''}`;}
  review.addEventListener('change',updateSelection);
  save.onclick=async()=>{
    if(busy){announce('A importação está em andamento. Aguarde a conclusão.');return;}
    if(!session||!documentData){announce('O painel ainda não está pronto. Aguarde o carregamento ou entre novamente.');return;}
    const selected=[...review.querySelectorAll('[data-import-index]:checked')].map(input=>({...candidates[Number(input.dataset.importIndex)]}));
    if(!selected.length){announce('Selecione pelo menos um processo da lista para confirmar a importação.');return;}
    for(const entry of selected){
      entry.reviewedAvailabilityDate=$('import-publication-date').value||'';entry.availabilityDate=entry.reviewedAvailabilityDate||entry.availabilityDate;
      const index=candidates.findIndex(c=>c.id===entry.id);
      for(const input of review.querySelectorAll(`[data-index="${index}"]`)){if(!input.value.trim()){input.focus();announce('Preencha os campos de revisão ou mantenha a indicação de conferência pendente.');return;}entry[input.dataset.field]=input.value.trim();}
    }
    let result;const importedAt=new Date().toISOString(),importId=crypto.randomUUID(),actor=session.user;
    busy=true;save.disabled=true;save.textContent='Salvando…';review.querySelectorAll('input').forEach(input=>input.disabled=true);$('import-publication-date').disabled=true;fileInput.disabled=true;$('cancel-import').disabled=true;announce('Atualizando a carteira e salvando a importação…');
    try{
      await updateDashboard(fresh=>{result=AASPImport.merge(fresh,selected,fileName,importedAt,{referenceEntries:candidates.referenceEntries||[]});const receipt=result.next.imports.at(-1);result.next={...result.next,imports:[...result.next.imports.slice(0,-1),{...receipt,id:importId,actorId:actor.id,actorName:actor.user_metadata?.dibbern_profile?.name||actor.email||'Equipe',actorEmail:actor.email||'',duplicates:result.duplicates}]};return result.next;});mountDashboard();if(fromControl)window.showControlImportDay?.(DailyPublications.today());else if(window.showImportedDay)showImportedDay(DailyPublications.today());dialog.close();if(!fromControl&&window.queuePublicationEmails){const dates=[...new Set(selected.map(e=>e.availabilityDate||PublicationData.availabilityDate(e.text)).filter(Boolean))];await queuePublicationEmails(dates.length?dates:[DailyPublications.today()]);}
      $('sync').textContent=`Importação salva: ${result.added} novo(s) processo(s), ${result.updated} atualizado(s), incluindo ${result.duplicates} já importado(s), sem duplicação. ${result.publicationCount} publicação(ões) no arquivo.`;
    }catch(error){announce(error.message);window.auditEvent?.('error','Importação AASP não confirmada',{status:'failure',details:fileName+' · '+error.message});save.disabled=false;updateSelection();}
    finally{busy=false;review.querySelectorAll('input').forEach(input=>input.disabled=false);$('import-publication-date').disabled=false;fileInput.disabled=false;$('cancel-import').disabled=false;updateSelection();}
  };
  const confirmImport=save.onclick;save.onclick=async event=>{try{await confirmImport(event);}catch(error){announce('Não foi possível preparar a importação: '+(error.message||'Atualize a página e tente novamente.'));busy=false;fileInput.disabled=false;$('cancel-import').disabled=false;updateSelection();}};

})();
