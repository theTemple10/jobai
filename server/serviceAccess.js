import {createHash,createHmac} from 'node:crypto';
import {authorize,HttpError} from './protection.js';
const counters=new Map();
export function serviceProof(secret=process.env.SERVICE_ACCESS_SECRET) {
  if(!secret || secret.length<32) throw new HttpError(503,'This service is being connected. Please try again later.');
  return createHmac('sha256',secret).update('roleaide-provider-v1').digest('hex');
}
export async function serviceRPC(name,body) {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url || !key) throw new HttpError(503,'This service is being connected. Please try again later.');
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({...body,proof:serviceProof()}),signal:AbortSignal.timeout(10000)});
  const result=await response.json().catch(()=>null);
  if(!response.ok) throw new HttpError(503,'We could not check service availability. Please try again later.');
  return result;
}
export async function protectService(req,operation,{requireAccount=false}={}) {
  let identity;
  if(req.headers.authorization){try{identity=`user:${await authorize(req)}`;}catch(error){if(requireAccount || error.status!==401)throw error;}}
  if(!identity) {
    if(requireAccount) throw new HttpError(401,'Sign in to create or optimise a CV.');
    // Vercel overwrites this platform header. Other deployments must configure
    // their own trusted proxy; never accept an arbitrary client-supplied IP.
    const address=process.env.VERCEL?req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim():req.socket?.remoteAddress;
    if(!address && process.env.NODE_ENV==='production') throw new HttpError(503,'We could not check service availability. Please try again.');
    identity=`guest:${address || 'local'}`;
  }
  const [kind,...value]=identity.split(':');
  const salt=process.env.SERVICE_ACCESS_SECRET || 'local-development-only';
  const subject=`${kind}:${createHmac('sha256',salt).update(value.join(':')).digest('hex')}`;
  if(process.env.NODE_ENV!=='production' && (!process.env.SERVICE_ACCESS_SECRET || !process.env.SUPABASE_URL)) {
    const key=subject+operation,now=Date.now();
    for(const [key,row] of counters)if(row.until<now)counters.delete(key);
    const row=counters.get(key) || {count:0,until:now+3600000};row.count++;counters.set(key,row);
    if(row.count>10)throw new HttpError(429,'You have reached the service limit. Please try again later.');
    return;
  }
  const allowed=await serviceRPC('consume_public_service_quota',{subject,requested_operation:operation});
  if(typeof allowed!=='boolean')throw new HttpError(503,'We could not check service availability. Please try again later.');
  if(!allowed)throw new HttpError(429,'The current service allowance has been reached. Please try again later or browse public remote listings.');
}
export const searchCacheKey=params=>createHash('sha256').update(params.toString().toLowerCase()).digest('hex');
