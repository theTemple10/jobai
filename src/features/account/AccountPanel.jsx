import { useEffect, useState } from 'react';
import SignInForm from './SignInForm.jsx';
import { supabase, listCloudResumes } from './supabase.js';

export default function AccountPanel({ user, onOpenResume, navigate, hasDraft, onPrepareSignIn }) {
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [resumes, setResumes] = useState([]);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(Boolean(user));
  const [deleting, setDeleting] = useState(null);
  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    const timer = setTimeout(() => setLoading(true), 0);
    listCloudResumes(user.id).then(rows => {if (active) setResumes(rows);}).catch(err => {if (active) setError(err.message);}).finally(() => {clearTimeout(timer); if (active) setLoading(false);});
    return () => {active = false; clearTimeout(timer);};
  }, [user, reload]);

  async function signOut() {
    setError('');
    const {error} = await supabase.auth.signOut();
    if (error) setError(error.message);
    else {setResumes([]); setMessage('You have signed out.');}
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
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {!supabase ? <div className="account-card"><h2>Account saving is being connected.</h2><p>You can build and download a CV now. Until cloud storage is connected, a draft can be saved on this device from the CV builder.</p><button className="button primary" onClick={() => navigate('builder')}>Continue to the builder →</button></div> : user ? <>
      <div className="account-toolbar"><p>Signed in as <strong>{user.email}</strong></p><button className="button secondary" onClick={signOut}>Sign out</button></div>
      <div className="saved-resumes">{loading ? <p role="status">Opening your saved CVs…</p> : resumes.length ? resumes.map(resume => <article className="account-card" key={resume.id}><span className="eyebrow">SAVED CV</span><h2>{resume.title}</h2><p>Updated {new Date(resume.updated_at).toLocaleDateString()}</p><div className="button-row"><button className="button primary" onClick={() => onOpenResume(resume)}>Open CV →</button><button className="button secondary" disabled={deleting === resume.id} onClick={() => remove(resume.id)}>{deleting === resume.id ? 'Deleting…' : 'Delete'}</button></div></article>) : <div className="account-card"><h2>Your next draft starts here.</h2><p>Build a CV, then choose “Save to my account” to keep it in this workspace.</p><button className="button primary" onClick={() => navigate('builder')}>Build a CV →</button></div>}</div>
    </> : <SignInForm hasDraft={hasDraft} onPrepareSignIn={onPrepareSignIn} navigate={navigate}/>}

  </main>;
}
