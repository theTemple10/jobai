import { createHash } from 'node:crypto';
const counters = new Map();
export class HttpError extends Error {
  constructor(status, message) {super(message); this.status = status;}
}
export async function authorize(req) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'Account access is not connected yet. You can still build and download a CV.');
    return `dev:${req.headers['x-forwarded-for']?.split(',')[0] || 'local'}`;
  }
  const token = req.headers.authorization;
  if (!token?.startsWith('Bearer ') || token.length > 10000) throw new HttpError(401, 'Please sign in to use AI assistance and live job search.');
  const response = await fetch(`${url}/auth/v1/user`, {headers: {apikey: key, Authorization: token}, signal: AbortSignal.timeout(10000)});
  if (!response.ok) throw new HttpError(401, 'Your sign-in has expired. Please sign in again.');
  const user = await response.json();
  if (!user.id) throw new HttpError(401, 'Please sign in again.');
  return user.id;
}
export async function rateLimit(identity, operation, limit) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const key = `jobai:${operation}:${createHash('sha256').update(identity).digest('hex')}`;
  if (!redisUrl || !redisToken) {
    if (process.env.NODE_ENV === 'production') throw new HttpError(503, 'The service is temporarily unavailable. Your draft is safe; please try again later.');
    const now = Date.now();
    if (counters.size > 1000) for (const [id, row] of counters) if (row.until < now) counters.delete(id);
    const previous = counters.get(key);
    const row = previous && previous.until > now ? previous : {count: 0, until: now + 3600000};
    row.count++; counters.set(key, row);
    if (row.count > limit) throw new HttpError(429, 'You have reached the hourly limit. Please try again later.');
    return;
  }
  const response = await fetch(redisUrl, {
    method: 'POST', headers: {Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n", '1', key]),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok || result.error || !Number.isFinite(Number(result.result))) throw new HttpError(503, 'We could not check service availability. Please try again.');
  if (Number(result.result) > limit) throw new HttpError(429, 'You have reached the hourly limit. Please try again later.');
}
export function replyError(res, error) {
  const status = error.status || (error.name === 'TimeoutError' ? 504 : 502);
  const message = error.status ? error.message : status === 504 ? 'The service took too long. Please try again.' : 'The service is unavailable. Please try again later.';
  return res.status(status).json({error: message});
}
