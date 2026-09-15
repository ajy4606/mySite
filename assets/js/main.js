/* ============================================================
   main.js — routing, motion, and the plate interactions
   ============================================================ */

/* Bump this query whenever stack.js changes — assets are served with a
   one-hour cache and browsers will otherwise keep the old module. */
import { createStack }  from './gl/stack.js?v=20260915';
import { viewer }       from './gl/delaminate.js?v=20260915';
import { PAGES, canonicalPath, resolvePage, pageSchema } from './pages.mjs?v=20260915';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a,b,t) => a + (b-a)*t;

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- the stack shown on the index -------------------------------------- */
/* Each series comes apart in its own language rather than every plate
   resolving into the same screen. Keep MODES, WORKS and the stage labels in
   delaminate.js in step if a series is added. */
/* 0 dither · 1 chroma peel · 2 data · 3 metal · 4 pixel · 5 none · 6 contour · 7 streak · 8 afterimage */
const MODES = {
  'v-hwanggok':           7,   // streak — supersedes contour (mode 6, kept in shaders.js but unused)
  'v-hwanggok-colorized': 1,   // chroma peel — the generated colour lifts off the capture
  'v-midore':             8,   // afterimage — whole-image temporal layers, no RGB/pixel split
  'v-full-metal-plant':   3,   // metal
  'v-installation':       5    // none — documentation, left untouched
};
const MODE_NONE = 5;

/* `src` is the cover — the artist's pick for each series, not necessarily its
   first plate. Changing one means changing it in three places: here, and the
   index row's data-peek + thumb and the grid card in index.html. Midore's is
   also the share image, so og:image and the preload hint follow it too. */
/* `meta` says what each work is made of — nothing else. It used to mix
   registers: a year for one, a process for another, an award for a third,
   so the five captions did not read as one list. Years live on the project
   page, the award lives there and in the CV. */
const WORKS = [
  { title:'Midore',             kr:'미도래',          meta:'Photograph · 3D render · Generative model', mode:8, src:'assets/works/midore/13.jpg?v=072b6cc01d4d',             href:'#/midore' },              // Midore #14
  { title:'Full Metal Plant',   kr:'풀 메탈 플랜트',   meta:'Generative model · 3D render',              mode:3, src:'assets/works/full-metal-plant/01.jpg?v=ec2a35391f12',   href:'#/full-metal-plant' },    // Full Metal Plant #1
  { title:'Hwanggok_Colorized', kr:'황곡_컬러라이즈드', meta:'Generative colorization',                   mode:1, src:'assets/works/hwanggok-colorized/05.jpg?v=e3e0a257c98a', href:'#/hwanggok-colorized' },  // Hwanggok_Colorized #11
  { title:'Hwanggok',           kr:'황곡',            meta:'Program-generated · Cut & assembly',        mode:7, src:'assets/works/hwanggok/03.jpg?v=fec1ee68a895',           href:'#/hwanggok' },            // Hwanggok #7
  { title:'Installation',       kr:'전시 전경',        meta:'Exhibition views',                          mode:5, src:'assets/works/installation/26.jpg',       href:'#/installation' }         // Installation Fig. 17
];

/* ---- conceptual threads -------------------------------------------------
   Drawn from the artist's own statements rather than invented categories:
   the unit (dot / pixel / data), indexicality, the generative model,
   the plausible falsehood, and materiality.
   ------------------------------------------------------------------------ */
const THREADS = {
  unit:       { ko:'단위 — 점·픽셀·데이터', en:'Unit — dot, pixel, data' },
  index:      { ko:'지표성',              en:'Indexicality' },
  generative: { ko:'생성 모델',            en:'Generative model' },
  fiction:    { ko:'그럴듯한 허위',         en:'Plausible falsity' },
  material:   { ko:'물성',                en:'Materiality' }
};

/* ============================================================
   1. language
   ============================================================ */
/* v2 intentionally resets the old browser-language default once. New visitors
   start in Korean; after that, an explicit KO/EN choice is remembered. */
const LANG_KEY = 'ajy-lang-v2';

function currentLang(){
  return document.documentElement.getAttribute('data-lang') || 'ko';
}

