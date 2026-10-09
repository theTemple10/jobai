export const SECTIONS = [
  { id: 'summary', label: 'Professional summary', hint: 'A short introduction in your own words.' },
  { id: 'experience', label: 'Work experience', hint: 'Paid work, internships, or freelance work.' },
  { id: 'education', label: 'Education', hint: 'Degrees, diplomas, or relevant training.' },
  { id: 'projects', label: 'Projects', hint: 'Things you built, researched, or contributed to.' },
  { id: 'skills', label: 'Skills', hint: 'Tools and abilities you can demonstrate.' },
  { id: 'certifications', label: 'Certifications', hint: 'Credentials you have actually earned.' },
  { id: 'volunteering', label: 'Volunteering', hint: 'Community work and positions of responsibility.' },
  { id: 'languages', label: 'Languages', hint: 'Languages and your proficiency.' },
];

export function emptyResume() {
  return {
    version: 1, name: '', title: '', email: '', phone: '', location: '', website: '',
    summary: '', skills: '', certifications: '', languages: '',
    sections: ['summary', 'experience', 'education', 'projects', 'skills'],
    experience: [], education: [], projects: [], volunteering: [],
  };
}

const text = (value) => typeof value === 'string' ? value.trim().slice(0, 12000) : '';
const rows = (value, keys) => Array.isArray(value) ? value.slice(0, 30).map(item =>
  Object.fromEntries(keys.map(key => [key, text(item?.[key])]))
) : [];

export function normalizeResume(value) {
  const base = emptyResume();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  for (const key of ['name', 'title', 'email', 'phone', 'location', 'website', 'summary', 'skills', 'certifications', 'languages']) base[key] = text(value[key]);
  base.sections = Array.isArray(value.sections) ? SECTIONS.map(s => s.id).filter(id => value.sections.includes(id)) : base.sections;
  base.experience = rows(value.experience, ['role', 'company', 'dates', 'bullets']);
  base.education = rows(value.education, ['degree', 'institution', 'dates']);
  base.projects = rows(value.projects, ['name', 'link', 'bullets']);
  base.volunteering = rows(value.volunteering, ['role', 'company', 'dates', 'bullets']);
  return base;
}

export function resumeFromProfile(profile) {
  const p = profile || {};
  return normalizeResume({
    ...emptyResume(), ...p,
    skills: Array.isArray(p.skills) ? p.skills.join(', ') : '',
    languages: Array.isArray(p.languages) ? p.languages.join(', ') : '',
    certifications: Array.isArray(p.certifications) ? p.certifications.join('\n') : '',
    experience: Array.isArray(p.experience) ? p.experience.map(e => ({...e, dates: e.duration, bullets: Array.isArray(e.highlights) ? e.highlights.join('\n') : ''})) : [],
    education: Array.isArray(p.education) ? p.education.map(e => ({...e, dates: e.year})) : [],
  });
}

export function profileFromResume(resume) {
  const r = normalizeResume(resume);
  return {
    name: r.name, title: r.title, email: r.email, phone: r.phone, location: r.location, summary: r.summary,
    skills: r.sections.includes('skills') ? r.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
    experience: r.sections.includes('experience') ? r.experience.map(e => ({role: e.role, company: e.company, duration: e.dates, highlights: lines(e.bullets)})) : [],
    education: r.sections.includes('education') ? r.education.map(e => ({degree: e.degree, institution: e.institution, year: e.dates})) : [],
    jobTitles: r.title ? [r.title] : [], keyStrengths: [],
  };
}

export const lines = (value = '') => text(value).split('\n').map(s => s.replace(/^[-•]\s*/, '').trim()).filter(Boolean);

// One representation feeds the preview, accessible plain text, PDF, and DOCX.
export function resumeBlocks(value) {
  const r = normalizeResume(value);
  const blocks = [
    {type: 'name', text: r.name}, {type: 'title', text: r.title},
    {type: 'contact', text: [r.email, r.phone, r.location, r.website].filter(Boolean).join(' | ')},
  ];
  for (const {id, label} of SECTIONS) {
    if (!r.sections.includes(id)) continue;
    const entries = [];
    if (['summary', 'skills', 'certifications', 'languages'].includes(id)) {
      lines(r[id]).forEach(line => entries.push({type: 'text', text: line}));
    } else {
      r[id].forEach(row => {
        const heading = id === 'education' ? [row.degree, row.institution, row.dates] : id === 'projects' ? [row.name, row.link] : [row.role, row.company, row.dates];
        if (heading.some(Boolean)) entries.push({type: 'entry', text: heading.filter(Boolean).join(' | ')});
        lines(row.bullets).forEach(line => entries.push({type: 'bullet', text: line}));
      });
    }
    if (entries.length) blocks.push({type: 'heading', text: label}, ...entries);
  }
  return blocks.filter(block => block.text);
}

export function reviewResume(value) {
  const r = normalizeResume(value);
  const checks = [
    {label: 'Your name is included', passed: Boolean(r.name)},
    {label: 'A contact email is included', passed: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)},
    {label: 'Your target role is clear', passed: Boolean(r.title)},
    {label: 'Relevant skills are listed', passed: r.sections.includes('skills') && Boolean(r.skills)},
    {label: 'Experience, education, or projects give supporting evidence', passed: ['experience', 'education', 'projects', 'volunteering'].some(id => r.sections.includes(id) && r[id].some(row => Object.values(row).some(Boolean)))},
  ];
  return checks;
}
