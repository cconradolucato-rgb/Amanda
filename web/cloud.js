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
  if(!response.ok){if(response.status===401||response.status===403)throw Error('Acesso não autorizado ou sessão expirada. Saia e entre novamente.');throw Error('Não foi possível concluir a operação no Supabase. Verifique a conexão e a configuração do banco.');}
  return body;
}
async function saveDashboard(next){
  $('sync').textContent='Salvando…';
  try{
    const rows=await request(`/rest/v1/dashboards?id=eq.1&revision=eq.${revision}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data:next,revision:revision+1})});
    if(!Array.isArray(rows)||rows.length!==1)throw Error('Os dados foram alterados em outra janela. Recarregue os dados antes de salvar novamente.');
    documentData=rows[0].data;revision=rows[0].revision;$('sync').textContent='Salvo na nuvem';
  }catch(error){$('sync').textContent='Não salvo — verifique a conexão ou recarregue';throw error;}
}
async function loadDashboard(){
  const rows=await request('/rest/v1/dashboards?id=eq.1&select=data,revision');
  if(!Array.isArray(rows)||rows.length!==1)throw Error('Conta sem acesso liberado ou banco ainda não configurado.');
  documentData=rows[0].data;revision=rows[0].revision;
  if(!Array.isArray(documentData.base)||!Array.isArray(documentData.portfolios))throw Error('Dados do dashboard incompletos.');
  mountDashboard();$('login').hidden=true;document.querySelector('main').hidden=false;$('session-bar').hidden=false;
  $('session-email').textContent=session.user?.email||'Conta autorizada';$('sync').textContent='Dados carregados da nuvem';
}
$('login-form').onsubmit=async event=>{
  event.preventDefault();const button=$('login-form').querySelector('button');button.disabled=true;$('login-message').textContent='Entrando…';
  try{
    const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})},false);
    storeSession({...result,expires_at:Math.floor(Date.now()/1000)+result.expires_in});$('password').value='';await loadDashboard();
  }catch(error){$('login-message').textContent=error.message;}finally{button.disabled=false;}
};
$('logout').onclick=async()=>{try{await request('/auth/v1/logout',{method:'POST'})}catch{}finally{storeSession(null);location.reload();}};
$('reload').onclick=()=>{if(confirm('Recarregar os dados da nuvem? Preenchimentos ainda não salvos serão descartados.'))location.reload();};
(async()=>{try{const value=sessionStorage.getItem('dibbern-session');if(value){session=JSON.parse(value);await loadDashboard();}}catch(error){$('login-message').textContent=error.message;}})();
