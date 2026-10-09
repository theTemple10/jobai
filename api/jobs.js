import { authorize, rateLimit, HttpError, replyError } from '../server/protection.js';

export function buildSearch(query) {
  if (typeof query.query !== 'string' || !query.query.trim() || query.query.length > 250) throw new HttpError(400, 'Enter a job title and a shorter location.');
  const params = new URLSearchParams({query: query.query.trim(), num_pages: '1', date_posted: 'month'});
  if (query.remote_jobs_only === 'true') params.set('remote_jobs_only', 'true');
  return params;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {res.setHeader?.('Allow', 'GET'); return res.status(405).json({error: 'Method not allowed'});}
  try {
    const params = buildSearch(req.query || {});
    const identity = await authorize(req);
    await rateLimit(identity, 'jobs', 40, req.headers.authorization);
    if (!process.env.JSEARCH_KEY) throw new HttpError(503, 'Live job search is not connected yet. You can still build and download a CV.');
    const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
      headers: {'X-RapidAPI-Key': process.env.JSEARCH_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'}, signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 502, response.status === 429 ? 'The job service has reached its request limit. Please try again later.' : 'The job provider is unavailable. Please try again later.');
    if (!Array.isArray(data.data)) throw new HttpError(502, 'The job provider returned an unexpected response. Please try again.');
    return res.status(200).json(data);
  } catch (error) {return replyError(res, error);}
}
