import { useState } from 'react';
import { SECTIONS, normalizeResume, resumeBlocks, reviewResume } from '../lib/resume.js';
import { exportDocx, exportPdf, exportText } from '../lib/exportResume.js';
import { saveCloudResume, supabase } from '../lib/supabase.js';
import { requestAI } from '../lib/ai.js';

const GROUPS = {
  experience: {name: 'position', fields: [['role', 'Job title'], ['company', 'Company or organisation'], ['dates', 'Dates (e.g. Jan 2024 – Present)'], ['bullets', 'What did you do? One achievement per line.']]},
  education: {name: 'qualification', fields: [['degree', 'Degree or qualification'], ['institution', 'Institution'], ['dates', 'Dates or graduation year']]},
  projects: {name: 'project', fields: [['name', 'Project name'], ['link', 'Project URL (optional)'], ['bullets', 'What did you build or contribute? One point per line.']]},
  volunteering: {name: 'role', fields: [['role', 'Your role'], ['company', 'Organisation'], ['dates', 'Dates'], ['bullets', 'Your contributions. One point per line.']]},
};

function Field({label, value, onChange, multiline, ...props}) {
  return <label className="field">{label}{multiline ? <textarea rows={4} value={value} onChange={e => onChange(e.target.value)} {...props} /> : <input value={value} onChange={e => onChange(e.target.value)} {...props} />}</label>;
}

