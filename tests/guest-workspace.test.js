import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const proof='a'.repeat(64),subject='guest:'+createHash('sha256').update('fixture-ip').digest('hex');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;insert into auth.users values('${a}'),('${b}');`);
 for(const file of ['202610090001_workspace.sql','20261029133101_guest_services_and_applications.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.query("insert into private.service_settings values('service_proof_sha256',$1)",[createHash('sha256').update(proof).digest('hex')]);
 return db;
}
test('guest service capability rejects browser calls and enforces shared quotas',async()=>{
 const db=await database();
 try{
  await db.exec('set role anon;');
  await assert.rejects(db.query('select public.consume_public_service_quota($1,$2,$3)',[subject,'ai','b'.repeat(64)]),/denied/);
  for(let i=0;i<6;i++)assert.equal((await db.query('select public.consume_public_service_quota($1,$2,$3) as ok',[subject,'ai',proof])).rows[0].ok,i<5);
  await assert.rejects(db.query('select * from private.public_service_usage'),/permission denied/);
  await db.exec('reset role;');
  await db.exec("insert into private.public_service_usage values('global:month','jobs',date_trunc('month',now()),now()+interval '1 month',89);");
  await db.exec('set role anon;');
  assert.equal((await db.query('select public.consume_public_service_quota($1,$2,$3) as ok',[subject,'jobs',proof])).rows[0].ok,true);
  assert.equal((await db.query('select public.consume_public_service_quota($1,$2,$3) as ok',['guest:'+'f'.repeat(64),'jobs',proof])).rows[0].ok,false);
 }finally{await db.close();}
});
test('shared job cache requires server proof and expires data',async()=>{
 const db=await database(),key='c'.repeat(64);
 try{
  await db.exec('set role anon;');
  await assert.rejects(db.query('select public.read_job_search_cache($1,$2)',[key,'wrong']),/denied/);
  await db.query('select public.write_job_search_cache($1,$2,$3)',[key,JSON.stringify({data:[{job_id:'fixture'}]}),proof]);
  assert.equal((await db.query('select public.read_job_search_cache($1,$2) as data',[key,proof])).rows[0].data.data[0].job_id,'fixture');
  await db.exec("reset role;update private.job_search_cache set expires_at=now()-interval '1 second';set role anon;");
  assert.equal((await db.query('select public.read_job_search_cache($1,$2) as data',[key,proof])).rows[0].data,null);
 }finally{await db.close();}
});
test('workspace applications isolate owners and reject spoofed records',async()=>{
 const db=await database();
 try{
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
  const row=await db.query("insert into public.application_activity(user_id,job_key,job) values($1,'job-1','{\"title\":\"Developer\"}') returning id",[a]);
  const id=row.rows[0].id;
  await db.exec(`set request.jwt.claim.sub='${b}';`);
  assert.equal((await db.query('select * from public.application_activity')).rows.length,0);
  assert.equal((await db.query("update public.application_activity set status='offer' where id=$1 returning id",[id])).rows.length,0);
  await assert.rejects(db.query("insert into public.application_activity(user_id,job_key,job) values($1,'spoof','{}')",[a]),/row-level security/);
  await db.exec(`set request.jwt.claim.sub='${a}';`);
  await db.query("update public.application_activity set status='submitted' where id=$1",[id]);
  assert.equal((await db.query('select status from public.application_activity')).rows[0].status,'submitted');
  await db.exec('reset role;set role anon;');
  await assert.rejects(db.query('select * from public.application_activity'),/permission denied/);
 }finally{await db.close();}
});
