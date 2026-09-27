import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(process.env.SQL_TEST_DEPS || root, 'package.json'));
let db, NativeClient;
const native=Boolean(process.env.DATABASE_TEST_URL);
if(native){
 if(!new URL(process.env.DATABASE_TEST_URL).pathname.endsWith('_test')) throw new Error('Native test database name must end with _test and be disposable');
 NativeClient=req('pg').Client; const client=new NativeClient({connectionString:process.env.DATABASE_TEST_URL}); await client.connect();
 if((await client.query("SELECT 1 FROM pg_namespace WHERE nspname='bds'")).rowCount) {await client.end();throw new Error('Use an empty disposable test database');}
 db={query:(...args)=>client.query(...args),exec:s=>client.query(s),close:()=>client.end()};
}else{
 const { PGlite } = req('@electric-sql/pglite');
 const { postgis } = req('@electric-sql/pglite-postgis');
 const { pg_trgm } = req('@electric-sql/pglite/contrib/pg_trgm');
 db = new PGlite({ extensions: { postgis, pg_trgm } });
}
const results=[];
const q=(s,p=[])=>db.query(s,p);
const scalar=async(s,p=[])=>Object.values((await q(s,p)).rows[0])[0];
const id=async(s,p=[])=>scalar(s+' RETURNING id',p);
async function test(name,fn){ await fn(); results.push({name,status:'passed'}); console.log('PASS',name); }
async function as(actor,fn,role='bdsgiatot_api'){
 await db.exec('BEGIN');
 try { await db.exec(`SET LOCAL ROLE ${role}`); await q("SELECT set_config('app.user_id',$1,true)",[actor||'']);
  const r=await fn(); await db.exec('COMMIT'); return r;
 } catch(e){await db.exec('ROLLBACK');throw e;}
}
async function deny(actor,sql,params=[],code='42501') {
 await assert.rejects(as(actor,()=>q(sql,params)),e=>{assert.equal(e.code,code,e.message);return true;});
}
try {
 for(const file of ['001_schema.sql','002_business_rules.sql','003_security.sql','004_seed_catalogs.sql']) {
  await db.exec(readFileSync(resolve(root,'sql',file),'utf8')); console.log('MIGRATED',file);
 }
 await test('PostGIS and pg_trgm loaded with unmodified migrations',async()=>{
  assert.ok(await scalar('SELECT public.postgis_version()'));
  assert.ok(Number(await scalar("SELECT public.similarity('villa','villa')"))===1);
 });
 const admin=await id("INSERT INTO bds.users(email,display_name,platform_role,status) VALUES('admin@example.test','Admin','admin','active')");
 const companyAdmin=await id("INSERT INTO bds.users(email,display_name,status) VALUES('manager@example.test','Manager','active')");
 const other=await id("INSERT INTO bds.users(email,display_name,status) VALUES('other@example.test','Other','active')");
 const sale=await id("INSERT INTO bds.users(email,display_name,status) VALUES('sale@example.test','Sale','active')");
 const sale2=await id("INSERT INTO bds.users(email,display_name,status) VALUES('sale2@example.test','Sale2','active')");
 const org=await id("INSERT INTO bds.organizations(legal_name,slug,registration_number,registration_country,verification_status,status) VALUES('Test company','test-company','TEST1','VN','verified','active')");
 const org2=await id("INSERT INTO bds.organizations(legal_name,slug,registration_number,registration_country,verification_status,status) VALUES('Other company','other-company','TEST2','VN','verified','active')");
 await q("INSERT INTO bds.organization_members(organization_id,user_id,role,status) VALUES($1,$2,'org_admin','active'),($3,$4,'org_admin','active')",[org,companyAdmin,org2,other]);
 const member=await id("INSERT INTO bds.organization_members(organization_id,user_id,role,status) VALUES($1,$2,'sale','active')",[org,sale]);
 const member2=await id("INSERT INTO bds.organization_members(organization_id,user_id,role,status) VALUES($1,$2,'sale','active')",[org,sale2]);
 const loc=await id("INSERT INTO bds.locations(country_code,name,slug,location_type) VALUES('VN','Test location','test-location','province')");
 const project=await id("INSERT INTO bds.projects(location_id,name,slug,address,status) VALUES($1,'Test project','test-project','Test address','published')",[loc]);
 await q("INSERT INTO bds.project_property_types VALUES($1,'villa')",[project]);
 const po=await id("INSERT INTO bds.project_organizations(project_id,organization_id,role,verification_status) VALUES($1,$2,'owner','verified')",[project,org]);
 const project2=await id("INSERT INTO bds.projects(location_id,name,slug,address,status) VALUES($1,'Other project','other-project','Test address','published')",[loc]);
 const po2=await id("INSERT INTO bds.project_organizations(project_id,organization_id,role,verification_status) VALUES($1,$2,'distributor','verified')",[project2,org2]);
 const contract=await id("INSERT INTO bds.contracts(organization_id,contract_number,status,effective_from,effective_until,signed_at) VALUES($1,'TEST-CONTRACT','active',now()-interval '1 day',now()+interval '1 year',now())",[org]);
 await q("INSERT INTO bds.contract_documents(contract_id,organization_id,document_type,private_storage_key,version) VALUES($1,$2,'signed_contract','private/test-contract',1)",[contract,org]);
 const plan=await id("INSERT INTO bds.combo_plans(name,default_sale_limit,default_listing_limit) VALUES('Test plan',1,1)");
 const sub=await id("INSERT INTO bds.subscriptions(contract_id,organization_id,combo_plan_id,sale_limit,active_listing_limit,starts_at,ends_at,status) VALUES($1,$2,$3,1,1,now()-interval '1 hour',now()+interval '30 days','active')",[contract,org,plan]);
 const grant=await id("INSERT INTO bds.subscription_projects(subscription_id,organization_id,project_id,project_organization_id,valid_from,valid_until) VALUES($1,$2,$3,$4,now()-interval '30 minutes',now()+interval '29 days')",[sub,org,project,po]);
 let seat,assignment,l1,l2;
 await test('Company admin allocates one seat and project assignment',async()=>{
  seat=await as(companyAdmin,()=>scalar('SELECT bds.allocate_seat($1,$2)',[sub,member]));
  assignment=await as(companyAdmin,()=>scalar('SELECT bds.assign_project($1,$2)',[seat,grant])); assert.ok(assignment);
 });
 await test('Seat allocation is idempotent',async()=>assert.equal(await as(companyAdmin,()=>scalar('SELECT bds.allocate_seat($1,$2)',[sub,member])),seat));
 await test('Second seat exceeds quota',()=>deny(companyAdmin,'SELECT bds.allocate_seat($1,$2)',[sub,member2],'23514'));
 await test('Other company cannot allocate a seat',()=>deny(other,'SELECT bds.allocate_seat($1,$2)',[sub,member],'42501'));
 const createListing=()=>as(sale,()=>id(`INSERT INTO bds.listings(organization_id,project_id,subscription_id,assignment_id,property_type_code,transaction_type,slug,title,description,price_amount,currency_code,price_basis,area_m2,created_by)
 VALUES($1,$2,$3,$4,'villa','sale','test-villa','Test villa for sale','This is a full description for a test villa listing.',3000000000,'VND','total',120,$5)`,[org,project,sub,assignment,sale]));
 await test('Assigned Sale creates draft listings',async()=>{l1=await createListing();l2=await createListing();assert.ok(l1&&l2);});
 await test('Drafts are not public',async()=>assert.equal(await as(null,()=>scalar('SELECT count(*)::int FROM bds.public_listings')),0));
 await test('Other company cannot read tenant listings',async()=>assert.equal(await as(other,()=>scalar('SELECT count(*)::int FROM bds.listings')),0));
 await test('Other company cannot read tenant contracts',async()=>assert.equal(await as(other,()=>scalar('SELECT count(*)::int FROM bds.contracts')),0));
 await test('Other company update affects zero rows',async()=>assert.equal((await as(other,()=>q("UPDATE bds.listings SET title='Unauthorized change' WHERE id=$1 RETURNING id",[l1]))).rows.length,0));
 await test('Sale cannot update publication status directly',()=>deny(sale,"UPDATE bds.listings SET status='published' WHERE id=$1",[l1]));
 await test('Null non-negotiable price is rejected',()=>deny(sale,'UPDATE bds.listings SET price_amount=NULL WHERE id=$1',[l1],'23514'));
 await test('Sale submits for review',()=>as(sale,()=>q("SELECT bds.transition_listing($1,'pending')",[l1])));
 await test('Sale cannot approve own listing',()=>deny(sale,"SELECT bds.transition_listing($1,'published',NULL,now()+interval '1 day')",[l1]));
 await test('Admin cannot approve listing with no image',()=>deny(admin,"SELECT bds.transition_listing($1,'published',NULL,now()+interval '1 day')",[l1],'23514'));
 await as(admin,()=>q("SELECT bds.transition_listing($1,'rejected','Add image')",[l1]));
 const media=await id("INSERT INTO bds.media_assets(organization_id,uploaded_by,storage_key,public_url,mime_type,byte_size,width,height,status) VALUES($1,$2,'images/test.webp','https://example.test/test.webp','image/webp',10000,1000,800,'ready')",[org,sale]);
 await as(sale,()=>q('INSERT INTO bds.listing_media(listing_id,media_asset_id,organization_id,display_order) VALUES($1,$2,$3,0),($4,$2,$3,0)',[l1,media,org,l2]));
 await as(sale,()=>q("SELECT bds.transition_listing($1,'pending')",[l1]));
 await test('Platform admin publishes approved listing',()=>as(admin,()=>q("SELECT bds.transition_listing($1,'published',NULL,now()+interval '1 day')",[l1])));
 await test('Public view contains live listing',async()=>assert.equal(await as(null,()=>scalar('SELECT count(*)::int FROM bds.public_listings')),1));
 await test('Live content cannot change without re-review',()=>deny(sale,"UPDATE bds.listings SET title='Changed live listing' WHERE id=$1",[l1],'23514'));
 await as(sale,()=>q("SELECT bds.transition_listing($1,'pending')",[l2]));
 await test('Second published listing exceeds quota',()=>deny(admin,"SELECT bds.transition_listing($1,'published',NULL,now()+interval '1 day')",[l2],'23514'));
 await test('Anonymous API can record consented contact',async()=>assert.ok(await as(null,()=>scalar("SELECT bds.record_contact($1,'Buyer','buyer@example.test','Interested',true)",[l1]))));
 await test('Other company cannot read contact',async()=>assert.equal(await as(other,()=>scalar('SELECT count(*)::int FROM bds.contact_requests')),0));
 await test('Assigned Sale can read contact',async()=>assert.equal(await as(sale,()=>scalar('SELECT count(*)::int FROM bds.contact_requests')),1));
 await test('Auth credentials inaccessible to API role',()=>deny(sale,'SELECT * FROM bds_private.auth_credentials'));
 await test('Public access disappears immediately when combo is suspended',async()=>{
  await as(admin,()=>q("UPDATE bds.subscriptions SET status='suspended' WHERE id=$1",[sub]));
  assert.equal(await as(null,()=>scalar('SELECT count(*)::int FROM bds.public_listings')),0);
  await as(admin,()=>q("UPDATE bds.subscriptions SET status='active' WHERE id=$1",[sub]));
 });
 await test('Blocked Sale immediately loses public listing visibility',async()=>{
  await as(companyAdmin,()=>q("SELECT bds.set_sale_status($1,'blocked')",[member]));
  assert.equal(await as(null,()=>scalar('SELECT count(*)::int FROM bds.public_listings')),0);
  await as(companyAdmin,()=>q("SELECT bds.set_sale_status($1,'active')",[member]));
 });
 await test('Cross-company composite key mismatch is rejected',async()=>{
  await assert.rejects(id("INSERT INTO bds.subscription_projects(subscription_id,organization_id,project_id,project_organization_id,valid_from,valid_until) VALUES($1,$2,$3,$4,now(),now()+interval '1 day')",[sub,org2,project2,po2]),e=>e.code==='23503');
 });
 await test('Payment reference is unique and prevents duplicate records',async()=>{
  const sql="INSERT INTO bds.payment_records(contract_id,organization_id,amount,currency_code,provider,reference,status,paid_at) VALUES($1,$2,100,'VND','bank','reference-1','confirmed',now())";
  await q(sql,[contract,org]);await assert.rejects(q(sql,[contract,org]),e=>e.code==='23505');
 });
 await test('Revoking seat hides listings and releases capacity',async()=>{
  await as(companyAdmin,()=>q('SELECT bds.revoke_seat($1)',[seat]));
  assert.equal(await as(null,()=>scalar('SELECT count(*)::int FROM bds.public_listings')),0);
  assert.ok(await as(companyAdmin,()=>scalar('SELECT bds.allocate_seat($1,$2)',[sub,member2])));
 });
 await test('All base tables have RLS enabled',async()=>assert.equal(await scalar("SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bds' AND c.relkind='r' AND NOT c.relrowsecurity"),0));
 await test('Request actor context is cleared after transaction',async()=>assert.equal(await scalar("SELECT nullif(current_setting('app.user_id',true),'') IS NULL"),true));
 await test('API cannot grant platform admin role to itself',()=>deny(sale,"UPDATE bds.users SET platform_role='admin' WHERE id=$1",[sale]));
 await test('Company admin cannot edit combo limit',async()=>assert.equal((await as(companyAdmin,()=>q('UPDATE bds.subscriptions SET sale_limit=999 WHERE id=$1 RETURNING id',[sub]))).rows.length,0));
 await test('Admin increases quota then invitation reserves seat',async()=>{
  await as(admin,()=>q('UPDATE bds.subscriptions SET sale_limit=2 WHERE id=$1',[sub]));
  const invited=await as(companyAdmin,()=>scalar("SELECT bds.invite_sale($1,'invited@example.test','Invited Sale',$2,now()+interval '1 day')",[sub,'a'.repeat(64)]));
  assert.ok(invited);
  assert.equal(await scalar("SELECT count(*)::int FROM bds.subscription_seats WHERE subscription_id=$1 AND status='active'",[sub]),2);
 });
 let invitedUser;
 await test('Invitation activates user once via auth role',async()=>{
  invitedUser=await as(null,()=>scalar('SELECT bds.accept_invitation($1,$2)',['a'.repeat(64),'$argon2id$TEST_ONLY_NOT_A_REAL_HASH']),'bdsgiatot_auth');
  assert.ok(invitedUser);
  await assert.rejects(as(null,()=>q('SELECT bds.accept_invitation($1,$2)',['a'.repeat(64),'$argon2id$TEST_ONLY_NOT_A_REAL_HASH']),'bdsgiatot_auth'),e=>e.code==='23514');
 });
 await test('API role cannot invoke auth activation function',()=>deny(sale,'SELECT bds.accept_invitation($1,$2)',['a'.repeat(64),'$argon2id$TEST_ONLY']));
 await test('Public projections do not contain contact PII or credential hashes',async()=>{
  const cols=(await q("SELECT column_name FROM information_schema.columns WHERE table_schema='bds' AND table_name='public_listings'")).rows.map(r=>r.column_name);
  for(const forbidden of ['password_hash','customer_name','contact_detail','registration_number']) assert.ok(!cols.includes(forbidden));
 });
 if(native){
  const concurrent=async(sql,params)=>{
   const client=new NativeClient({connectionString:process.env.DATABASE_TEST_URL}); await client.connect();
   try {await client.query('BEGIN');await client.query('SET LOCAL ROLE bdsgiatot_api');await client.query("SELECT set_config('app.user_id',$1,true)",[admin]);
    const r=await client.query(sql,params);await client.query('COMMIT');return r;
   }catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
  };
  await test('Two concurrent publications compete for exactly one slot',async()=>{
   await as(admin,()=>q('UPDATE bds.subscriptions SET sale_limit=3 WHERE id=$1',[sub]));
   seat=await as(companyAdmin,()=>scalar('SELECT bds.allocate_seat($1,$2)',[sub,member]));
   assignment=await as(companyAdmin,()=>scalar('SELECT bds.assign_project($1,$2)',[seat,grant]));
   const a=await createListing(),b=await createListing();
   for(const lid of [a,b]){
    await as(sale,()=>q('INSERT INTO bds.listing_media(listing_id,media_asset_id,organization_id,display_order) VALUES($1,$2,$3,0)',[lid,media,org]));
    await as(sale,()=>q("SELECT bds.transition_listing($1,'pending')",[lid]));
   }
   const rs=await Promise.allSettled([a,b].map(lid=>concurrent("SELECT bds.transition_listing($1,'published',NULL,now()+interval '1 day')",[lid])));
   assert.equal(rs.filter(r=>r.status==='fulfilled').length,1);
   assert.equal(rs.find(r=>r.status==='rejected').reason.code,'23514');
  });
 }
 const report={testedAt:new Date().toISOString(),engine:(native?'Native PostgreSQL':'PGlite')+' with real PostGIS and pg_trgm; unmodified migrations',server:await scalar('SELECT version()'),
  postgis:await scalar('SELECT public.postgis_version()'),tableCount:await scalar("SELECT count(*)::int FROM pg_tables WHERE schemaname IN ('bds','bds_private')"),
  tests:results,limits:[...(native?[]:['Not a multi-connection PostgreSQL server; concurrent quota races still require integration testing on native PostgreSQL.']),'No HTTP/UI application has been built in this deliverable.']};
 writeFileSync(resolve(root,'tests','last-result.json'),JSON.stringify(report,null,2));
 console.log(`ALL ${results.length} TESTS PASSED`);
} catch(e){console.error('FAILED',e.message,'code:',e.code,'detail:',e.detail,'where:',e.where);process.exitCode=1;}
finally{await db.close();}
