import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyResume,normalizeResume,resumeBlocks} from '../src/features/resume/resume.js';
import {emptyIntake,normalizeIntake,validateDraftFacts} from '../src/features/resume/intake.js';
import {arrangeNotes,draftFromAI,factsFromIntake} from '../src/features/resume/guidedDraft.js';
import {buildRequest} from '../api/groq.js';

const source=()=>({...emptyResume(),name:'Ada Obi',email:'ada@example.com',title:'Frontend developer',skills:'JavaScript, Accessibility',intake:{...emptyIntake(),selected:['projects'],notes:{projects:'Built an accessible community directory with JavaScript for 20 volunteers.'}}});

test('guided notes create a factual downloadable document without an AI provider',()=>{
 const r=arrangeNotes(source()),text=resumeBlocks(r).map(block=>block.text).join('\n');
 assert.match(text,/Ada Obi/);assert.match(text,/20 volunteers/);assert.match(text,/Projects/);assert.equal(r.projects[0].name,'');assert.equal(r.intake.completed,true);
 assert.equal(source().intake.completed,false);
});
test('unfinished intake survives normal document persistence without becoming CV claims',()=>{
 const r=normalizeResume(source());assert.equal(r.intake.notes.projects,source().intake.notes.projects);assert.equal(r.intake.completed,false);
 assert.doesNotMatch(resumeBlocks(r).map(block=>block.text).join('\n'),/20 volunteers/);
 assert.deepEqual(normalizeIntake({version:1,selected:['unknown','projects'],stage:999,notes:{projects:'x'}}).selected,['projects']);
});
test('draft requests omit contact details and bound the operation on the server',()=>{
 const facts=factsFromIntake(source());assert.equal(facts.email,undefined);assert.equal(facts.name,undefined);
 const request=buildRequest({operation:'draft',facts,model:'uncontrolled',max_tokens:99999});
 assert.equal(request.max_tokens,4096);assert.deepEqual(request.response_format,{type:'json_object'});assert.notEqual(request.model,'uncontrolled');assert.doesNotMatch(request.messages[1].content,/ada@example.com|Ada Obi/);
 assert.throws(()=>validateDraftFacts({...facts,notes:{projects:'x'.repeat(3001)}}));
 assert.throws(()=>buildRequest({operation:'draft',facts:{...facts,notes:{}}}),{status:400});
});
test('AI drafting preserves identity and skills and refuses invented metrics',()=>{
 const r=source();
 const result=draftFromAI(JSON.stringify({name:'Invented name',email:'fake@example.com',skills:'Invented skill',summary:'I build accessible community tools.',projects:[{name:'A fabricated title',link:'https://invented.example',bullets:'Built a JavaScript directory for 20 volunteers.'}]}),r);
 assert.equal(result.name,r.name);assert.equal(result.email,r.email);assert.equal(result.skills,r.skills);assert.equal(result.projects[0].name,'');assert.equal(result.projects[0].link,'');
 assert.throws(()=>draftFromAI(JSON.stringify({projects:[{bullets:'Improved engagement by 98%.'}]}),r),/added numbers/);
 assert.throws(()=>draftFromAI('not JSON',r),/unreadable draft/);assert.throws(()=>draftFromAI('{}',r),/empty draft/);
});
test('missing AI sections fall back to the original notes rather than dropping experience',()=>{
 const r={...source(),intake:{...source().intake,selected:['projects','education'],notes:{...source().intake.notes,education:'BSc Computer Science, Example University, 2024.'}}};
 const result=draftFromAI(JSON.stringify({summary:'I build accessible tools.'}),r);
 assert.equal(result.projects[0].bullets,r.intake.notes.projects);assert.equal(result.education[0].degree,r.intake.notes.education);
});
