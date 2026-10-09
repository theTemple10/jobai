import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeJob, normalizeProfile } from '../src/lib/jobs.js';

test('zero skill overlap gives zero coverage; identical input is deterministic', () => {
  const row = {job_title:'Accountant',job_description:'Bookkeeping',job_min_salary:20,job_max_salary:30,job_salary_period:'HOUR',job_salary_currency:'USD'};
  const first = normalizeJob(row,0,{skills:['Python']},100000);
  assert.deepEqual(first,normalizeJob(row,0,{skills:['Python']},100000));
  assert.equal(first.match,0); assert.equal(first.postedDays,null); assert.equal(first.urgent,false);
  assert.equal(first.salary,'USD 20 – 30 / hour');
});
test('coverage respects word boundaries, unique skills, and missing skill evidence', () => {
  assert.equal(normalizeJob({job_description:'JavaScript'},0,{skills:['Java']}).match,0);
  assert.equal(normalizeJob({job_description:'Python and C++'},0,{skills:['Python','python','C++','SQL']}).match,67);
  assert.equal(normalizeJob({},0,{skills:[]}).match,null);
});
test('full job context is retained, unsafe URLs are rejected, dates are truthful', () => {
  const description='Important requirement. '.repeat(100);
  const row=normalizeJob({job_description:description,job_apply_link:'javascript:alert(1)',job_posted_at_timestamp:1000,job_highlights:{Qualifications:['a','b','c','d']}},0,{skills:[]},1000000);
  assert.equal(row.description,description);assert.equal(row.requirements.length,4);assert.equal(row.applyUrl,'');assert.equal(row.postedDays,0);
});
test('AI profile validation normalizes malformed collections and rejects unusable input', () => {
  assert.throws(()=>normalizeProfile(null));assert.throws(()=>normalizeProfile({skills:{}}));
  const profile=normalizeProfile({title:'Engineer',skills:[42,'SQL'],experience:[null],name:'null'});
  assert.deepEqual(profile.skills,['SQL']);assert.deepEqual(profile.jobTitles,['Engineer']);assert.equal(profile.name,'');
});
