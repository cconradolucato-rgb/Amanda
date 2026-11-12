'use strict';
(function(){
  // This scopes the registration UI only. Database access must be authorized by Supabase RLS.
  const eligibleEmails=new Set(['cconradolucato@gmail.com','assistente1@dibbernadvogados.com.br','assistente2@dibbernadvogados.com.br','assistente3@dibbernadvogados.com.br','assistente9@dibbernadvogados.com.br','assistente10@dibbernadvogados.com.br','assistente6@dibbernadvogados.com.br','carina@dibbernadvogados.com.br','danilo@dibbernadvogados.com.br']);
  const dialog=$('signup-dialog'),message=$('signup-message');let busy=false,photo='',photoBusy=false,approvalReady=false;
  async function approvalStatus(){try{approvalReady=await request('/rest/v1/rpc/office_account_activation_version',{method:'POST',body:'{}'},false)===1;}catch{approvalReady=false;}const help=$('signup-activation-help');if(help)help.textContent='Todos os campos são obrigatórios, inclusive a foto. Use o e-mail profissional informado pelo escritório. '+(approvalReady?'Após o cadastro, solicite à administração a aprovação em Cadastros no painel. Depois, entre com a senha criada.':'Enquanto a aprovação no painel não for ativada, o cadastro usa a confirmação enviada por e-mail.');return approvalReady;}
  $('signup-uf').innerHTML='<option value="">Selecione a UF</option>'+ProfileRegistration.states.map(uf=>'<option>'+uf+'</option>').join('');
  function previewPhoto(){const preview=$('signup-photo-preview');preview.hidden=!photo;if(photo)preview.src=photo;else preview.removeAttribute('src');}
  $('signup-photo').onchange=async()=>{const file=$('signup-photo').files[0];photo='';previewPhoto();if(!file)return;photoBusy=true;dialog.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);message.textContent='Preparando sua foto…';try{photo=await ProfileRegistration.preparePhoto(file);previewPhoto();message.textContent='Foto pronta. Preencha todos os dados para criar sua conta.';}catch(e){$('signup-photo').value='';message.textContent=e.message;}finally{photoBusy=false;dialog.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);}};
  function resetSecrets(){
    $('signup-password').value='';$('signup-confirm').value='';
    dialog.querySelectorAll('[data-signup-toggle]').forEach(button=>{$(button.dataset.signupToggle).type='password';button.setAttribute('aria-pressed','false');const label=button.dataset.signupToggle==='signup-confirm'?'Mostrar confirmação de senha':'Mostrar senha';button.setAttribute('aria-label',label);button.title=label;});
  }
  function close(){if(busy||photoBusy)return;resetSecrets();dialog.close();}
  $('close-signup').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('open-signup').onclick=()=>{
    $('signup-form').reset();photo='';previewPhoto();resetSecrets();message.textContent='';
    const email=$('email').value.trim().toLowerCase();if(eligibleEmails.has(email))$('signup-email').value=email;
    dialog.showModal();approvalStatus();
  };
  dialog.querySelectorAll('[data-signup-toggle]').forEach(button=>button.onclick=()=>{
    const input=$(button.dataset.signupToggle),visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));const label=visible?'Ocultar senha':button.dataset.signupToggle==='signup-confirm'?'Mostrar confirmação de senha':'Mostrar senha';button.setAttribute('aria-label',label);button.title=label;
  });
  $('signup-form').onsubmit=async event=>{
    event.preventDefault();if(busy||photoBusy)return;
    const email=$('signup-email').value.trim().toLowerCase(),name=$('signup-name').value.trim(),password=$('signup-password').value;
    if(!eligibleEmails.has(email)){message.textContent='Use o e-mail autorizado para este primeiro acesso. Se precisar de outra conta, solicite a liberação ao escritório.';return;}
    let profile;try{profile=ProfileRegistration.validate({name,oab:$('signup-uf').value+' '+$('signup-oab').value.trim(),phone:$('signup-phone').value,photo});}catch(e){message.textContent=e.message;return;}
    if(password!==$('signup-confirm').value){message.textContent='A confirmação de senha não confere.';return;}
    if(password.length<8){message.textContent='Use uma senha de pelo menos 8 caracteres.';return;}
    busy=true;dialog.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);message.textContent='Solicitando criação da sua conta…';
    try{
      await approvalStatus();
      const created=await request(`/auth/v1/signup?redirect_to=${encodeURIComponent(location.origin+'/')}`,{method:'POST',body:JSON.stringify({email,password,data:{dibbern_profile:profile}})},false);
      resetSecrets();$('email').value=email;
      if(created?.access_token){storeSession({...created,expires_at:Math.floor(Date.now()/1000)+created.expires_in});dialog.close();await loadDashboard();return;}
      message.textContent=approvalReady?'Solicitação enviada. Para o primeiro acesso, peça à administração a aprovação em Cadastros no painel. Depois da liberação, entre com a senha criada. Se já possui conta, use seu acesso habitual.':'Solicitação enviada. A aprovação no painel ainda precisa ser ativada pelo administrador. Enquanto isso, a confirmação por e-mail continua disponível. Se já possui conta, entre com sua senha.';
      $('login-message').textContent=approvalReady?'Após a aprovação do cadastro pela administração, entre com a senha escolhida. As permissões da sua carteira serão mantidas.':'A aprovação no painel ainda precisa ser ativada. Se seu cadastro já foi confirmado por e-mail, entre com a senha escolhida.';
    }catch(error){resetSecrets();message.textContent=error.message;}
    finally{busy=false;dialog.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);}
  };
})();
