import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export async function saveCloudResume(userId, document, id) {
  if (!supabase) throw new Error('Account storage has not been connected yet.');
  const row = {user_id: userId, title: document.title || 'My CV', document};
  const result = id
    ? await supabase.from('resumes').update(row).eq('id', id).eq('user_id', userId).select().single()
    : await supabase.from('resumes').insert(row).select().single();
  if (result.error) throw result.error;
  return result.data;
}

export async function listCloudResumes(userId) {
  const {data, error} = await supabase.from('resumes').select('id,title,document,updated_at').eq('user_id', userId).order('updated_at', {ascending: false});
  if (error) throw error;
  return data;
}