function setLang(l){
  const doc = document.documentElement;
  doc.setAttribute('data-lang', l);
  doc.setAttribute('lang', l === 'en' ? 'en' : 'ko');
  $$('.lang-tog button').forEach(b => b.classList.toggle('on', b.dataset.lang === l));
  try{ localStorage.setItem(LANG_KEY, l); }catch(e){}
  /* the hero caption is composed in JS, so it does not follow the .l-ko/.l-en
     spans the rest of the page uses and has to be repainted by hand */
  if(stack) stack.refresh();
  requestAnimationFrame(() => { measure(); paintStrata(); });
}

function initLang(){
  let saved = null;
  try{ saved = localStorage.getItem(LANG_KEY); }catch(e){}
  setLang(saved === 'ko' || saved === 'en' ? saved : 'ko');
  $$('.lang-tog button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
}

/* text as the reader currently sees it — the other language is in the DOM
   too, so a plain textContent would return both at once */
function visibleText(el){
  if(!el) return '';
  const clone = el.cloneNode(true);
  clone.querySelectorAll(currentLang() === 'ko' ? '.l-en' : '.l-ko').forEach(n => n.remove());
  // adjacent elements carry no whitespace in the markup, so a plain
  // textContent would run "…입력" straight into "Pl. 01"
  clone.querySelectorAll('*').forEach(n => n.insertAdjacentText('afterend', ' '));
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

/* ============================================================
   2. router
   ============================================================ */
const ROUTES = {
  '/':                    'v-home',
  '/midore':              'v-midore',
  '/full-metal-plant':    'v-full-metal-plant',
  '/hwanggok-colorized':  'v-hwanggok-colorized',
  '/hwanggok':            'v-hwanggok',
  '/installation':        'v-installation',
  '/texts':               'v-texts',
  '/text-sajinbipyeong':  'v-text-sajinbipyeong',
  '/text-midorepreface':  'v-text-midorepreface',
  '/info':                'v-info',
  '/bio':                 'v-info',        // legacy
  '/contact':             'v-info'         // legacy
};
const NAV_FOR = {
  'v-home':'#/', 'v-midore':'#/', 'v-full-metal-plant':'#/',
  'v-hwanggok-colorized':'#/', 'v-hwanggok':'#/',
  'v-installation':'#/installation',
  'v-texts':'#/texts', 'v-text-sajinbipyeong':'#/texts', 'v-text-midorepreface':'#/texts',
  'v-info':'#/info'
};

let currentView = null;
let stack = null;
let routeTimer = 0, routing = false, homeScroll = 0;
let closeMenu = () => {};

function parseHash(){
  const route = resolvePage(new URL(location.href)) || { path:'/', search:'', anchor:'' };
  return { ...route, params:new URLSearchParams(route.search) };
}

function rememberScroll(){
  if(routing || !currentView || document.body.classList.contains('is-locked')) return;
  if(currentView === 'v-home') homeScroll = window.scrollY;
  history.replaceState({ ...history.state, scrollY:window.scrollY }, '', location.href);
}

function updatePageMeta(path){
  const page = PAGES[path];
  if(!page) return;
  document.title = page.title;
  const url = 'https://ahnjaeyoung.com' + canonicalPath(path);
  $('link[rel="canonical"]').href = url;
  $('meta[property="og:url"]').content = url;
  $('meta[property="og:title"]').content = page.title;
  $('meta[name="description"]').content = page.description;
  $('meta[property="og:description"]').content = page.description;
  const image = $(`#idx-list [data-work="v-${page.work}"]`)?.dataset.peek;
  if(image){
    const shareImage = new URL(image, 'https://ahnjaeyoung.com/').href;
    $('meta[property="og:image"]').content = shareImage;
    $('meta[name="twitter:image"]').content = shareImage;
    $('script[type="application/ld+json"]').textContent = JSON.stringify(pageSchema(path, shareImage));
  }
  for(const name of ['twitter:title', 'twitter:image:alt']) $(`meta[name="${name}"]`).content = page.title;
  $('meta[property="og:image:alt"]').content = page.title;
  $('meta[name="twitter:description"]').content = page.description;
}

function render(instant, options = {}){
  clearTimeout(routeTimer);
  const { path, params, anchor } = parseHash();
  const id = ROUTES[path];
  const returningHome = id === 'v-home' && currentView && currentView !== id;
  const position = () => {
    if(options.restore != null){
      window.scrollTo({ top:options.restore, behavior:'instant' });
    }else if(anchor){
      const target = document.getElementById(anchor);
      if(returningHome && anchor === 'works' && homeScroll > 0) window.scrollTo({ top:homeScroll, behavior:'instant' });
      else target?.scrollIntoView({ behavior:instant ? 'instant' : 'smooth', block:'start' });
    }else window.scrollTo({ top:0, behavior:'instant' });
    if(params.has('t')) applyThreadFocus(params.get('t'));
  };

  if(id === currentView){
    routing = false;
    document.body.classList.remove('is-leaving');
    if(options.position) position();
    return;
  }

  routing = true;
  const swap = () => {
    $$('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(id);
    if(el) el.classList.add('active');
    currentView = id;

    updatePageMeta(path);
    const navHash = NAV_FOR[id] || '#/';
    $$('.nav a, .mmenu a').forEach(a => a.classList.toggle('on', resolvePage(new URL(a.href))?.path === navHash.slice(1)));

    document.body.classList.remove('is-leaving');

    if(id === 'v-home'){ stack && stack.resume(); if(!params.has('t')) clearThreadFocus(); }
    else                 stack && stack.pause();

    bindView(el);
    requestAnimationFrame(() => {
      measure(); paintStrata(); position(); routing = false;
      if(!instant){
        const heading = $('h1', el);
        if(heading){ heading.tabIndex = -1; heading.focus({ preventScroll:true }); }
      }
    });
  };

  if(instant || REDUCED){ swap(); return; }
  document.body.classList.add('is-leaving');
  routeTimer = setTimeout(swap, 190);
}

function normalizeLegacyURL(){
  if(!location.hash.startsWith('#/')) return;
  const route = parseHash();
  history.replaceState(history.state, '', canonicalPath(route.path) + route.search);
}

function initNavigation(){
  history.scrollRestoration = 'manual';
  normalizeLegacyURL();
  let navigationURL = location.href;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if(!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href);
    if(url.origin !== location.origin) return;
    const route = resolvePage(url);
    if(!route) return;
    e.preventDefault();
    rememberScroll(); closeMenu(false);
    const href = canonicalPath(route.path) + route.search + (route.anchor ? '#' + route.anchor : '');
    if(href !== location.pathname + location.search + location.hash) history.pushState({ scrollY:0 }, '', href);
    navigationURL = location.href;
    render(false, { position:true });
  });
  window.addEventListener('popstate', e => {
    closeMenu(false);
    normalizeLegacyURL();
    // A viewer entry has the same route. Its own Back handler closes it;
    // do not move the document behind the lightbox.
    const changed = navigationURL !== location.href;
    navigationURL = location.href;
    if(changed || ROUTES[parseHash().path] !== currentView) render(false, { restore:e.state?.scrollY ?? 0, position:true });
  });
  window.addEventListener('hashchange', () => {
    if(location.hash.startsWith('#/')){ normalizeLegacyURL(); navigationURL = location.href; render(false, { position:true }); }
  });
}

/* ============================================================
   3. reveal on scroll
   ============================================================ */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(e.isIntersecting){ e.target.classList.add('in'); revealIO.unobserve(e.target); }
  });
}, { rootMargin:'0px 0px -8% 0px', threshold:0.04 });

