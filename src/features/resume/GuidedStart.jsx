import {useEffect,useRef,useState} from 'react';
import {INTAKE_KINDS,ROLE_SUGGESTIONS,emptyIntake,skillSuggestions} from './intake.js';
import {arrangeNotes,draftFromAI,factsFromIntake} from './guidedDraft.js';
import {requestAI} from '../../shared/lib/ai.js';
import CVField from './CVField.jsx';
import ResumePreview from './ResumePreview.jsx';
import Icon from '../../shared/components/Icon.jsx';

export default function GuidedStart({resume,onChange,onAccept,onManual,onImport,onSave,autoSave,onAutoSave,dirty,savedAt}) {
  const intake=resume.intake || emptyIntake();
  const steps=[{id:'role'},{id:'sources'},...intake.selected.map(id=>({id:'note',kind:INTAKE_KINDS.find(kind=>kind.id===id)})),{id:'skills'},{id:'contact'},{id:'draft'}];
  const index=Math.min(intake.stage,steps.length-1);
  const step=steps[index];
  const [customSkill,setCustomSkill]=useState('');
  const [candidate,setCandidate]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [consent,setConsent]=useState(false);
  const [source,setSource]=useState('');
  const [savedMessage,setSavedMessage]=useState('');
  const controllerRef=useRef(null);
  const headingRef=useRef(null);
  const skills=resume.skills.split(',').map(skill=>skill.trim()).filter(Boolean);

  useEffect(()=>()=>controllerRef.current?.abort(),[]);
  useEffect(()=>{
    const heading=headingRef.current;
    heading?.focus({preventScroll:true});
    if (!heading || (!index && !candidate)) return;
    const top=heading.getBoundingClientRect().top;
    const headerBottom=document.querySelector('.product-header')?.getBoundingClientRect().bottom || 0;
    if (top<headerBottom+12 || top>window.innerHeight-100) heading.scrollIntoView({block:'start',behavior:'instant'});
  },[index,candidate]);

  function change(patch,guidePatch={}) {
    controllerRef.current?.abort();setBusy(false);setError('');setCandidate(null);
    onChange({...resume,...patch,intake:{...intake,...guidePatch,completed:false}});
  }
  function move(next) {change({}, {stage:next});}
  function next(event) {
    event.preventDefault();
    if (step.id==='role' && !resume.title.trim()) {setError('Choose a role, or type the kind of work you want to explore.');return;}
    if (step.id==='sources' && !intake.selected.length) {setError('Choose at least one starting point. Projects, learning, and helping people all count.');return;}
    if (step.id==='note' && !intake.notes[step.kind.id].trim()) {setError('A short sentence is enough. Add one fact, or go back and choose another starting point.');return;}
    if (step.id==='contact' && !resume.name.trim()) {setError('Add the name you want on your CV.');return;}
    move(index+1);
  }
  function toggleKind(id) {
    const selected=intake.selected.includes(id)?intake.selected.filter(kind=>kind!==id):INTAKE_KINDS.map(kind=>kind.id).filter(kind=>kind===id || intake.selected.includes(kind));
    change({}, {selected});
  }
  function toggleSkill(skill) {
    const has=skills.some(value=>value.toLowerCase()===skill.toLowerCase());
    const next=has?skills.filter(value=>value.toLowerCase()!==skill.toLowerCase()):[...skills,skill];
    if (next.length>50) {setError('Keep up to 50 skills that you can explain or demonstrate.');return;}
    change({skills:next.join(', ')});
  }
  function addSkill() {
    const value=customSkill.trim();
    if (value && !skills.some(skill=>skill.toLowerCase()===value.toLowerCase())) toggleSkill(value);
    setCustomSkill('');
  }
  function arrange() {
    try {setError('');setCandidate(arrangeNotes(resume));setSource('Your original words, arranged into sections.');}
    catch(err) {setError(err.message);}
  }
  async function draftWithAI() {
    if (!consent) {setError('Please confirm you want to send these notes for a writing suggestion.');return;}
    const controller=new AbortController();controllerRef.current=controller;
    setError('');setBusy(true);
    try {
      const raw=await requestAI({operation:'draft',facts:factsFromIntake(resume)},AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]));
      if (controller.signal.aborted) return;
      setCandidate(draftFromAI(raw,resume));setSource('AI suggested this wording. Check it against the notes you supplied.');
    } catch(err) {if (!controller.signal.aborted) setError(err.message || 'Writing assistance is unavailable. Your original notes are still here.');}
    finally {if (controllerRef.current===controller) setBusy(false);}
  }

  const titles={role:'What kind of work are you aiming for?',sources:'What can we build on?',skills:'Which skills have you actually used?',contact:'Who should this CV introduce?',draft:'You’ve given us a starting point.'};
  return <section className="guided-start" aria-label="Guided CV creation">
    <div className="intake-topline"><span className="eyebrow">A CV FROM A FEW SHORT ANSWERS</span><button className="text-link" onClick={onManual}>Open section editor</button></div>
    <div className="intake-layout">
      <aside className="intake-aside"><div className="intake-symbol"><Icon name="document" size={28}/></div><h1>You don’t need to write a CV from scratch.</h1><p>Tell us a few things you’ve done. We’ll put them into a draft you can check and change.</p><ol><li><span>01</span>Choose a starting point</li><li><span>02</span>Share a few facts</li><li><span>03</span>Review your draft</li></ol><div className="intake-import"><p>Already have a CV?</p><button className="text-link" onClick={onImport}>Import it instead ↗</button></div><p className="intake-note">A course, a personal project, or helping in a family business can be relevant experience.</p></aside>
      <div className="intake-card">
        {!candidate ? <>
          <div className="intake-progress"><span>Step {index+1} of {steps.length}</span><span>{step.id==='draft'?'Ready to arrange':'Short answers are enough'}</span></div>
          <div className="intake-progress-track" aria-hidden="true"><span style={{width:`${100*(index+1)/steps.length}%`}}/></div>
          <h2 ref={headingRef} tabIndex={-1}>{step.id==='note'?step.kind.question:titles[step.id]}</h2>
          {error && <p className="notice error" role="alert">{error}</p>}
          <form onSubmit={next}>
            {step.id==='role' && <><p className="form-help">Pick something close, or enter your own. You can change direction later.</p><CVField label="Target role" value={resume.title} onChange={title=>change({title})} maxLength={150} placeholder="e.g. Junior data analyst" autoComplete="organization-title"/><div className="intake-role-options">{ROLE_SUGGESTIONS.map(role=><button type="button" key={role} aria-pressed={resume.title===role} onClick={()=>change({title:role})}>{role}</button>)}</div></>}
            {step.id==='sources' && <><p className="form-help">Choose what fits. You won’t be asked to fill sections you don’t need.</p><div className="intake-source-options">{INTAKE_KINDS.map(kind=><label key={kind.id} className={intake.selected.includes(kind.id)?'selected':''}><input type="checkbox" checked={intake.selected.includes(kind.id)} onChange={()=>toggleKind(kind.id)}/><span><strong>{kind.label}</strong><small>{kind.hint}</small></span></label>)}</div></>}
            {step.id==='note' && <><p className="form-help">{step.kind.prompt}</p><CVField label="Your short answer" multiline value={intake.notes[step.kind.id]} onChange={note=>change({}, {notes:{...intake.notes,[step.kind.id]:note}})} maxLength={3000} placeholder="Write the facts in your own words. Rough notes are fine."/><p className="intake-note">You can leave out metrics or formal titles you don’t have. We won’t fill them in for you.</p></>}
            {step.id==='skills' && <><p className="form-help">These are suggestions, not claims about you. Select only what you can explain or demonstrate.</p><div className="intake-skill-options">{[...new Set([...skillSuggestions(resume.title),...skills])].map(skill=><button type="button" key={skill} aria-pressed={skills.some(value=>value.toLowerCase()===skill.toLowerCase())} onClick={()=>toggleSkill(skill)}>{skills.some(value=>value.toLowerCase()===skill.toLowerCase())?'✓ ': '+ '}{skill}</button>)}</div><div className="intake-custom-skill"><CVField label="Another skill (optional)" value={customSkill} onChange={setCustomSkill} maxLength={100} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addSkill();}}}/><button type="button" className="button secondary" disabled={!customSkill.trim()} onClick={addSkill}>Add skill</button></div></>}
            {step.id==='contact' && <><p className="form-help">Just the essentials for now. Phone, location, and links can be added later.</p><CVField label="Full name" value={resume.name} onChange={name=>change({name})} autoComplete="name" maxLength={200}/><CVField label="Email (optional for now)" type="email" value={resume.email} onChange={email=>change({email})} autoComplete="email" maxLength={254}/><CVField label="City and country (optional)" options={['Lagos, Nigeria','Abuja, Nigeria','Accra, Ghana','Toronto, Canada','London, United Kingdom']} value={resume.location} onChange={location=>change({location})} maxLength={200}/></>}
            {step.id==='draft' && <><p className="form-help">Your answers will become a starting draft. Nothing is sent to AI unless you choose writing assistance below.</p><div className="intake-answer-review">{intake.selected.map(id=><div key={id}><h3>{INTAKE_KINDS.find(kind=>kind.id===id).label}</h3><p>{intake.notes[id]}</p></div>)}</div><button type="button" className="button primary intake-arrange" onClick={arrange} disabled={busy}>Arrange my notes →</button><p className="intake-note">Works without an account or an AI connection. Your wording stays yours.</p><div className="intake-ai-choice"><h3>Want help with the wording?</h3><p>AI can suggest clearer sentences and structure. It receives your target role, selected skills, and notes. Your contact fields are not included. Review the result before using it.</p><label className="consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>Send these notes for an AI draft.</label><button type="button" className="button secondary" disabled={!consent || busy} onClick={draftWithAI}>{busy?'Working with your notes…':'Suggest an AI draft'}</button><p className="intake-note">If writing assistance is unavailable, arrange your original notes above.</p></div></>}
            <div className="intake-actions">{index>0 && <button type="button" className="text-link" onClick={()=>move(index-1)}>← Back</button>}{step.id!=='draft' && <button className="button primary">Continue →</button>}</div>
          </form>
        </> : <div className="intake-draft-review"><span className="eyebrow">BEFORE IT BECOMES YOUR CV</span><h2 ref={headingRef} tabIndex={-1}>Does this sound like you?</h2><p className="form-help">{source} You can add names, dates, links, or more detail in the editor. Check that every claim is yours.</p><ResumePreview resume={candidate}/><div className="intake-actions"><button className="text-link" onClick={()=>setCandidate(null)}>← Back to my notes</button><button className="button primary" onClick={()=>onAccept(candidate)}>Use this draft →</button></div></div>}
        <div className="intake-save"><label className="consent"><input type="checkbox" checked={autoSave} onChange={event=>onAutoSave(event.target.checked)}/>Keep my answers on this device as I go. Use only on a device you trust.</label><div className="intake-save-row"><button className="text-link" onClick={async()=>{if(await onSave()) setSavedMessage('Your answers were saved on this device.');}}>Save my answers</button><span role="status">{dirty?autoSave?'Saving…':'Not saved on this device':savedAt?'Saved on this device':savedMessage}</span></div></div>
      </div>
    </div>
  </section>;
}
