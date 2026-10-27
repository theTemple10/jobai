import { useEffect, useState } from 'react';
import { BRAND } from '../../shared/lib/brand.js';
import { dailyEncouragement } from './quotes.js';

function PaperCompanion() {
  return <div className="hero-art" aria-hidden="true">
    <div className="hero-people"><img className="people-working" src="/images/people-at-work.webp" width="720" height="900" alt="" decoding="async"/><img className="people-talking" src="/images/people-in-conversation.webp" width="600" height="800" alt="" decoding="async"/></div>
    <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    <span className="art-spark spark-one">✧</span><span className="art-spark spark-two">✦</span>
    <div className="paper-pal">
      <div className="paper-fold" /><div className="pal-eyes"><i /><i /></div><div className="pal-smile" />
      <div className="pal-lines"><i /><i /><i /></div><div className="pal-seal"><img src="/brand-mark.svg" width="28" height="28" alt="" /></div>
    </div>
    <div className="art-note note-one"><span className="note-dot" /> Your story, clearly told</div>
    <div className="art-note note-two">One step at a time <span>↗</span></div>
    <div className="art-caption">A little structure. A fresh start.</div>
  </div>;
}

export default function LandingPage({ navigate, onImport }) {
  const [quote, setQuote] = useState(() => dailyEncouragement());
  useEffect(() => {
    const timer = setInterval(() => setQuote(dailyEncouragement()), 60000);
    return () => clearInterval(timer);
  }, []);

  return <main id="main-content" className="landing">
    <section className="landing-hero container">
      <div className="hero-copy">
        <h1>You have a story.<br />Let’s help it<br /><em>open doors.</em></h1>
        <p className="hero-intro">Turn your existing CV into a focused job search.</p>
        <p>Upload your CV, review the extracted profile, then discover related jobs ranked by the skills and role information in each posting. {BRAND.name} shows the matching evidence so you can decide what to pursue.</p>
        <div className="hero-actions"><button className="button primary" onClick={onImport}>Upload my CV and find jobs <span>→</span></button><button className="button secondary" onClick={() => navigate('jobs')}>Explore jobs <span>↗</span></button><button className="text-link" onClick={() => navigate('builder')}>Build my CV</button></div>
        <p className="hero-footnote">Browse public remote jobs freely · Sign in for CV analysis and extended search</p>
      </div>
      <PaperCompanion />
    </section>

    <aside className="daily-note container" aria-label="Daily encouragement">
      <span className="daily-icon" aria-hidden="true">☀</span><div><span className="eyebrow">A SMALL REMINDER FOR TODAY</span><blockquote>“{quote}”</blockquote><p>Words from {BRAND.name} · A new reminder each day</p></div>
    </aside>

    <section id="how-it-works" className="landing-section container">
      <div className="section-heading"><span className="eyebrow">FROM A BLANK PAGE TO A NEXT STEP</span><h2>You don’t have to do<br />everything at once.</h2><p>Bring what you have. We’ll help you give it shape, then make the next part of your search a little easier.</p></div>
      <div className="journey-grid">
        {[
          ['01', 'Upload your existing CV', 'Bring a PDF or Word CV, or paste its text. We extract the information for your review. Sign in in the same tab when analysis needs your account.'],
          ['02', 'Review your profile', 'Correct your target role and skills before searching. Your extracted experience gives you a starting point, not a final verdict.'],
          ['03', 'Explore ranked jobs', 'Review matched skills, gaps and title overlap. Check location and eligibility, then open the original listing to apply yourself.'],
        ].map(([number, title, copy]) => <article className="journey-card" key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
      </div>
    </section>

    <section id="your-cv" className="story-section">
      <div className="container story-grid"><div className="mini-document" aria-hidden="true"><div className="mini-document-top"><span /><small>YOUR NAME</small></div><h4>Your next opportunity</h4><div className="mini-heading">EXPERIENCE</div><div className="mini-line wide" /><div className="mini-line" /><div className="mini-line medium" /><div className="mini-heading">PROJECTS & SKILLS</div><div className="mini-line wide" /><div className="mini-line medium" /><div className="mini-document-stamp">Made with your experience.</div></div>
      <div><span className="eyebrow">THERE’S MORE THAN ONE WAY TO HAVE EXPERIENCE</span><h2>Your first CV doesn’t<br />need a first job.</h2><p>A course project. A community you helped. Something you built on a borrowed laptop. Work you did for a family business. These can all help tell a useful story when they’re relevant to the role.</p><p>Choose what belongs on your CV. We’ll give it a clean structure, with familiar headings and readable text. You supply the facts; the document helps them speak clearly.</p><button className="text-link" onClick={() => navigate('builder')}>Let’s find your starting point <span>↗</span></button></div></div>
    </section>

    <section id="our-approach" className="landing-section container promise-grid">
      <div><span className="eyebrow">A LITTLE HELP. YOUR OWN VOICE.</span><h2>Useful support,<br />honest expectations.</h2><p>You deserve to understand what a tool can do before trusting it with your career.</p></div>
      <div className="promise-list"><article><span>✓</span><div><h3>Made for people and readable by software</h3><p>Simple layouts and clear sections help resume parsers. No template can guarantee an interview or work perfectly with every applicant tracking system.</p></div></article><article><span>✓</span><div><h3>Your experience stays yours</h3><p>Review every extracted fact and suggested line. We encourage clear writing, never invented jobs, qualifications, or achievements.</p></div></article><article><span>✓</span><div><h3>You decide what happens next</h3><p>Application assistance prepares your letter and opens a listing. It doesn’t submit on your behalf or promise an outcome.</p></div></article></div>
    </section>

    <section className="closing-note container"><span className="eyebrow">NO PERFECT START REQUIRED</span><h2>A few pointers are enough<br />to begin.</h2><p>You can come back, change your words, and build on what you’ve done. For now, let’s make the blank page a little less blank.</p><button className="button primary" onClick={() => navigate('builder')}>Start my CV <span>↗</span></button></section>
  </main>;
}
