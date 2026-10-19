import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const home = await readFile('dist/index.html','utf8');
assert.match(home,/You have a story/,'Landing copy must be in built HTML, not only JavaScript.');
assert.match(home,/RoleAide/);assert.match(home,/application\/ld\+json/);
assert.match(home,/og-image\.png/);assert.match(home,/<a[^>]+href="\/jobs"/);
for (const route of ['builder','jobs','account']) {
 const html=await readFile(`dist/${route}/index.html`,'utf8');
 assert.match(html,/<meta name="robots" content="noindex,follow"/);
 assert.doesNotMatch(html,/You have a story/,'Workspace entries must not contain a rendered public landing page.');
}
for (const route of ['help','privacy']) assert.match(await readFile(`dist/${route}/index.html`,'utf8'),/<main /);
const sitemap=await readFile('dist/sitemap.xml','utf8');assert.match(sitemap,/\/privacy/);assert.doesNotMatch(sitemap,/\/builder|\/account|\/jobs/);
for(const [file,size] of [['favicon-32.png',32],['apple-touch-icon.png',180],['favicon-192.png',192],['favicon-512.png',512]]) {
 const bytes=await readFile(`dist/${file}`);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
}
const image=await readFile('dist/og-image.png');assert.equal(image.readUInt32BE(16),1200);assert.equal(image.readUInt32BE(20),630);
assert.equal(JSON.parse(await readFile('dist/site.webmanifest','utf8')).name,'RoleAide');
console.log('Public HTML, private workspace indexing, sitemap, manifest, and brand asset sizes verified.');
