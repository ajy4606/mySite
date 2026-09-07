/* Fills the <div data-plates="slug"> containers in index.html from the
   image manifest. Captions are lifted from the original filenames where the
   artist put them there; everything else is left as a marked placeholder. */
const fs = require('fs');
const path = require('path');

/* 폴더를 옮기거나 이름을 바꿔도 따라오도록, 이 스크립트 위치에서 거슬러 올라갑니다.
   (예전에는 C:/Users/USER/Desktop/mySite 로 박아 두어서 폴더를 옮기면 멈췄습니다.) */
const SITE = path.resolve(__dirname, '..');

const manifestPath = path.join(SITE, 'assets/works/manifest.json');
if(!fs.existsSync(manifestPath)){
  console.error('\n  매니페스트가 없습니다: assets/works/manifest.json');
  console.error('  먼저 이미지 처리를 돌리세요:  powershell -File tools\\build-images.ps1\n');
  process.exit(1);
}
let manifestText = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
/* Some PowerShell versions have written the formatted JSON with literal
   "\\n" separators. Accept that legacy form so the layout pipeline remains
   usable without touching the image manifest by hand. */
if(manifestText.startsWith('[\\n')) manifestText = manifestText.replace(/\\n/g, '\n');
const manifest = JSON.parse(manifestText);

const TODO_WORK = '<span class="todo">매체 · 크기 입력</span>';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dim = s => s.replace(/(\d+)\s*[xX×]\s*(\d+)\s*cm/, '$1 × $2 cm');
const fullAttr = item => item.full ? ` data-full="${esc(item.full)}"` : '';
const responsive = item => item.full && item.fullW > item.w
  ? ` srcset="${esc(item.file)} ${item.w}w, ${esc(item.full)} ${item.fullW}w" sizes="auto, (max-width:699px) calc(100vw - 36px), 90vw"`
  : '';

/* 파일 이름이 곧 캡션입니다. 형식은 네 시리즈 모두 같습니다:

     제목, 크기, 매체, 연도.jpg

   제목에 #번호가 있으면 시리즈 번호로, 없으면 개별 제목으로 읽습니다.
     "Midore #21, 30x30cm, Archival Pigment Print, 2024"
       → 《Midore》 #21, 2024 · Archival Pigment Print · 30 × 30 cm
     "Aralia, 100x100cm, Sublimation transfer on metal plate, 2022"
       → 《Aralia》, 2022 · Sublimation transfer on metal plate · 100 × 100 cm

   캡션을 고치려면 index.html이 아니라 images/ 안의 파일 이름을 고치고
   build-images.ps1 → gen-plates.js 를 다시 돌리세요. */
