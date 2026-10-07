// Non-browser regression checks: generated routes, original plate sequences,
// links/anchors, contact opt-out, and URL compatibility. node tools/test-site.js
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
(async () => {
  const { PAGES, resolvePage, canonicalPath } = await import(pathToFileURL(path.join(ROOT, 'assets/js/pages.mjs')));
  const html = read('index.html');
  // Zoom originals must only load after opening a viewer, even on retina screens.
  for(const image of html.matchAll(/<img\b[^>]*>/g)){
    assert.ok(!/\b(?:src|srcset)="[^"]*-full\.jpg/.test(image[0]), 'Zoom original used in page image');
    const srcset = image[0].match(/\bsrcset="([^"]+)"/)?.[1];
    if(srcset){
      const widths = new Set();
      for(const entry of srcset.split(',')){
        const [src, width] = entry.trim().split(/\s+/);
        assert.ok(fs.existsSync(path.join(ROOT, src.split('?')[0])), `Missing responsive image: ${src}`);
        assert.ok(/^\d+w$/.test(width), `Invalid width descriptor: ${width}`);
        assert.ok(!widths.has(width), `Duplicate responsive width: ${width}`);
        widths.add(width);
      }
      assert.ok(image[0].includes(' sizes="'), 'Responsive image lacks layout sizes');
    }
  }
  for(const [route, page] of Object.entries(PAGES)){
    const file = route === '/' ? 'index.html' : route.slice(1) + '/index.html';
    const generated = read(file);
    assert.equal((generated.match(/class="view active"/g) || []).length, 1, file);
    assert.ok(generated.includes(`class="view active" id="${page.id}"`), file);
    assert.ok(generated.includes(`rel="canonical" href="https://ahnjaeyoung.com${canonicalPath(route)}"`), file);
    assert.ok(generated.includes(page.description), file);
    for(const url of [route, canonicalPath(route), '#' + route]){
      assert.equal(resolvePage(new URL(url, 'https://ahnjaeyoung.com/')).path, route, url);
    }
  }
  assert.equal(resolvePage(new URL('https://ahnjaeyoung.com/no-such-page')), null);
  for(const old of ['/bio', '/contact']) assert.equal(resolvePage(new URL(old, 'https://ahnjaeyoung.com')).path, '/info');
  for(const match of html.matchAll(/href="(\/[^"\s]*)"/g)){
    const url = new URL(match[1].replace(/&amp;/g, '&'), 'https://ahnjaeyoung.com');
    const route = resolvePage(url);
    assert.ok(route, `Unknown local link ${url}`);
    if(route.anchor) assert.ok(html.includes(`id="${route.anchor}"`), `Missing anchor ${url}`);
  }
  assert.ok(!/href="(?:mailto:|https?:\/\/(?:www\.)?instagram\.com)/i.test(html), 'Contact links must stay absent');
  for(const slug of ['midore','full-metal-plant','hwanggok-colorized','hwanggok']){
    assert.ok(html.includes(`id="${slug}-note"`));
    const start = html.indexOf(`id="v-${slug}"`);
    const header = html.slice(start, html.indexOf('</header>', start));
    assert.deepEqual([...header.matchAll(/<dt>([^<]+)<\/dt>/g)].map(match => match[1]), ['Year', 'Process'], `${slug} detail metadata`);
    assert.ok(!header.includes('class="project-summary"'), `${slug} ambiguous detail summary returned`);
    assert.ok(header.includes('class="context-links"'), `${slug} context links missing`);
  }
  // The review did not authorize changing any artwork or installation order.
  const before = execFileSync('git', ['show', '90351a8:index.html'], { cwd:ROOT, encoding:'utf8', maxBuffer:2e6 });
  const plates = text => [...text.matchAll(/<div class="strata"[^>]+>/g)].map(m => m[0]);
  assert.deepEqual(plates(html), plates(before), 'Original plate sources, dimensions and order changed');
  const css = read('assets/css/site.css');
  assert.ok(!/filter:grayscale\(\.(?:12|16|1|3)\)/.test(css), 'Unexpected thumbnail color filter');
  assert.ok(!/\.card:hover\s/.test(css), 'Grid hover treatment returned');
  assert.ok(css.includes('.plate .tag{display:none}'), 'Artwork hover badge returned');
  assert.ok(!/\.strata:hover::after/.test(css), 'Artwork hover frame returned');
  assert.ok(css.includes('h1[tabindex="-1"]:focus{outline:none}'), 'Programmatic heading focus outline returned');
  assert.ok(!/\.layer-stack:hover li[^\{]*\{[^}]*transform/.test(css), 'Layer hover movement returned');
  const viewer = read('assets/js/gl/delaminate.js');
  assert.ok(!viewer.includes('isMobileViewer()'), 'Touch handling still depends on viewport width');
  assert.ok(viewer.includes('role="slider"'));
  const errorPage = read('404.html');
  assert.ok(errorPage.includes('href="/#works"') && errorPage.includes('href="/"'), '404 recovery links missing');
  assert.ok(errorPage.includes('content="noindex"'), '404 page should not be indexed');
  console.log(`PASS: ${Object.keys(PAGES).length} routes, legacy URLs, anchors, contact opt-out, ${plates(html).length} unchanged plates, viewer and color guards`);
})().catch(error => { console.error(error); process.exitCode = 1; });
