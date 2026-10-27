import { useEffect, useRef, useState } from 'react';
import { supabase, listCloudResumes } from './supabase.js';

export default function AccountPanel({ user, onOpenResume, navigate, hasDraft, onPrepareSignIn }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resumes, setResumes] = useState([]);
  const [reload, setReload] = useState(0);
  const [recoveryConsent, setRecoveryConsent] = useState(false);
  const [loading, setLoading] = useState(Boolean(user));
  const [deleting, setDeleting] = useState(null);
  const [sentTo, setSentTo] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const feedbackRef = useRef(null);
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  useEffect(() => {
    if (!message && !error) return;
    feedbackRef.current?.focus();
    feedbackRef.current?.scrollIntoView({block:'nearest'});
  }, [message,error]);
  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    const timer = setTimeout(() => setLoading(true), 0);
    listCloudResumes(user.id).then(rows => {if (active) setResumes(rows);}).catch(err => {if (active) setError(err.message);}).finally(() => {clearTimeout(timer); if (active) setLoading(false);});
    return () => {active = false; clearTimeout(timer);};
  }, [user, reload]);

  async function signIn(event) {
    event.preventDefault();
    if (busy || retrySeconds) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (hasDraft && !recoveryConsent) throw new Error('Please allow a recovery copy before leaving this CV to sign in. You can also download it and return later.');
      if (hasDraft) onPrepareSignIn();
      const address = email.trim();
      const {error} = await supabase.auth.signInWithOtp({email: address, options: {emailRedirectTo: `${window.location.origin}/account`}});
      if (error) throw error;
      setSentTo(address);
      setNow(Date.now());setRetryAt(Date.now()+60000);
      setMessage('Check your inbox');
    } catch (err) { setError(err.message); } finally {setBusy(false);}
  }

  async function signOut() {
    setError('');
    const {error} = await supabase.auth.signOut();
    if (error) setError(error.message);
    else {setResumes([]); setSentTo(''); setMessage('You have signed out.');}
  }

  async function remove(id) {
    if (!window.confirm('Delete this saved CV? Download a copy first if you want to keep it.')) return;
    setError(''); setDeleting(id);
    const {error} = await supabase.from('resumes').delete().eq('id', id).eq('user_id', user.id);
    setDeleting(null); if (error) setError(error.message); else setReload(n => n + 1);
  }

  return <main id="main-content" className="container account-page">
    <span className="eyebrow">A PLACE TO PICK UP WHERE YOU LEFT OFF</span><h1>Your workspace</h1>
    <p className="page-intro">Keep versions of your CV together, and come back when you’re ready for the next step.</p>
    <div ref={feedbackRef} tabIndex={-1}>
      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <div className="notice" role="status" aria-live="polite"><strong>{message}</strong>{sentTo && !user && <><p>A sign-in link was requested for <strong>{sentTo}</strong>. Check your spam folder too. Use the newest link to return to this workspace.</p><p>You can keep building your CV while you wait.</p><button className="button secondary" onClick={() => navigate('builder')}>Continue building my CV →</button></>}</div>}
    </div>
    {!supabase ? <div className="account-card"><h2>Account saving is being connected.</h2><p>You can build and download a CV now. Until cloud storage is connected, a draft can be saved on this device from the CV builder.</p><button className="button primary" onClick={() => navigate('builder')}>Continue to the builder →</button></div> : user ? <>
      <div className="account-toolbar"><p>Signed in as <strong>{user.email}</strong></p><button className="button secondary" onClick={signOut}>Sign out</button></div>
      <div className="saved-resumes">{loading ? <p role="status">Opening your saved CVs…</p> : resumes.length ? resumes.map(resume => <article className="account-card" key={resume.id}><span className="eyebrow">SAVED CV</span><h2>{resume.title}</h2><p>Updated {new Date(resume.updated_at).toLocaleDateString()}</p><div className="button-row"><button className="button primary" onClick={() => onOpenResume(resume)}>Open CV →</button><button className="button secondary" disabled={deleting === resume.id} onClick={() => remove(resume.id)}>{deleting === resume.id ? 'Deleting…' : 'Delete'}</button></div></article>) : <div className="account-card"><h2>Your next draft starts here.</h2><p>Build a CV, then choose “Save to my account” to keep it in this workspace.</p><button className="button primary" onClick={() => navigate('builder')}>Build a CV →</button></div>}</div>
    </> : <form className="account-card" onSubmit={signIn} aria-busy={busy}><h2>Come back to your progress.</h2><p>Enter your email and we’ll send a sign-in link. No new password to remember.</p><label className="field">Email address<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>{hasDraft && <label className="consent"><input type="checkbox" checked={recoveryConsent} onChange={event => setRecoveryConsent(event.target.checked)} />Keep a recovery copy of this CV on this device while I sign in. It is removed when the app restores it.</label>}<button className="button primary" disabled={busy || retrySeconds > 0}>{busy ? 'Sending your link…' : retrySeconds ? `Request another link in ${retrySeconds}s` : sentTo ? 'Email me another sign-in link →' : 'Email me a sign-in link →'}</button><p className="form-help">Saving is optional. You can build and export a CV without an account.</p></form>}
  </main>;
}
