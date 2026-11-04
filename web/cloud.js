'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const config=window.DIBBERN_CONFIG;
let session=null,documentData=null,revision=0;
function storeSession(value){session=value;if(value)sessionStorage.setItem('dibbern-session',JSON.stringify(value));else sessionStorage.removeItem('dibbern-session');}
async function request(path,options={},authenticated=true){
  if(authenticated){
    if(!session)throw Error('Entre novamente para continuar.');
    if((session.expires_at||0)<Date.now()/1000+60){
      const fresh=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})},false);
      storeSession({...fresh,expires_at:Math.floor(Date.now()/1000)+fresh.expires_in});
    }
  }
  const response=await fetch(config.url+path,{...options,headers:{apikey:config.key,'Content-Type':'application/json',...(authenticated?{Authorization:`Bearer ${session.access_token}`} : {}),...options.headers},signal:AbortSignal.timeout(20000)});
  let body;try{body=await response.json()}catch{body=null}
  if(!response.ok){
    const authErrors={invalid_credentials:'E-mail ou senha atual incorretos.',weak_password:'A nova senha não atende às regras de segurança da conta. Escolha uma senha mais forte.',same_password:'Escolha uma senha diferente da senha atual.',reauthentication_needed:'A conta exige verificação adicional. Saia, entre novamente e tente alterar a senha.',reauthentication_not_valid:'Verificação da conta expirada. Entre novamente antes de alterar a senha.',over_request_rate_limit:'Muitas tentativas. Aguarde alguns minutos e tente novamente.',over_email_send_rate_limit:'O limite de envio de e-mails foi atingido. Aguarde antes de tentar novamente.',email_address_invalid:'Confira o endereço de e-mail informado.',email_address_not_authorized:'O Supabase não autorizou o envio de confirmação para este endereço. O administrador precisa revisar o serviço de e-mail do projeto.',email_not_confirmed:'Confirme seu e-mail antes de entrar. Use o link enviado pelo Supabase.',user_already_exists:'Esta conta já existe. Entre com sua senha.',signup_disabled:'O cadastro de novas contas está desativado no Supabase. Solicite a liberação ao escritório.'};
    if(authErrors[body?.error_code||body?.code])throw Error(authErrors[body.error_code||body.code]);
    if(response.status===401||response.status===403)throw Error('Acesso não autorizado ou sessão expirada. Saia e entre novamente.');throw Error('Não foi possível concluir a operação no Supabase. Verifique a conexão e a configuração do banco.');}
  if(authenticated&&options.method&&path.startsWith('/auth/v1/user'))window.auditEvent?.('connection','Configuração da conta atualizada',{status:'success',details:'Dados da conta alterados. Senhas e tokens não são registrados.'});
  return body;
}
let dashboardMutation=Promise.resolve(),dashboardRequiresReload=false;
function queueDashboardMutation(task){const result=dashboardMutation.then(task,task);dashboardMutation=result.catch(()=>{});return result;}
function saveDashboard(next){return queueDashboardMutation(()=>persistDashboard(next));}
async function persistDashboard(next){
  if(dashboardRequiresReload)throw Error('A carteira foi alterada em outra sessão. Recarregue a página antes de salvar para preservar as alterações da equipe.');
  next={...next,activityLog:[...new Map([...(documentData.activityLog||[]),...(next.activityLog||[])].map(e=>[e.id,e])).values()]};
  next=OfficeActivity.recordActivity(documentData,next,session.user);
  $('sync').textContent='Salvando…';
  try{
    const rows=await request(`/rest/v1/dashboards?id=eq.1&revision=eq.${revision}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data:next,revision:revision+1})});
    if(!Array.isArray(rows)||rows.length!==1)throw Error('Os dados foram alterados em outra janela. Recarregue os dados antes de salvar novamente.');
    documentData=await PublicationData.hydrate(rows[0].data);revision=rows[0].revision;$('sync').textContent='Salvo na nuvem';window.dispatchEvent(new Event('dashboard-saved'));
  }catch(error){$('sync').textContent='Não salvo — verifique a conexão ou recarregue';window.auditEvent?.('error','Alterações não foram salvas',{status:'failure',details:error.message});throw error;}
}
async function loadDashboard(){
  let rows,officeWarning=false;
  try{
    const response=await fetch('/api/office-updates',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Sincronização pendente');const result=await response.json();
    if(!Array.isArray(result.rows)||result.rows.length!==1)throw Error('Resposta inválida');rows=result.rows;
  }catch{officeWarning=true;rows=await request('/rest/v1/dashboards?id=eq.1&select=data,revision');}
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Conta sem acesso liberado ou banco ainda não configurado.');
  documentData=await PublicationData.hydrate(rows[0].data);revision=rows[0].revision;
  if(!Array.isArray(documentData.base)||!Array.isArray(documentData.portfolios))throw Error('Dados do dashboard incompletos.');
  mountDashboard();$('login').hidden=true;$('publications-page').hidden=false;$('session-bar').hidden=false;
  $('session-email').textContent=session.user?.email||'Conta autorizada';if(window.renderAccountIdentity)window.renderAccountIdentity();$('sync').textContent=officeWarning?'Dados carregados. Atualização da carteira pendente; recarregue para tentar novamente.':'Dados carregados da nuvem';window.dispatchEvent(new Event('dashboard-ready'));
}
function setPasswordVisible(visible){
  $('password').type=visible?'text':'password';
  $('toggle-password').setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');$('toggle-password').title=visible?'Ocultar senha':'Mostrar senha';
  $('toggle-password').setAttribute('aria-pressed',String(visible));
}
$('toggle-password').onclick=()=>setPasswordVisible($('password').type==='password');
let loginBusy=false,loginNeedsDashboard=false;
function loginRetry(value){loginNeedsDashboard=value;$('password').required=!value;$('login-submit').textContent=value?'Tentar carregar painel':'Entrar';}
for(const id of ['email','password'])$(id).addEventListener('input',()=>{if(!loginBusy)loginRetry(false);});
$('login-form').onsubmit=async event=>{
  event.preventDefault();if(loginBusy)return;loginBusy=true;const button=$('login-submit');button.disabled=true;$('email').readOnly=true;$('password').readOnly=true;
  try{
    if(!loginNeedsDashboard){
      $('login-message').textContent='Verificando acesso…';
      const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})},false);
      storeSession({...result,expires_at:Math.floor(Date.now()/1000)+result.expires_in});loginRetry(true);
    }
    $('login-message').textContent='Acesso confirmado. Carregando painel…';await loadDashboard();
    $('password').value='';setPasswordVisible(false);loginRetry(false);$('login-message').textContent='';
  }catch(error){$('login-message').textContent=(loginNeedsDashboard?'Seu acesso foi confirmado, mas o painel não carregou. Tente carregar novamente. ':'')+error.message;}finally{loginBusy=false;button.disabled=false;$('email').readOnly=false;$('password').readOnly=false;}
};
$('logout').onclick=async()=>{await window.auditEvent?.('session','Saída da conta solicitada',{status:'info'});try{await request('/auth/v1/logout',{method:'POST'})}catch{}finally{storeSession(null);location.reload();}};
(async()=>{try{
  const callback=new URLSearchParams(location.hash.slice(1));
  if(callback.has('access_token')&&callback.has('refresh_token')){
    const accessToken=callback.get('access_token'),refreshToken=callback.get('refresh_token');
    history.replaceState(null,'',location.pathname+location.search);
    const user=await request('/auth/v1/user',{headers:{Authorization:`Bearer ${accessToken}`}},false);
    storeSession({access_token:accessToken,refresh_token:refreshToken,user,expires_at:Math.floor(Date.now()/1000)+(Number(callback.get('expires_in'))||3600)});
    await loadDashboard();
  }else{
    if(callback.has('error')){history.replaceState(null,'',location.pathname+location.search);$('login-message').textContent='O link de confirmação expirou ou não é válido. Tente entrar após confirmar sua conta ou solicite ajuda ao escritório.';}
    const value=sessionStorage.getItem('dibbern-session');if(value){session=JSON.parse(value);await loadDashboard();}
  }
}catch(error){if(session?.access_token)loginRetry(true);$('login-message').textContent=error.message;}})();