/* ============================================================
   4. strata — plates delaminate away from the viewport centre
   ============================================================ */
let strata = [];
const SEP_MAX = 9;
const MOBILE_PLAIN = window.matchMedia('(max-width:820px), (hover:none) and (pointer:coarse)').matches;
/* Keep artwork documentation intact while the page scrolls. The sliced
   treatment remains available in the fullscreen viewer, where it is an
   explicit interaction rather than something that can read as a layout bug. */
const DETAIL_SCROLL_SPLIT = false;

function measure(){
  strata = $$('.view.active .strata');
}

function paintStrata(){
  if(!DETAIL_SCROLL_SPLIT || REDUCED || MOBILE_PLAIN) return;
  /* the exhibition views are documentation — they never come apart */
  if(currentView === 'v-installation') return;
  const vh = window.innerHeight;
  for(const el of strata){
    const r = el.getBoundingClientRect();
    if(r.bottom < -240 || r.top > vh + 240) continue;
    const d   = ((r.top + r.height/2) - vh/2) / (vh/2);
    const mag = Math.min(1, Math.abs(d));
    el.style.setProperty('--sep', (Math.pow(mag, 1.35) * SEP_MAX).toFixed(2));
  }
}

/* build the 5 strata bands once the source image is decodable */
function splitPlate(el){
  if(el.dataset.built) return;
  el.dataset.built = '1';
  // A relative url() inside a custom property resolves against the
  // stylesheet that consumes it via var() (assets/css/site.css), not the
  // document — so "assets/works/x.jpg" became "assets/css/assets/works/x.jpg"
  // and every stratum band silently failed to load. Resolve to an absolute
  // URL first so it's unambiguous regardless of which file references it.
  const abs = new URL(el.dataset.src, document.baseURI).href;
  el.style.setProperty('--src', `url("${abs}")`);
  for(let i = 0; i < 5; i++){
    const band = document.createElement('i');
    band.style.setProperty('--i', i);
    el.appendChild(band);
  }
  el.classList.add('split');
}

