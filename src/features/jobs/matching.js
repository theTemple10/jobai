// A transparent text heuristic, not an ATS score or a hiring prediction.
const aliases={javascript:['javascript','js'],typescript:['typescript','ts'],react:['react','react.js','reactjs'],'node.js':['node.js','nodejs'],postgresql:['postgresql','postgres'],excel:['excel','microsoft excel'],aws:['aws','amazon web services']};
const vocabulary=['JavaScript','TypeScript','React','Node.js','Python','Java','C++','C#','SQL','PostgreSQL','HTML','CSS','Git','Docker','AWS','Excel','Power BI','Tableau','Data analysis','Customer service','Communication','Project management','Sales','Accounting','Bookkeeping','Research','Laboratory','Biochemistry','Quality assurance','Content writing','Digital marketing','SEO','Figma'];
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const canonical=value=>Object.keys(aliases).find(key=>aliases[key].includes(value.toLowerCase().trim())) || value.toLowerCase().trim();
function mentions(text,skill){return (aliases[canonical(skill)] || [skill]).some(term=>new RegExp(`(^|[^a-z0-9])${escape(term)}(?=$|[^a-z0-9])`,'i').test(text));}
function titleWords(text){return [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) || [])].filter(word=>!['a','an','the','and','or','in','of','for','at','remote'].includes(word));}

export function scoreJob(profile,title,description,requirements=[]) {
  const text=`${title} ${description} ${requirements.join(' ')}`;
  const skills=[...new Set((profile.skills || []).filter(value=>typeof value==='string' && value.trim()).map(canonical))];
  const terms=[...new Set([...vocabulary.map(canonical),...skills])].filter(skill=>mentions(text,skill));
  const matched=terms.filter(skill=>skills.includes(skill));
  const missing=terms.filter(skill=>!skills.includes(skill));
  const words=titleWords(profile.title || '');
  const jobWords=titleWords(title);
  const titleScore=words.length?Math.round(100*words.filter(word=>jobWords.includes(word)).length/words.length):null;
  const skillsScore=terms.length && skills.length?Math.round(100*matched.length/terms.length):null;
  const score=skillsScore!==null && titleScore!==null?Math.round(.7*skillsScore+.3*titleScore):skillsScore??titleScore;
  return {score,skillsScore,titleScore,matched,missing,detected:terms.length,method:'Text evidence: 70% detected skill coverage + 30% target-title overlap when both are available. Otherwise only the available component is used. Skills use a limited vocabulary plus your listed skills. Mentions may be optional or negated; check the original posting. Location, seniority, qualifications and work eligibility are not scored.'};
}
