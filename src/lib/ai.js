import { supabase } from './supabase.js';

export async function requestAI(body, signal) {
  const response = await fetch('/api/groq', {
    method: 'POST', signal: signal || AbortSignal.timeout(60000),
    headers: {'Content-Type': 'application/json', ...await authHeaders()},
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.error || 'The writing service is unavailable. Please try again.');
  const result = data.choices?.[0]?.message?.content;
  if (typeof result !== 'string' || !result.trim()) throw new Error('No usable text was returned. Please try again.');
  return result;
}

export async function authHeaders() {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  return session ? {Authorization: `Bearer ${session.access_token}`} : {};
}
