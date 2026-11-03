'use strict';
(function(){
 const button=document.getElementById('back-to-top');
 const update=()=>{button.hidden=window.scrollY<300;};
 window.addEventListener('scroll',update,{passive:true});
 window.addEventListener('pageshow',update);
 button.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 update();
})();
