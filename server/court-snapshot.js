'use strict';
module.exports=JSON.parse(require('node:zlib').gunzipSync(Buffer.from(require('./court-snapshot-data'),'base64')).toString('utf8'));
