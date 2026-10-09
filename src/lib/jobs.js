export function normalizeProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The analysis returned an invalid profile. Please try again.');
  const strings = key => Array.isArray(value[key]) ? value[key].filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()) : [];
  const text = key => typeof value[key] === 'string' && value[key] !== 'null' ? value[key].trim() : '';
  const profile = Object.fromEntries(['name', 'email', 'phone', 'location', 'title', 'summary', 'seniority'].map(key => [key, text(key)]));
  for (const key of ['skills', 'languages', 'certifications', 'jobTitles', 'industries', 'keyStrengths']) profile[key] = strings(key);
  profile.experience = Array.isArray(value.experience) ? value.experience.filter(e => e && typeof e === 'object').map(e => ({
    role: typeof e.role === 'string' ? e.role : '', company: typeof e.company === 'string' ? e.company : '',
    duration: typeof e.duration === 'string' ? e.duration : '', highlights: Array.isArray(e.highlights) ? e.highlights.filter(h => typeof h === 'string') : [],
  })) : [];
  profile.education = Array.isArray(value.education) ? value.education.filter(e => e && typeof e === 'object').map(e => ({
    degree: typeof e.degree === 'string' ? e.degree : '', institution: typeof e.institution === 'string' ? e.institution : '', year: typeof e.year === 'string' ? e.year : '',
  })) : [];
  if (!profile.title && !profile.name && !profile.skills.length) throw new Error('We could not identify a usable profile. Try another document or build your CV manually.');
  if (!profile.jobTitles.length && profile.title) profile.jobTitles = [profile.title];
  return profile;
}

const escapes = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalizeJob(item, index, profile, now = Date.now()) {
  const publishers = ['linkedin', 'indeed', 'glassdoor', 'remoteok', 'wellfound', 'weworkremotely'];
  const publisher = typeof item.job_publisher === 'string' ? item.job_publisher.trim() : '';
  const publisherKey = publisher.toLowerCase().replace(/\s/g, '');
  const board = publishers.find(key => publisherKey.includes(key)) || 'other';
  const description = typeof item.job_description === 'string' ? item.job_description : '';
  const requirements = Array.isArray(item.job_highlights?.Qualifications) ? item.job_highlights.Qualifications.filter(s => typeof s === 'string') : [];
  const jobText = `${item.job_title || ''} ${description} ${requirements.join(' ')}`;
  const skills = [...new Set((profile.skills || []).filter(s => typeof s === 'string' && s.trim()).map(s => s.trim().toLowerCase()))];
  const matchedSkills = skills.filter(skill => new RegExp(`(^|[^a-z0-9])${escapes(skill)}(?=$|[^a-z0-9])`, 'i').test(jobText));
  const match = skills.length ? Math.round(100 * matchedSkills.length / skills.length) : null;
  const timestamp = Number(item.job_posted_at_timestamp);
  const postedDays = Number.isFinite(timestamp) && timestamp > 0 ? Math.max(0, Math.floor((now / 1000 - timestamp) / 86400)) : null;
  const hasMin = Number.isFinite(item.job_min_salary);
  const hasMax = Number.isFinite(item.job_max_salary);
  const currency = item.job_salary_currency || '';
  const period = item.job_salary_period ? ` / ${String(item.job_salary_period).toLowerCase()}` : '';
  const salary = hasMin || hasMax ? `${currency} ${hasMin ? item.job_min_salary.toLocaleString('en-US') : ''}${hasMin && hasMax ? ' – ' : ''}${hasMax ? item.job_max_salary.toLocaleString('en-US') : ''}${period}`.trim() : 'Salary not listed';
  const rawUrl = typeof item.job_apply_link === 'string' ? item.job_apply_link : '';
  let applyUrl = '';
  try { const url = new URL(rawUrl); if (['https:', 'http:'].includes(url.protocol)) applyUrl = url.href; } catch { /* An invalid URL cannot be used for navigation. */ }
  return {
    id: item.job_id || `job_${index}`, title: item.job_title || 'Role', company: item.employer_name || 'Company',
    location: [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') || 'Location not listed',
    type: item.job_employment_type ? String(item.job_employment_type).replaceAll('_', ' ') : 'Type not listed',
    remote: Boolean(item.job_is_remote), salary, match, matchedSkills, totalSkills: skills.length,
    board, boardLabel: board === 'other' ? publisher || 'Source not listed' : null, applyUrl,
    description: description || 'See the original listing for details.', requirements, postedDays,
    industry: 'Not listed', urgent: false,
    tags: item.job_is_remote ? ['Remote · check country eligibility'] : [],
  };
}
