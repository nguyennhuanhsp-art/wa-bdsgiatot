import {spawn} from 'node:child_process';
const port=Number(process.env.PORT||3000);
if(process.env.APP_MODE!=='hosted-demo'||!process.env.APP_ORIGIN?.startsWith('https://')||!process.env.DEMO_ACCESS_USER||(process.env.DEMO_ACCESS_PASSWORD?.length||0)<32||process.env.COOKIE_SECURE!=='true'||!Number.isInteger(port)||port<1024||port>65535||port===3001)throw Error('Invalid protected-demo configuration.');
if(['DATABASE_API_URL','DATABASE_AUTH_URL','DATABASE_WORKER_URL'].some(k=>process.env[k]))throw Error('Do not attach production credentials to a demo.');
const children=[];let stopping=false;
function stop(code){if(stopping)return;stopping=true;for(const p of children)p.kill('SIGTERM');setTimeout(()=>process.exit(code),2000).unref();}
process.on('SIGTERM',()=>stop(0));process.on('SIGINT',()=>stop(0));
function run(args,cwd){const p=spawn(process.execPath,args,{cwd,env:process.env,stdio:'inherit'});children.push(p);p.on('error',()=>stop(1));p.on('exit',c=>{if(!stopping)stop(c||1)});return p;}
run(['apps/api/dist/main.js'],process.cwd());
let ready=false;for(let i=0;i<60&&!stopping;i++){try{const r=await fetch('http://127.0.0.1:3001/api/v1/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
if(!ready){stop(1);throw Error('Demo API did not become ready.');}
run(['../../node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',String(port)],new URL('../apps/web/',import.meta.url));
