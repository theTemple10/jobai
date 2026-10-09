import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyResume, normalizeResume, resumeBlocks, profileFromResume, resumeFromProfile, reviewResume } from '../src/lib/resume.js';
import { dailyEncouragement } from '../src/lib/quotes.js';

test('exports include only chosen sections, preserving candidate facts', () => {
  const resume = {...emptyResume(), name: 'Ada Obi', title: 'Developer', skills: 'Python, SQL', sections: ['projects'], experience: [{role: 'Hidden role', company: 'Acme', bullets: 'Hidden achievement'}], projects: [{name: 'Community directory', link: '', bullets: 'Built search for local volunteers\nImproved keyboard navigation'}]};
  const blocks = resumeBlocks(resume);
  const text = blocks.map(b => b.text).join('\n');
  assert.match(text, /Community directory/);
  assert.doesNotMatch(text, /Hidden|Python/);
  assert.equal(blocks.filter(b => b.type === 'bullet').length, 2);
  assert.deepEqual(profileFromResume(resume).skills, []);
});
test('malformed persisted data cannot introduce unsupported sections or rows', () => {
  const resume = normalizeResume({name: 42, sections: ['skills', '__proto__'], experience: [null], skills: 'SQL'});
  assert.equal(resume.name, ''); assert.deepEqual(resume.sections, ['skills']);
  assert.deepEqual(resume.experience[0], {role:'',company:'',dates:'',bullets:''});
});
test('imported profile maps dates and highlights into editable resume fields', () => {
  const resume = resumeFromProfile({name:'Ada',title:'Engineer',skills:['SQL'],experience:[{role:'Intern',company:'Acme',duration:'2024',highlights:['Built a report']}], education:[{degree:'BSc',institution:'University',year:'2023'}]});
  assert.equal(resume.experience[0].dates, '2024'); assert.equal(resume.experience[0].bullets, 'Built a report');
  assert.equal(profileFromResume(resume).experience[0].highlights[0], 'Built a report');
});
test('completeness guidance flags missing facts without inventing a score', () => {
  assert.ok(reviewResume(emptyResume()).every(check => !check.passed));
  assert.equal(reviewResume({...emptyResume(),name:'Ada',email:'invalid'})[1].passed,false);
});
test('daily encouragement is stable throughout a local calendar day', () => {
  assert.equal(dailyEncouragement(new Date(2026,9,9,1)), dailyEncouragement(new Date(2026,9,9,23)));
  assert.notEqual(dailyEncouragement(new Date(2026,9,9)),dailyEncouragement(new Date(2026,9,10)));
});
