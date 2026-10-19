import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeJob } from './jobs.js';
import { authHeaders } from '../../shared/lib/ai.js';
import Icon from '../../shared/components/Icon.jsx';

const locations = ['All locations', 'Nigeria', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Netherlands', 'UAE', 'South Africa', 'Remote'];

export default function JobExplorer({ profile, applications, onApply, onImport, onEditProfile, DetailComponent }) {
  const Detail = DetailComponent;
  const [query, setQuery] = useState(profile.title || '');
  const [location, setLocation] = useState('All locations');
  const [jobs, setJobs] = useState([]);
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [board, setBoard] = useState('all');
  const [remote, setRemote] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const controllerRef = useRef();
  const headingRef = useRef();
  const applied = Object.fromEntries(applications.map(app => [app.id, app.status]));

  const search = useCallback(async (title, place) => {
    const term = title.trim();
    if (!term) {setError('Enter a role, skill, or company to start your search.'); return;}
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState('loading'); setError(''); setSelected(null);
    try {
      const params = new URLSearchParams({query: term + (place !== 'All locations' && place !== 'Remote' ? ` in ${place}` : '')});
      if (place === 'Remote') params.set('remote_jobs_only', 'true');
      const headers = await authHeaders();
      const response = await fetch(`/api/jobs?${params}`, {headers, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)])});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'We couldn’t load jobs just now. Please try again.');
      if (!Array.isArray(data.data)) throw new Error('The job service returned an unexpected result. Please try again.');
      if (controller.signal.aborted) return;
      const seen = new Set();
      const results = data.data.filter(item => {
        if (!item || typeof item !== 'object') return false;
        const key = item.job_id || `${item.job_title}|${item.employer_name}|${item.job_city}`;
        if (seen.has(key)) return false; seen.add(key); return true;
      }).map((item, index) => normalizeJob(item, index, profile)).sort((a,b) => (b.match ?? -1) - (a.match ?? -1));
      setJobs(results); setLastQuery(term); setBoard('all'); setState('done');
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.name === 'TimeoutError' ? 'The search took longer than expected. Please try again.' : err.message);
      setJobs([]); setState('error');
    }
  }, [profile]);

  useEffect(() => {
    // Run once for each supplied profile; manual searches remain user actions.
    if (profile.title) search(profile.title, 'All locations');
    return () => controllerRef.current?.abort();
  }, [profile.title, search]);
  useEffect(() => { if (selected) {headingRef.current?.focus({preventScroll:true}); window.scrollTo({top:0});} }, [selected]);

  const publishers = [...new Set(jobs.map(job => job.boardLabel || job.board))];
  const filtered = jobs.filter(job => (!remote || job.remote) && (board === 'all' || (job.boardLabel || job.board) === board));

  if (selected) return <section className="job-detail-shell" ref={headingRef} tabIndex={-1} aria-label="Job details"><Detail job={selected} profile={profile} onBack={() => {const id = selected.id; setSelected(null); requestAnimationFrame(() => document.querySelector(`[data-job-id="${CSS.escape(String(id))}"]`)?.focus({preventScroll:true}));}} onApply={method => {onApply(selected, method); setSelected(null);}} applied={applied[selected.id]} /></section>;

  return <div className="job-explorer">
    <header className="jobs-heading"><div><span className="eyebrow">A LITTLE DIRECTION FOR YOUR NEXT CHAPTER</span><h1>Find your next possibility.</h1><p>A role worth exploring starts with what matters to you.</p></div><span className="jobs-heading-art" aria-hidden="true"><Icon name="briefcase" size={42} /><span>↗</span></span></header>
    <form className="job-search-form" onSubmit={event => {event.preventDefault(); search(query, location);}}>
      <label className="search-field"><span>What would you like to do?</span><span className="search-input"><Icon name="search" /><input aria-label="Job title, skill, or company" value={query} maxLength={150} onChange={event => setQuery(event.target.value)} placeholder="Role, skill, or company" autoComplete="off" /></span></label>
      <label className="search-field"><span>Where would you like to work?</span><span className="search-input"><Icon name="location" /><select aria-label="Job search location" value={location} onChange={event => setLocation(event.target.value)}>{locations.map(place => <option key={place}>{place}</option>)}</select></span></label>
      <button className="button primary" disabled={state === 'loading'}><Icon name="search" />{state === 'loading' ? 'Searching…' : 'Find jobs'}</button>
    </form>
    <div className="jobs-layout">
      <aside className="job-sidebar">
        <section className="profile-note"><span className="eyebrow">YOUR STARTING POINT</span><div className="sidebar-icon"><Icon name="document" /></div><h2>{profile.name ? `A next step for ${profile.name.split(' ')[0]}.` : 'Bring your experience with you.'}</h2><p>{profile.title ? `Exploring ${profile.title} roles. Your listed skills help put relevant postings first.` : 'Search by role now, or build a CV to bring more context to your search.'}</p>{profile.skills.length > 0 && <div className="skill-chips">{profile.skills.slice(0,5).map(skill => <span key={skill}>{skill}</span>)}{profile.skills.length > 5 && <span>+{profile.skills.length - 5}</span>}</div>}<button className="text-link" onClick={onEditProfile}>{profile.title ? 'Review my profile' : 'Build my CV'} <span>↗</span></button><button className="sidebar-import" onClick={onImport}>Import an existing CV</button></section>
        <section className="search-reassurance"><Icon name="spark" /><h3>Find a direction, not a verdict.</h3><p>Skill coverage means your listed skills appear in a posting. It isn’t a hiring prediction. Check eligibility and details with the employer.</p></section>
      </aside>
      <section className="job-results" aria-label="Job search results" aria-busy={state === 'loading'}>
        <div className="results-heading"><div><span className="eyebrow">OPPORTUNITIES TO EXPLORE</span><h2>{state === 'idle' ? 'A new search starts here.' : state === 'loading' ? 'Looking for possibilities…' : `${filtered.length} ${filtered.length === 1 ? 'role' : 'roles'} to explore`}</h2>{state === 'done' && <p>Results for “{lastQuery}” · Sorted by listed skill coverage</p>}</div></div>
        {(state === 'done' && jobs.length > 0) && <div className="job-filter-bar"><label className="remote-filter"><input type="checkbox" checked={remote} onChange={event => setRemote(event.target.checked)} />Remote in these results</label><label className="board-filter"><span className="sr-only">Job board filter</span><select aria-label="Job board filter" value={board} onChange={event => setBoard(event.target.value)}><option value="all">All sources</option>{publishers.map(publisher => <option key={publisher}>{publisher}</option>)}</select></label>{(remote || board !== 'all') && <button className="text-link" onClick={() => {setRemote(false); setBoard('all');}}>Clear filters</button>}</div>}
        {error && <div className="job-empty job-service-error" role="alert"><Icon name="globe" size={32} /><h3>Let’s get your search connected.</h3><p>{error}</p><div className="button-row"><button className="button secondary" onClick={() => search(query, location)}>Try again</button><a className="text-link" href="/account">Open my workspace →</a></div><p className="form-help">You can keep building and downloading your CV while live search is unavailable.</p></div>}
        {state === 'loading' && <div className="job-loading" role="status"><span className="search-spinner" /><p>Checking the latest postings. You don’t need to start over.</p></div>}
        {state === 'idle' && !error && <div className="job-empty"><div className="empty-journey"><Icon name="search" size={40} /><span>✦</span></div><h3>There’s more than one way forward.</h3><p>Try a job title, a skill you enjoy using, or a company you’d like to work with. You can narrow the location above.</p><div className="suggested-searches">{['Frontend developer','Data analyst','Customer support'].map(term => <button key={term} onClick={() => {setQuery(term); search(term, location);}}>{term}<Icon name="arrow" size={15} /></button>)}</div></div>}
        {state === 'done' && filtered.length === 0 && <div className="job-empty"><Icon name="search" size={34} /><h3>{jobs.length ? 'Let’s give this search more room.' : 'No listings came back this time.'}</h3><p>{jobs.length ? 'Clear a filter to see more of the roles we found.' : 'Try a broader role or another location. Job availability changes, and no results doesn’t mean there’s no path forward.'}</p>{jobs.length > 0 && <button className="button secondary" onClick={() => {setRemote(false); setBoard('all');}}>Clear filters</button>}</div>}
        {state === 'done' && <div className="job-card-list">{filtered.map(job => <button key={job.id} className="job-card" data-job-id={job.id} aria-label={`View ${job.title} at ${job.company}`} onClick={() => setSelected(job)}><span className="company-monogram" aria-hidden="true">{job.company.slice(0,2).toUpperCase()}</span><span className="job-card-main"><span className="job-company">{job.company}<span>{job.postedDays === null ? 'Date not listed' : `${job.postedDays}d ago`}</span></span><span className="job-title">{job.title}</span><span className="job-facts"><span><Icon name="location" size={14} />{job.location}</span><span>{job.type}</span></span><span className="job-tags"><span>{job.boardLabel || job.board}</span>{job.remote && <span className="remote-tag">Remote · check eligibility</span>}{applied[job.id] && <span className="activity-tag">{applied[job.id] === 'submitted' ? '✓ Submitted' : '↗ Opened'}</span>}</span><span className="job-card-bottom"><span>{job.salary}</span><span className="job-coverage">{job.match === null ? 'Add skills for coverage' : `${job.match}% listed skill coverage`}</span></span></span><Icon name="arrow" /></button>)}</div>}
      </section>
    </div>
  </div>;
}
