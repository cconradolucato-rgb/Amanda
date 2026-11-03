'use strict';
(function(){
  let images=[],busy=false,existing=[];
  const maxImageLength=180000;
  $('editor').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  const safeImage=value=>typeof value==='string'&&value.length<=maxImageLength&&/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(value);
  function safeLink(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
  function drawSaved(){
    $('saved-notes').innerHTML=existing.length?existing.map((note,index)=>`<article class="saved-note"><div class="note-meta">${esc(note.author||'Equipe')} · ${esc(new Date(note.createdAt).toLocaleString('pt-BR'))}</div>${note.text?`<p>${esc(note.text)}</p>`:''}<div class="note-gallery">${(note.images||[]).filter(image=>safeImage(image.data)).map((image,imageIndex)=>`<button type="button" data-note-image="${index}" data-image-index="${imageIndex}" aria-label="Ampliar imagem ${esc(image.name||'anexa')}"><img src="${image.data}" alt="${esc(image.name||'Imagem anexada')}"></button>`).join('')}</div>${(note.links||[]).filter(link=>safeLink(link)).map(link=>`<p><a href="${esc(safeLink(link))}" target="_blank" rel="noopener noreferrer">${esc(link)}</a></p>`).join('')}</article>`).join(''):'<p class="muted">Nenhuma observação adicionada a este processo.</p>';
  }
  function drawImages(){
    $('note-image-previews').innerHTML=images.map((image,index)=>`<div class="note-image-preview"><img src="${image.data}" alt="Prévia de ${esc(image.name)}"><small>${esc(image.name)}</small><button type="button" data-remove-note-image="${index}">Remover imagem</button></div>`).join('');
  }
  $('note-image-previews').onclick=event=>{const button=event.target.closest('[data-remove-note-image]');if(!button||busy)return;images.splice(Number(button.dataset.removeNoteImage),1);drawImages();};
  $('saved-notes').onclick=event=>{
    const button=event.target.closest('[data-note-image]');if(!button)return;
    const image=existing[Number(button.dataset.noteImage)]?.images?.filter(image=>safeImage(image.data))[Number(button.dataset.imageIndex)];
    if(!image)return;$('note-full-image').src=image.data;$('note-image-name').textContent=image.name||'Imagem anexada';$('note-viewer').showModal();
  };
  $('note-viewer').addEventListener('close',()=>$('note-full-image').removeAttribute('src'));
  $('close-note-viewer').onclick=()=>{$('note-viewer').close();$('note-full-image').removeAttribute('src');};
  $('note-images').onchange=async()=>{
    if(busy)return;const files=[...$('note-images').files];$('note-images').value='';
    if(!files.length)return;
    if(images.length+files.length>3){$('notes-message').textContent='Adicione até 3 imagens por observação.';return;}
    if(files.some(file=>!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)){$('notes-message').textContent='Use PNG, JPG ou WebP de até 5 MB por imagem.';return;}
    busy=true;$('notes-message').textContent='Preparando imagens…';$('note-images').disabled=true;
    try{
      const prepared=[];
      for(const file of files){let bitmap;
        try{
          bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas'),ratio=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));let output='';
          for(const factor of [1,.75,.5]){
            canvas.width=Math.max(1,Math.round(bitmap.width*ratio*factor));canvas.height=Math.max(1,Math.round(bitmap.height*ratio*factor));
            const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
            for(const quality of [.8,.6,.4]){output=canvas.toDataURL('image/jpeg',quality);if(safeImage(output))break;}
            if(safeImage(output))break;
          }
          if(!safeImage(output))throw Error('Não foi possível otimizar uma das imagens. Selecione um arquivo menor.');
          prepared.push({name:file.name,data:output});
        }finally{bitmap?.close();}
      }
      images.push(...prepared);drawImages();$('notes-message').textContent='Imagens prontas. Salve o acompanhamento para confirmar.';
    }catch(error){$('notes-message').textContent=error.message||'Não foi possível ler as imagens.';}
    finally{busy=false;$('note-images').disabled=false;}
  };
  window.processNotes={canClose:()=>!busy,
    open(record){images=[];existing=Array.isArray(record.notes)?record.notes:[];$('note-text').value='';$('note-links').value='';$('note-images').value='';$('notes-message').textContent='';drawImages();drawSaved();},
    pending(record){
      if(busy)throw Error('Aguarde o preparo das imagens antes de salvar.');
      const text=$('note-text').value.trim(),rawLinks=$('note-links').value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
      if(rawLinks.length>5)throw Error('Adicione no máximo 5 links por observação.');
      const links=rawLinks.map(value=>{const link=safeLink(value);if(!link)throw Error('Confira os links: use endereços completos HTTP ou HTTPS, sem usuário ou senha.');return link;});
      if(!text&&!links.length&&!images.length)return record.notes||[];
      if(text.length>10000)throw Error('A observação pode ter até 10.000 caracteres.');
      const name=session?.user?.user_metadata?.dibbern_profile?.name||session?.user?.email||'Equipe';
      return [...(record.notes||[]),{id:crypto.randomUUID(),author:name,authorId:session?.user?.id||'',createdAt:new Date().toISOString(),text,links,images:[...images]}];
    }
  };
})();
