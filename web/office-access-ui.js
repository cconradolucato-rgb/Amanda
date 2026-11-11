'use strict';
(function(){
 function apply(){if(typeof session==='undefined'||!session||typeof documentData==='undefined'||!documentData)return;const admin=OfficeAccess.role(session.user)?.admin===true;document.documentElement.dataset.officeScope=admin?'all':'own';for(const id of ['owner','deadline-owner','deadline-assigned']){const input=document.getElementById(id);if(input&&!admin)input.disabled=true;}const custom=document.querySelector('#process-state-choice option[value="__custom__"]');if(custom&&!admin)custom.disabled=true;}
 window.applyOfficeAccessUI=apply;document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});apply();});window.addEventListener('dashboard-ready',apply);window.addEventListener('dashboard-saved',apply);window.addEventListener('dashboard-remote-updated',apply);
})();
