import {useEffect,useRef,useState} from 'react';
import {supabase,googleSignInAvailable} from './supabase.js';

export default function SignInForm({navigate,inline=false,recovery=false,onRecovered=()=>{}}) {
  const [mode,setMode]=useState('signin');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [canResend,setCanResend]=useState(false);
  const [google,setGoogle]=useState(false);
  const feedback=useRef(null);
  const activeMode=recovery?'recover':mode;
  useEffect(()=>{let active=true;googleSignInAvailable().then(value=>{if(active)setGoogle(value);});return()=>{active=false;};},[]);
  useEffect(()=>{if(error || message){feedback.current?.focus();feedback.current?.scrollIntoView({block:'nearest'});}},[error,message]);
  function choose(next){setMode(next);setError('');setMessage('');setCanResend(false);setPassword('');setConfirmation('');}
  async function submit(event){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    try{
      if(['signup','recover'].includes(activeMode) && password!==confirmation)throw new Error('The passwords do not match.');
      let result;
      if(activeMode==='signin')result=await supabase.auth.signInWithPassword({email:email.trim(),password});
      else if(activeMode==='signup'){
        result=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:`${window.location.origin}/account`}});
        if(!result.error && !result.data.session){setCanResend(true);setMessage('Check your email to confirm your account. Then sign in here with your email and password, on any device.');setMode('signin');}
      }else if(activeMode==='forgot'){
        result=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/account`});
        if(!result.error)setMessage('If an account exists for that address, a password reset email has been requested. Open it to choose a new password.');
      }else{
        result=await supabase.auth.updateUser({password});
        if(!result.error){onRecovered();setMode('signin');setMessage('Your password has been updated.');}
      }
      if(result.error)throw result.error;
      setPassword('');setConfirmation('');
    }catch(err){setError(err.message || 'Account access could not be completed. Please try again.');if(err.code==='email_not_confirmed')setCanResend(true);}
    finally{setBusy(false);}
  }
  async function resend(){setBusy(true);setError('');try{const {error}=await supabase.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:`${window.location.origin}/account`}});if(error)throw error;setMessage('A fresh confirmation email was requested. Confirm it, then sign in with your password.');setCanResend(false);}catch(err){setError(err.message);}finally{setBusy(false);}}
  async function signInGoogle(){
    setBusy(true);setError('');
    try{
      const target=['/builder','/jobs','/account'].includes(window.location.pathname)?window.location.pathname:'/account';
      try{sessionStorage.setItem('roleaide_auth_return',target);}catch{ /* Account sign-in remains available without return-route storage. */ }
      const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/account`}});
      if(error)throw error;
    }catch(err){setError(err.message || 'Google sign-in could not be started.');setBusy(false);}
  }
  if(!supabase)return <section className="account-card"><h2>Account access is unavailable</h2><p>Please try again later. You can still use the guest job-search and cover-letter tools.</p></section>;
  const title={signin:'Sign in',signup:'Create your account',forgot:'Reset your password',recover:'Choose a new password'}[activeMode];
  return <section className="account-card" aria-label="Account access"><h2>{title}</h2><p>Use an account for the CV builder and to keep your application history. Job search and cover letters work without signing in.</p>
    {!recovery && <div className="button-row"><button className="button secondary" disabled={busy} aria-pressed={mode==='signin'} onClick={()=>choose('signin')}>Sign in</button><button className="button secondary" disabled={busy} aria-pressed={mode==='signup'} onClick={()=>choose('signup')}>Sign up</button></div>}
    <div ref={feedback} tabIndex={-1}>{error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}</div>
    <form onSubmit={submit} aria-busy={busy}>
      {activeMode!=='recover' && <label className="field">Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>}
      {activeMode!=='forgot' && <label className="field">Password<input aria-label="Password" type="password" autoComplete={activeMode==='signin'?'current-password':'new-password'} required minLength={activeMode==='signin'?1:8} maxLength={256} value={password} onChange={event=>setPassword(event.target.value)}/>{activeMode!=='signin' && <span className="form-help">Use at least 8 characters. A longer unique password is better.</span>}</label>}
      {['signup','recover'].includes(activeMode) && <label className="field">Confirm password<input type="password" autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>}
      <button className="button primary" disabled={busy}>{busy?'Please wait…':{signin:'Sign in and continue →',signup:'Create account →',forgot:'Send password reset email',recover:'Save new password'}[activeMode]}</button>
    </form>
    {canResend && <button className="text-link" disabled={busy} onClick={resend}>Resend confirmation email</button>}
    {activeMode==='signin' && <button className="text-link" disabled={busy} onClick={()=>choose('forgot')}>Forgot password?</button>}
    {google && !inline && !recovery && <button className="button secondary" disabled={busy} onClick={signInGoogle}>Continue with Google</button>}
    {!inline && navigate && <p><button className="text-link" onClick={()=>navigate('jobs')}>Continue to guest job search →</button></p>}
  </section>;
}
