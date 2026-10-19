import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer,loadEnv} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const env = {...loadEnv('production', process.cwd(), ''), ...process.env};
const origin = new URL(env.VITE_PUBLIC_SITE_URL || 'https://jobai-orpin.vercel.app').origin;
if (!origin.startsWith('https://')) throw new Error('VITE_PUBLIC_SITE_URL must be an HTTPS origin.');
const preview = env.VERCEL_ENV === 'preview';
const server = await createServer({mode:'production',server:{middlewareMode:true, hmr:false, ws:false, watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
try {
  const {default:PublicLayout} = await server.ssrLoadModule('/src/shared/components/PublicLayout.jsx');
  const {default:LandingPage} = await server.ssrLoadModule('/src/features/marketing/LandingPage.jsx');
  const {default:InfoPage} = await server.ssrLoadModule('/src/features/marketing/InfoPage.jsx');
  let template = await readFile('dist/index.html','utf8');
  template = template.replaceAll('https://jobai-orpin.vercel.app', origin);
  const publicPages = [
    {path:'/',name:'RoleAide — CV builder & job search workspace',node:createElement(LandingPage,{navigate:()=>{},onImport:()=>{}})},
    {path:'/privacy',name:'Your data & privacy — RoleAide',node:createElement(InfoPage,{page:'privacy'})},
    {path:'/help',name:'Help & support — RoleAide',node:createElement(InfoPage,{page:'help'})},
  ];
  for (const route of [...publicPages, ...['builder','jobs','account'].map(page=>({path:`/${page}`,name:`${{builder:'CV builder',jobs:'Find jobs',account:'My workspace'}[page]} — RoleAide`,node:null}))]) {
    const canonical = `${origin}${route.path === '/' ? '/' : route.path}`;
    const hidden = preview || !route.node;
    let html = template.replace(/<title>[^<]*<\/title>/,`<title>${route.name}</title>`)
      .replace(/(<link rel="canonical" href=")[^"]*/,`$1${canonical}`)
      .replace(/(<meta property="og:url" content=")[^"]*/,`$1${canonical}`)
      .replace(/<meta name="robots"[^>]*>/,`<meta name="robots" content="${hidden?'noindex,follow':'index,follow'}" data-site-indexing="${preview?'disabled':'enabled'}" />`)
      .replace(/(<meta property="og:title" content=")[^"]*/,`$1${route.name}`)
      .replace(/(<meta name="twitter:title" content=")[^"]*/,`$1${route.name}`);
    if (route.node) {
      const markup = renderToStaticMarkup(createElement(PublicLayout,{route:route.path === '/' ? 'home' : route.path.slice(1)},route.node));
      html = html.replace('<div id="root"></div>',`<div id="root">${markup}</div>`);
    }
    if (route.path === '/') {
      const data = {'@context':'https://schema.org','@graph':[{'@type':'WebSite',name:'RoleAide',url:`${origin}/`,description:'A career workspace for CV creation, job discovery, and application preparation.'},{'@type':'Organization',name:'Philos Digital Labs',url:`${origin}/`},{'@type':'Brand',name:'RoleAide',logo:`${origin}/brand-mark.svg`}]};
      html = html.replace('</head>',`<script type="application/ld+json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script></head>`);
    }
    const directory = route.path === '/' ? 'dist' : `dist${route.path}`;
    await mkdir(directory,{recursive:true});await writeFile(`${directory}/index.html`,html);
  }
  await writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPages.map(route=>`<url><loc>${origin}${route.path}</loc></url>`).join('')}</urlset>\n`);
  await writeFile('dist/site.webmanifest',JSON.stringify({name:'RoleAide',short_name:'RoleAide',description:'A little help. Your next role.',start_url:'/',display:'standalone',background_color:'#F7F5F0',theme_color:'#0B1E3D',icons:[{src:'/favicon-192.png',sizes:'192x192',type:'image/png'},{src:'/favicon-512.png',sizes:'512x512',type:'image/png'}]},null,2));
  console.log('Generated public landing/help/privacy HTML, workspace metadata, sitemap, and manifest.');
} finally {await server.close();}
