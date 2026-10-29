import {useEffect,useState} from 'react';
import SignInForm from './SignInForm.jsx';
import {supabase,listCloudResumes,listApplications,updateApplication,deleteApplication} from './supabase.js';
const statuses={saved:'Saved listing',opened:'Opened listing',submitted:'Submitted',interview:'Interview',offer:'Offer',rejected:'Rejected',withdrawn:'Withdrawn'};
export default function AccountPanel({user,onOpenResume,navigate}){
  const [resumes,setResumes]=useState([]),[applications,setApplications]=useState([]);
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(Boolean(user)),[reload,setReload]=useState(0);
  useEffect(()=>{
    if(!user || !supabase)return;let active=true;
    const timer=setTimeout(()=>setLoading(true),0);
    Promise.allSettled([listCloudResumes(user.id),listApplications(user.id)]).then(results=>{
      if(!active)return;
      if(results[0].status==='fulfilled')setResumes(results[0].value);
      if(results[1].status==='fulfilled')setApplications(results[1].value);
      const errors=results.filter(row=>row.status==='rejected').map(row=>row.reason.message);
      setError(errors.join(' '));
    }).finally(()=>{clearTimeout(timer);if(active)setLoading(false);});
    return()=>{active=false;clearTimeout(timer);};
  },[user,reload]);
  async function action(work){setBusy(true);setError('');setMessage('');try{await work();setReload(n=>n+1);}catch(err){setError(err.message || 'We could not save that change. Please try again.');}finally{setBusy(false);}}
  async function removeCV(row){if(!window.confirm('Delete this saved CV version? Download it first if you want to keep a copy.'))return;await action(async()=>{const {error}=await supabase.from('resumes').delete().eq('id',row.id).eq('user_id',user.id);if(error)throw error;});}
  function downloadLetter(row){const url=URL.createObjectURL(new Blob([row.cover_letter],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='cover-letter.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <main id="main-content" className="container account-page"><span className="eyebrow">YOUR CVS AND APPLICATION HISTORY</span><h1>Your workspace</h1>
    {!user?<><p className="page-intro">Sign in to track your progress and view your saved CVs and applications. You can search and prepare cover letters as a guest.</p><SignInForm navigate={navigate}/></>:<>
      <div className="account-toolbar"><p>Signed in as <strong>{user.email}</strong></p><button className="button secondary" disabled={busy} onClick={()=>action(async()=>{const {error}=await supabase.auth.signOut();if(error)throw error;setResumes([]);setApplications([]);})}>Sign out</button></div>
      <p className="page-intro">Keep your CV versions, saved matches, letters and application updates together.</p>
      {error && <div className="notice error" role="alert"><p>{error}</p><button className="text-link" onClick={()=>setReload(n=>n+1)}>Retry workspace</button></div>}{message && <p className="notice" role="status">{message}</p>}
      <div className="workspace-stats"><p><strong>{resumes.length}</strong> saved CV versions</p><p><strong>{applications.filter(row=>row.status==='submitted').length}</strong> submitted by you</p><p><strong>{applications.filter(row=>row.status==='interview').length}</strong> interviews reported</p></div>
      {loading?<p role="status">Opening your workspace…</p>:<>
        <section aria-label="Saved CV versions"><h2>Your CVs</h2><div className="saved-resumes">{resumes.length?resumes.map((row,index)=><article className="account-card" key={row.id}><span className="eyebrow">{index===0?'MOST RECENTLY UPDATED':'SAVED VERSION'}</span><h3>{row.title}</h3><p>Updated {new Date(row.updated_at).toLocaleDateString()}</p><div className="button-row"><button className="button primary" onClick={()=>onOpenResume(row)}>Open CV →</button><button className="button secondary" disabled={busy} onClick={()=>removeCV(row)}>Delete CV</button></div></article>):<p>No saved CVs yet. Create or import a CV, then save it to your account.</p>}</div><button className="text-link" onClick={()=>navigate('builder')}>Create or optimise a CV →</button></section>
        <section className="workspace-applications" aria-label="Application history"><h2>Your applications</h2>{applications.length?applications.map(row=><article className="account-card" key={row.id}><h3>{row.job.title} at {row.job.company}</h3><p>{row.job.location} · Last updated {new Date(row.updated_at).toLocaleDateString()}</p><p>CV profile: {row.profile.title || 'Not recorded'} · Text evidence match: {row.job.evidence?.score===null || row.job.evidence?.score===undefined?'Not available':`${row.job.evidence.score}%`}</p><label className="field">Status reported by you<select value={row.status} disabled={busy} onChange={event=>action(()=>updateApplication(user.id,row.id,{status:event.target.value}))}>{Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          {row.cover_letter && <details><summary>Saved cover letter</summary><p className="workspace-letter">{row.cover_letter}</p><button className="text-link" onClick={async()=>{try{await navigator.clipboard.writeText(row.cover_letter);setMessage('Letter copied.');}catch{setError('Clipboard access failed. Select the letter text or download it.');}}}>Copy letter</button><button className="text-link" onClick={()=>downloadLetter(row)}>Download letter</button></details>}
          {/^https?:\/\//.test(row.job.applyUrl || '') && <a className="text-link" href={row.job.applyUrl} target="_blank" rel="noopener noreferrer">Open original listing ↗</a>}<button className="text-link" disabled={busy} onClick={()=>{if(window.confirm('Delete this application record?'))action(()=>deleteApplication(user.id,row.id));}}>Delete application</button></article>):<p>No tracked applications yet. Choose to track a listing from job search; opening an employer page alone does not mean you submitted an application.</p>}<button className="text-link" onClick={()=>navigate('jobs')}>Find jobs →</button></section>
      </>}
    </>}
  </main>;
}
