import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

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
    expect(route.request().postDataJSON().operation).toBe('parse');
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