/* The bands are painted from a background-image, so they must not be shown
   before that image is decodable or the plate flashes empty. Drive it from an
   explicit preload rather than the <img>'s load event: the <img> is lazy and
   may never fire, and it only exists as the no-script fallback anyway. */
function preparePlate(el){
  if(el.dataset.pending || el.dataset.built) return;
  /* Documentation is never taken apart, so it is never sliced. Leaving the
     bands in place showed faint seams between them — five strips of
     fractional height cannot tile a box exactly at every viewport width. */
  if(!DETAIL_SCROLL_SPLIT || el.dataset.nosplit || MOBILE_PLAIN) return;
  const src = el.dataset.src;
  if(!src) return;
  el.dataset.pending = '1';
  const pre = new Image();
  pre.decoding = 'async';
  pre.onload  = () => splitPlate(el);
  pre.onerror = () => { delete el.dataset.pending; };   // keep the <img> showing
  pre.src = src;
}

/* A series can run to forty-odd plates, so they are only fetched as they come
   within reach of the viewport — preparing a whole view at once would pull
   tens of megabytes for images nobody has scrolled to yet. */
const plateIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(!e.isIntersecting) return;
    preparePlate(e.target);
    plateIO.unobserve(e.target);
  });
}, { rootMargin:'700px 0px' });

/* ============================================================
   5. residue — which works have been taken apart this visit
   Marked in the index only. The plates themselves are left alone: a screen
   laid over a photograph reads as a fault in the print, not as a trace of
   reading. Session-scoped, so it resets with the tab.
   ============================================================ */
const RES_KEY = 'ajy-residue';
const seen = { works: new Set() };

try{
  const raw = JSON.parse(sessionStorage.getItem(RES_KEY) || '{}');
  (raw.works || []).forEach(w => seen.works.add(w));
}catch(e){}

function saveResidue(){
  try{
    sessionStorage.setItem(RES_KEY, JSON.stringify({ works: [...seen.works] }));
  }catch(e){}
}

function recordResidue(src, workId){
  if(workId && !seen.works.has(workId)){
    seen.works.add(workId);
    saveResidue();
    paintResidue();
  }
}

function paintResidue(){
  $$('#idx-list .row, #idx-grid .card').forEach(el => {
    const on = seen.works.has(el.dataset.work);
    el.classList.toggle('residue', on);
    if(on) el.title = '이미 해체해 본 작업 — already taken apart';
    else   el.removeAttribute('title');
  });
}

/* ============================================================
   6. per-view bindings
   ============================================================ */
