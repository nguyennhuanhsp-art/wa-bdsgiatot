import {spawn} from 'node:child_process';import {randomBytes} from 'node:crypto';import fs from 'node:fs';import assert from 'node:assert/strict';
const checks=[];let child;
async function server(password,port){child=spawn(process.execPath,['../../node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:new URL('../apps/web/',import.meta.url),env:{...process.env,APP_MODE:'hosted-demo',DEMO_ACCESS_USER:'test-viewer',DEMO_ACCESS_PASSWORD:password},stdio:'ignore'});for(let i=0;i<60;i++){try{await fetch(`http://127.0.0.1:${port}/`);return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Gate test server did not start');}
async function stop(){if(child&&child.exitCode===null){const exit=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exit;}child=undefined;}
try{
 const password=randomBytes(32).toString('base64url');await server(password,3100);
 for(const route of ['/','/quan-tri','/api/v1/me','/api/v1/auth/demo','/images/home-1.webp','/_next/static/test.js']){const r=await fetch(`http://127.0.0.1:3100${route}`,{headers:{'x-middleware-subrequest':'middleware:middleware:middleware:middleware:middleware'}});assert.equal(r.status,401,route);assert.match(r.headers.get('cache-control'),/no-store/);checks.push('Anonymous denied: '+route);}
 const wrong=await fetch('http://127.0.0.1:3100/',{headers:{Authorization:'Basic '+Buffer.from('test-viewer:incorrect').toString('base64')}});assert.equal(wrong.status,401);checks.push('Wrong password denied');
 const valid=await fetch('http://127.0.0.1:3100/',{headers:{Authorization:'Basic '+Buffer.from(`test-viewer:${password}`).toString('base64')}});assert.equal(valid.status,200);assert.match(valid.headers.get('x-robots-tag'),/noindex/);checks.push('Authorized viewer allowed and noindex applied');
 await stop();await server('',3100);assert.equal((await fetch('http://127.0.0.1:3100/')).status,503);checks.push('Missing secret fails closed');
 fs.writeFileSync('tests/demo-gate-result.json',JSON.stringify({at:new Date().toISOString(),passed:checks.length,checks},null,2));console.log(checks.length+' demo gate checks passed.');
}finally{await stop();}
