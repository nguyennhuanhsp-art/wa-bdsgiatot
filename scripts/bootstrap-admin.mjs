import { Client } from 'pg';
import argon2 from 'argon2';
import readline from 'node:readline';
async function secret(prompt){
 if(!process.stdin.isTTY) throw new Error('Run bootstrap in an interactive terminal');
 process.stdout.write(prompt);readline.emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const listener=(str,key={})=>{
  if(key.ctrl&&key.name==='c'){cleanup();reject(new Error('Cancelled'));}
  else if(key.name==='return'){cleanup();resolve(value);}
  else if(key.name==='backspace'){value=value.slice(0,-1);}
  else if(str&&!key.ctrl&&!key.meta){value+=str;}
 };function cleanup(){process.stdin.off('keypress',listener);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}
 process.stdin.on('keypress',listener);});
}
const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),name=process.env.BOOTSTRAP_ADMIN_NAME?.trim();
if(!email||!name||!process.env.DATABASE_ADMIN_URL) throw new Error('Set DATABASE_ADMIN_URL, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_NAME');
const password=await secret('Admin password (hidden): '),confirmation=await secret('Repeat password (hidden): ');
if(password.length<14||password!==confirmation) throw new Error('Passwords must match and contain at least 14 characters');
const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
const db=new Client({connectionString:process.env.DATABASE_ADMIN_URL});await db.connect();
try{
 await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(98173452)');
 if((await db.query("SELECT 1 FROM bds.users WHERE platform_role='admin' AND status='active'")).rowCount) throw new Error('An active platform admin already exists');
 let u=await db.query('SELECT id,platform_role,status FROM bds.users WHERE email=$1 FOR UPDATE',[email]);
 if(u.rowCount && (u.rows[0].platform_role!=='admin'||u.rows[0].status!=='invited')) throw new Error('Existing email is not an invited bootstrap admin');
 if(!u.rowCount) u=await db.query("INSERT INTO bds.users(email,display_name,platform_role,status) VALUES($1,$2,'admin','invited') RETURNING id",[email,name]);
 await db.query('INSERT INTO bds_private.auth_credentials(user_id,password_hash) VALUES($1,$2)',[u.rows[0].id,hash]);
 await db.query("UPDATE bds.users SET status='active' WHERE id=$1",[u.rows[0].id]);await db.query('COMMIT');
 console.log('First platform admin created. No password is written to files.');
}catch(e){await db.query('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{await db.end();}
