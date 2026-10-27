import {useEffect,useRef,useState} from 'react';
import {supabase} from './supabase.js';

export default function SignInForm({hasDraft=false,onPrepareSignIn=()=>{},navigate,inline=false}) {
  const [email,setEmail]=useState('');
  const [sentTo,setSentTo]=useState('');
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [retryAt,setRetryAt]=useState(0);
  const [now,setNow]=useState(Date.now);
  const [recoveryConsent,setRecoveryConsent]=useState(false);
  const feedback=useRef(null);
  const seconds=Math.max(0,Math.ceil((retryAt-now)/1000));
  useEffect(()=>{
    if (!retryAt) return;
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[retryAt]);
  useEffect(()=>{if(error || sentTo){feedback.current?.focus();feedback.current?.scrollIntoView({block:'nearest'});}},[error,sentTo]);

  async function send(event) {
    event.preventDefault();if(busy || seconds) return;
    setBusy('send');setError('');
    try {
      if(hasDraft && recoveryConsent) onPrepareSignIn();
      const address=email.trim();
      const {error}=await supabase.auth.signInWithOtp({email:address,options:{emailRedirectTo:`${window.location.origin}/account`}});
      if(error) throw error;
      setSentTo(address);setCode('');setNow(Date.now());setRetryAt(Date.now()+60000);
    } catch(err){setError(err.message || 'We could not send your email. Please try again.');}
    finally{setBusy('');}
  }
  async function verify(event) {
    event.preventDefault();if(busy) return;
    setBusy('verify');setError('');
    try {
      const {data,error}=await supabase.auth.verifyOtp({email:sentTo,token:code.trim(),type:'email'});
      if(error) throw error;
      if(!data.session) throw new Error('Sign-in did not finish. Request a new email and try again.');
    } catch(err){setError(err.message || 'This code could not be verified. Use the newest email or request another.');}
    finally{setBusy('');}
  }
  if(!supabase) return <section className="account-card"><h2>Sign-in is unavailable</h2><p>Account access has not been configured for this version. Your selected CV stays in this tab; close this message and try again after setup.</p></section>;
  return <section className="account-card" aria-label="Email sign-in">
    <h2>{inline?'Sign in to analyse your CV':'Sign in to your workspace'}</h2>
    <p>{inline?'Your selected CV stays in this tab. Sign in here, then we’ll continue with it.':'Use your email to create an account or return to your workspace. No password needed.'}</p>
    <div ref={feedback} tabIndex={-1}>
      {error && <p className="notice error" role="alert">{error}</p>}
      {sentTo && <div className="notice" role="status"><strong>Check your inbox</strong><p>A sign-in email was requested for <strong>{sentTo}</strong>. Check spam too. Enter the code from the newest email to continue here, or use its sign-in link.</p><p>Keep this tab open so your selected CV and edits stay available.</p>{!inline && <button className="button secondary" onClick={()=>navigate('builder')}>Continue building my CV →</button>}</div>}
    </div>
    {sentTo && <form onSubmit={verify} aria-busy={busy==='verify'}>
      <label className="field">Email sign-in code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,''))}/></label>
      <button className="button primary" disabled={Boolean(busy) || code.length<6}>{busy==='verify'?'Checking your code…':'Verify code and continue →'}</button>
    </form>}
    <form onSubmit={send} aria-busy={busy==='send'}>
      <label className="field">Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/></label>
      {hasDraft && <label className="consent"><input type="checkbox" checked={recoveryConsent} onChange={event=>setRecoveryConsent(event.target.checked)}/>Keep a recovery copy of this CV on this device while I sign in. It is removed when the app restores it.</label>}
      <button className="button primary" disabled={Boolean(busy) || seconds>0}>{busy==='send'?'Sending your email…':seconds?`Request another link in ${seconds}s`:sentTo?'Email me another sign-in link →':'Email me a sign-in link →'}</button>
    </form>
    <p className="form-help">Public remote listings and CV downloads work without an account. Analysis and extended job search use your account’s service allowance.</p>
  </section>;
}
