export function filterPublicJobs(jobs, term, location) {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  return jobs.filter(job => {
    if (!job || typeof job !== 'object') return false;
    const text = `${job.job_title || ''} ${job.employer_name || ''} ${job.job_description || ''}`.toLowerCase();
    if (!words.every(word => text.includes(word))) return false;
    if (['All locations','Remote'].includes(location)) return true;
    // This is a text filter, not a claim of work eligibility. Always show the
    // source's original restriction and ask the candidate to check the listing.
    const restriction = (job.job_country || '').toLowerCase();
    return /worldwide|anywhere|global/.test(restriction) || restriction.includes(location.toLowerCase());
  });
}
