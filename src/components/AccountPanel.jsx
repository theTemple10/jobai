import { useEffect, useState } from 'react';
import { supabase, listCloudResumes } from '../lib/supabase.js';

export default function AccountPanel({ user, onOpenResume, navigate }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resumes, setResumes] = useState([]);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    listCloudResumes(user.id).then(rows => {if (active) setResumes(rows);}).catch(err => {if (active) setError(err.message);});
    return () => {active = false;};
  }, [user, reload]);

  async function signIn(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const {error} = await supabase.auth.signInWithOtp({email: email.trim(), options: {emailRedirectTo: `${window.location.origin}/`}});
      if (error) throw error;
      setMessage('Check your email for a sign-in link. You can keep working here while you wait.');
    } catch (err) { setError(err.message); } finally {setBusy(false);}
  }

  async function signOut() {
    setError('');
    const {error} = await supabase.auth.signOut();
    if (error) setError(error.message);
    else {setResumes([]); setMessage('You have signed out.');}
  }

  async function remove(id) {
    setError('');
    const {error} = await supabase.from('resumes').delete().eq('id', id).eq('user_id', user.id);
    if (error) setError(error.message); else setReload(n => n + 1);
  }

  return <main id="main-content" className="container account-page">
    <span className="eyebrow">A PLACE TO PICK UP WHERE YOU LEFT OFF</span><h1>Your workspace</h1>
    <p className="page-intro">Keep versions of your CV together, and come back when you’re ready for the next step.</p>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {!supabase ? <div className="account-card"><h2>Account saving is being connected.</h2><p>You can build and download a CV now. Until cloud storage is connected, a draft can be saved on this device from the CV builder.</p><button className="button primary" onClick={() => navigate('builder')}>Continue to the builder →</button></div> : user ? <>
      <div className="account-toolbar"><p>Signed in as <strong>{user.email}</strong></p><button className="button secondary" onClick={signOut}>Sign out</button></div>
      <div className="saved-resumes">{resumes.length ? resumes.map(resume => <article className="account-card" key={resume.id}><span className="eyebrow">SAVED CV</span><h2>{resume.title}</h2><p>Updated {new Date(resume.updated_at).toLocaleDateString()}</p><div className="button-row"><button className="button primary" onClick={() => onOpenResume(resume)}>Open CV →</button><button className="button secondary" onClick={() => remove(resume.id)}>Delete</button></div></article>) : <div className="account-card"><h2>Your next draft starts here.</h2><p>Build a CV, then choose “Save to my account” to keep it in this workspace.</p><button className="button primary" onClick={() => navigate('builder')}>Build a CV →</button></div>}</div>
    </> : <form className="account-card" onSubmit={signIn}><h2>Come back to your progress.</h2><p>Enter your email and we’ll send a sign-in link. No new password to remember.</p><label className="field">Email address<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><button className="button primary" disabled={busy}>{busy ? 'Sending your link…' : 'Email me a sign-in link →'}</button><p className="form-help">Saving is optional. You can build and export a CV without an account.</p></form>}
  </main>;
}
