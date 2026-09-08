/* ============================================================
   delaminate.js — full-screen decomposition viewer
   ------------------------------------------------------------
   Opening a plate assembles it: the image arrives decomposed and
   resolves to source. Dragging horizontally runs it back through
   four stages, named for whichever treatment the series is taken
   apart by — see STAGE_SETS. Keyboard 1–4 jumps to a stage, arrows
   move between plates in the same series, Esc closes.
   ============================================================ */

import * as THREE from '../../vendor/three.module.min.js';
import { VERT, FRAG_DELAM } from './shaders.js?v=20260908-2';

const lerp  = (a,b,t) => a + (b-a)*t;
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));

/* A stable 0..1 number per image path. Modes that vary themselves per plate
   (streak) need each frame to differ from its neighbours, but they must not
   differ between visits — a plate that combed one way on Monday and another
   way on Tuesday would read as a bug, not as a series. Hashing the path
   rather than the list index also keeps a plate's own look intact when the
   running order changes. FNV-1a; Math.imul keeps the multiply 32-bit. */
function seedFor(str){
  let h = 2166136261;
  for(let i = 0; i < str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100003) / 100003;
}

/* Stage names follow whichever treatment the series is taken apart by.
   Index matches the `mode` uniform in shaders.js. */
const STAGE_SETS = [
  [ ['Source','원본'], ['Grain','그레인'],   ['Threshold','임계'], ['Indexed','인덱스'] ],    // 0 dither
  [ ['Source','원본'], ['Lift','들뜸'],      ['Peel','박리'],      ['Capture','원판'] ],      // 1 chroma peel
  [ ['Source','원본'], ['Shift','이동'],     ['Split','분리'],     ['Data','데이터'] ],       // 2 data
  [ ['Source','원본'], ['Temper','담금'],    ['Brushed','헤어라인'],['Iron','철'] ],          // 3 metal
  [ ['Source','원본'], ['Grid','격자'],      ['Block','블록'],     ['Raster','래스터'] ],     // 4 pixel
  null,                                                                                      // 5 none — no scrubber
  [ ['Source','원본'], ['Contour','등고선'],  ['Reduce','환원'],    ['Drawing','도면'] ],      // 6 contour — unused (mode 7 replaced it for Hwanggok)
  [ ['Source','원본'], ['Comb','빗질'],       ['Trail','잔상'],     ['Streak','궤적'] ],       // 7 streak
  [ ['Source','원본'], ['Delay','지연'],      ['Drift','어긋남'],   ['Unarrived','미도래'] ]    // 8 afterimage
];
const STAGE_T = [0.00, 0.34, 0.66, 1.00];
const STREAK_STAGE_T = [0.00, 0.30, 0.58, 1.00];
const stageStops = mode => mode === 7 ? STREAK_STAGE_T : STAGE_T;

let V = null, tried = false;   // singleton

