'use strict';
(function(){
  const dialog=$('account-dialog'),message=$('account-message');let busy=false,photo='',photoBusy=false;
  const safePhoto=value=>typeof value==='string'&&value.length<=2400&&/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';
  function profile(user){const p=user?.user_metadata?.dibbern_profile;return p&&typeof p==='object'?p:{};}
  function renderAccountIdentity(){
    const p=profile(session?.user),name=typeof p.name==='string'?p.name:'';
    $('session-name').textContent=name;$('session-name').hidden=!name;
    const avatar=safePhoto(p.photo);$('header-account').hidden=!session||!documentData;$('logout').hidden=!session||!documentData;$('header-account').title=name||session?.user?.email||'Minha conta';$('header-initials').textContent=(name||session?.user?.email||'—').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('pt-BR');$('header-initials').hidden=!!avatar;$('session-avatar').hidden=!avatar;
    if(avatar)$('session-avatar').src=avatar;else $('session-avatar').removeAttribute('src');
    $('session-email').textContent=session?.user?.email||'Conta autorizada';
  }
  window.renderAccountIdentity=renderAccountIdentity;
  function preview(){
    $('profile-preview').hidden=!photo;$('profile-initials').hidden=!!photo;
    if(photo)$('profile-preview').src=photo;else $('profile-preview').removeAttribute('src');
    $('profile-initials').textContent=$('profile-name').value.trim().split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toLocaleUpperCase('pt-BR')||'—';
  }
  function toggleBusy(value){busy=value;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=value);}
  function resetPasswords(){
    $('password-form').reset();
    dialog.querySelectorAll('[data-password-toggle]').forEach(button=>{$(button.dataset.passwordToggle).type='password';button.textContent='Mostrar senha';button.setAttribute('aria-pressed','false');});
  }
  function close(){if(busy||photoBusy)return;resetPasswords();photo='';$('profile-photo').value='';dialog.close();}
  $('close-account').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('header-account').onclick=async()=>{
    if(!session)return;message.textContent='Carregando sua conta…';resetPasswords();dialog.showModal();toggleBusy(true);
    try{
      const user=await request('/auth/v1/user');
      storeSession({...session,user});const p=profile(user);
      $('profile-name').value=typeof p.name==='string'?p.name:'';
      $('profile-oab').value=typeof p.oab==='string'?p.oab:'';
      $('profile-phone').value=typeof p.phone==='string'?p.phone:'';
      $('profile-email').value=user.email||'';photo=safePhoto(p.photo);$('profile-photo').value='';preview();renderAccountIdentity();message.textContent='';
    }catch(error){dialog.close();alert(error.message);}finally{toggleBusy(false);}
  };
  $('profile-name').oninput=preview;
  $('remove-photo').onclick=()=>{if(!busy&&!photoBusy)$('profile-photo').click();};
  $('profile-photo').onchange=async()=>{
    const file=$('profile-photo').files[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){message.textContent='Selecione PNG, JPG ou WebP de até 5 MB.';$('profile-photo').value='';return;}
    photoBusy=true;toggleBusy(true);message.textContent='Preparando sua foto…';let bitmap;
    try{
      bitmap=await createImageBitmap(file);
      if(!bitmap.width||!bitmap.height)throw Error('Imagem inválida.');
      const canvas=document.createElement('canvas'),side=Math.min(bitmap.width,bitmap.height);
      let output='';
      // Keep the avatar small: auth metadata also travels in the session token.
      for(const size of [80,64,48]){
        canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,size,size);
        for(const quality of [.65,.45,.25]){output=canvas.toDataURL('image/webp',quality);if(safePhoto(output))break;}
        if(safePhoto(output))break;
      }
      if(!safePhoto(output))throw Error('Não foi possível ajustar a foto. Escolha uma imagem mais simples.');
      photo=output;preview();message.textContent='Foto pronta. Clique em Salvar meus dados para confirmar.';
    }catch(error){message.textContent=error.message||'Não foi possível abrir esta imagem.';$('profile-photo').value='';}
    finally{bitmap?.close();photoBusy=false;toggleBusy(false);}
  };
  $('profile-form').onsubmit=async event=>{
    event.preventDefault();if(busy||photoBusy)return;
    let next={name:$('profile-name').value.trim(),oab:$('profile-oab').value.trim(),phone:$('profile-phone').value.trim(),photo};
    try{next=ProfileRegistration.validate(next);}catch(e){message.textContent=e.message;return;}
    toggleBusy(true);message.textContent='Salvando seus dados…';
    try{
      const user=await request('/auth/v1/user',{method:'PUT',body:JSON.stringify({data:{dibbern_profile:next}})});
      storeSession({...session,user});renderAccountIdentity();
      let synced=true;
      try{const response=await fetch('/api/office-updates',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Sincronização pendente');const result=await response.json();if(result.rows?.length===1){documentData=await PublicationData.hydrate(result.rows[0].data);revision=result.rows[0].revision;mountDashboard();}}
      catch{synced=false;}
      message.textContent='Seus dados e sua foto foram salvos.'+(synced?'':' A OAB da carteira será sincronizada no próximo acesso.');
    }catch(error){message.textContent=error.message;}finally{toggleBusy(false);}
  };
  dialog.querySelectorAll('[data-password-toggle]').forEach(button=>button.onclick=()=>{const input=$(button.dataset.passwordToggle),visible=input.type==='password';input.type=visible?'text':'password';button.textContent=visible?'Ocultar senha':'Mostrar senha';button.setAttribute('aria-pressed',String(visible));});
  $('password-form').onsubmit=async event=>{
    event.preventDefault();if(busy||photoBusy)return;
    const current=$('current-password').value,next=$('new-password').value;
    if(next!==$('confirm-password').value){message.textContent='A confirmação da nova senha não confere.';$('confirm-password').focus();return;}
    if(next.length<8){message.textContent='A nova senha precisa ter pelo menos 8 caracteres.';return;}
    if(current===next){message.textContent='Escolha uma senha diferente da senha atual.';return;}
    toggleBusy(true);message.textContent='Confirmando sua identidade…';
    try{
      const fresh=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:session.user.email,password:current})},false);
      if(fresh.user.id!==session.user.id)throw Error('A conta autenticada não corresponde à sessão atual. Entre novamente.');
      storeSession({...fresh,expires_at:Math.floor(Date.now()/1000)+fresh.expires_in});
      const user=await request('/auth/v1/user',{method:'PUT',body:JSON.stringify({password:next})});
      storeSession({...session,user});renderAccountIdentity();message.textContent='Senha atualizada. Use a nova senha no próximo acesso.';
    }catch(error){message.textContent=error.message;}finally{resetPasswords();toggleBusy(false);}
  };
  renderAccountIdentity();
})();
