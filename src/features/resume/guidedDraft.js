import {normalizeResume} from './resume.js';
import {normalizeIntake, validateDraftFacts} from './intake.js';

export function factsFromIntake(document) {
  const r=normalizeResume(document);
  const intake=normalizeIntake(r.intake);
  return validateDraftFacts({role:r.title,skills:r.skills.split(',').map(skill=>skill.trim()).filter(Boolean),notes:Object.fromEntries((intake?.selected || []).map(id=>[id,intake.notes[id]]))});
}

export function arrangeNotes(document) {
  const r=normalizeResume(document);
  const facts=factsFromIntake(r);
  const result={...r,sections:[...new Set([...r.sections,...Object.keys(facts.notes),...(facts.skills.length?['skills']:[])])]};
  for (const [kind,note] of Object.entries(facts.notes)) {
    if (kind === 'summary') result.summary=[r.summary,note].filter(Boolean).join('\n');
    else if (kind === 'education') result.education=[...r.education,{degree:note,institution:'',dates:''}];
    else if (kind === 'projects') result.projects=[...r.projects,{name:'',link:'',bullets:note}];
    else result[kind]=[...r[kind],{role:'',company:'',dates:'',bullets:note}];
  }
  result.intake={...r.intake,completed:true};
  return normalizeResume(result);
}

const numericTokens = text => text.match(/\d+(?:[.,]\d+)*(?:%|\b)/g) || [];
function groundedText(text, source) {
  const allowed=new Set(numericTokens(source));
  if (numericTokens(text).some(number=>!allowed.has(number))) throw new Error('The suggestion added numbers that were not in your notes. Your answers are safe. Try again or arrange your original words.');
  return text;
}
const literal = (value, source) => value && source.toLowerCase().includes(value.trim().toLowerCase()) ? value.trim() : '';

export function draftFromAI(raw, document) {
  let value;
  try {value=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,'').trim());} catch {throw new Error('The writing service returned an unreadable draft. Your notes are still here; you can arrange them without AI.');}
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The writing service returned an invalid draft. Please use your original notes or try again.');
  const r=normalizeResume(document), facts=factsFromIntake(r), proposed=normalizeResume(value);
  if (!proposed.summary.trim() && Object.keys(facts.notes).filter(kind=>kind!=='summary').every(kind=>!proposed[kind].length)) throw new Error('The writing service returned an empty draft. Your notes are still here; arrange them without AI or try again.');
  const result={...r,sections:[...new Set([...r.sections,...Object.keys(facts.notes),...(facts.skills.length?['skills']:[])])]};
  const source=Object.values(facts.notes).join('\n')+'\n'+facts.skills.join(', ');
  if (proposed.summary.trim()) {
    result.summary=groundedText(proposed.summary,source);result.sections=[...new Set([...result.sections,'summary'])];
  }
  for (const [kind,note] of Object.entries(facts.notes)) {
    if (kind === 'summary') {if (!proposed.summary.trim()) result.summary=note;continue;}
    const candidates=proposed[kind].slice(0,10).map(row=>Object.fromEntries(Object.entries(row).map(([key,text])=>[key,key === 'bullets' ? groundedText(text,note) : literal(text,note)]))).filter(row=>Object.values(row).some(Boolean));
    if (kind === 'education' && !candidates.length) candidates.push({degree:note,institution:'',dates:''});
    else if (kind !== 'education' && !candidates.length) candidates.push(kind === 'projects'?{name:'',link:'',bullets:note}:{role:'',company:'',dates:'',bullets:note});
    result[kind]=[...r[kind],...candidates];
  }
  // Identity, contact details, selected skills, and existing unselected sections
  // come from the candidate, never from model-generated data.
  result.intake={...r.intake,completed:true};
  return normalizeResume(result);
}
