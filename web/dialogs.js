'use strict';
// Use each dialog's existing cancel handler, including its save-in-progress guard.
for(const dialog of document.querySelectorAll('dialog')){
 const outside=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
 let startedOutside=false;
 dialog.addEventListener('pointerdown',event=>{startedOutside=outside(event);});
 dialog.addEventListener('click',event=>{
  if(!startedOutside||!outside(event)){startedOutside=false;return;}
  startedOutside=false;
  if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();
 });
 dialog.addEventListener('close',()=>{startedOutside=false;});
}
