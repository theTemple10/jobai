import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest } from '../api/groq.js';
import { buildSearch } from '../api/jobs.js';
import { authorize, rateLimit } from '../server/protection.js';

test('AI operations bound tokens and model selection on the server', () => {
  const result=buildRequest({operation:'rewrite',text:'I build accessible interfaces.',model:'arbitrary',max_tokens:999999});
  assert.equal(result.max_tokens,700);assert.notEqual(result.model,'arbitrary');assert.equal(result.messages.length,2);
  assert.throws(()=>buildRequest({operation:'toString',text:'x'}));
  assert.throws(()=>buildRequest({operation:'rewrite',text:'x'.repeat(12001)}));
});
test('search forwards only allowed parameters and limits pagination', () => {
  const result=buildSearch({query:'Developer in Nigeria',num_pages:'999',country:'unexpected',remote_jobs_only:'true'});
  assert.equal(result.get('num_pages'),'1');assert.equal(result.get('country'),null);assert.equal(result.get('remote_jobs_only'),'true');
  assert.throws(()=>buildSearch({query:['bad']}));
});
test('production provider endpoints fail closed without account/quota configuration', async () => {
  const keys=['NODE_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    process.env.NODE_ENV='production';for(const key of keys.slice(1)) delete process.env[key];
    await assert.rejects(authorize({headers:{}}),{status:503});
    await assert.rejects(rateLimit('test','ai',30),{status:503});
  } finally {for(const key of keys) if(previous[key]===undefined) delete process.env[key]; else process.env[key]=previous[key];}
});
