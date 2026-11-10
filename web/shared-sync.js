'use strict';
let sharedPendingRow=null,sharedChecking=false,sharedViewTimer=null;
function sharedEditorOpen(){return [...document.querySelectorAll('dialog[open]')].some(d=>!['audit-dialog','integrations-dialog','today-deadlines-dialog'].includes(d.id));}
function sharedNotice(text){const node=$('shared-sync-message');node.hidden=!text;if(node.textContent!==text)node.textContent=text;}
async function acceptSharedRow(row){
 if(!row||row.revision<=revision)return;
 const next=await PublicationData.hydrate(row.data),changed=!SharedData.same({...documentData,activityLog:null},{...next,activityLog:null});
 if(sharedEditorOpen()&&changed){if(!sharedPendingRow||row.revision>sharedPendingRow.revision)sharedPendingRow=row;sharedNotice('Há atualizações da equipe. Sua edição foi mantida e será combinada com os dados atuais ao salvar.');return;}
 documentData=next;revision=row.revision;dashboardRequiresReload=false;
 if(changed){const state=window.captureDashboardView?.();mountDashboard();window.restoreDashboardView?.(state);sharedNotice('Dados atualizados com as alterações da equipe.');}
 window.dispatchEvent(new CustomEvent('dashboard-remote-updated',{detail:{changed}}));
}
function flushSharedPending(){clearTimeout(sharedViewTimer);sharedViewTimer=setTimeout(()=>{if(sharedEditorOpen())return;if(sharedPendingRow?.revision>revision){const row=sharedPendingRow;sharedPendingRow=null;queueDashboardMutation(()=>acceptSharedRow(row)).catch(()=>{});}else{sharedPendingRow=null;sharedNotice('');}},0);}
async function checkSharedUpdates(){
 if(sharedChecking||!session||!documentData||document.visibilityState!=='visible')return;sharedChecking=true;
 try{await queueDashboardMutation(async()=>{const rows=await request('/rest/v1/dashboards?id=eq.1&select=revision');if(rows?.[0]?.revision>Math.max(revision,sharedPendingRow?.revision||0)){const full=await request('/rest/v1/dashboards?id=eq.1&select=data,revision');if(full?.[0])await acceptSharedRow(full[0]);}});}catch{sharedNotice('Não foi possível atualizar os dados da equipe agora. O sistema tentará novamente.');}finally{sharedChecking=false;}
}
document.addEventListener('close',flushSharedPending,true);window.addEventListener('dashboard-saved',flushSharedPending);window.addEventListener('online',checkSharedUpdates);window.addEventListener('focus',checkSharedUpdates);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkSharedUpdates();});setInterval(checkSharedUpdates,5000);