function build(){
  const root = document.createElement('div');
  root.className = 'dlm';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-label','Image delamination viewer');
  root.innerHTML = `
    <div class="dlm-ui">
      <div class="dlm-top">
        <p class="dlm-cap"></p>
        <div class="dlm-actions">
          <button class="dlm-zoom-reset" type="button" aria-label="Reset zoom to 1× · 확대 초기화" title="Reset zoom to 1× · 확대 초기화">1×</button>
          <button class="dlm-close" type="button">Close ✕ <span class="sr">(Esc)</span></button>
        </div>
      </div>
      <div class="dlm-bot">
        <div class="dlm-read">
          <span class="scale">물성 조절 · Viscosity — <span class="dlm-desktop-instruction"><span class="l-ko">드래그하여 층을 해체</span><span class="l-en">drag to take the layers apart</span></span><span class="dlm-mobile-instruction"><span class="l-ko">핀치 확대 · 강도는 아래 바</span><span class="l-en">pinch zoom · use the bar</span></span></span>
          <span class="hint"></span>
          <button class="dlm-effects-toggle" type="button" aria-expanded="false" aria-controls="dlm-effects"><span class="l-ko">효과 조절</span><span class="l-en">Effects</span></button>
          <span class="dlm-nav">
            <button class="prev" type="button">← Prev</button>
            <button class="next" type="button">Next →</button>
          </span>
        </div>
        <div class="dlm-effects" id="dlm-effects">
        <div class="dlm-track" role="slider" tabindex="0" aria-label="효과 강도 · Effect intensity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span class="fill"></span><span class="knob"></span>
        </div>
        <div class="dlm-stages">
          ${STAGE_T.map((_,i)=>`<button type="button" data-s="${i}">${String(i+1).padStart(2,'0')} <span class="sl"></span></button>`).join('')}
        </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  return root;
}

function init(){
  const root   = build();
  const canvas = document.createElement('canvas');
  const source = document.createElement('img');
  source.className = 'dlm-source';
  source.alt = '';
  source.decoding = 'async';
  root.prepend(source);
  root.prepend(canvas);

  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
  }catch(e){ root.remove(); return null; }
  if(!renderer.getContext()){ root.remove(); return null; }

  renderer.setClearColor(0x060607, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG_DELAM,
    transparent: true,
    uniforms:{
      uTex:     { value: null },
      uPlanePx: { value: new THREE.Vector2(1000, 750) },
      uT:       { value: 1 },
      uTime:    { value: 0 },
      uFade:    { value: 0 },
      uMode:    { value: 2 },
      uSeed:    { value: 0 }
    }
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1), mat);
  scene.add(mesh);

  const ui = {
    cap:    root.querySelector('.dlm-cap'),
    close:  root.querySelector('.dlm-close'),
    fill:   root.querySelector('.dlm-track .fill'),
    knob:   root.querySelector('.dlm-track .knob'),
    track:  root.querySelector('.dlm-track'),
    stages: [...root.querySelectorAll('.dlm-stages button')],
    prev:   root.querySelector('.prev'),
    next:   root.querySelector('.next'),
    hint:   root.querySelector('.hint'),
    bot:    root.querySelector('.dlm-bot'),
    zoomReset: root.querySelector('.dlm-zoom-reset'),
    effectsToggle: root.querySelector('.dlm-effects-toggle')
  };

  const state = {
    open:false, list:[], idx:0,
    t:1, tTarget:0, aspect:1.333, lastFocus:null, onShow:null, mode:2
  };

  let pushed = false;              // whether we own a history entry

  /* The image and the sharp mobile source share one view transform. Effects
     stay on the WebGL mesh; zoom and pan belong to the act of looking, so the
     same coordinates are also applied to the real <img> used at Source. */
  const view = {
    zoom:1, panX:0, panY:0,
    baseW:1, baseH:1, baseY:0,
    availW:1, availH:1, centreX:0, centreY:0
  };
  const ZOOM_MAX = 4;
  let touchInput = false;
  const isTouchViewer = () => touchInput || window.matchMedia('(any-pointer:coarse)').matches;

  function clampView(){
    if(view.zoom <= 1.001){
      view.zoom = 1; view.panX = 0; view.panY = 0;
      return;
    }
    const maxX = Math.max(0, (view.baseW * view.zoom - view.availW) / 2);
    const maxY = Math.max(0, (view.baseH * view.zoom - view.availH) / 2);
    view.panX = clamp(view.panX, -maxX, maxX);
    view.panY = clamp(view.panY, -maxY, maxY);
  }

  function applyView(){
    clampView();
    mesh.scale.set(view.baseW * view.zoom, view.baseH * view.zoom, 1);
    mesh.position.x = view.panX;
    /* DOM y grows down; the orthographic scene's y grows up. */
    mesh.position.y = view.baseY - view.panY;
    source.style.transform = `translate3d(${view.panX.toFixed(2)}px,${view.panY.toFixed(2)}px,0) scale(${view.zoom.toFixed(4)})`;
    root.classList.toggle('is-zoomed', view.zoom > 1.01);
    paintHud();
  }

  function resetView(apply = true){
    view.zoom = 1; view.panX = 0; view.panY = 0;
    if(apply) applyView();
  }

  function syncSourceView(){
    const intact = state.tTarget <= 0.001 && (isTouchViewer() || window.innerWidth < 700 || state.t < 0.001);
    root.classList.toggle('source-view', state.open && intact && source.hasAttribute('src'));
  }

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const cache = new Map();
  let loadSeq = 0;

  /* ---- sizing ---------------------------------------------------------- */
  function resize(){
    const W = window.innerWidth, H = window.innerHeight;
    const compact = H <= 520;
    if(compact !== root.classList.contains('is-compact')){
      root.classList.remove('effects-open');
      ui.effectsToggle.setAttribute('aria-expanded', 'false');
    }
    root.classList.toggle('is-compact', compact);
    root.classList.toggle('is-touch', isTouchViewer());
    /* Interactive treatments stay below full retina resolution so every
       series can scrub smoothly. Plain lightboxes keep the higher ceiling. */
    const plain = state.mode > 4.5 && state.mode < 5.5;
    const dprCap = plain ? 2 : (W < 700 ? 2 : 1.5);
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);

    camera.left = -W/2; camera.right = W/2;
    camera.top  =  H/2; camera.bottom = -H/2;
    camera.updateProjectionMatrix();

    const padX = W < 700 || compact ? 20 : 80;
    // Fit to the actual controls, including short landscape and translated text.
    const padT = Math.max(ui.cap.getBoundingClientRect().bottom, ui.close.getBoundingClientRect().bottom) + 8;
    const padB = H - ui.bot.getBoundingClientRect().top + 8;
    const availW = Math.max(80, W - padX*2);
    const availH = Math.max(80, H - padT - padB);

    const s = Math.min(availW / state.aspect, availH);
    const w = s * state.aspect, h = s;
    view.baseW = w; view.baseH = h;
    view.baseY = (padB - padT) / 2;
    view.availW = availW; view.availH = availH;
    view.centreX = W / 2;
    view.centreY = H / 2 - view.baseY;
    {
      /* Size the sharp DOM source to the exact WebGL plate bounds. An
         object-fit box looked aligned only for some aspect ratios and jumped
         when the scrubber swapped Source for the treated canvas. */
      source.style.left = `${((W - w) / 2).toFixed(2)}px`;
      source.style.top = `${(view.centreY - h / 2).toFixed(2)}px`;
      source.style.width = `${w.toFixed(2)}px`;
      source.style.height = `${h.toFixed(2)}px`;
    }
    mat.uniforms.uPlanePx.value.set(w * dpr, h * dpr);
    applyView();
    syncSourceView();
  }
  window.addEventListener('resize', resize);

  /* ---- loading --------------------------------------------------------- */
  function show(i){
    clearImageGesture();
    const nextIdx = clamp(i, 0, state.list.length - 1);
    const item = state.list[nextIdx];
    const imageSrc = item.full || item.src;
    const ticket = ++loadSeq;

    /* Keep the current plate and its metadata paired until the next texture
       is ready, instead of advancing the caption over the previous image. */
    root.classList.add('is-loading');
    root.setAttribute('aria-busy', 'true');
    ui.prev.disabled = true;
    ui.next.disabled = true;
    ui.hint.textContent = `${String(nextIdx+1).padStart(2,'0')} / ${String(state.list.length).padStart(2,'0')}  ·  LOADING`;

    const apply = (tex, url) => {
      if(!state.open || ticket !== loadSeq) return;
      state.idx = nextIdx;
      mat.uniforms.uTex.value = tex;
      mat.uniforms.uSeed.value = seedFor((item.src || String(nextIdx)).split('?')[0]);
      state.aspect = tex.image.width / tex.image.height;
      resetView(false);
      resize();
      /* Phones open on the intact source image. Starting from the fully
         decomposed shader state looked like compression damage on a small
         display; the treatment is still available from the stage bar. */
      state.t = isTouchViewer() || window.innerWidth < 700 ? 0 : 1;
      state.tTarget = 0;
      mat.uniforms.uT.value = state.t;
      mat.uniforms.uFade.value = 0;
      source.src = url;
      ui.cap.textContent = item.caption || '';
      ui.prev.disabled = state.idx === 0;
      ui.next.disabled = state.idx === state.list.length - 1;
      root.classList.remove('is-loading');
      root.removeAttribute('aria-busy');
      syncSourceView();
      if(state.onShow) state.onShow(item);
      paintHud();
      resize();
    };

    const fail = () => {
      if(!state.open || ticket !== loadSeq) return;
      root.classList.remove('is-loading');
      root.removeAttribute('aria-busy');
      ui.prev.disabled = state.idx === 0;
      ui.next.disabled = state.idx === state.list.length - 1;
      ui.hint.textContent = 'IMAGE COULD NOT BE LOADED';
    };

    function load(url){
      if(cache.has(url)){
        const tex = cache.get(url);
        cache.delete(url); cache.set(url, tex);
        apply(tex, url);
        return;
      }
      loader.load(url, (tex) => {
        if(!state.open || ticket !== loadSeq){ tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter  = THREE.LinearMipmapLinearFilter;
        tex.magFilter  = THREE.LinearFilter;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        cache.set(url, tex);
        apply(tex, url);
        // Large textures must not accumulate for an entire exhibition visit.
        while(cache.size > 2){
          const oldest = cache.keys().next().value;
          cache.get(oldest).dispose(); cache.delete(oldest);
        }
      }, undefined, () => {
        if(!state.open || ticket !== loadSeq) return;
        if(url !== item.src) load(item.src);
        else fail();
      });
    }
    load(imageSrc);
  }

  /* ---- hud ------------------------------------------------------------- */
  function paintHud(){
    const p = clamp(state.tTarget, 0, 1);
    ui.fill.style.width = (p*100).toFixed(2) + '%';
    ui.knob.style.left  = (p*100).toFixed(2) + '%';
    ui.track.setAttribute('aria-valuenow', String(Math.round(p*100)));
    let active = 0;
    stageStops(state.mode).forEach((tv,i) => { if(p >= tv - 0.001) active = i; });
    /* mode 5 has no stage set. Falling back to another series' names printed
       "DATA 100%" over the exhibition views — a treatment that is not running
       and a track that is not shown. A plain lightbox says only where it is. */
    const names = STAGE_SETS[state.mode];
    if(names){
      ui.stages.forEach((b,i) => {
        b.classList.toggle('on', i === active);
        b.setAttribute('aria-pressed', String(i === active));
        const sl = b.querySelector('.sl');
        if(sl) sl.textContent = names[i][0] + ' · ' + names[i][1];
      });
    }
    const pos = state.list.length
      ? `${String(state.idx+1).padStart(2,'0')} / ${String(state.list.length).padStart(2,'0')}`
      : '';
    ui.hint.textContent = (pos && names)
      ? `${pos}  ·  ${names[active][0].toUpperCase()} ${Math.round(p*100)}%`
      : pos;
    if(names) ui.track.setAttribute('aria-valuetext', `${Math.round(p*100)}% · ${names[active].join(' · ')}`);
  }

  function setT(v){
    const next = clamp(v, 0, 1);
    state.tTarget = next;
    syncSourceView();
    /* Direct manipulation follows the pointer immediately. Stage buttons
       still use the eased transition in the render loop. */
    if(dragging || trackDrag){
      state.t = next;
      mat.uniforms.uT.value = next;
    }
    paintHud();
  }

  /* ---- interaction ----------------------------------------------------- */
  let dragging = false, sx = 0, st = 0;
  const touches = new Map();
  let pinch = null, pan = null, gestureMoved = false;
  let lastTapAt = 0, lastTapX = 0, lastTapY = 0;

  const touchPair = () => [...touches.values()].slice(0, 2);
  const distance = (a,b) => Math.hypot(b.x - a.x, b.y - a.y);
  const midpoint = (a,b) => ({ x:(a.x+b.x)/2, y:(a.y+b.y)/2 });

  function pointOnImage(x,y){
    const cx = view.centreX + view.panX;
    const cy = view.centreY + view.panY;
    const halfW = view.baseW * view.zoom / 2;
    const halfH = view.baseH * view.zoom / 2;
    return x >= cx - halfW && x <= cx + halfW && y >= cy - halfH && y <= cy + halfH;
  }

  function beginPan(point){
    pan = {
      id:point.id, x:point.x, y:point.y,
      panX:view.panX, panY:view.panY,
      at:performance.now()
    };
  }

  function beginPinch(){
    const [a,b] = touchPair();
    if(!a || !b) return;
    const mid = midpoint(a,b);
    pinch = {
      distance:Math.max(1, distance(a,b)), zoom:view.zoom,
      anchorX:(mid.x - view.centreX - view.panX) / view.zoom,
      anchorY:(mid.y - view.centreY - view.panY) / view.zoom
    };
    pan = null;
    gestureMoved = true;
  }

  function clearImageGesture(){
    for(const id of touches.keys()){
      if(canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
    touches.clear();
    pinch = null; pan = null; gestureMoved = false; dragging = false;
    lastTapAt = 0;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if(e.pointerType === 'touch'){
      touchInput = true;
      root.classList.add('is-touch');
      /* Start a viewing gesture on the artwork itself. The fullscreen canvas
         also covers the captions and blank surround; accepting touches there
         made an accidental pinch or pan feel as if the whole page were stuck. */
      if(touches.size === 0 && !pointOnImage(e.clientX, e.clientY)) return;
      const point = { id:e.pointerId, x:e.clientX, y:e.clientY };
      touches.set(e.pointerId, point);
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
      if(touches.size === 1){ beginPan(point); gestureMoved = false; }
      else if(touches.size === 2) beginPinch();
      e.preventDefault();
      return;
    }
    if(state.mode > 4.5 && state.mode < 5.5) return;   // plain lightbox: nothing to scrub
    dragging = true; sx = e.clientX; st = state.tTarget;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if(e.pointerType === 'touch' && touches.has(e.pointerId)){
      const point = { id:e.pointerId, x:e.clientX, y:e.clientY };
      touches.set(e.pointerId, point);
      if(touches.size >= 2 && pinch){
        const [a,b] = touchPair();
        const mid = midpoint(a,b);
        const nextZoom = clamp(pinch.zoom * distance(a,b) / pinch.distance, 1, ZOOM_MAX);
        view.zoom = nextZoom;
        view.panX = mid.x - view.centreX - pinch.anchorX * nextZoom;
        view.panY = mid.y - view.centreY - pinch.anchorY * nextZoom;
        applyView();
      }else if(touches.size === 1 && pan && pan.id === e.pointerId && view.zoom > 1.001){
        const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
        if(Math.hypot(dx,dy) > 5) gestureMoved = true;
        view.panX = pan.panX + dx;
        view.panY = pan.panY + dy;
        applyView();
      }
      e.preventDefault();
      return;
    }
    if(!dragging) return;
    setT(st + (e.clientX - sx) / (window.innerWidth * 0.62));
  });
  const endDrag = (e) => {
    if(e && e.pointerType === 'touch' && touches.has(e.pointerId)){
      const point = touches.get(e.pointerId);
      const wasSingle = touches.size === 1;
      const wasTap = wasSingle && !gestureMoved && pan &&
        performance.now() - pan.at < 320 &&
        Math.hypot(point.x - pan.x, point.y - pan.y) < 10;
      touches.delete(e.pointerId);
      if(canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

      if(touches.size >= 2) beginPinch();
      else if(touches.size === 1){
        beginPan([...touches.values()][0]);
        pinch = null; gestureMoved = true;
      }else{
        pinch = null; pan = null;
        if(wasTap){
          const now = performance.now();
          if(now - lastTapAt < 340 && Math.hypot(point.x-lastTapX, point.y-lastTapY) < 30){
            /* Double tap is deliberately a reset, not a second way to zoom.
               Pinch owns magnification; the repeat gesture always gets home. */
            resetView();
            lastTapAt = 0;
          }else{
            lastTapAt = now; lastTapX = point.x; lastTapY = point.y;
          }
        }
        gestureMoved = false;
      }
      return;
    }
    dragging = false;
    if(e && e.pointerId != null && canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* the track is a scrubber, not a row of buttons — press and drag along it */
  let trackDrag = false;
  const trackSet = (clientX) => {
    const r = ui.track.getBoundingClientRect();
    setT((clientX - r.left) / r.width);
  };
  ui.track.addEventListener('pointerdown', (e) => {
    if(state.mode > 4.5 && state.mode < 5.5) return;
    trackDrag = true;
    try{ ui.track.setPointerCapture(e.pointerId); }catch(err){}
    trackSet(e.clientX);
    e.preventDefault();
  });
  ui.track.addEventListener('pointermove', (e) => { if(trackDrag) trackSet(e.clientX); });
  const endTrack = (e) => {
    if(!trackDrag) return;
    trackDrag = false;
    if(e && e.pointerId != null && ui.track.hasPointerCapture(e.pointerId))
      ui.track.releasePointerCapture(e.pointerId);
  };
  ui.track.addEventListener('pointerup', endTrack);
  ui.track.addEventListener('pointercancel', endTrack);
  ui.track.addEventListener('keydown', e => {
    const steps = { ArrowLeft:-.01, ArrowDown:-.01, ArrowRight:.01, ArrowUp:.01, PageDown:-.1, PageUp:.1 };
    if(!(e.key in steps) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault(); e.stopPropagation();
    setT(e.key === 'Home' ? 0 : e.key === 'End' ? 1 : state.tTarget + steps[e.key]);
  });
  ui.effectsToggle.addEventListener('click', () => {
    const open = root.classList.toggle('effects-open');
    ui.effectsToggle.setAttribute('aria-expanded', String(open));
    resize();
  });
  const controlsObserver = new ResizeObserver(() => {
    if(state.open) requestAnimationFrame(resize);
  });
  controlsObserver.observe(ui.bot);
  ui.stages.forEach((b,i) => b.addEventListener('click', () => setT(stageStops(state.mode)[i])));
  ui.zoomReset.addEventListener('click', () => resetView());
  ui.close.addEventListener('click', () => close(false));
  ui.prev.addEventListener('click', () => show(state.idx - 1));
  ui.next.addEventListener('click', () => show(state.idx + 1));

  document.addEventListener('keydown', (e) => {
    if(!state.open) return;
    if(e.key === 'Escape'){ close(false); return; }
    if(e.key === 'Tab'){
      /* aria-modal should behave like one: keep keyboard focus inside the
         viewer instead of letting it disappear into the page underneath. */
      const focusable = [...root.querySelectorAll('button:not([disabled]), [tabindex="0"]')]
        .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      if(focusable.length){
        const first = focusable[0], last = focusable[focusable.length - 1];
        if(e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))){
          e.preventDefault(); last.focus();
        }else if(!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))){
          e.preventDefault(); first.focus();
        }
      }
      return;
    }
    if(e.key === 'ArrowLeft'  && state.idx > 0){ e.preventDefault(); show(state.idx - 1); return; }
    if(e.key === 'ArrowRight' && state.idx < state.list.length - 1){ e.preventDefault(); show(state.idx + 1); return; }
    const n = parseInt(e.key, 10);
    if(n >= 1 && n <= 4) setT(stageStops(state.mode)[n-1]);
  });

  /* ---- loop ------------------------------------------------------------ */
  const clock = new THREE.Clock();
  function frame(){
    requestAnimationFrame(frame);
    if(!state.open) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const response = state.mode > 4.5 && state.mode < 5.5 ? 0.0006 : 0.00008;
    state.t = lerp(state.t, state.tTarget, 1 - Math.pow(response, dt));
    syncSourceView();
    mat.uniforms.uT.value    = state.t;
    mat.uniforms.uTime.value = clock.elapsedTime;
    if(mat.uniforms.uTex.value)
      mat.uniforms.uFade.value = lerp(mat.uniforms.uFade.value, 1, 1 - Math.pow(0.01, dt));
    renderer.render(scene, camera);
  }
  frame();

  /* ---- open / close ---------------------------------------------------- */
  function open(list, idx, opts){
    clearImageGesture();
    state.list = list; state.open = true;
    state.onShow = (opts && opts.onShow) || null;
    state.mode = (opts && typeof opts.mode === 'number') ? opts.mode : 2;
    mat.uniforms.uMode.value = state.mode;
    resetView(false);
    root.classList.remove('effects-open');
    ui.effectsToggle.setAttribute('aria-expanded', 'false');

    /* mode 5 alone has nothing to scrub through — it is a plain lightbox.
       Anything above it is a real treatment and keeps its scrubber. */
    const plain = state.mode > 4.5 && state.mode < 5.5;
    root.classList.toggle('is-plain', plain);

    /* A fullscreen overlay reads as a page to most people, so Back should
       leave it rather than the site. Pushing a state that does not touch the
       hash keeps the hash router out of it. */
    if(!pushed){
      try{ history.pushState({ ...history.state, dlm:1 }, '', location.href); pushed = true; }catch(e){}
    }
    state.lastFocus = document.activeElement;
    document.body.classList.add('is-locked');
    root.classList.add('open');
    resize();
    show(idx);
    requestAnimationFrame(() => {
      root.classList.add('shown');
      ui.close.focus({ preventScroll:true });
    });
  }
  /* fromPop: the history entry is already gone, so do not pop it again */
  function close(fromPop){
    if(!state.open) return;
    clearImageGesture();
    loadSeq++;
    root.classList.remove('is-loading');
    root.removeAttribute('aria-busy');
    root.classList.remove('shown');
    document.body.classList.remove('is-locked');
    setTimeout(() => {
      root.classList.remove('open');
      state.open = false;
      if(state.lastFocus && state.lastFocus.focus) state.lastFocus.focus({ preventScroll:true });
    }, 420);
    if(pushed){
      pushed = false;
      if(fromPop !== true){ try{ history.back(); }catch(e){} }
    }
  }

  window.addEventListener('popstate', () => { if(state.open) close(true); });

  return { open, close: () => close(false), get isOpen(){ return state.open; } };
}

export function viewer(){
  if(!tried){ tried = true; V = init(); }
  return V;
}
