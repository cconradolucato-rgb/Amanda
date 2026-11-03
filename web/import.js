'use strict';
(function(){
  let candidates=[],fileName='',busy=false,fromControl=false;
  const dialog=$('import-dialog'),fileInput=$('report-file'),message=$('import-message'),review=$('import-review'),save=$('confirm-import');
  const announce=text=>{message.textContent=text;};
  function openImport(control=false){
    fromControl=control;
    if(!session||!documentData){$('login-message').textContent='Entre com sua conta para importar relatórios.';$('email').focus();return;}
    candidates=[];$('import-publication-date').value='';fileInput.value='';review.replaceChildren();save.disabled=true;announce('Selecione o relatório baixado da AASP. Nada será salvo antes da confirmação.');dialog.showModal();
  };
  $('import-report').onclick=()=>openImport(false);$('control-import-aasp').onclick=()=>openImport(true);
  $('cancel-import').onclick=()=>{if(!busy)dialog.close();};
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  async function readPDF(file){
    const pdfjs=await import('./pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='./pdf.worker.min.mjs';
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
    candidates=[];review.replaceChildren();save.disabled=true;
    if(file.size>10*1024*1024){announce('Selecione um arquivo de até 10 MB.');return;}
    const ext=file.name.split('.').pop().toLowerCase();
    if(!['pdf','txt'].includes(ext)){announce('Formato não suportado. Selecione um relatório PDF ou TXT.');return;}
    busy=true;fileInput.disabled=true;$('cancel-import').disabled=true;announce('Lendo o relatório…');fileName=file.name;
    try{
      const text=ext==='pdf'?await readPDF(file):await file.text();
      $('import-publication-date').value=PublicationData.availabilityDate(text);
      candidates=AASPImport.parse(text);
      for(const entry of candidates){
        const bytes=new TextEncoder().encode(entry.text.replace(/\s+/g,' ').trim());
        entry.fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      }
      review.innerHTML=candidates.map((entry,index)=>{
        const current=documentData.base.find(row=>row.id===entry.id),duplicate=current?.importedPublications?.some(p=>p.fingerprint===entry.fingerprint);
        return `<article class="import-entry"><label class="import-select"><input type="checkbox" data-import-index="${index}" checked> ${esc(entry.id)} <span class="badge">${duplicate?'Atualizar existente, sem duplicar':current?'Adicionar publicação ao processo':'Novo processo'}</span></label><p class="muted">${current?'O acompanhamento e os vínculos existentes serão preservados.':'Confira os campos antes de incluir. Cliente e responsável serão atribuídos em Gerenciar / detalhes.'}</p>${current?'':`<label>Evento / publicação<input data-field="event" data-index="${index}" value="${esc(entry.event)}" maxlength="300"></label><label>Partes<input data-field="parties" data-index="${index}" value="${esc(entry.parties)}" maxlength="1000"></label><label>Tribunal / vara<input data-field="court" data-index="${index}" value="${esc(entry.court)}" maxlength="300"></label><label>Datas da fonte<input data-field="dates" data-index="${index}" value="${esc(entry.dates)}" maxlength="300"></label>`}<details><summary>Conferir texto extraído</summary><pre class="import-source">${esc(entry.text)}</pre></details></article>`;
      }).join('');
      announce(`${candidates.length} processo(s) identificado(s). Revise os números e os textos; desmarque referências que não devam ser importadas. Datas e prazos não são calculados automaticamente.`);
      updateSelection();
    }catch(error){announce(error.name==='PasswordException'?'PDF protegido por senha. Envie uma cópia desbloqueada.':error.message||'Não foi possível ler o relatório.');}
    finally{busy=false;fileInput.disabled=false;$('cancel-import').disabled=false;}
  };
  function updateSelection(){const n=review.querySelectorAll('[data-import-index]:checked').length;save.disabled=!n;save.textContent=`Confirmar importação${n?` (${n})`:''}`;}
  review.addEventListener('change',updateSelection);
  save.onclick=async()=>{
    if(busy)return;
    const selected=[...review.querySelectorAll('[data-import-index]:checked')].map(input=>({...candidates[Number(input.dataset.importIndex)]}));
    if(!selected.length)return;
    for(const entry of selected){
      entry.availabilityDate=$('import-publication-date').value||entry.availabilityDate;
      const index=candidates.findIndex(c=>c.id===entry.id);
      for(const input of review.querySelectorAll(`[data-index="${index}"]`)){if(!input.value.trim()){input.focus();announce('Preencha os campos de revisão ou mantenha a indicação de conferência pendente.');return;}entry[input.dataset.field]=input.value.trim();}
    }
    const result=AASPImport.merge(documentData,selected,fileName,new Date().toISOString());
    busy=true;save.disabled=true;fileInput.disabled=true;$('cancel-import').disabled=true;announce('Salvando importação no Supabase…');
    try{
      await saveDashboard(result.next);mountDashboard();if(fromControl)window.showControlImportDay?.(DailyPublications.today());else if(window.showImportedDay)showImportedDay(DailyPublications.today());dialog.close();if(!fromControl&&window.queuePublicationEmails){const dates=[...new Set(selected.map(e=>e.availabilityDate||PublicationData.availabilityDate(e.text)).filter(Boolean))];await queuePublicationEmails(dates.length?dates:[DailyPublications.today()]);}
      $('sync').textContent=`Importação salva: ${result.added} novo(s) processo(s), ${result.updated} atualizado(s), incluindo ${result.duplicates} já importado(s), sem duplicação.`;
    }catch(error){announce(error.message);save.disabled=false;}
    finally{busy=false;fileInput.disabled=false;$('cancel-import').disabled=false;}
  };
})();
