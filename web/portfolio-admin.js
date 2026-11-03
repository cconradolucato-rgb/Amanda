'use strict';
(function(){
  const dialog=$('portfolio-dialog'),message=$('portfolio-message');let busy=false,pending=null;
  const normalize=value=>value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
  const clearPending=()=>{pending=null;sessionStorage.removeItem('dibbern-pending-portfolio');};
  function open(value){
    if(!session||!documentData)return;
    $('portfolio-form').reset();message.textContent='';
    if(value){$('portfolio-lawyer-name').value=value.lawyer;$('portfolio-client-names').value=value.clients.join('\n');}
    if(!dialog.open)dialog.showModal();
  }
  function close(){if(busy)return;clearPending();dialog.close();}
  $('add-portfolio').onclick=()=>open();$('close-portfolio').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  function openPending(){if(pending&&session&&documentData)open(pending);}
  try{
    const hash=new URLSearchParams(location.hash.slice(1)),encoded=hash.get('carteira');
    if(encoded){
      history.replaceState(null,'',location.pathname+location.search);
      if(encoded.length>40000)throw Error('Cadastro grande demais.');
      const raw=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
      const data=JSON.parse(new TextDecoder().decode(raw));
      if(typeof data.lawyer==='string'&&data.lawyer.length<=120&&Array.isArray(data.clients)&&data.clients.length<=300&&data.clients.every(c=>typeof c==='string'&&c.length<=300))sessionStorage.setItem('dibbern-pending-portfolio',JSON.stringify(data));
    }
    const stored=sessionStorage.getItem('dibbern-pending-portfolio');if(stored)pending=JSON.parse(stored);
  }catch{clearPending();}
  window.addEventListener('dashboard-ready',openPending);openPending();
  $('portfolio-form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const lawyer=$('portfolio-lawyer-name').value.trim(),raw=$('portfolio-client-names').value.split(/\r?\n/).map(c=>c.trim()).filter(Boolean);
    if(!lawyer||!raw.length){message.textContent='Preencha o nome e pelo menos um cliente.';return;}
    if(raw.length>300||raw.some(c=>c.length>300)){message.textContent='Use até 300 clientes, com no máximo 300 caracteres por nome.';return;}
    const unique=[...new Map(raw.map(c=>[normalize(c),c])).values()];
    const portfolios=documentData.portfolios.map(p=>({...p,clients:[...p.clients]})),existing=portfolios.find(p=>normalize(p.lawyer)===normalize(lawyer));
    if(existing){const known=new Set(existing.clients.map(normalize));existing.clients.push(...unique.filter(c=>!known.has(normalize(c))));}
    else portfolios.push({lawyer,clients:unique});
    busy=true;dialog.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);message.textContent='Salvando carteira…';
    try{await saveDashboard({...documentData,portfolios});clearPending();mountDashboard();dialog.close();$('sync').textContent=`Carteira de ${lawyer} salva com ${existing?existing.clients.length:unique.length} clientes.`;}
    catch(error){message.textContent=error.message;}
    finally{busy=false;dialog.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=false);}
  };
})();
