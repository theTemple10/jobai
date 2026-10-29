import {loadEnv} from 'vite';
import {existsSync} from 'node:fs';
const env={...loadEnv('production',process.cwd(),''),...process.env};
const groups=[
 {name:'AI writing and document analysis',keys:['GROQ_API_KEY']},
 {name:'Browser sign-in and account saving',keys:['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']},
 {name:'Server account verification and shared quotas',keys:['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SERVICE_ACCESS_SECRET']},
 {name:'Live job search',keys:['JSEARCH_KEY']},
];
console.log('RoleAide configuration check (values are never printed).');
console.log('Guest job tools need provider/quota configuration; the CV builder and workspace require account sign-in.\n');
let missing=false;
for(const group of groups) {
 console.log(group.name);
 for(const key of group.keys) {const set=Boolean(env[key]?.trim());console.log(`  ${key}: ${set?'set':'missing'}`);if(!set)missing=true;}
}
if(env.VITE_SUPABASE_URL && env.SUPABASE_URL && env.VITE_SUPABASE_URL.replace(/\/$/,'')!==env.SUPABASE_URL.replace(/\/$/,'')) {console.log('\nBrowser/server Supabase project URLs differ. Use the same project.');missing=true;}
for(const file of ['202610090001_workspace.sql','20261029133101_guest_services_and_applications.sql'])console.log(`Database migration ${file}: ${existsSync('supabase/migrations/'+file)?'present':'missing'}. Remote application is not checked.`);
console.log('Set Supabase Auth Site URL and allowed redirect URLs for the deployed site.');
console.log('Optional: GROQ_VISION_MODEL for images, VITE_EMAILJS_* for email copies, VITE_SUPPORT_EMAIL for a private support contact.');
console.log('This checks configuration presence, not credential validity or live feature quality.');
process.exitCode=missing?1:0;
