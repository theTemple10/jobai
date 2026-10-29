import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { buildRequest } from '../../api/groq.js';


const testUser={id:'11111111-1111-4111-8111-111111111111',email:'ada@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-29T00:00:00Z'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function testSession(){return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:testUser.id,exp:Math.floor(Date.now()/1000)+3600})}.test`,refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:testUser};}
const guestTests=['guest','first visit','job provider failure','unexpected saved activity','returning visitors','pasted CV'];
test.beforeEach(async({page},info)=>{
  await page.route('**/auth/v1/settings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({external:{email:true,google:false}})}));
  await page.route('**/rest/v1/application_activity?**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
  await page.route('**/rest/v1/resumes?**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
  if(!guestTests.some(prefix=>info.title.startsWith(prefix)))await page.addInitScript(session=>localStorage.setItem('sb-roleaide-test-auth-token',JSON.stringify(session)),testSession());
});

test('landing and builder fit mobile widths and respect reduced motion', async ({ page }) => {
  for (const width of [320,375,768,1440]) {
    await page.setViewportSize({width,height:900});await page.goto('/');
    await expect(page.getByRole('heading',{level:1})).toContainText('You have a story');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.paper-pal').evaluate(element=>parseFloat(getComputedStyle(element).animationDuration))).toBeLessThan(0.1);
    if (width === 1440) await page.screenshot({path:'/tmp/jobai-landing-desktop.png',fullPage:true});
    if (width === 375) await page.screenshot({path:'/tmp/jobai-landing-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Build my CV'}).click();
    await expect(page.getByRole('heading',{level:1})).toHaveText('You don’t need to write a CV from scratch.');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) await page.screenshot({path:'/tmp/jobai-builder-desktop.png',fullPage:true});
  }
});

test('existing Word CV imports into editable builder fields',async({page})=>{
  const {Document,Packer,Paragraph}=await import('docx');
  const buffer=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('Ada Obi, Frontend Developer. Built accessible community tools using JavaScript. Education: BSc Computer Science.')]}]}));
  await page.route('**/api/groq',async route=>{
    const payload = route.request().postDataJSON();
    expect(payload.operation).toBe('parse');
    expect(buildRequest(payload).messages[1].content).toContain('Ada Obi');
    await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({name:'Ada Obi',title:'Frontend Developer',skills:['JavaScript'],experience:[],education:[]})}}]})});
  });
  await page.goto('/builder?mode=editor');await page.getByRole('button',{name:'Import an existing CV'}).click();
  await page.locator('input[type=file]').setInputFiles({name:'existing-cv.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer});
  await page.getByLabel('I agree to send this CV').check();await page.getByRole('button',{name:'Analyse CV with AI'}).click();
  await expect(page.getByLabel('Full name')).toHaveValue('Ada Obi');
  await expect(page.getByLabel('Target role',{exact:true})).toHaveValue('Frontend Developer');
});

test('a first CV exports selectable PDF and editable DOCX from reviewed facts', async ({page}) => {
  await page.goto('/builder?mode=editor');
  await page.getByLabel('Full name').fill('Ada Ọbí');
  await page.getByLabel('Target role',{exact:true}).fill('Frontend Developer');
  await page.getByLabel('Email',{exact:true}).fill('ada@example.com');
  await page.getByRole('button',{name:'Projects',exact:true}).click();
  await page.getByRole('button',{name:'+ Add project'}).click();
  await page.getByLabel('Project name').fill('Community directory');
  await page.getByLabel('What did you build or contribute?').fill('Built keyboard navigation for the community directory.');
  await page.getByRole('button',{name:'Review & download'}).click();
  await expect(page.getByRole('button',{name:'Download PDF'})).toBeDisabled();
  await page.getByLabel('I have reviewed this CV').check();
  const pdfDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF'}).click();
  const pdf=await pdfDownload;const pdfPath=await pdf.path();
  const text=execFileSync('pdftotext',[pdfPath,'-'],{encoding:'utf8'});
  expect(text).toContain('Ada Ọbí');expect(text).toContain('Community directory');expect(text).toContain('keyboard navigation');
  const wordDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download Word'}).click();
  const word=await wordDownload;const xml=strFromU8(unzipSync(await readFile(await word.path()))['word/document.xml']);
  const wordText=await page.evaluate(xml=>new DOMParser().parseFromString(xml,'application/xml').documentElement.textContent,xml);
  expect(wordText).toContain('Ada Ọbí');expect(wordText).toContain('Community directory');
});

test('draft saving is explicit, recoverable, and removable',async({page})=>{
  await page.goto('/builder?mode=editor');await page.getByLabel('Full name').fill('Saved candidate');
  expect(await page.evaluate(()=>localStorage.getItem('jobai_resume_draft'))).toBeNull();
  await page.getByRole('button',{name:'Save on this device'}).click();await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('Saved candidate');
  await page.getByRole('button',{name:'Delete device draft'}).click();await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('');
});

test('job provider failure is a persistent error without fictional listings',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('jobai_step','3');localStorage.setItem('jobai_profile',JSON.stringify({name:'Ada',title:'Developer',skills:['Python'],jobTitles:['Developer']}));});
  await page.route('**/api/jobs?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'The job provider is unavailable.'})}));
  await page.goto('/#/jobs');await expect(page.getByRole('alert')).toContainText('The job provider is unavailable');
  await expect(page.getByText('TechCorp')).toHaveCount(0);await expect(page.getByText('GlobalBank')).toHaveCount(0);
});

test('normal keyboard entry preserves words, paragraphs, and achievements',async({page})=>{
  await page.goto('/builder?mode=editor');
  await page.getByLabel('Full name',{exact:true}).pressSequentially('Ada Obi');
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Ada Obi');
  await page.getByRole('button',{name:'Professional summary',exact:true}).click();
  const summary=page.getByLabel('A short introduction');
  await summary.pressSequentially('I build tools.');await summary.press('Enter');await summary.pressSequentially('For people.');
  await expect(summary).toHaveValue('I build tools.\nFor people.');
  await page.getByRole('button',{name:'Projects',exact:true}).click();await page.getByRole('button',{name:'+ Add project'}).click();
  const achievements=page.getByLabel('What did you build or contribute?');
  await achievements.pressSequentially('Built a tool');await achievements.press('Enter');await achievements.pressSequentially('Made it accessible');
  await expect(achievements).toHaveValue('Built a tool\nMade it accessible');
});

test('skip navigation retains the active tool and focuses its content',async({page})=>{
  await page.goto('/builder?mode=editor');await page.getByRole('link',{name:'Skip to content'}).focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/builder(?:\?mode=editor)?$/);await expect(page.locator('main')).toBeFocused();
  await page.getByRole('link',{name:'Find jobs',exact:true}).click();await expect(page).toHaveURL(/\/jobs$/);
  await page.goBack();await expect(page.getByRole('heading',{level:1})).toHaveText('Let’s tell your story.');
});

test('unexpected saved activity cannot blank job search',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{localStorage.setItem('jobai_applications','{}');localStorage.setItem('jobai_step','3');});
  await page.goto('/jobs');await expect(page.getByRole('heading',{level:1})).toHaveText('Find your next possibility.');
  await expect(page.getByText('A new search starts here.')).toBeVisible();expect(errors).toEqual([]);
});

test('automatic device saving is explicit and preserves later edits',async({page})=>{
  await page.goto('/builder?mode=editor');await page.getByLabel('Full name',{exact:true}).fill('Ada Obi');
  expect(await page.evaluate(()=>localStorage.getItem('jobai_resume_draft'))).toBeNull();
  await page.getByLabel('Keep this draft updated on this device.').check();
  await expect(page.getByText(/Saved on this device at/)).toBeVisible();
  await page.getByLabel('Full name',{exact:true}).fill('Ada Obi Updated');
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('jobai_resume_draft')).name)).toBe('Ada Obi Updated');
  await page.reload();await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Ada Obi Updated');
  await page.getByRole('button',{name:'Delete device draft'}).click();
  expect(await page.evaluate(()=>localStorage.getItem('jobai_resume_draft'))).toBeNull();
  await expect(page.getByLabel('Keep this draft updated on this device.')).not.toBeChecked();
});

test('first visit offers search without a CV and submits one bounded query',async({page})=>{
  const requests=[];await page.route('**/api/jobs?**',route=>{requests.push(route.request().url());return route.fulfill({contentType:'application/json',body:JSON.stringify({data:[]})});});
  await page.goto('/jobs');await expect(page.getByLabel('Job title, skill, or company')).toBeVisible();expect(requests).toHaveLength(0);
  await page.getByLabel('Job title, skill, or company').fill('Frontend developer');await page.getByLabel('Job search location').selectOption('Remote');await page.getByRole('button',{name:'Find jobs',exact:true}).click();
  await expect(page.getByText('No listings came back this time.')).toBeVisible();expect(requests).toHaveLength(1);expect(new URL(requests[0]).searchParams.get('remote_jobs_only')).toBe('true');
});

test('returning visitors can deliberately import a different CV',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('jobai_step','3');localStorage.setItem('jobai_profile',JSON.stringify({title:'Developer',skills:[]}));});
  await page.goto('/');await page.getByRole('button',{name:'Upload my CV and find jobs'}).click();
  await expect(page.getByRole('button',{name:'Choose a CV file'})).toBeVisible();
});

test('job cards and detail actions fit narrow screens in both themes',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('jobai_step','3');localStorage.setItem('jobai_profile',JSON.stringify({title:'Developer',skills:['Python']}));});
  await page.route('**/api/jobs?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({data:[{job_id:'role-1',job_title:'Senior Frontend Developer, Accessibility and Design Systems',employer_name:'Community Labs International',job_description:'Build accessible Python tools.\nReview real requirements.',job_city:'Lagos',job_country:'Nigeria',job_is_remote:true}]})}));
  for(const width of [320,375,768,1440]) {
    await page.setViewportSize({width,height:950});await page.goto('/jobs');await expect(page.getByRole('button',{name:/View Senior Frontend Developer/})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:/View Senior Frontend Developer/}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const title = await page.getByRole('heading',{name:'Senior Frontend Developer, Accessibility and Design Systems',exact:true}).boundingBox();expect(title.width).toBeGreaterThan(150);
  }
});

test('empty documents cannot be exported and mobile preview is easy to reach',async({page})=>{
  await page.setViewportSize({width:375,height:900});await page.goto('/builder?mode=editor');
  await page.getByRole('button',{name:'Review & download'}).click();await page.getByLabel('I have reviewed this CV').check();await expect(page.getByRole('button',{name:'Download PDF'})).toBeDisabled();
  await page.getByRole('button',{name:'Contact & target role'}).click();await page.getByLabel('Full name',{exact:true}).fill('Ada Obi');
  await page.getByRole('button',{name:'Preview my CV',exact:true}).click();await expect(page.getByRole('heading',{name:'Ada Obi',exact:true})).toBeVisible();
  await expect(page.getByLabel('CV editor')).toBeHidden();await page.getByRole('button',{name:'Edit my CV',exact:true}).click();await expect(page.getByLabel('Full name',{exact:true})).toBeVisible();
});

test('sign-in recovery copies restore only in their short recovery window',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('jobai_auth_handoff',JSON.stringify({document:{name:'Recovery candidate',title:'Developer'},cloudId:null,at:Date.now()})));
  await page.goto('/builder?mode=editor');await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Recovery candidate');
  expect(await page.evaluate(()=>localStorage.getItem('jobai_auth_handoff'))).toBeNull();
});

test('starting a new CV asks before discarding excluded section facts', async ({page}) => {
  await page.goto('/builder?mode=editor');
  await page.getByRole('button', {name:'Skills', exact:true}).click();
  await page.getByLabel('Skills (separate with commas)').fill('Python, SQL');
  await page.getByLabel('Include Skills', {exact:true}).uncheck();
  const dialog = page.waitForEvent('dialog').then(dialog => dialog.dismiss());
  await page.getByRole('button', {name:'New CV', exact:true}).click();
  await dialog;
  await page.getByLabel('Include Skills', {exact:true}).check();
  await page.getByRole('button', {name:'Skills', exact:true}).click();
  await expect(page.getByLabel('Skills (separate with commas)')).toHaveValue('Python, SQL');
});

test('a restored sign-in copy remains unsaved until explicitly saved', async ({page}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('jobai_auth_handoff', JSON.stringify({document:{name:'Recovery candidate',title:'Developer'},at:Date.now()})));
  await page.goto('/builder?mode=editor');
  await expect(page.getByLabel('Full name', {exact:true})).toHaveValue('Recovery candidate');
  await expect(page.getByText('Changes in this tab · not saved yet', {exact:true})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('jobai_auth_handoff'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('jobai_resume_draft'))).toBeNull();
  await page.getByRole('button', {name:'Save on this device', exact:true}).click();
  await expect(page.getByText(/Saved on this device at/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Full name', {exact:true})).toHaveValue('Recovery candidate');
});

async function reachGuidedDraft(page) {
  await page.goto('/builder');
  await page.getByRole('button',{name:'Frontend developer',exact:true}).click();
  await page.getByRole('button',{name:'Continue →',exact:true}).click();
  await page.getByLabel('A project I worked on').check();
  await page.getByRole('button',{name:'Continue →',exact:true}).click();
  await page.getByLabel('Your short answer').fill('Built keyboard navigation for a community directory using JavaScript.');
  await page.getByRole('button',{name:'Continue →',exact:true}).click();
  await page.getByRole('button',{name:'+ JavaScript',exact:true}).click();
  await page.getByRole('button',{name:'Continue →',exact:true}).click();
  await page.getByLabel('Full name',{exact:true}).fill('Ada Obi');
  await page.getByRole('button',{name:'Continue →',exact:true}).click();
}

test('authenticated guided journey reaches a real export and job discovery without AI',async({page})=>{
  let aiRequests=0;page.on('request',request=>{if(request.url().includes('/api/groq')) aiRequests++;});
  await reachGuidedDraft(page);
  await page.getByRole('button',{name:'Arrange my notes →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Does this sound like you?'})).toBeVisible();
  await page.getByRole('button',{name:'Use this draft →',exact:true}).click();
  await page.getByLabel('I have reviewed this CV').check();
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF ↓',exact:true}).click();
  const pdf=await downloaded;const text=execFileSync('pdftotext',[await pdf.path(),'-'],{encoding:'utf8'});
  expect(text).toContain('Ada Obi');expect(text).toContain('keyboard navigation');expect(aiRequests).toBe(0);
  await page.route('**/api/jobs?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({data:[]})}));
  await page.getByRole('button',{name:'Explore jobs for this profile →'}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Find your next possibility.');
  await expect(page.getByText('No listings came back this time.')).toBeVisible();
});

test('guided answers recover at the unfinished step after explicit saving',async({page})=>{
  await reachGuidedDraft(page);
  await page.getByRole('button',{name:'Save my answers',exact:true}).click();await page.reload();
  await expect(page.getByRole('heading',{name:'You’ve given us a starting point.'})).toBeVisible();
  await expect(page.getByText('Built keyboard navigation for a community directory using JavaScript.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'← Back',exact:true}).click();
  await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Ada Obi');
});

test('guided AI drafting sends notes only and preserves a fallback on failure',async({page})=>{
  await reachGuidedDraft(page);
  let attempts=0;
  await page.route('**/api/groq',async route=>{
    const payload=route.request().postDataJSON();expect(payload.operation).toBe('draft');expect(JSON.stringify(payload)).not.toContain('Ada Obi');
    expect(buildRequest(payload).messages[1].content).toContain('keyboard navigation');
    attempts++;
    if(attempts===1) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Writing is unavailable.'})});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({projects:[{bullets:'Built keyboard navigation for a community directory using JavaScript.'}]})}}]})});
  });
  await expect(page.getByRole('button',{name:'Suggest an AI draft',exact:true})).toBeDisabled();
  await page.getByLabel('Send these notes for an AI draft.').check();
  await page.getByRole('button',{name:'Suggest an AI draft',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Writing is unavailable.');
  await expect(page.getByRole('button',{name:'Arrange my notes →',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Suggest an AI draft',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Does this sound like you?'})).toBeVisible();
  await expect(page.getByText('Ada Obi',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'← Back to my notes',exact:true}).click();
  await expect(page.getByText('Built keyboard navigation for a community directory using JavaScript.',{exact:true})).toBeVisible();
});

test('guided choices and draft review fit small screens in both themes',async({page})=>{
  await page.setViewportSize({width:320,height:850});
  for(const theme of ['light','dark']) {
    await page.goto('/');await page.evaluate(theme=>localStorage.setItem('jobai_theme',JSON.stringify(theme)),theme);
    await reachGuidedDraft(page);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Arrange my notes →',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const heading=page.getByRole('heading',{name:'Does this sound like you?'});
    const bounds=await heading.boundingBox();const header=await page.locator('.product-header').boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(header.y+header.height);expect(bounds.y+bounds.height).toBeLessThan(850);
    await page.screenshot({path:`/tmp/roleaide-guided-${theme}-mobile.png`,fullPage:true});
  }
});


test('pasted CV can be retried after a failure without losing its text',async({page})=>{
  let attempts=0;
  await page.route('**/api/groq',async route=>{
    expect(buildRequest(route.request().postDataJSON()).messages[1].content).toContain('Built a community directory');
    attempts++;
    if(attempts===1) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Please try again.'})});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({name:'Ada Obi',title:'Developer',skills:['JavaScript']})}}]})});
  });
  await page.goto('/');await page.getByRole('button',{name:'Upload my CV and find jobs'}).click();
  await page.getByRole('button',{name:'Paste CV text',exact:true}).click();
  const notes='Ada Obi. Built a community directory using JavaScript for a local volunteer group.';
  await page.getByLabel('Your existing CV or rough notes').fill(notes);
  await page.getByLabel('I agree to send this CV').check();await page.getByRole('button',{name:'Analyse CV with AI'}).click();
  await expect(page.getByLabel('Your existing CV or rough notes')).toHaveValue(notes);
  await page.getByLabel('I agree to send this CV').check();await page.getByRole('button',{name:'Analyse CV with AI'}).click();
  await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('Ada Obi');
});


test('guests see attributed remote listings before account access and can filter country text',async({page})=>{
  let paidRequests=0;
  page.on('request',request=>{if(request.url().includes('/api/jobs?')) paidRequests++;});
  await page.route('**/api/public-jobs',route=>{
    expect(route.request().headers().authorization).toBeUndefined();
    return route.fulfill({contentType:'application/json',body:JSON.stringify({data:[
      {job_id:'global',job_title:'Developer',employer_name:'Global Example',job_description:'Build JavaScript tools',job_country:'Worldwide',job_is_remote:true,job_publisher:'Remotive',job_apply_link:'https://remotive.com/remote-jobs/software-dev/global-1'},
      {job_id:'usa',job_title:'Developer',employer_name:'US Example',job_description:'Build JavaScript tools',job_country:'United States',job_is_remote:true,job_publisher:'Remotive'}
    ]})});
  });
  await page.goto('/jobs');await page.getByLabel('Job search source').selectOption('public');await page.getByLabel('Job title, skill, or company').fill('Developer');
  await page.getByLabel('Job search location').selectOption('Nigeria');await page.getByRole('button',{name:'Find jobs',exact:true}).click();
  await expect(page.getByRole('button',{name:'View Developer at Global Example'})).toBeVisible();
  await expect(page.getByRole('button',{name:'View Developer at US Example'})).toHaveCount(0);
  await expect(page.getByText(/delayed by at least 24 hours/)).toBeVisible();
  expect(paidRequests).toBe(0);
});


test('guest CV parsing, matching and downloadable cover letters never request sign-in',async({page,context})=>{
  let authRequests=0;
  page.on('request',request=>{if(/\/auth\/v1\/(otp|token|verify)/.test(request.url()))authRequests++;});
  await page.route('**/api/groq',route=>{
    const payload=route.request().postDataJSON();expect(route.request().headers().authorization).toBeUndefined();
    const content=payload.operation==='parse'?JSON.stringify({name:'Ada Obi',title:'Developer',skills:['JavaScript'],projects:[{name:'Community directory',highlights:['Built accessible search']}]}):'Dear Hiring Manager, I built accessible search for a community directory using JavaScript. I would welcome the opportunity to contribute.';
    return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content}}]})});
  });
  await page.route('**/api/jobs?**',route=>{expect(route.request().headers().authorization).toBeUndefined();return route.fulfill({contentType:'application/json',body:JSON.stringify({data:[{job_id:'guest-job',job_title:'Developer',employer_name:'Example',job_description:'JavaScript and accessible search',job_apply_link:'https://example.com/guest-job'}]})});});
  await context.route('https://example.com/**',route=>route.fulfill({body:'Employer application page'}));
  await page.goto('/');await page.getByRole('button',{name:'Upload my CV and find jobs'}).click();await page.getByRole('button',{name:'Paste CV text',exact:true}).click();
  await page.getByLabel('Your existing CV or rough notes').fill('Ada Obi. Developer. Built accessible community directory search using JavaScript and HTML.');
  await page.getByLabel('I agree to send this CV').check();await page.getByRole('button',{name:'Analyse CV with AI'}).click();
  await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('Ada Obi');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Explore jobs for this profile →'}).click();await page.getByRole('button',{name:'View Developer at Example'}).click();
  await page.getByRole('button',{name:'Cover Letter',exact:true}).click();await page.getByRole('button',{name:'Generate Now',exact:true}).click();
  await expect(page.getByLabel('Editable cover letter')).toHaveValue(/community directory/);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download letter',exact:true}).click();expect((await download).suggestedFilename()).toBe('cover-letter.txt');
  await page.getByRole('button',{name:'Open listing & copy letter',exact:true}).first().click();expect(authRequests).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('jobai_applications'))).toBeNull();
});

test('guest builder is protected before editing and email password login opens it',async({page})=>{
  await page.route('**/auth/v1/token?grant_type=password',route=>{expect(route.request().postDataJSON()).toMatchObject({email:'ada@example.com',password:'test-password-123'});return route.fulfill({contentType:'application/json',body:JSON.stringify(testSession())});});
  await page.goto('/builder?mode=editor');await expect(page.getByRole('heading',{level:1})).toHaveText('Sign in to create or optimise your CV');await expect(page.getByLabel('Full name',{exact:true})).toHaveCount(0);
  await page.getByLabel('Email address').fill('ada@example.com');await page.getByLabel('Password',{exact:true}).fill('test-password-123');await page.getByRole('button',{name:'Sign in and continue →'}).click();
  await expect(page.getByLabel('Full name',{exact:true})).toBeVisible();
});

test('guest signup confirms account then offers ordinary password sign-in',async({page})=>{
  await page.route('**/auth/v1/signup**',route=>{const data=route.request().postDataJSON();expect(data.email).toBe('new@example.com');expect(data.password).toBe('test-password-123');return route.fulfill({contentType:'application/json',body:JSON.stringify({user:{...testUser,email:'new@example.com'},session:null})});});
  await page.goto('/account');await expect(page.getByText(/Sign in to track your progress/)).toBeVisible();await page.getByRole('button',{name:'Sign up',exact:true}).click();
  await page.getByLabel('Email address').fill('new@example.com');await page.getByLabel('Password',{exact:true}).fill('test-password-123');await page.getByLabel('Confirm password').fill('test-password-123');await page.getByRole('button',{name:'Create account →'}).click();
  await expect(page.getByRole('status')).toContainText('sign in here with your email and password, on any device');await expect(page.getByRole('button',{name:'Sign in and continue →'})).toBeVisible();
});

test('workspace shows owned applications and updates reported status',async({page})=>{
  let status='saved';const row={id:'application-1',user_id:testUser.id,job_key:'job-1',job:{id:'job-1',title:'Developer',company:'Example',location:'Nigeria',evidence:{score:77},applyUrl:'https://example.com/job'},profile:{title:'Developer'},cover_letter:'My saved factual letter.',status,updated_at:'2026-10-29T00:00:00Z'};
  await page.route('**/rest/v1/application_activity?**',route=>{
    if(route.request().method()==='PATCH'){status=route.request().postDataJSON().status;return route.fulfill({contentType:'application/json',body:JSON.stringify({...row,status})});}
    return route.fulfill({contentType:'application/json',body:JSON.stringify([{...row,status}])});
  });
  await page.goto('/account');await expect(page.getByRole('heading',{name:'Developer at Example'})).toBeVisible();await expect(page.getByText(/Text evidence match: 77%/)).toBeVisible();
  await page.getByLabel('Status reported by you').selectOption('submitted');await expect(page.getByLabel('Status reported by you')).toHaveValue('submitted');await expect(page.getByText('submitted by you',{exact:false})).toBeVisible();
  await page.getByText('Saved cover letter',{exact:true}).click();await expect(page.getByText('My saved factual letter.')).toBeVisible();
});

test('guest image CV parsing uses vision without an account',async({page})=>{
  await page.route('**/api/groq',route=>{
    const body=route.request().postDataJSON();expect(body.useVision).toBe(true);expect(buildRequest(body).messages[1].content.some(part=>part.type==='image_url')).toBe(true);expect(route.request().headers().authorization).toBeUndefined();
    return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({name:'Ada Image',title:'Developer',skills:['SQL']})}}]})});
  });
  await page.goto('/');await page.getByRole('button',{name:'Upload my CV and find jobs'}).click();
  const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=300;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,300,100);ctx.fillStyle='black';ctx.fillText('Ada Image. Developer. SQL.',10,50);return canvas.toDataURL('image/png').split(',')[1];});
  await page.locator('input[type=file]').setInputFiles({name:'image-cv.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.getByLabel('I agree to send this CV').check();await page.getByRole('button',{name:'Analyse CV with AI'}).click();await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('Ada Image');
});

test('guest can request password recovery without a login link flow',async({page})=>{
  let requests=0;await page.route('**/auth/v1/recover**',route=>{requests++;expect(route.request().postDataJSON().email).toBe('ada@example.com');return route.fulfill({contentType:'application/json',body:'{}'});});
  await page.goto('/account');await page.getByRole('button',{name:'Forgot password?',exact:true}).click();await page.getByLabel('Email address').fill('ada@example.com');await page.getByRole('button',{name:'Send password reset email'}).click();await expect(page.getByRole('status')).toContainText('password reset email');expect(requests).toBe(1);
});

test('guest Google entry is offered only when the provider is enabled',async({page})=>{
  await page.route('**/auth/v1/settings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({external:{email:true,google:true}})}));
  let launched=false;await page.route('**/auth/v1/authorize?**',route=>{const url=new URL(route.request().url());expect(url.searchParams.get('provider')).toBe('google');expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/account');launched=true;return route.fulfill({contentType:'text/html',body:'Google provider handoff fixture'});});
  await page.goto('/account');await page.getByRole('button',{name:'Continue with Google'}).click();await expect(page.getByText('Google provider handoff fixture')).toBeVisible();expect(launched).toBe(true);
});

test('changed account CV saves preserve the previous version',async({page})=>{
  const existing={id:'cv-old',title:'Developer',document:{name:'Ada Original',title:'Developer'},updated_at:'2026-10-29T00:00:00Z'};let posted=false,patched=false;
  await page.route('**/rest/v1/resumes**',route=>{
    if(route.request().method()==='PATCH')patched=true;
    if(route.request().method()==='POST'){posted=true;return route.fulfill({contentType:'application/json',body:JSON.stringify({...existing,...route.request().postDataJSON(),id:'cv-new'})});}
    const single=new URL(route.request().url()).searchParams.has('id');return route.fulfill({contentType:'application/json',body:JSON.stringify(single?existing:[existing])});
  });
  await page.goto('/account');await page.getByRole('button',{name:'Open CV →',exact:true}).click();await page.getByLabel('Full name',{exact:true}).fill('Ada Updated');await page.getByRole('button',{name:'Save to my account',exact:true}).click();
  await expect(page.getByText('A new CV version was saved. Your previous version is in your workspace.',{exact:true})).toBeVisible();expect(posted).toBe(true);expect(patched).toBe(false);
});