function bindView(view){
  if(!view) return;

  /* On phones the plate must remain a stable photograph while the page
     scrolls. The decomposition remains available only through the deliberate
     tap-to-open viewer, never as a passive scroll effect. */
  if(MOBILE_PLAIN){
    $$('.strata', view).forEach(el => { el.dataset.nosplit = '1'; });
  }

  /* documentation opens as a plain lightbox and is never sliced — set before
     the plates are observed so the first ones are prepared correctly */
  if(view.id === 'v-installation'){
    $$('.plate .tag', view).forEach(tag => { tag.textContent = '⤢ Enlarge'; });
    $$('.strata', view).forEach(el => { el.dataset.nosplit = '1'; });
  }

  $$('.rv', view).forEach(el => { if(!el.classList.contains('in')) revealIO.observe(el); });

  $$('.strata', view).forEach(el => {
    if(!el.dataset.built) plateIO.observe(el);
    if(el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', () => openViewer(el));
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openViewer(el); }
    });
  });

  $$('.threads[data-threads]', view).forEach(fillThreadChips);
  paintResidue();
}

function openViewer(el){
  const v = viewer();
  const workId = currentView;
  const group = el.closest('.plates, .inst') || el.closest('.view');
  const all   = $$('.strata[data-src]', group);
  /* Only the caption itself — not the "Pl. 01" that follows it inside the
     figcaption. The viewer already prints the position as "01 / 20", so
     carrying the plate number across just ran it into the end of the
     caption with nothing to separate the two. The exhibition views carry no
     caption at all, so there the number is all there is to show. */
  const list  = all.map(s => {
    const fc = s.closest('figure')?.querySelector('figcaption');
    return {
      src: s.dataset.src,
      full: s.dataset.full || s.dataset.src,
      caption: visibleText(fc?.querySelector('span:not(.no)'))
               || visibleText(fc?.querySelector('span.no'))
    };
  });
  const idx = Math.max(0, all.indexOf(el));

  if(v) v.open(list, idx, {
    mode: MODES[workId] ?? 2,
    onShow: item => recordResidue(item.src, workId)
  });
  else {
    recordResidue(el.dataset.src, workId);
    window.open(list[idx].src, '_blank', 'noopener');   // no webgl: plain image
  }
}

/* ============================================================
   7. threads — detail chips and a quiet related-work cue
   ============================================================ */
function threadLabel(id){
  const t = THREADS[id];
  return `<span class="l-ko">${t.ko}</span><span class="l-en">${t.en}</span>`;
}

function fillThreadChips(box){
  if(box.dataset.filled) return;
  box.dataset.filled = '1';
  box.innerHTML = (box.dataset.threads || '').split(/\s+/).filter(id => THREADS[id])
    .map(id => `<a class="thread" href="#/?t=${id}">${threadLabel(id)}</a>`).join('');
}

let threadFocusTimer = 0;

function clearThreadFocus(){
  const rows  = $$('#idx-list .row');
  const cards = $$('#idx-grid .card');
  $('#idx-list')?.classList.remove('thread-cue');
  $('#idx-grid')?.classList.remove('thread-cue');
  [...rows, ...cards].forEach(el => el.classList.remove('thread-related','thread-muted','filtered-out'));
  const label = $('#idx-count');
  if(label) label.textContent = 'Index — Selected Works 2020–2026';
}

function applyThreadFocus(t){
  clearTimeout(threadFocusTimer);
  clearThreadFocus();
  if(!t || !THREADS[t]) return;

  const rows  = $$('#idx-list .row');
  const cards = $$('#idx-grid .card');
  $('#idx-list')?.classList.add('thread-cue');
  $('#idx-grid')?.classList.add('thread-cue');
  [...rows, ...cards].forEach(el => {
    const related = (el.dataset.threads || '').split(/\s+/).includes(t);
    el.classList.toggle('thread-related', related);
    el.classList.toggle('thread-muted', !related);
  });

  const label = $('#idx-count');
  if(label) label.innerHTML = `Index — Related thread · ${threadLabel(t)}`;

  setTimeout(() => {
    document.querySelector('.idx-head')?.scrollIntoView({
      behavior: REDUCED ? 'auto' : 'smooth', block:'start'
    });
  }, 60);

  /* A thread is a moment of orientation, not a persistent filter state. */
  threadFocusTimer = setTimeout(clearThreadFocus, 3200);
  try{ history.replaceState(history.state, '', '/#works'); }catch(e){}
}

/* ============================================================
   8. index — list / grid + cursor preview
   ============================================================ */
