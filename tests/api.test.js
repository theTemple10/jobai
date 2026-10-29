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

test('guest services enforce shared limits without account gates and reuse cached jobs',async()=>{
  const {default:parse}=await import('../api/groq.js');
  const {default:jobs}=await import('../api/jobs.js');
  const keys=['NODE_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','GROQ_API_KEY','JSEARCH_KEY','SERVICE_ACCESS_SECRET','VERCEL'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]])),previousFetch=globalThis.fetch;
  let cache=null,providerJobs=0,providerAI=0,quotaCalls=0,allow=true;
  const response=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  const guest={headers:{'x-vercel-forwarded-for':'203.0.113.5'}};
  try{
    Object.assign(process.env,{NODE_ENV:'production',VERCEL:'1',SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public',GROQ_API_KEY:'test-groq',JSEARCH_KEY:'test-jobs',SERVICE_ACCESS_SECRET:'s'.repeat(64)});
    globalThis.fetch=async(url,options)=>{
      if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:'test-user'})};
      if(url.includes('/rpc/')){
        const body=JSON.parse(options.body);assert.match(body.proof,/^[a-f0-9]{64}$/);
        if(url.endsWith('consume_public_service_quota')){quotaCalls++;assert.match(body.subject,/^(guest|user):[a-f0-9]{64}$/);return {ok:true,json:async()=>allow};}
        if(url.endsWith('read_job_search_cache'))return {ok:true,json:async()=>cache};
        if(url.endsWith('write_job_search_cache')){cache=body.data;return {ok:true,json:async()=>null};}
      }
      if(url.includes('groq.com')){providerAI++;return {ok:true,json:async()=>({choices:[{message:{content:'{"title":"Developer"}'}}]})};}
      if(url.includes('jsearch.')){providerJobs++;return {ok:true,json:async()=>({data:[{job_id:'fixture',job_title:'Developer'}]})};}
      throw new Error('Unexpected provider call');
    };
    const parsed=response();await parse({...guest,method:'POST',body:{operation:'parse',messages:[{role:'user',content:'Candidate supplied facts'}]}},parsed);
    assert.equal(parsed.code,200);assert.equal(providerAI,1);assert.equal(quotaCalls,1);
    const accountOnly=response();await parse({...guest,method:'POST',body:{operation:'rewrite',text:'Candidate summary'}},accountOnly);assert.equal(accountOnly.code,401);assert.equal(providerAI,1);
    for(let i=0;i<2;i++){const result=response();await jobs({...guest,method:'GET',query:{query:'Developer in Nigeria'}},result);assert.equal(result.code,200);}
    assert.equal(providerJobs,1);assert.equal(quotaCalls,2);
    allow=false;
    const limited=response();await parse({...guest,method:'POST',body:{operation:'coverletter',messages:[{role:'user',content:'Candidate and posting facts'}]}},limited);
    assert.equal(limited.code,429);assert.equal(providerAI,1);
  }finally{globalThis.fetch=previousFetch;for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});
