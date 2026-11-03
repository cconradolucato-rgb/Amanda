'use strict';
const crypto=require('node:crypto');
function authorized(header,secret){if(typeof secret!=='string'||secret.length<20||typeof header!=='string')return false;const actual=Buffer.from(header),expected=Buffer.from('Bearer '+secret);return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);}
function databaseHeaders(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Object.assign(Error('Configure o acesso de servidor ao banco para ativar a execução automática.'),{status:503});return {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};}
module.exports={authorized,databaseHeaders};