function initIndex(){
  const list = $('#idx-list'), grid = $('#idx-grid');
  const bList = $('#tog-list'), bGrid = $('#tog-grid');
  if(!list || !grid) return;

  const set = (mode) => {
    const isGrid = mode === 'grid';
    grid.classList.toggle('hide', !isGrid);
    list.classList.toggle('hide',  isGrid);
    bGrid.classList.toggle('on',  isGrid);
    bList.classList.toggle('on', !isGrid);
    try{ localStorage.setItem('ajy-index-mode', mode); }catch(e){}
    requestAnimationFrame(measure);
  };
  bList.addEventListener('click', () => set('list'));
  bGrid.addEventListener('click', () => set('grid'));
  let saved = 'list';
  try{ saved = localStorage.getItem('ajy-index-mode') || 'list'; }catch(e){}
  set(saved);

  /* cursor preview */
  const peek = $('#peek'), pimg = $('#peek img');
  if(!peek || window.matchMedia('(hover: none)').matches) return;

  const p = { x:0, y:0, tx:0, ty:0, on:false };
  $$('.row', list).forEach(row => {
    row.addEventListener('pointerenter', () => {
      const s = row.dataset.peek;
      if(!s) return;
      if(pimg.getAttribute('src') !== s) pimg.setAttribute('src', s);
      p.on = true; peek.classList.add('on');
    });
    row.addEventListener('pointerleave', () => { p.on = false; peek.classList.remove('on'); });
  });
  list.addEventListener('pointermove', (e) => { p.tx = e.clientX; p.ty = e.clientY; });
  (function follow(){
    requestAnimationFrame(follow);
    if(!p.on) { p.x = p.tx; p.y = p.ty; return; }
    p.x = lerp(p.x, p.tx, 0.14);
    p.y = lerp(p.y, p.ty, 0.14);
    peek.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%,-50%) scale(1)`;
  })();
}

/* ============================================================
   9. header, menu, scroll chrome
   ============================================================ */
function initChrome(){
  const burger = $('#burger'), mmenu = $('#mmenu'), prog = $('#prog');
  closeMenu = (restore = true) => {
    if(!mmenu.classList.contains('open')) return;
    mmenu.classList.remove('open');
    burger.textContent = 'Menu';
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
    $('main').inert = false; $('footer').inert = false;
    if(restore) burger.focus({ preventScroll:true });
  };
  burger.addEventListener('click', () => {
    if(mmenu.classList.contains('open')){ closeMenu(); return; }
    rememberScroll();
    mmenu.classList.add('open');
    burger.textContent = 'Close'; burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-locked');
    $('main').inert = true; $('footer').inert = true;
    $('a', mmenu).focus({ preventScroll:true });
  });
  document.addEventListener('keydown', e => {
    if(!mmenu.classList.contains('open')) return;
    if(e.key === 'Escape'){ e.preventDefault(); closeMenu(); return; }
    if(e.key !== 'Tab') return;
    const focusable = [burger, ...$$('a, button', mmenu)];
    const first = focusable[0], last = focusable.at(-1);
    if(e.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))){ e.preventDefault(); first.focus(); }
  });
  window.addEventListener('resize', () => { if(innerWidth > 820) closeMenu(); }, { passive:true });

  let ticking = false;
  const onScroll = () => {
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      /* Safari reports elastic overscroll outside the document range. At the
         bottom that value can oscillate while the visual viewport settles,
         making the header progress line repeatedly overshoot and repaint.
         Clamp both the viewport and position to the real scrollable range. */
      const viewportH = document.documentElement.clientHeight || window.innerHeight;
      const h = Math.max(0, document.documentElement.scrollHeight - viewportH);
      const y = Math.min(h, Math.max(0, window.scrollY));
      document.body.classList.toggle('scrolled', y > 8);
      prog.style.width = h > 40 ? ((y / h) * 100).toFixed(2) + '%' : '0';
      prog.style.opacity = h > 40 && y > 8 ? '1' : '0';
      paintStrata();
      rememberScroll();
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', () => { measure(); paintStrata(); onScroll(); }, { passive:true });
  onScroll();
}

/* ============================================================
   10. hero
   ============================================================ */
function initHero(onProgress){
  const hero = $('#hero');
  if(!hero) return null;

  const now   = $('#hero-now');
  const ttl   = $('.ttl', now), sub = $('.sub', now), idx = $('.idx', now);
  const ticks = $$('#hero-ticks button');
  const prev = $('#hero-prev'), next = $('#hero-next'), mobileCount = $('#hero-mobile-count');

  const s = createStack({
    host: hero,
    items: WORKS,
    reduced: REDUCED,
    onProgress,
    onChange(i, item){
      now.classList.add('swapping');
      setTimeout(() => {
        idx.textContent = `${String(i+1).padStart(2,'0')} / ${String(WORKS.length).padStart(2,'0')}`;
        ttl.textContent = item.title;
        /* The Korean title is the original, not a translation of the English
           one — for four of the five it is only a transliteration of it, so
           「풀 메탈 플랜트」 beside "Full Metal Plant" tells an English reader
           nothing. Dropped in EN rather than translated. */
        sub.textContent = currentLang() === 'ko'
          ? `${item.kr} — ${item.meta}`
          : item.meta;
        now.parentElement.setAttribute('href', canonicalPath(item.href.slice(1)));
        now.classList.remove('swapping');
      }, REDUCED ? 0 : 190);
      ticks.forEach((b, j) => {
        const active = j === i;
        b.classList.toggle('on', active);
        b.setAttribute('aria-pressed', String(active));
      });
      if(prev) prev.disabled = i === 0;
      if(next) next.disabled = i === WORKS.length - 1;
      if(mobileCount) mobileCount.textContent = `${String(i+1).padStart(2,'0')} / ${String(WORKS.length).padStart(2,'0')}`;
    }
  });

  if(s){
    hero.classList.add('gl-ready');
    ticks.forEach((b, j) => b.addEventListener('click', (e) => { e.stopPropagation(); s.goTo(j); }));
    if(prev) prev.addEventListener('click', (e) => { e.stopPropagation(); s.previous(); });
    if(next) next.addEventListener('click', (e) => { e.stopPropagation(); s.next(); });
  }else{
    // no webgl — the static print stack stays, ticks just navigate
    hero.classList.add('no-gl');
    ticks.forEach((b, j) => b.addEventListener('click', () => { location.hash = WORKS[j].href; }));
    onProgress(1);
  }
  return s;
}

/* ============================================================
   11. boot
   ============================================================ */
function boot(){
  const pre  = $('#pre'), preN = $('#pre-n'), preBar = $('#pre-bar');
  let shown = 0, target = 0, done = false;

  const setProgress = (v) => { target = Math.max(target, Math.min(1, v)); };

  (function tick(){
    if(done) return;
    requestAnimationFrame(tick);
    shown = lerp(shown, target, 0.10);
    const n = Math.round(shown * 100);
    preN.textContent = String(n).padStart(3, '0');
    preBar.style.width = n + '%';
    if(target >= 1 && n >= 99) finish();
  })();

  function finish(){
    if(done) return;
    done = true;
    preN.textContent = '100';
    preBar.style.width = '100%';
    setTimeout(() => {
      pre.classList.add('done');
      document.body.classList.remove('is-locked');
      /* The stack starts its auto-cycle while the preloader is still visible.
         Reset it here so the first work receives a full viewing interval. */
      if(stack && currentView === 'v-home') stack.resume();
      bindView($('.view.active'));
      measure(); paintStrata();
    }, 220);
  }

  document.body.classList.add('is-locked');

  /* The safety net goes down before anything that could throw. The preloader
     locks scrolling, so if setup died halfway the page would be frozen with no
     way out — these two timers guarantee it always unlocks. */
  setTimeout(() => setProgress(1), 1500);
  setTimeout(finish, 2300);

  const guard = (label, fn) => {
    try{ return fn(); }
    catch(e){ console.error('[boot] ' + label + ' failed', e); return null; }
  };

  guard('lang',   initLang);
  guard('chrome', initChrome);
  guard('index',  initIndex);
  guard('navigation', initNavigation);
  guard('render', () => render(true, { restore:history.state?.scrollY }));
  stack = guard('hero', () => initHero(setProgress));
  if(!stack) setProgress(1);

  const yr = $('#yr');
  if(yr) yr.textContent = new Date().getFullYear();
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
