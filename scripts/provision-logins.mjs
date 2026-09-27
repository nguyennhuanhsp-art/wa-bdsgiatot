import { Client } from 'pg';
const entries=[['bds_app_login','bdsgiatot_api','API_DB_PASSWORD'],['bds_auth_login','bdsgiatot_auth','AUTH_DB_PASSWORD'],['bds_worker_login','bdsgiatot_worker','WORKER_DB_PASSWORD']];
for(const [, ,key] of entries){const val=process.env[key];if(!val||val.length<20||val.includes('REPLACE')) throw new Error('Set a unique random secret of at least 20 characters: '+key);}
const db=new Client({connectionString:process.env.DATABASE_ADMIN_URL});await db.connect();
try{
 await db.query('BEGIN');
 for(const [login,group,key] of entries){
  if((await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[login])).rowCount) throw new Error('Login already exists; refusing to overwrite: '+login);
  // Server quotes the literal; identifiers below are fixed constants, not user input.
  const quoted=(await db.query('SELECT quote_literal($1) AS secret',[process.env[key]])).rows[0].secret;
  await db.query(`CREATE ROLE ${login} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${quoted}`);
  await db.query(`GRANT ${group} TO ${login}`);
  await db.query(`ALTER ROLE ${login} SET search_path=bds,public`);
  console.log('CREATED',login);
 }
 await db.query('COMMIT');
}catch(e){await db.query('ROLLBACK');console.error('Provision failed:',e.code||'configuration error');process.exitCode=1;}finally{await db.end();}
