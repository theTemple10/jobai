import {test, expect} from '@playwright/test';
import {jsPDF} from 'jspdf';
import {loadEnv} from 'vite';
import process from 'node:process';

function cvFile() {
  const pdf = new jsPDF();
  pdf.text(pdf.splitTextToSize('Ada Obi - Frontend Developer. Built accessible JavaScript tools for a community directory.', 170), 20, 20);
  return {name:'candidate.pdf', mimeType:'application/pdf', buffer:Buffer.from(pdf.output('arraybuffer'))};
}

async function choosePdf(page) {
  if(await page.getByRole('button',{name:'Import an existing CV',exact:false}).count()) await page.getByRole('button', {name:'Import an existing CV', exact:false}).click();
  await page.locator('input[type=file]').setInputFiles(cvFile());
  await page.getByLabel('I agree to send this CV').check();
  await page.getByRole('button', {name:'Analyse CV with AI', exact:false}).click();
}

test('production PDF and worker load and extracted text reaches analysis', async ({page}) => {
  const assets=[];
  page.on('response', response => {if (/\/assets\/pdf[-.].*\.m?js/.test(response.url())) assets.push({url:response.url(), status:response.status()});});
  await page.route('**/api/groq', async route => {
    const body=route.request().postDataJSON();
    expect(body.operation).toBe('parse');
    expect(body.messages[0].content).toContain('community directory');
    await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({name:'Ada Obi',title:'Frontend Developer',skills:['JavaScript']})}}]})});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Upload my CV and find jobs'}).click();
  await choosePdf(page);
  await expect(page.getByLabel('Your name', {exact:true})).toHaveValue('Ada Obi');
  expect(assets.some(asset => /\/pdf-/.test(asset.url) && asset.status===200)).toBe(true);
  expect(assets.some(asset => /pdf\.worker/.test(asset.url) && asset.status===200)).toBe(true);
});

test('a missing production module offers recovery without discarding the current CV', async ({page}) => {
  await page.route('**/assets/pdf-*.js', route => route.fulfill({status:404,contentType:'text/plain',body:'Not found'}));
  let providerRequests=0;
  await page.route('**/api/groq', route => {providerRequests++;return route.abort();});
  const env={...loadEnv('production',process.cwd(),''),...process.env};
  const project=new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
  const user={id:'11111111-1111-4111-8111-111111111111',email:'ada@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const session={user,access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})}.fixture`,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer'};
  await page.route('**/auth/v1/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(user)}));
  await page.addInitScript(({project,session})=>localStorage.setItem(`sb-${project}-auth-token`,JSON.stringify(session)),{project,session});
  await page.goto('/builder?mode=editor');
  await page.getByLabel('Full name', {exact:true}).fill('Unsaved candidate');
  await choosePdf(page);
  await expect(page.getByRole('button', {name:'Reload page', exact:true})).toBeVisible();
  await expect(page.getByRole('alert').filter({has:page.getByRole('button', {name:'Reload page',exact:true})})).toContainText('save any work');
  expect(providerRequests).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('jobai_resume_draft'))).toBeNull();
  await page.getByRole('link', {name:'CV builder',exact:true}).click();
  await expect(page.getByLabel('Full name', {exact:true})).toHaveValue('Unsaved candidate');
});
