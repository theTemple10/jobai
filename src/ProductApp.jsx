import { useEffect, useRef, useState } from 'react';
import LandingPage from './components/LandingPage.jsx';
import ResumeBuilder from './components/ResumeBuilder.jsx';
import AccountPanel from './components/AccountPanel.jsx';
import JobSearch from './index.jsx';
import { emptyResume, normalizeResume, resumeFromProfile, profileFromResume } from './lib/resume.js';
import { supabase } from './lib/supabase.js';
import './product.css';

const routeFromHash = () => ['builder', 'jobs', 'account'].find(route => window.location.hash === `#/${route}`) || 'home';
function initialDraft() {
  try {return normalizeResume(JSON.parse(localStorage.getItem('jobai_resume_draft')));} catch {return emptyResume();}
}

export default function ProductApp() {
  const [route, setRoute] = useState(routeFromHash);
  const [resume, setResume] = useState(initialDraft);
  const [user, setUser] = useState(null);
  const [cloudId, setCloudId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [theme, setTheme] = useState(() => {try {return JSON.parse(localStorage.getItem('jobai_theme')) || 'system';} catch {return 'system';}});
  const [sessionError, setSessionError] = useState('');
  const mainRef = useRef();
  const accountIdRef = useRef(null);

  useEffect(() => {
    const changed = () => {setRoute(routeFromHash()); window.scrollTo({top: 0});};
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    apply();
    try {localStorage.setItem('jobai_theme', JSON.stringify(theme));} catch { /* Theme still works without storage. */ }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({data, error}) => {
      if (!active) return;
      if (error) setSessionError(error.message);
      else setUser(data.session?.user || null);
    });
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user?.id || null;
      if (accountIdRef.current && nextId !== accountIdRef.current) {setResume(emptyResume()); setCloudId(null);}
      accountIdRef.current = nextId;
      setUser(session?.user || null);
    });
    return () => {active = false; data.subscription.unsubscribe();};
  }, []);

  useEffect(() => {mainRef.current?.focus();}, [route]);
  function navigate(next) {window.location.hash = next === 'home' ? '/' : `/${next}`; if (route === next) window.scrollTo({top: 0});}
  function openResume(saved) {setResume(normalizeResume(saved.document)); setCloudId(saved.id); navigate('builder');}
  function findJobs(document) {
    const profile = profileFromResume(document);
    try {localStorage.setItem('jobai_profile', JSON.stringify(profile)); localStorage.setItem('jobai_step', '2');} catch {setSessionError('Your browser could not save the profile. Enable device storage to use job matching.'); return;}
    setImporting(false); navigate('jobs');
  }

  return <div className="product-app">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="product-header"><div className="container product-nav"><a className="brand" href="#/" aria-label="JobAI home"><span className="brand-mark">J<span>✦</span></span><span>JobAI<small>by Philos Digital Labs</small></span></a><nav aria-label="Main navigation"><a href="#/builder" aria-current={route === 'builder' ? 'page' : undefined}>CV builder</a><a href="#/jobs" aria-current={route === 'jobs' ? 'page' : undefined}>Find jobs</a><a href="#/account" aria-current={route === 'account' ? 'page' : undefined}>{user ? 'My workspace' : 'Save my progress'}</a></nav><button className="theme-toggle" onClick={() => setTheme(t => t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system')} aria-label={`Theme: ${theme}. Switch theme.`} title={`Theme: ${theme}`}>{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}</button></div></header>
    <div ref={mainRef} tabIndex={-1} className="route-focus" />
    {sessionError && <p role="alert" className="notice error container">{sessionError}</p>}
    {route === 'home' && <LandingPage navigate={navigate} />}
    {route === 'builder' && <ResumeBuilder resume={resume} onChange={setResume} user={user} cloudId={cloudId} onCloudSaved={setCloudId} onImport={() => {setImporting(true); navigate('jobs');}} onFindJobs={findJobs} navigate={navigate} />}
    {route === 'account' && <AccountPanel user={user} onOpenResume={openResume} navigate={navigate} />}
    {route === 'jobs' && <JobSearch embedded forceUpload={importing} onProfileParsed={importing ? profile => {setResume(resumeFromProfile(profile)); setCloudId(null); setImporting(false); navigate('builder');} : undefined} />}
    <footer className="product-footer"><div className="container"><a className="footer-brand" href="#/">JobAI<span> A little structure for your next chapter.</span></a><p>Built by Philos Digital Labs. You review your documents and submit applications yourself.</p><p>CVs are sent to our AI provider when you choose analysis. Account saving is optional.</p></div></footer>
  </div>;
}
