'use strict';
(function(){
 const root=document.documentElement,key='dibbern-theme',themes=['light','dark','reading'],names={light:'Claro',dark:'Escuro',reading:'Leitura'};let theme='light';
 try{const stored=localStorage.getItem(key);if(themes.includes(stored))theme=stored;}catch{}
 root.dataset.theme=theme;
 function apply(value,persist=false){
  theme=themes.includes(value)?value:'light';root.dataset.theme=theme;
  const label=document.getElementById('theme-label'),footer=document.getElementById('footer-theme');
  for(const button of document.querySelectorAll('[data-theme-choice]'))button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme));
  if(label)label.textContent=names[theme];if(footer)footer.textContent='Tema '+names[theme].toLocaleLowerCase('pt-BR');
  if(persist)try{localStorage.setItem(key,theme);}catch{}
 }
 document.addEventListener('DOMContentLoaded',()=>{apply(theme);for(const button of document.querySelectorAll('[data-theme-choice]'))button.addEventListener('click',()=>{apply(button.dataset.themeChoice,true);window.auditEvent?.('navigation','Tema de exibição alterado',{status:'success',details:'Tema '+names[theme].toLocaleLowerCase('pt-BR')});});});
 window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
})();
