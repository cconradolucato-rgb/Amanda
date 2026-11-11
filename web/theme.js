'use strict';
(function(){
 const root=document.documentElement,key='dibbern-theme',themes=['light','dark','reading'],names={light:'Claro',dark:'Escuro',reading:'Leitura'};let theme='light';
 try{const stored=localStorage.getItem(key);if(themes.includes(stored))theme=stored;}catch{}
 root.dataset.theme=theme;
 function apply(value,persist=false){
  theme=themes.includes(value)?value:'light';root.dataset.theme=theme;
  const button=document.getElementById('theme-toggle'),label=document.getElementById('theme-label'),footer=document.getElementById('footer-theme'),next=themes[(themes.indexOf(theme)+1)%themes.length];
  if(button){button.removeAttribute('aria-pressed');button.setAttribute('aria-label',`Tema ${names[theme]}. Alterar para ${names[next]}`);button.title=`Claro, Escuro e Leitura. Alterar para ${names[next]}`;}
  if(label)label.textContent=names[theme];if(footer)footer.textContent='Tema '+names[theme].toLocaleLowerCase('pt-BR');
  if(persist)try{localStorage.setItem(key,theme);}catch{}
 }
 document.addEventListener('DOMContentLoaded',()=>{apply(theme);document.getElementById('theme-toggle').addEventListener('click',()=>{apply(themes[(themes.indexOf(theme)+1)%themes.length],true);window.auditEvent?.('navigation','Tema de exibição alterado',{status:'success',details:'Tema '+names[theme].toLocaleLowerCase('pt-BR')});});});
 window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
})();
