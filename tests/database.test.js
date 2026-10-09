import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL migration isolates CV ownership and applies atomic per-user quotas', async () => {
  const db = new PGlite();
  const ada = '11111111-1111-4111-8111-111111111111';
  const ben = '22222222-2222-4222-8222-222222222222';
  try {
    // Emulate Supabase's auth roles and verified JWT claim for policy testing.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${ada}'),('${ben}');
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202610090001_workspace.sql', import.meta.url), 'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${ada}';`);
    const saved = await db.query("insert into public.resumes (user_id,title,document) values ($1,'Ada CV','{}') returning id",[ada]);
    const id = saved.rows[0].id;
    assert.equal((await db.query('select * from public.resumes')).rows.length,1);
    await db.exec(`set request.jwt.claim.sub = '${ben}';`);
    assert.equal((await db.query('select * from public.resumes')).rows.length,0);
    assert.equal((await db.query("update public.resumes set title='Changed' where id=$1 returning id",[id])).rows.length,0);
    assert.equal((await db.query('delete from public.resumes where id=$1 returning id',[id])).rows.length,0);
    await assert.rejects(db.query("insert into public.resumes (user_id,title,document) values ($1,'Impersonated CV','{}')",[ada]), /row-level security/i);
    const responses = await Promise.all(Array.from({length:31},()=>db.query("select public.consume_service_quota('ai') as allowed")));
    assert.equal(responses.filter(response=>response.rows[0].allowed).length,30);
    await db.exec(`set request.jwt.claim.sub = '${ada}';`);
    assert.equal((await db.query("select public.consume_service_quota('ai') as allowed")).rows[0].allowed,true);
    await db.query("update public.resumes set title='Updated by owner' where id=$1",[id]);
    assert.equal((await db.query('select title from public.resumes where id=$1',[id])).rows[0].title,'Updated by owner');
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.resumes'), /permission denied/i);
    await assert.rejects(db.query("select public.consume_service_quota('ai')"), /permission denied/i);
  } finally {await db.close();}
});
