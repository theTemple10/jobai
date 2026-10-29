import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,createHash,createHmac} from 'node:crypto';
import {loadEnv} from 'vite';
import process from 'node:process';
const env=loadEnv('development',process.cwd(),'');
let secret=env.SERVICE_ACCESS_SECRET;
if(process.argv.includes('--rotate') || !secret || secret.length<32){
  secret=randomBytes(32).toString('base64url');
  let content=await readFile('.env.local','utf8');
  const line=`SERVICE_ACCESS_SECRET=${secret}`;
  if(/^\s*(?:export\s+)?SERVICE_ACCESS_SECRET\s*=/m.test(content))content=content.replace(/^\s*(?:export\s+)?SERVICE_ACCESS_SECRET\s*=.*$/m,line);
  else content+=`\n# Server-only guest quota/cache capability; never use a VITE_ prefix.\n${line}\n`;
  await writeFile('.env.local',content,{mode:0o600});
}
const proof=createHmac('sha256',secret).update('roleaide-provider-v1').digest('hex');
const verifier=createHash('sha256').update(proof).digest('hex');
const sql=`insert into private.service_settings(name,value) values ('service_proof_sha256','${verifier}') on conflict(name) do update set value=excluded.value;\n`;
await writeFile('/tmp/roleaide-service-verifier.sql',sql,{mode:0o600});
console.log('Server key is configured in ignored .env.local. No key value printed.');
console.log('Private verifier SQL prepared at /tmp/roleaide-service-verifier.sql. Apply after the additive migration.');
