'use strict';
(function(root){
 const admins=['assistente2@dibbernadvogados.com.br','carina@dibbernadvogados.com.br','danilo@dibbernadvogados.com.br'];
 const lawyers={'assistente1@dibbernadvogados.com.br':'paola alves','assistente3@dibbernadvogados.com.br':'lais cavinato','assistente9@dibbernadvogados.com.br':'thais dias','assistente10@dibbernadvogados.com.br':'gabriela pizani','assistente6@dibbernadvogados.com.br':'guilherme aguiar'};
 function role(user){const email=String(user?.email||'').trim().toLowerCase();return admins.includes(email)?{admin:true,email}:lawyers[email]?{admin:false,email,lawyer:lawyers[email]}:null;}
 function requireAdmin(user){if(!role(user)?.admin)throw Object.assign(Error('Esta ação é exclusiva da administração do escritório.'),{status:403});}
 function check(data,user){const r=role(user);if(!r)throw Error('Esta conta não tem acesso autorizado ao escritório.');if(!r.admin&&(data?.officeAccess?.version!==1||data.officeAccess.scope!=='own'||data.portfolios?.length!==1))throw Error('O acesso individual ainda precisa ser ativado pelo administrador no banco de dados.');return r;}
 const api={role,requireAdmin,check};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OfficeAccess=api;
})(typeof window==='undefined'?globalThis:window);
