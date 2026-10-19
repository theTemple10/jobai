import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { buildRequest } from '../../api/groq.js';

test('landing and builder fit mobile widths and respect reduced motion', async ({ page }) => {
  for (const width of [320,375,768,1440]) {
    await page.setViewportSize({width,height:900});await page.goto('/');
    await expect(page.getByRole('heading',{level:1})).toContainText('You have a story');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.paper-pal').evaluate(element=>parseFloat(getComputedStyle(element).animationDuration))).toBeLessThan(0.1);
    if (width === 1440) await page.screenshot({path:'/tmp/jobai-landing-desktop.png',fullPage:true});
    if (width === 375) await page.screenshot({path:'/tmp/jobai-landing-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Build my CV'}).click();
    await expect(page.getByRole('heading',{level:1})).toHaveText('Let’s tell your story.');
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
  await page.goto('/#/builder');await page.getByRole('button',{name:'Import an existing CV'}).click();
  await page.locator('input[type=file]').setInputFiles({name:'existing-cv.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer});
  await page.getByLabel('I agree to send this CV').check();await page.getByRole('button',{name:'Analyse CV with AI'}).click();
  await expect(page.getByLabel('Full name')).toHaveValue('Ada Obi');
  await expect(page.getByLabel('Target role',{exact:true})).toHaveValue('Frontend Developer');
});

test('opened listing becomes submitted only after user confirmation',async({page,context})=>{
  await page.addInitScript(()=>{localStorage.setItem('jobai_step','3');localStorage.setItem('jobai_profile',JSON.stringify({name:'Ada',title:'Developer',skills:['Python'],jobTitles:['Developer']}));});
  await page.route('**/api/jobs?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({data:[{job_id:'role-1',job_title:'Python Developer',employer_name:'Community Labs',job_description:'Build Python tools for community services.',job_apply_link:'https://example.com/jobs/role-1'}]})}));
  await context.route('https://example.com/**',route=>route.fulfill({body:'Application page'}));
  await page.goto('/#/jobs');await page.getByRole('button',{name:'View Python Developer at Community Labs'}).click();
  await page.getByRole('button',{name:'Apply on'}).click();
  await expect(page.getByText('↗ Opened',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Application activity'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByText('Opened listing',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'I submitted this application'}).click();
  await expect(page.getByText('Submitted (confirmed by you)',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a first CV exports selectable PDF and editable DOCX from reviewed facts', async ({page}) => {
  await page.goto('/#/builder');
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
  await page.goto('/#/builder');await page.getByLabel('Full name').fill('Saved candidate');
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
  await page.goto('/builder');
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
  await page.goto('/builder');await page.getByRole('link',{name:'Skip to content'}).focus();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/builder$/);await expect(page.locator('main')).toBeFocused();
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
  await page.goto('/builder');await page.getByLabel('Full name',{exact:true}).fill('Ada Obi');
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
  await expect(page.getByText('No listings came back this time.')).toBeVisible();expect(requests).toHaveLength(1);expect(requests[0]).toContain('remote_jobs_only=true');
});

test('restored cover letters retain preparation actions and project evidence',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('jobai_step','3');localStorage.setItem('jobai_profile',JSON.stringify({name:'Ada',title:'Developer',skills:['Python'],jobTitles:['Developer'],projects:[{name:'Community tool',highlights:['Built accessible search']}]}));localStorage.setItem('jobai_letter_role-1',JSON.stringify('Dear Hiring Manager, I build Python tools.'));});
  await page.route('**/api/jobs?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({data:[{job_id:'role-1',job_title:'Developer',employer_name:'Community Labs',job_description:'Python development'}]})}));
  await page.route('**/api/groq',route=>{const payload=route.request().postDataJSON();expect(payload.messages[0].content).toContain('Built accessible search');return route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:'A reviewed letter.'}}]})});});
  await page.goto('/jobs');await page.getByRole('button',{name:'View Developer at Community Labs'}).click();
  await expect(page.getByRole('button',{name:'Open listing & copy letter',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Regenerate',exact:false}).click();await page.getByLabel('Editable cover letter').waitFor();
  await expect(page.getByLabel('Editable cover letter')).toHaveValue('A reviewed letter.');
});

test('returning visitors can deliberately import a different CV',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('jobai_step','3');localStorage.setItem('jobai_profile',JSON.stringify({title:'Developer',skills:[]}));});
  await page.goto('/');await page.getByRole('button',{name:'I already have a CV'}).click();
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
  await page.setViewportSize({width:375,height:900});await page.goto('/builder');
  await page.getByRole('button',{name:'Review & download'}).click();await page.getByLabel('I have reviewed this CV').check();await expect(page.getByRole('button',{name:'Download PDF'})).toBeDisabled();
  await page.getByRole('button',{name:'Contact & target role'}).click();await page.getByLabel('Full name',{exact:true}).fill('Ada Obi');
  await page.getByRole('button',{name:'Preview my CV',exact:true}).click();await expect(page.getByRole('heading',{name:'Ada Obi',exact:true})).toBeVisible();
  await expect(page.getByLabel('CV editor')).toBeHidden();await page.getByRole('button',{name:'Edit my CV',exact:true}).click();await expect(page.getByLabel('Full name',{exact:true})).toBeVisible();
});

test('sign-in recovery copies restore only in their short recovery window',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('jobai_auth_handoff',JSON.stringify({document:{name:'Recovery candidate',title:'Developer'},cloudId:null,at:Date.now()})));
  await page.goto('/builder');await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Recovery candidate');
  expect(await page.evaluate(()=>localStorage.getItem('jobai_auth_handoff'))).toBeNull();
});