function caption(orig){
  const m = orig.replace(/(\.(jpe?g|png))+$/i, '')
    .match(/^\s*(.+?)\s*,\s*([\dxX×\s]+cm)\s*,\s*([^,]+?)\s*,\s*(\d{4})\s*$/);
  if(!m) return TODO_WORK;

  const [, rawTitle, size, medium, year] = m;
  const hash  = rawTitle.match(/^(.*?)\s*#\s*(\d+)$/);
  const title = esc((hash ? hash[1] : rawTitle).trim());
  const no    = hash ? ` #${hash[2]}` : '';
  return `《${title}》${no}, ${year} · ${esc(medium)} · ${dim(size.replace(/\s+/g, ''))}`;
}

/* `num` is the plate's position on the page, which is not the file number
   once the order has been arranged by hand. */
function plate(item, cls, label, num){
  const ar = (item.w / item.h).toFixed(4);
  const n  = num || item.n;
  const alt = `${item.project.replace(/-/g, ' ')} ${n}`;
  const featured = PROJECT_CLASS[item.project]?.[workNo(item)] || '';
  const classes = [cls, featured].filter(Boolean).join(' ');
  /* --ar sits on the figure too: the Installation grid sizes its rows from it */
  return `        <figure class="plate${classes ? ' ' + classes : ''} rv" style="--ar:${ar}">
          <div class="strata" style="--ar:${ar}" data-src="${item.file}"${fullAttr(item)} data-orig="${esc(item.orig)}">
            <img src="${item.file}"${responsive(item)} alt="${esc(alt)}" loading="lazy" width="${item.w}" height="${item.h}">
          </div>
          <span class="tag">⌖ Delaminate</span>
          <figcaption><span>${caption(item.orig)}</span><span class="no">${label} ${n}</span></figcaption>
        </figure>`;
}

/* Installation views keep only the clickable image. Work captions, figure
   numbers, and treatment labels belong to the artwork pages, not this archive. */
function installationPlate(item, num){
  const ar = (item.w / item.h).toFixed(4);
  const alt = `installation ${num}`;
  return `        <figure class="plate rv" style="--ar:${ar}">
          <div class="strata" style="--ar:${ar}" data-src="${item.file}"${fullAttr(item)} data-orig="${esc(item.orig)}">
            <img src="${item.file}"${responsive(item)} alt="${esc(alt)}" loading="lazy" width="${item.w}" height="${item.h}">
          </div>
        </figure>`;
}

/* rhythm for the single-column project pages */
const CYCLE = ['plate--wide', 'pair', 'plate--right', 'plate--left', 'pair', 'plate--inset'];

/* Midore is edited as a chromatic sequence rather than by file number:
   cold blue -> overgrowth and traces -> warm material -> yellow terrain ->
   living green and water -> monochrome -> night. */
const PROJECT_LAYOUT = {
  'midore': [
    { works:['#1'], cls:'plate--midore-opener' },
    { works:['#3','#5'], pair:'plate-pair--midore-cool' },
    { works:['#2'], cls:'plate--midore-right-large' },
    { works:['#4','#8'], pair:'plate-pair--midore-traces' },
    { works:['#11'], cls:'plate--left' },
    { works:['#7'], cls:'plate--right' },
    { works:['#6','#19'], pair:'plate-pair--midore-material' },
    { works:['#20'], cls:'plate--tall' },
    { works:['#9'], cls:'plate--wide' },
    { works:['#21','#13'], pair:'plate-pair--midore-earth' },
    { works:['#14'], cls:'plate--midore-anchor' },
    { works:['#22'], cls:'plate--midore-right-large' },
    { works:['#23'], cls:'plate--wide' },
    { works:['#12','#18'], pair:'plate-pair--midore-mono' },
    { works:['#24'], cls:'plate--midore-closing' }
  ]
};

function buildProjectLayout(items, layout){
  const byWork = new Map(items.map(x => [workNo(x), x]));
  const used = new Set();
  const out = [];
  let position = 1;
  const pos = () => String(position++).padStart(2, '0');

  for(const group of layout){
    const selected = group.works.map(w => byWork.get(w)).filter(Boolean);
    selected.forEach(x => used.add(x));
    if(selected.length > 1){
      out.push(`        <div class="plate-pair ${group.pair || ''}">`);
      for(const item of selected) out.push(plate(item, '', 'Pl.', pos()).replace(/^/gm, '  '));
      out.push('        </div>');
    }else if(selected.length === 1){
      out.push(plate(selected[0], group.cls || 'plate--wide', 'Pl.', pos()));
    }
  }

  /* New images are never dropped: they enter after the curated sequence and
     can be assigned deliberately on the next edit. */
  for(const item of items){
    if(!used.has(item)) out.push(plate(item, 'plate--wide', 'Pl.', pos()));
  }
  return out.join('\n');
}

/* Pl. 번호는 파일 번호가 아니라 페이지에서의 자리입니다. 자리를 바꾸기 전에는
   둘이 같았지만(파일 01이 첫 도판), PROJECT_ORDER로 순서를 바꾸면 갈라집니다.
   전시 전경이 이미 자리 기준으로 매기고 있어서 작품 페이지도 같게 맞춥니다 —
   그래야 Pl. 01, 02, 03 … 이 끊기지 않고 이어집니다. */
function buildProject(items){
  const layout = PROJECT_LAYOUT[items[0]?.project];
  if(layout) return buildProjectLayout(items, layout);
  const out = [];
  let i = 0, c = 0;
  const pos = () => String(i + 1).padStart(2, '0');
  while(i < items.length){
    const step = CYCLE[c++ % CYCLE.length];
    if(step === 'pair' && i + 1 < items.length){
      const pairKey = `${items[i].project}:${workNo(items[i])}|${workNo(items[i+1])}`;
      const pairClass = PROJECT_PAIR_CLASS[pairKey] || '';
      out.push(`        <div class="plate-pair${pairClass ? ' ' + pairClass : ''}">`);
      out.push(plate(items[i], '', 'Pl.', pos()).replace(/^/gm, '  ')); i++;
      out.push(plate(items[i], '', 'Pl.', pos()).replace(/^/gm, '  ')); i++;
      out.push('        </div>');
    }else{
      out.push(plate(items[i], step === 'pair' ? 'plate--inset' : step, 'Pl.', pos())); i++;
    }
  }
  return out.join('\n');
}

/* 작품 페이지 안에서 손으로 맞춰 둔 자리.
   기본은 작품 번호순인데, 그 순서가 아닌 자리에 두고 싶을 때만 여기에 적습니다.
   여기 적은 것이 먼저, 나머지는 원래 순서대로 뒤에 붙습니다.

   ⚠ index.html을 직접 고쳐서 자리를 바꾸면 다음 실행 때 지워집니다.
      자리 바꾸기는 반드시 여기에 적어 두세요.

   번호는 파일 번호(01, 02 …)가 아니라 작품 번호(#7, #35 …)로 씁니다.
   파일 번호는 이미지를 하나 추가하면 전부 밀려서 바뀌지만, 작품 번호는
   그대로라 이 목록이 깨지지 않습니다.

   황곡: 《황곡》 #7을 맨 앞으로(#3과 맞바꿈), #36을 #35보다 앞으로. */
const PROJECT_ORDER = {
  'hwanggok': ['#7', '#6', '#3', '#9', '#21', '#22', '#25', '#34', '#36', '#35'],
  'midore': ['#1','#3','#5','#2','#4','#8','#11','#7','#6','#19','#20','#9','#21','#13','#14','#22','#23','#12','#18','#24']
};

/* A small number of plates need a deliberate scale outside the repeating
   layout cycle. Keep that decision in the generator so rebuilding index.html
   does not silently return the work to its former size. */
const PROJECT_CLASS = {
  'hwanggok': { '#9': 'plate--feature' }
};

/* Midore #11 and #12 form an editorial transition: the second work carries
   more width while the pair shares a lower baseline instead of forcing equal
   image heights. */
const PROJECT_PAIR_CLASS = {};

/* 원본 파일 이름 앞머리의 "… #7, 60x80cm, …" 에서 작품 번호를 읽습니다. */
function workNo(item){
  const m = String(item.orig || '').split(',')[0].match(/#\s*(\d+)\s*$/);
  return m ? '#' + m[1] : null;
}

function applyOrder(slug, items){
  const want = PROJECT_ORDER[slug];
  if(!want) return items;

  const byWork = new Map();
  for(const x of items){ const w = workNo(x); if(w && !byWork.has(w)) byWork.set(w, x); }

  const seen = new Set();
  const seq  = [];
  for(const w of want){
    const hit = byWork.get(w);
    if(hit){ seq.push(hit); seen.add(hit.n); }
    else console.log(`  (자리 지정 ${w} — 그런 작품 번호가 없어 건너뜁니다)`);
  }
  for(const x of items){ if(!seen.has(x.n)) seq.push(x); }
  return seq;
}

/* 전시 전경 순서 — www.ahnjaeyoung.com/installation 의 배열을 따릅니다.
   포스터를 따로 모으지 않고 전시별로 사이사이 두는 것이 작가님 배열입니다
   (포스터 → 그 전시의 전경). 여기 없는 번호는 뒤에 번호순으로 붙습니다.
   새 이미지를 넣어 순서를 바꾸려면 이 배열만 고치세요. */
/* Installation originals are named 1.jpg, 2.jpg, ... and may include a
   variant such as 16_2.jpg. Keep the newest/highest number first without a
   hand-maintained list, so newly added photographs land in the right place. */
function installationOrder(item){
  const m = String(item.orig || '').match(/^(\d+)(?:[_-](\d+))?/);
  return m ? [Number(m[1]), Number(m[2] || 0)] : [-1, -1];
}

function buildInstallation(items){
  const seq = [...items].sort((a, b) => {
    const ak = installationOrder(a), bk = installationOrder(b);
    return bk[0] - ak[0] || bk[1] - ak[1] || String(b.orig).localeCompare(String(a.orig));
  });
  return seq.map((x, i) => installationPlate(x, String(i + 1).padStart(2, '0'))).join('\n');
}

/* 전시 전경은 순서와 캡션을 손으로 맞춰 둔 상태라 기본으로는 건드리지 않습니다.
   전경을 다시 만들어야 할 때만:  node tools/gen-plates.js installation   */
const only = process.argv.slice(2);
const targets = only.length ? only : ['midore', 'full-metal-plant', 'hwanggok-colorized', 'hwanggok'];

const byProject = {};
manifest.forEach(m => { if(targets.includes(m.project)) (byProject[m.project] ||= []).push(m); });

let html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
let filled = 0;

/* 컨테이너 안에는 이미 <div class="strata"> 같은 중첩 div가 들어 있습니다.
   여는 태그부터 div를 세어 짝이 맞는 </div>를 찾아야 합니다 — 게으른 정규식으로
   자르면 첫 번째 </div>에서 끊겨 마크업이 망가집니다. */
function replaceContainer(src, slug, body){
  const open = new RegExp(`<div class="(?:plates|inst)" data-plates="${slug}">`);
  const m = open.exec(src);
  if(!m) return null;

  const from = m.index + m[0].length;
  const tag  = /<div\b|<\/div>/g;
  tag.lastIndex = from;
  let depth = 1, hit;
  while((hit = tag.exec(src))){
    depth += hit[0] === '</div>' ? -1 : 1;
    if(depth === 0) return src.slice(0, from) + '\n' + body + '\n      ' + src.slice(hit.index);
  }
  return null;
}

for(const [slug, items] of Object.entries(byProject)){
  const body = slug === 'installation' ? buildInstallation(items) : buildProject(applyOrder(slug, items));
  const next = replaceContainer(html, slug, body);
  if(next === null){ console.log('!! no container for ' + slug); continue; }
  html = next;
  filled++;
  console.log(`${slug}: ${items.length} plates`);
}

/* Covers, preloads, and thumbnails must leave the old 30-day image cache too.
   Content hashes change only when the exported bytes change. */
const assetVersions = new Map();
for(const item of manifest){
  for(const url of [item.file, item.thumb, item.full]){
    if(url) assetVersions.set(url.split('?')[0], url);
  }
}
function refreshAssetVersions(text){
  return text.replace(/assets\/works\/[a-z-]+\/\d+(?:-sm|-full)?\.jpg(?:\?v=[a-zA-Z0-9-]+)?/g,
    url => assetVersions.get(url.split('?')[0]) || url);
}
html = refreshAssetVersions(html);
const mainPath = path.join(SITE, 'assets/js/main.js');
const main = fs.readFileSync(mainPath, 'utf8');
const refreshedMain = refreshAssetVersions(main);
if(main !== refreshedMain) fs.writeFileSync(mainPath, refreshedMain, 'utf8');
fs.writeFileSync(path.join(SITE, 'index.html'), html, 'utf8');
console.log('containers filled: ' + filled);
