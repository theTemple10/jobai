import { HttpError, replyError } from '../server/protection.js';

// A fixed URL lets the CDN share one feed across searches. Filtering happens
// in the browser; guest searches never spend the owner's JSearch allowance.
let cached;
let pending;
const MAX_AGE = 6 * 60 * 60 * 1000;

export function publicJob(item) {
  if (!item || typeof item.title !== 'string' || typeof item.company_name !== 'string') return null;
  let url;
  try {url = new URL(item.url);} catch {return null;}
  if (url.protocol !== 'https:' || url.hostname !== 'remotive.com') return null;
  const description = typeof item.description === 'string' ? item.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0,30000) : '';
  return {
    job_id: `remotive_${item.id}`, job_title: item.title, employer_name: item.company_name,
    job_description: description, job_publisher: 'Remotive', job_apply_link: url.href,
    job_country: typeof item.candidate_required_location === 'string' ? item.candidate_required_location : 'Eligibility not listed',
    job_is_remote: true, job_employment_type: item.job_type || '',
    job_posted_at_timestamp: Date.parse(item.publication_date) / 1000,
  };
}

async function loadFeed() {
  const response = await fetch('https://remotive.com/api/remote-jobs', {signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw new HttpError(503, 'Remote listings are unavailable just now. Please try again later.');
  const result = await response.json();
  if (!Array.isArray(result.jobs)) throw new HttpError(502, 'The remote job source returned an unexpected response.');
  const data = result.jobs.map(publicJob).filter(Boolean);
  cached = {at: Date.now(), data};
  return cached;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {res.setHeader?.('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  try {
    if (!cached || Date.now() - cached.at >= MAX_AGE) {
      pending ||= loadFeed().finally(() => {pending = null;});
      await pending;
    }
    res.setHeader('Cache-Control','public, max-age=300, s-maxage=21600');
    return res.status(200).json({data:cached.data, source:'Remotive', fetchedAt:new Date(cached.at).toISOString()});
  } catch(error) {res.setHeader('Cache-Control','no-store');return replyError(res,error);}
}
