import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyResume} from '../src/features/resume/resume.js';
import {emptyIntake} from '../src/features/resume/intake.js';
import {hasDraft, prepareAuthHandoff, readHandoff} from '../src/features/resume/drafts.js';

test('recovery protects facts even when their CV section is excluded', () => {
  const hidden = {...emptyResume(), sections: [], skills: 'Python', projects: [{name: 'Community directory', bullets: 'Built accessible search'}]};
  assert.equal(hasDraft(hidden), true);
  assert.equal(hasDraft({...emptyResume(), sections: [], projects: [{name: ' ', bullets: '\n'}]}), false);
});

test('unfinished guided answers count as work before they become CV sections', () => {
  const draft = {...emptyResume(), intake: {...emptyIntake(), notes: {projects: 'Built a directory for local volunteers.'}}};
  assert.equal(hasDraft(draft), true);
});

test('consented auth recovery retains hidden facts and rejects invalid or expired copies', () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  try {
    const document = {...emptyResume(), sections: [], skills: 'Python'};
    prepareAuthHandoff(document, 'saved-cv');
    assert.equal(readHandoff()?.document.skills, 'Python');
    assert.equal(readHandoff()?.cloudId, 'saved-cv');
    for (const copy of [
      {document, at: Date.now() - 31 * 60 * 1000},
      {document, at: Date.now() + 60 * 1000},
      {document: [], at: Date.now()},
      {document: 'invalid', at: Date.now()},
    ]) {
      values.set('jobai_auth_handoff', JSON.stringify(copy));
      assert.equal(readHandoff(), null);
    }
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
