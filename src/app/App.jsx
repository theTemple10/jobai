import { useEffect, useRef, useState } from 'react';
import InfoPage from '../features/marketing/InfoPage.jsx';
import LandingPage from '../features/marketing/LandingPage.jsx';
import ResumeBuilder from '../features/resume/ResumeBuilder.jsx';
import AccountPanel from '../features/account/AccountPanel.jsx';
import JobSearch from '../features/jobs/JobSearch.jsx';
import { emptyResume, normalizeResume, resumeFromProfile, profileFromResume } from '../features/resume/resume.js';
import { supabase } from '../features/account/supabase.js';
import { ROUTES, routeFromLocation, navigateTo } from './navigation.js';
import { initialDraft, hasDraft, readHandoff, clearHandoff, prepareAuthHandoff } from '../features/resume/drafts.js';
import { readStored } from '../shared/lib/storage.js';
import { ProductHeader, ProductFooter } from '../shared/components/PublicLayout.jsx';
import { BRAND } from '../shared/lib/brand.js';
import '../shared/styles/product.css';

export default function ProductApp() {
  const [route, setRoute] = useState(() => readHandoff() ? 'builder' : routeFromLocation());
  const [resume, setResume] = useState(initialDraft);
  const [user, setUser] = useState(null);
  const [cloudId, setCloudId] = useState(() => readHandoff()?.cloudId || null);
  const [dirty, setDirty] = useState(() => Boolean(readHandoff()));
  const [editorVersion,setEditorVersion] = useState(0);
  const [autoSave, setAutoSave] = useState(() => readStored('jobai_autosave', false, value => typeof value === 'boolean'));
  const [savedAt, setSavedAt] = useState('');
  const [importing, setImporting] = useState(false);
  const [theme, setTheme] = useState(() => {try {return JSON.parse(localStorage.getItem('jobai_theme')) || 'system';} catch {return 'system';}});
  const [sessionError, setSessionError] = useState('');
  const accountIdRef = useRef(null);
  const handoffRef = useRef(readHandoff());

  useEffect(() => {
    clearHandoff();
    const changed = () => {
      const next = routeFromLocation();
      if (window.location.hash.startsWith('#/')) window.history.replaceState({}, '', ROUTES[next]);
      setRoute(next); window.scrollTo({top: 0});
    };
    changed();
    window.addEventListener('popstate', changed);
    window.addEventListener('hashchange', changed);
    return () => {window.removeEventListener('popstate', changed); window.removeEventListener('hashchange', changed);};
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = event => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!autoSave || !dirty) return;
    const timer = setTimeout(() => {
      try {localStorage.setItem('jobai_resume_draft', JSON.stringify(resume)); setDirty(false); setSavedAt(new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));}
      catch {setSessionError('Device saving is unavailable. Download your CV to keep a copy.');}
    }, 600);
    return () => clearTimeout(timer);
  }, [autoSave, dirty, resume]);

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
      else {setUser(data.session?.user || null); if (data.session?.user && handoffRef.current) {handoffRef.current = null; navigateTo('builder');}}
    });
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user?.id || null;
      if (accountIdRef.current && nextId !== accountIdRef.current) {setResume(emptyResume()); setCloudId(null);}
      accountIdRef.current = nextId;
      setUser(session?.user || null);
      if (session?.user && handoffRef.current) {handoffRef.current = null; navigateTo('builder');}
    });
    return () => {active = false; data.subscription.unsubscribe();};
  }, []);

  useEffect(() => {
    const main = document.getElementById('main-content');
    main?.setAttribute('tabindex', '-1'); main?.focus({preventScroll: true});
    document.title = `${{home:'CV builder & job search workspace',builder:'CV builder',jobs:'Find jobs',account:'My workspace',privacy:'Your data & privacy',help:'Help & support'}[route]} — ${BRAND.name}`;
    document.querySelector('link[rel=canonical]')?.setAttribute('href', `${BRAND.siteUrl}${ROUTES[route]}`);
    const robots = document.querySelector('meta[name=robots]');
    robots?.setAttribute('content', robots.dataset.siteIndexing === 'disabled' || ['builder','jobs','account'].includes(route) ? 'noindex,follow' : 'index,follow');
  }, [route]);
  function navigate(next) {navigateTo(next);}
  function updateResume(next) {setResume(next); setDirty(true);}
  function savedDevice(deleted = false) {setDirty(false); setSavedAt(deleted ? '' : new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));}
  function changeAutoSave(value) {setAutoSave(value); try {localStorage.setItem('jobai_autosave', JSON.stringify(value));} catch {setSessionError('This browser could not remember the device-saving preference.');} if (value) setDirty(true);}
  function newResume() {if (hasDraft(resume) && !window.confirm('Start a new CV? Save or download this version first if you want to keep it.')) return; setResume(emptyResume()); setCloudId(null); setDirty(true); setEditorVersion(value=>value+1); navigate('builder');}
  function startImport() {setImporting(true); navigate('jobs');}
  function internalLink(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href);
    const destination = Object.keys(ROUTES).find(key => ROUTES[key] === url.pathname);
    if (url.origin === window.location.origin && destination && !url.hash && !url.search) {event.preventDefault(); navigate(destination);}
  }
  function openResume(saved) {if (dirty && hasDraft(resume) && !window.confirm('Open this saved CV and replace your unsaved editing session?')) return; setResume(normalizeResume(saved.document)); setEditorVersion(value=>value+1); setCloudId(saved.id); setDirty(false); navigate('builder');}
  function findJobs(document) {
    const profile = profileFromResume(document);
    try {localStorage.setItem('jobai_profile', JSON.stringify(profile)); localStorage.setItem('jobai_step', '3');} catch {setSessionError('Your browser could not save the profile. Enable device storage to use job matching.'); return;}
    setImporting(false); navigate('jobs');
  }

  return <div className="product-app" onClick={internalLink}>
    <a className="skip-link" href="#main-content" onClick={event => {event.preventDefault(); const main = document.getElementById('main-content'); main?.setAttribute('tabindex', '-1'); main?.focus();}}>Skip to content</a>
    <ProductHeader route={route} user={user} theme={theme} onThemeChange={() => setTheme(t => t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system')} />
    {sessionError && <p role="alert" className="notice error container">{sessionError}</p>}
    {(route === 'privacy' || route === 'help') && <InfoPage page={route} />}
    {route === 'home' && <LandingPage navigate={navigate} onImport={startImport} />}
    {route === 'builder' && <ResumeBuilder key={editorVersion} resume={resume} onChange={updateResume} user={user} cloudId={cloudId} onCloudSaved={setCloudId} onImport={startImport} onNew={newResume} dirty={dirty} autoSave={autoSave} onAutoSave={changeAutoSave} savedAt={savedAt} onDeviceSaved={savedDevice} onFindJobs={findJobs} navigate={navigate} />}
    {route === 'account' && <AccountPanel hasDraft={hasDraft(resume)} onPrepareSignIn={() => prepareAuthHandoff(resume, cloudId)} user={user} onOpenResume={openResume} navigate={navigate} />}
    {route === 'jobs' && <JobSearch key={importing ? 'import' : 'search'} onImport={startImport} onBuildCV={() => navigate('builder')} forceUpload={importing} onProfileParsed={importing ? profile => {updateResume(resumeFromProfile(profile)); setCloudId(null); setImporting(false); navigate('builder');} : undefined} />}
    <ProductFooter />
  </div>;
}
