import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest } from '../api/groq.js';
import { buildSearch } from '../api/jobs.js';
import { authorize, rateLimit } from '../server/protection.js';

test('AI operations bound tokens and model selection on the server', () => {
  const result=buildRequest({operation:'rewrite',text:'I build accessible interfaces.',model:'arbitrary',max_tokens:999999});
  assert.equal(result.max_tokens,700);assert.notEqual(result.model,'arbitrary');assert.equal(result.messages.length,2);
  assert.throws(()=>buildRequest({operation:'parse',useVision:true,messages:[{role:'user',content:[null]}]}),{status:400});
  assert.throws(()=>buildRequest({operation:'parse',useVision:'true',messages:[{role:'user',content:'text'}]}),{status:400});
  assert.throws(()=>buildRequest({operation:'toString',text:'x'}));
  assert.throws(()=>buildRequest({operation:'rewrite',text:'x'.repeat(12001)}));
});
test('search forwards only allowed parameters and limits pagination', () => {
  const result=buildSearch({query:'Developer in Nigeria',num_pages:'999',country:'unexpected',remote_jobs_only:'true'});
  assert.equal(result.get('num_pages'),'1');assert.equal(result.get('country'),null);assert.equal(result.get('remote_jobs_only'),'true');
  assert.throws(()=>buildSearch({query:['bad']}));
});
test('production provider endpoints fail closed without account/quota configuration', async () => {
  const keys=['NODE_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try {
    process.env.NODE_ENV='production';for(const key of keys.slice(1)) delete process.env[key];
    await assert.rejects(authorize({headers:{}}),{status:503});
    await assert.rejects(rateLimit('test','ai',30),{status:503});
  } finally {for(const key of keys) if(previous[key]===undefined) delete process.env[key]; else process.env[key]=previous[key];}
});

test('authenticated parsing and job search pass identity and atomic quota gates before providers', async()=>{
  const {default:parse}=await import('../api/groq.js');
  const {default:jobs}=await import('../api/jobs.js');
  const keys=['NODE_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','GROQ_API_KEY','JSEARCH_KEY'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const previousFetch=globalThis.fetch;
  const calls=[];
  const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  try {
    Object.assign(process.env,{NODE_ENV:'production',SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public',GROQ_API_KEY:'test-groq',JSEARCH_KEY:'test-jobs'});
    globalThis.fetch=async(url,options)=>{
      calls.push(url);
      if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:'test-user'})};
      if(url.includes('/rpc/')){assert.equal(options.headers.Authorization,'Bearer test');return {ok:true,json:async()=>true};}
      if(url.includes('groq.com'))return {ok:true,json:async()=>({choices:[{message:{content:'{"title":"Developer","skills":["JavaScript"]}'}}]})};
      if(url.includes('jsearch.'))return {ok:true,json:async()=>({data:[{job_id:'real-provider-shape',job_title:'Developer'}]})};
      throw new Error('Unexpected URL');
    };
    const unsigned=response();await parse({method:'POST',headers:{},body:{operation:'parse',messages:[{role:'user',content:'Candidate CV facts.'}]}},unsigned);
    assert.equal(unsigned.code,401);assert.equal(calls.length,0);
    const cv=response();await parse({method:'POST',headers:{authorization:'Bearer test'},body:{operation:'parse',messages:[{role:'user',content:'Candidate CV facts.'}]}},cv);
    assert.equal(cv.code,200);assert.equal(calls.length,3);assert.match(calls[1],/consume_service_quota/);assert.match(calls[2],/groq/);
    const search=response();await jobs({method:'GET',headers:{authorization:'Bearer test'},query:{query:'Developer in Nigeria'}},search);
    assert.equal(search.code,200);assert.match(calls[4],/consume_service_quota/);assert.match(calls[5],/jsearch/);
    globalThis.fetch=async url=>({ok:true,json:async()=>url.endsWith('/auth/v1/user')?{id:'test-user'}:false});
    const limited=response();await jobs({method:'GET',headers:{authorization:'Bearer test'},query:{query:'Developer'}},limited);
    assert.equal(limited.code,429);
  } finally {globalThis.fetch=previousFetch;for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});
