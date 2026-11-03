'use strict';
(function(){
 const root=document.documentElement,key='dibbern-theme';let theme='light';
 try{if(localStorage.getItem(key)==='dark')theme='dark';}catch{}
 root.dataset.theme=theme;
 function apply(value,persist=false){
  theme=value==='dark'?'dark':'light';root.dataset.theme=theme;
  const dark=theme==='dark',button=document.getElementById('theme-toggle'),label=document.getElementById('theme-label'),footer=document.getElementById('footer-theme');
  if(button){button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',`Tema ${dark?'escuro':'claro'}. Ativar tema ${dark?'claro':'escuro'}`);button.title=`Ativar tema ${dark?'claro':'escuro'}`;}
  if(label)label.textContent=dark?'Escuro':'Claro';if(footer)footer.textContent=dark?'Tema escuro':'Tema claro';
  if(persist)try{localStorage.setItem(key,theme);}catch{}
 }
 document.addEventListener('DOMContentLoaded',()=>{apply(theme);document.getElementById('theme-toggle').addEventListener('click',()=>{apply(theme==='dark'?'light':'dark',true);window.auditEvent?.('navigation','Tema de exibição alterado',{status:'success',details:theme==='dark'?'Tema escuro':'Tema claro'});});});
 window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
})();
