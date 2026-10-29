import {normalizeResume} from '../resume/resume.js';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export async function saveCloudResume(userId, document, id) {
  if (!supabase) throw new Error('Account storage has not been connected yet.');
  const row = {user_id: userId, title: document.title || 'My CV', document};
  if(id){
    const existing=await supabase.from('resumes').select('*').eq('id',id).eq('user_id',userId).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data && JSON.stringify(normalizeResume(existing.data.document))===JSON.stringify(normalizeResume(document)))return existing.data;
  }
  // Changed saves create snapshots, preserving prior versions for the workspace.
  const result=await supabase.from('resumes').insert(row).select().single();
  if (result.error) throw result.error;
  return result.data;
}

export async function listCloudResumes(userId) {
  const {data, error} = await supabase.from('resumes').select('id,title,document,updated_at').eq('user_id', userId).order('updated_at', {ascending: false});
  if (error) throw error;
  return data;
}

export async function googleSignInAvailable(){
  if(!url || !key)return false;
  try{
    const response=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},signal:AbortSignal.timeout(8000)});
    const data=await response.json();return response.ok && data.external?.google===true;
  }catch{return false;}
}
export async function listApplications(userId){
  const {data,error}=await supabase.from('application_activity').select('*').eq('user_id',userId).order('updated_at',{ascending:false});
  if(error)throw error;return data;
}
export async function saveApplication(userId,job,profile,method='saved',letter=''){
  const {name,title,skills,experience,projects,education,volunteering,searchLocation,remoteOnly}=profile;
  const row={user_id:userId,job_key:String(job.id),job,profile:{name,title,skills,experience,projects,education,volunteering,searchLocation,remoteOnly},method};
  if(letter.trim())row.cover_letter=letter;
  const {data,error}=await supabase.from('application_activity').upsert(row,{onConflict:'user_id,job_key'}).select().single();
  if(error)throw error;
  if(method!=='saved' && data.status==='saved')return updateApplication(userId,data.id,{status:'opened'});
  return data;
}
export async function updateApplication(userId,id,patch){
  const safe={};if(patch.status!==undefined)safe.status=patch.status;if(patch.cover_letter!==undefined)safe.cover_letter=patch.cover_letter;
  const {data,error}=await supabase.from('application_activity').update(safe).eq('id',id).eq('user_id',userId).select().single();
  if(error)throw error;return data;
}
export async function deleteApplication(userId,id){
  const {error}=await supabase.from('application_activity').delete().eq('id',id).eq('user_id',userId);if(error)throw error;
}
