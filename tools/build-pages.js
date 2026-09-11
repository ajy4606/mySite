/* Generate crawlable pages from the maintained index.html, without duplicating
   editorial work. Run after gen-plates.js and bump.ps1, before preview/deploy. */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://ahnjaeyoung.com';
const esc = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

(async () => {
  const { PAGES, canonicalPath, resolvePage, pageSchema } = await import(pathToFileURL(path.join(ROOT, 'assets/js/pages.mjs')));
  let source = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // Mechanical migration is idempotent. Old incoming hash URLs remain supported
  // by the router; outgoing links are useful even without JavaScript.
  source = source.replace(/href="#\/([^"]*)"/g, (all, tail) => {
    const route = resolvePage(new URL('/' + tail, DOMAIN));
    return route ? `href="${canonicalPath(route.path)}${route.search}"` : all;
  });
  source = source.replace(/<a href="\/">(<span class="k">← Index<\/span>)/g, '<a href="/#works">$1');
  for(const slug of ['midore', 'full-metal-plant', 'hwanggok-colorized', 'hwanggok']){
    const start = source.indexOf(`id="v-${slug}"`);
    const end = source.indexOf('</section>', start);
    const section = source.slice(start, end).replace(/<div class="stmt grid12"(?: id="[^"]+")?>/, `<div class="stmt grid12" id="${slug}-note">`);
    source = source.slice(0, start) + section + source.slice(end);
  }
  function render(route){
    const page = PAGES[route];
    const row = source.match(new RegExp(`<a\\b[^>]*data-work="v-${page.work}"[^>]*>`));
    const image = row?.[0].match(/data-peek="([^"]+)"/)?.[1];
    if(!image) throw new Error(`Missing share image: ${route}`);
    const url = DOMAIN + canonicalPath(route);
    const shareImage = new URL(image, DOMAIN + '/').href;
    const extra = `<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:site_name" content="안재영 Ahn Jaeyoung">
<meta property="og:image:alt" content="${esc(page.title)}">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${esc(shareImage)}">
<meta name="twitter:image:alt" content="${esc(page.title)}">`;
    return source
      .replace(/<!-- SEO extras -->[\s\S]*?<!-- \/SEO extras -->\s*/g, '')
      .replace('</head>', `<!-- SEO extras -->\n${extra}\n<!-- /SEO extras -->\n</head>`)
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(pageSchema(route, shareImage)).replace(/</g, '\\u003c')}</script>`)
      .replace(/<section class="view(?: active)?" id="([^"]+)"/g, (_, id) => `<section class="view${id === page.id ? ' active' : ''}" id="${id}"`)
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(page.description)}"`)
      .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`)
      .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(page.title)}"`)
      .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(page.description)}"`)
      .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
      .replace(/(<meta property="og:image" content=")[^"]*"/, `$1${esc(new URL(image, DOMAIN + '/').href)}"`)
      .replace(/<link rel="preload" as="image" href="[^"]+">/, `<link rel="preload" as="image" href="${image}">`);
  }
  let changed = 0;
  function output(file, text){
    const target = path.join(ROOT, file);
    if(fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) return;
    changed++;
    if(process.argv.includes('--check')) throw new Error(`Generated file out of date: ${file}`);
    fs.mkdirSync(path.dirname(target), { recursive:true });
    fs.writeFileSync(target, text);
  }
  for(const route of Object.keys(PAGES)) output(route === '/' ? 'index.html' : route.slice(1) + '/index.html', render(route));
  output('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    Object.keys(PAGES).map(route => {
      const start = source.indexOf(`id="${PAGES[route].id}"`);
      const section = source.slice(start, source.indexOf('</section>', start));
      const images = [...new Set([...section.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/g)].map(m => new URL(m[1].split('?')[0], DOMAIN + '/').href))];
      return `  <url><loc>${DOMAIN + canonicalPath(route)}</loc>${images.map(src => `<image:image><image:loc>${esc(src)}</image:loc></image:image>`).join('')}</url>`;
    }).join('\n') + '\n</urlset>\n');
  console.log(`Static pages: ${Object.keys(PAGES).length}; updated: ${changed}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