export default function ResumeBuilder({ resume: initial, onChange, user, cloudId, onCloudSaved, onImport, onFindJobs, navigate }) {
  const r = normalizeResume(initial);
  const [active, setActive] = useState('details');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const checks = reviewResume(r);
  const blocks = resumeBlocks(r);

  const update = (key, value) => {onChange({...r, [key]: value}); setReviewed(false); setSuggestion(null);};
  const updateRow = (id, index, key, value) => update(id, r[id].map((row, i) => i === index ? {...row, [key]: value} : row));

  async function run(action, task) {
    setBusy(action); setError(''); setNotice('');
    try {await task();} catch (err) {setError(err.message || 'Something went wrong. Your draft is still here.');} finally {setBusy('');}
  }

  function saveDevice() {
    run('local', async () => {localStorage.setItem('jobai_resume_draft', JSON.stringify(r)); setNotice('Draft saved on this device. On a shared device, delete it when you finish.');});
  }

  async function saveAccount() {
    if (!user) {navigate('account'); return;}
    await run('cloud', async () => {const saved = await saveCloudResume(user.id, r, cloudId); onCloudSaved(saved.id); setNotice('Your CV is saved to your account.');});
  }

  async function improveSummary() {
    if (!aiConsent) {setError('Please confirm you want to send this summary to the writing service.'); return;}
    await run('writing', async () => {
      const result = await requestAI({operation: 'rewrite', text: r.summary});
      setSuggestion(result.trim());
    });
  }

  function removeDevice() {
    run('delete-local', async () => {localStorage.removeItem('jobai_resume_draft'); setNotice('The saved device draft was deleted. Your current editing session remains open.');});
  }

  return <main id="main-content" className="builder-page container">
    <header className="builder-heading"><div><span className="eyebrow">YOUR EXPERIENCE. A LITTLE MORE STRUCTURE.</span><h1>Let’s tell your story.</h1><p>Start with a few details. Choose what fits, and leave out what doesn’t.</p></div><button className="button secondary" onClick={onImport}>Import an existing CV ↗</button></header>
    <div className="builder-notices" aria-live="polite">{notice && <p className="notice">{notice}</p>}{error && <p className="notice error" role="alert">{error}</p>}</div>
    <div className="builder-layout">
      <aside className="builder-sidebar"><span className="eyebrow">YOUR SECTIONS</span><button className={`section-tab ${active === 'details' ? 'selected' : ''}`} onClick={() => setActive('details')}>Contact & target role <span>→</span></button>
        {SECTIONS.map(section => <div className="section-option" key={section.id}><input id={`include-${section.id}`} type="checkbox" checked={r.sections.includes(section.id)} onChange={e => {update('sections', e.target.checked ? [...r.sections, section.id] : r.sections.filter(id => id !== section.id)); if (!e.target.checked && active === section.id) setActive('details');}} /><label className="sr-only" htmlFor={`include-${section.id}`}>Include {section.label}</label><button className={`section-tab ${active === section.id ? 'selected' : ''}`} disabled={!r.sections.includes(section.id)} onClick={() => setActive(section.id)}>{section.label}</button></div>)}
        <p className="form-help">No work experience yet? Projects, education, and volunteering can be a good starting point.</p>
        <button className={`section-tab ${active === 'review' ? 'selected' : ''}`} onClick={() => setActive('review')}>Review & download <span>↗</span></button>
      </aside>

      <section className="builder-editor" aria-label="CV editor">
        {active === 'details' ? <><span className="eyebrow">LET’S START WITH YOU</span><h2>The essentials</h2><p className="form-help">Use contact details you’re happy to share with an employer. A city and country are enough; you don’t need a full street address.</p><div className="field-grid"><Field label="Full name" value={r.name} onChange={v => update('name', v)} autoComplete="name" /><Field label="Target role" value={r.title} onChange={v => update('title', v)} placeholder="e.g. Junior Frontend Developer" /><Field label="Email" type="email" value={r.email} onChange={v => update('email', v)} autoComplete="email" /><Field label="Phone (optional)" type="tel" value={r.phone} onChange={v => update('phone', v)} autoComplete="tel" /><Field label="City, country (optional)" value={r.location} onChange={v => update('location', v)} /><Field label="Portfolio or LinkedIn URL (optional)" value={r.website} onChange={v => update('website', v)} /></div></> : active === 'review' ? <>
          <span className="eyebrow">A LAST LOOK BEFORE YOU SHARE</span><h2>Clear, truthful, ready for review.</h2><p className="form-help">These are completeness checks, not an ATS score. Your document uses one column, standard headings, and selectable text.</p><ul className="review-checks">{checks.map(check => <li key={check.label} className={check.passed ? 'passed' : ''}><span aria-hidden="true">{check.passed ? '✓' : '○'}</span>{check.label}</li>)}</ul>
          <label className="consent"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I have reviewed this CV and confirm that its facts and achievements are mine.</label>
          <div className="export-actions"><button className="button primary" disabled={!reviewed || Boolean(busy)} onClick={() => run('pdf', () => exportPdf(r))}>{busy === 'pdf' ? 'Preparing…' : 'Download PDF ↓'}</button><button className="button secondary" disabled={!reviewed || Boolean(busy)} onClick={() => run('docx', () => exportDocx(r))}>Download Word ↓</button><button className="text-link" disabled={!reviewed} onClick={() => exportText(r)}>Plain text ↓</button></div>
          <p className="form-help">Use the format requested by the employer. For names or languages outside the PDF font’s character set, use the Word export and check the saved document.</p>
          <button className="button secondary" disabled={!r.title} onClick={() => onFindJobs(r)}>Explore jobs for this profile →</button>
        </> : <>
          <span className="eyebrow">ONE SECTION AT A TIME</span><h2>{SECTIONS.find(s => s.id === active)?.label}</h2><p className="form-help">{SECTIONS.find(s => s.id === active)?.hint}</p>
          {GROUPS[active] ? <>{r[active].map((row, index) => <div className="entry-editor" key={`${active}-${index}`}><div className="entry-heading"><h3>{GROUPS[active].name} {index + 1}</h3><button className="text-link" aria-label={`Remove ${GROUPS[active].name} ${index + 1}`} onClick={() => update(active, r[active].filter((_, i) => i !== index))}>Remove</button></div>{GROUPS[active].fields.map(([key, label]) => <Field key={key} label={label} value={row[key]} multiline={key === 'bullets'} onChange={v => updateRow(active, index, key, v)} placeholder={key === 'bullets' ? 'Describe what you did, how you did it, and the result. Include numbers only if you know they are accurate.' : undefined} />)}</div>)}<button className="button secondary" onClick={() => update(active, [...r[active], Object.fromEntries(GROUPS[active].fields.map(([key]) => [key, '']))])}>+ Add {GROUPS[active].name}</button></> : <>
            <Field label={active === 'skills' ? 'Skills (separate with commas)' : active === 'summary' ? 'A short introduction' : 'One item per line'} value={r[active]} multiline onChange={v => update(active, v)} placeholder={active === 'summary' ? 'What do you work on, what can you demonstrate, and what kind of role are you looking for?' : undefined} />
            {active === 'summary' && <div className="writing-assist"><h3>A second pair of eyes</h3><p className="form-help">Ask AI to suggest clearer wording for the summary you wrote. Only this text is sent to our AI provider. Review the suggestion; it can make mistakes.</p><label className="consent"><input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} />Send my summary for a wording suggestion.</label><button className="button secondary" disabled={Boolean(busy) || !r.summary.trim() || !aiConsent} onClick={improveSummary}>{busy === 'writing' ? 'Thinking about your words…' : 'Suggest clearer wording ✧'}</button>{suggestion && <div className="suggestion"><p>{suggestion}</p><div className="button-row"><button className="button primary" onClick={() => {update('summary', suggestion); setSuggestion(null);}}>Use this wording</button><button className="text-link" onClick={() => setSuggestion(null)}>Keep my original</button></div></div>}</div>}
          </>}
        </>}
        <div className="editor-save"><button className="button secondary" disabled={Boolean(busy)} onClick={saveDevice}>Save on this device</button>{supabase && <button className="button secondary" disabled={Boolean(busy)} onClick={saveAccount}>{busy === 'cloud' ? 'Saving…' : user ? 'Save to my account' : 'Sign in to save'}</button>}<button className="text-link" onClick={removeDevice}>Delete device draft</button><p className="form-help">Drafts stay in this tab until you choose to save. Downloads work without an account.</p></div>
      </section>

      <aside className="preview-panel" aria-label="CV preview"><div className="preview-label"><span className="eyebrow">LIVE PREVIEW</span><span>Single column · A4 exports</span></div><div className="resume-paper">{blocks.length ? blocks.map((block, i) => {
        const Tag = block.type === 'name' ? 'h2' : block.type === 'heading' ? 'h3' : 'p';
        return <Tag className={`resume-${block.type}`} key={i}>{block.type === 'bullet' ? '• ' : ''}{block.text}</Tag>;
      }) : <div className="preview-empty"><span>✧</span><h3>This page is yours.</h3><p>Add your name and a few details to see your story take shape.</p></div>}</div><p className="form-help">The downloaded document has clean formatting. It won’t include the app’s decorations or checklist.</p></aside>
    </div>
  </main>;
}
