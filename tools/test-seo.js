const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
(async () => {
  const { PAGES, canonicalPath } = await import(pathToFileURL(path.join(root, 'assets/js/pages.mjs')));
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const titles = new Set();
  for (const [route, page] of Object.entries(PAGES)) {
    const html = fs.readFileSync(path.join(root, route === '/' ? 'index.html' : route.slice(1) + '/index.html'), 'utf8');
    const url = 'https://ahnjaeyoung.com' + canonicalPath(route);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.ok(html.includes(`rel="canonical" href="${url}"`));
    assert.ok(sitemap.includes(`<loc>${url}</loc>`));
    assert.ok(!titles.has(page.title), 'Duplicate title');
    titles.add(page.title);
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(schemas.length, 1);
    const schema = JSON.parse(schemas[0][1]);
    const webPage = schema['@graph'].find(item => item['@id'] === url + '#webpage');
    assert.equal(webPage.name, page.title);
    assert.equal(webPage.description, page.description);
    for (const tag of ['twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt', 'robots']) {
      assert.equal((html.match(new RegExp(`name="${tag}"`, 'g')) || []).length, 1, tag);
    }
    assert.ok(html.includes('max-image-preview:large'));
    assert.ok(!html.includes('noindex'));
  }
  const images = [...sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)];
  assert.ok(images.length > 0);
  for (const [, image] of images) assert.ok(fs.existsSync(path.join(root, new URL(image).pathname)), image);
  console.log(`PASS: ${titles.size} unique page titles and schemas, ${images.length} existing sitemap images`);
})().catch(error => { console.error(error); process.exitCode = 1; });
