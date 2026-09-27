import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const files=['001_schema.sql','002_business_rules.sql','003_security.sql','004_seed_catalogs.sql'];
if(!process.env.DATABASE_ADMIN_URL) throw new Error('Set DATABASE_ADMIN_URL');
const db=new Client({connectionString:process.env.DATABASE_ADMIN_URL});await db.connect();
try {
 await db.query("SELECT pg_advisory_lock(98173451)");
 await db.query('CREATE TABLE IF NOT EXISTS public.bdsgiatot_schema_migrations(filename text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 for(const name of files){
  const raw=readFileSync(new URL('../sql/'+name,import.meta.url),'utf8');
  const hash=createHash('sha256').update(raw).digest('hex');
  const prev=await db.query('SELECT sha256 FROM public.bdsgiatot_schema_migrations WHERE filename=$1',[name]);
  if(prev.rowCount){if(prev.rows[0].sha256!==hash) throw new Error('Applied migration changed: '+name);console.log('SKIP',name);continue;}
  // Wrap both migration contents and journal record in one transaction.
  const sql=raw.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
  await db.query('BEGIN');
  try{await db.query(sql);await db.query('INSERT INTO public.bdsgiatot_schema_migrations(filename,sha256) VALUES($1,$2)',[name,hash]);await db.query('COMMIT');}
  catch(e){await db.query('ROLLBACK');throw e;}
  console.log('APPLIED',name);
 }
}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.query('SELECT pg_advisory_unlock(98173451)');await db.end();}
