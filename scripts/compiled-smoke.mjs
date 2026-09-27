import fs from 'node:fs';import assert from 'node:assert/strict';
const base='http://127.0.0.1:3001/api/v1',origin='http://127.0.0.1:3000';
const demo=JSON.parse(fs.readFileSync('.local/DEMO-ACCOUNTS.json','utf8'));
const r=await fetch(`${base}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email:'admin@bdsgiatot.test',password:demo.password})});assert.equal(r.status,201);const cookie=r.headers.get('set-cookie').split(';')[0];
const workspace=await fetch(`${base}/admin/overview`,{headers:{Cookie:cookie}});assert.equal(workspace.status,200);const d=await workspace.json();assert.ok(d.projects.length>=6);
const list=await (await fetch(`${base}/listings`)).json();assert.ok(list.total>=12);
const logout=await fetch(`${base}/auth/logout`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:'{}'});assert.equal(logout.status,201);assert.equal((await fetch(`${base}/admin/overview`,{headers:{Cookie:cookie}})).status,401);
fs.writeFileSync('tests/compiled-smoke.json',JSON.stringify({at:new Date().toISOString(),compiledServer:true,passwordLogin:true,adminOverview:true,persistentProjects:d.projects.length,publicListings:list.total,logoutInvalidatesSession:true},null,2));console.log('Compiled server, password login, persistent data, admin authorization and logout verified.');
