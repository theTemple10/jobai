import { useEffect, useState } from 'react';
import { dailyEncouragement } from '../lib/quotes.js';

function PaperCompanion() {
  return <div className="hero-art" aria-hidden="true">
    <div className="orbit orbit-one" /><div className="orbit orbit-two" />
    <span className="art-spark spark-one">✧</span><span className="art-spark spark-two">✦</span>
    <div className="paper-pal">
      <div className="paper-fold" /><div className="pal-eyes"><i /><i /></div><div className="pal-smile" />
      <div className="pal-lines"><i /><i /><i /></div><div className="pal-seal">✓</div>
    </div>
    <div className="art-note note-one"><span className="note-dot" /> Your story, clearly told</div>
    <div className="art-note note-two">One step at a time <span>↗</span></div>
    <div className="art-caption">A little structure. A fresh start.</div>
  </div>;
}

export default function LandingPage({ navigate }) {
  const [quote, setQuote] = useState(() => dailyEncouragement());
  useEffect(() => {
    const timer = setInterval(() => setQuote(dailyEncouragement()), 60000);
    return () => clearInterval(timer);
  }, []);

  return <main id="main-content" className="landing">
    <section className="landing-hero container">
      <div className="hero-copy">
        <span className="eyebrow"><span /> YOUR NEXT CHAPTER STARTS HERE</span>
        <h1>You have a story.<br />Let’s help it<br /><em>open doors.</em></h1>
        <p className="hero-intro">The job search can feel like a lot. Your CV doesn’t have to.</p>
        <p>Whether you’re writing your first resume or finding a better way to tell your experience, JobAI gives you a place to begin. Put your ideas into words, discover roles to explore, and prepare an application you can stand behind.</p>
        <div className="hero-actions"><button className="button primary" onClick={() => navigate('builder')}>Build my CV <span>↗</span></button><button className="button secondary" onClick={() => navigate('jobs')}>I already have a CV <span>→</span></button></div>
        <p className="hero-footnote">Start without an account · Your words stay editable · Go at your own pace</p>
      </div>
      <PaperCompanion />
    </section>

    <aside className="daily-note container" aria-label="Daily encouragement">
      <span className="daily-icon" aria-hidden="true">☀</span><div><span className="eyebrow">A SMALL REMINDER FOR TODAY</span><blockquote>“{quote}”</blockquote><p>Words from JobAI · A new reminder each day</p></div>
    </aside>

    <section id="how-it-works" className="landing-section container">
      <div className="section-heading"><span className="eyebrow">FROM A BLANK PAGE TO A NEXT STEP</span><h2>You don’t have to do<br />everything at once.</h2><p>Bring what you have. We’ll help you give it shape, then make the next part of your search a little easier.</p></div>
      <div className="journey-grid">
        {[
          ['01', 'Start with your story', 'No CV yet? Choose the sections that fit you and add a few details. Have one already? Upload it to extract a starting profile, then check that we got it right.'],
          ['02', 'Make it clear and useful', 'Turn your experience into a readable, single-column CV. Review the wording, keep the facts yours, and download a document you can edit or share.'],
          ['03', 'Take a thoughtful next step', 'Explore job listings, prepare a cover letter, and open the employer’s application page. You review and submit it yourself, with your own judgment in charge.'],
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
