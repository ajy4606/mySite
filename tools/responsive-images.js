const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const variants = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/works/responsive.json'), 'utf8'));
// Upper bounds for the artwork column; the browser also accounts for pixel density.
const SIZES = '(max-width:640px) calc(100vw - 36px), (max-width:1100px) 93vw, (max-width:1500px) 88vw, 1320px';
function addResponsiveImages(html){
  return html.replace(/<img\b[^>]*>/g, tag => {
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    const candidates = variants[src?.split('?')[0]];
    if(!candidates) return tag;
    // Thumbnails remain thumbnails; never include zoom originals in srcset.
    tag = tag.replace(/\s(?:srcset|sizes)="[^"]*"/g, '');
    return tag.replace('>', ` srcset="${candidates.map(x => `${x.src} ${x.width}w`).join(', ')}" sizes="${SIZES}">`);
  });
}
module.exports = { addResponsiveImages };
