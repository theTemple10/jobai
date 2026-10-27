import test from 'node:test';
import assert from 'node:assert/strict';
import handler, {publicJob} from '../api/public-jobs.js';
import {filterPublicJobs} from '../src/features/jobs/publicSearch.js';

const item = {id:1,title:'Frontend Developer',company_name:'Example',url:'https://remotive.com/remote-jobs/software-dev/example-1',description:'<p>Build JavaScript tools</p>',candidate_required_location:'Worldwide',publication_date:'2026-10-20T10:00:00Z'};

test('public feed preserves attribution and eligibility without trusting links or HTML',()=>{
  const row=publicJob(item);
  assert.equal(row.job_publisher,'Remotive');assert.equal(row.job_country,'Worldwide');
  assert.equal(row.job_apply_link,item.url);assert.equal(row.job_description.includes('<p>'),false);
  assert.equal(publicJob({...item,url:'javascript:alert(1)'}),null);
  assert.equal(publicJob({...item,url:'https://remotive.com.evil.test/job'}),null);
  assert.equal(filterPublicJobs([row],'frontend developer','Nigeria').length,1);
  assert.equal(filterPublicJobs([{...row,job_country:'United States'}],'developer','Nigeria').length,0);
  assert.equal(filterPublicJobs([row],'accountant','All locations').length,0);
});

test('guest searches share a cacheable feed and never call paid services or auth',async()=>{
  const previous=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async url=>{
    calls++;assert.equal(url,'https://remotive.com/api/remote-jobs');
    return {ok:true,json:async()=>({jobs:[item]})};
  };
  const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  try {
    const a=response(),b=response();
    await Promise.all([handler({method:'GET'},a),handler({method:'GET'},b)]);
    assert.equal(a.code,200);assert.equal(a.body.data[0].job_title,item.title);
    assert.match(a.headers['Cache-Control'],/s-maxage=21600/);assert.equal(calls,1);
    await handler({method:'GET'},response());assert.equal(calls,1);
    const disallowed=response();await handler({method:'POST'},disallowed);assert.equal(disallowed.code,405);
  } finally {globalThis.fetch=previous;}
});
