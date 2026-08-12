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
import { VERT, FRAG_DELAM } from './shaders.js?v=20260812-4';

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
        <button class="dlm-close" type="button">Close ✕ <span class="sr">(Esc)</span></button>
      </div>
      <div class="dlm-bot">
        <div class="dlm-read">
          <span class="scale">물성 조절 · Viscosity — <span class="l-ko">드래그하여 층을 해체</span><span class="l-en">drag to take the layers apart</span></span>
          <span class="hint"></span>
          <span class="dlm-nav">
            <button class="prev" type="button">← Prev</button>
            <button class="next" type="button">Next →</button>
          </span>
        </div>
        <div class="dlm-track">
          <span class="fill"></span><span class="knob"></span>
        </div>
        <div class="dlm-stages">
          ${STAGE_T.map((_,i)=>`<button type="button" data-s="${i}">${String(i+1).padStart(2,'0')} <span class="sl"></span></button>`).join('')}
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  return root;
}

function init(){
  const root   = build();
  const canvas = document.createElement('canvas');
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
    hint:   root.querySelector('.hint')
  };

  const state = {
    open:false, list:[], idx:0,
    t:1, tTarget:0, aspect:1.333, lastFocus:null, onShow:null, mode:2
  };

  let pushed = false;              // whether we own a history entry

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const cache = new Map();
  let loadSeq = 0;

  /* ---- sizing ---------------------------------------------------------- */
  function resize(){
    const W = window.innerWidth, H = window.innerHeight;
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

    const padX = W < 700 ? 20 : 80;
    const padT = W < 700 ? 74 : 96;    // caption row
    const padB = W < 700 ? 168 : 150;  // track + stages
    const availW = Math.max(80, W - padX*2);
    const availH = Math.max(80, H - padT - padB);

    const s = Math.min(availW / state.aspect, availH);
    const w = s * state.aspect, h = s;
    mesh.scale.set(w, h, 1);
    mesh.position.y = (padB - padT) / 2;
    mat.uniforms.uPlanePx.value.set(w * dpr, h * dpr);
  }
  window.addEventListener('resize', resize);

  /* ---- loading --------------------------------------------------------- */
  function show(i){
    const nextIdx = clamp(i, 0, state.list.length - 1);
    const item = state.list[nextIdx];
    const ticket = ++loadSeq;

    /* Keep the current plate and its metadata paired until the next texture
       is ready, instead of advancing the caption over the previous image. */
    root.classList.add('is-loading');
    root.setAttribute('aria-busy', 'true');
    ui.prev.disabled = true;
    ui.next.disabled = true;
    ui.hint.textContent = `${String(nextIdx+1).padStart(2,'0')} / ${String(state.list.length).padStart(2,'0')}  ·  LOADING`;

    const apply = (tex) => {
      if(!state.open || ticket !== loadSeq) return;
      state.idx = nextIdx;
      mat.uniforms.uTex.value = tex;
      mat.uniforms.uSeed.value = seedFor(item.src || String(nextIdx));
      state.aspect = tex.image.width / tex.image.height;
      resize();
      /* Phones open on the intact source image. Starting from the fully
         decomposed shader state looked like compression damage on a small
         display; the treatment is still available from the stage bar. */
      state.t = window.innerWidth < 700 ? 0 : 1;
      state.tTarget = 0;
      mat.uniforms.uT.value = state.t;
      mat.uniforms.uFade.value = 0;
      ui.cap.textContent = item.caption || '';
      ui.prev.disabled = state.idx === 0;
      ui.next.disabled = state.idx === state.list.length - 1;
      root.classList.remove('is-loading');
      root.removeAttribute('aria-busy');
      if(state.onShow) state.onShow(item);
      paintHud();
    };

    const fail = () => {
      if(!state.open || ticket !== loadSeq) return;
      root.classList.remove('is-loading');
      root.removeAttribute('aria-busy');
      ui.prev.disabled = state.idx === 0;
      ui.next.disabled = state.idx === state.list.length - 1;
      ui.hint.textContent = 'IMAGE COULD NOT BE LOADED';
    };

    if(cache.has(item.src)) apply(cache.get(item.src));
    else{
      loader.load(item.src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter  = THREE.LinearMipmapLinearFilter;
        tex.magFilter  = THREE.LinearFilter;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        cache.set(item.src, tex);
        apply(tex);
      }, undefined, fail);
    }
  }

  /* ---- hud ------------------------------------------------------------- */
  function paintHud(){
    const p = clamp(state.tTarget, 0, 1);
    ui.fill.style.width = (p*100).toFixed(2) + '%';
    ui.knob.style.left  = (p*100).toFixed(2) + '%';
    let active = 0;
    stageStops(state.mode).forEach((tv,i) => { if(p >= tv - 0.001) active = i; });
    /* mode 5 has no stage set. Falling back to another series' names printed
       "DATA 100%" over the exhibition views — a treatment that is not running
       and a track that is not shown. A plain lightbox says only where it is. */
    const names = STAGE_SETS[state.mode];
    if(names){
      ui.stages.forEach((b,i) => {
        b.classList.toggle('on', i === active);
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
  }

  function setT(v){
    const next = clamp(v, 0, 1);
    state.tTarget = next;
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

  canvas.addEventListener('pointerdown', (e) => {
    if(state.mode > 4.5 && state.mode < 5.5) return;   // plain lightbox: nothing to scrub
    dragging = true; sx = e.clientX; st = state.tTarget;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if(!dragging) return;
    setT(st + (e.clientX - sx) / (window.innerWidth * 0.62));
  });
  const endDrag = (e) => {
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
  ui.stages.forEach((b,i) => b.addEventListener('click', () => setT(stageStops(state.mode)[i])));
  ui.close.addEventListener('click', () => close(false));
  ui.prev.addEventListener('click', () => show(state.idx - 1));
  ui.next.addEventListener('click', () => show(state.idx + 1));

  document.addEventListener('keydown', (e) => {
    if(!state.open) return;
    if(e.key === 'Escape'){ close(false); return; }
    if(e.key === 'ArrowLeft'  && state.idx > 0){ show(state.idx - 1); return; }
    if(e.key === 'ArrowRight' && state.idx < state.list.length - 1){ show(state.idx + 1); return; }
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
    mat.uniforms.uT.value    = state.t;
    mat.uniforms.uTime.value = clock.elapsedTime;
    if(mat.uniforms.uTex.value)
      mat.uniforms.uFade.value = lerp(mat.uniforms.uFade.value, 1, 1 - Math.pow(0.01, dt));
    renderer.render(scene, camera);
  }
  frame();

  /* ---- open / close ---------------------------------------------------- */
  function open(list, idx, opts){
    state.list = list; state.open = true;
    state.onShow = (opts && opts.onShow) || null;
    state.mode = (opts && typeof opts.mode === 'number') ? opts.mode : 2;
    mat.uniforms.uMode.value = state.mode;

    /* mode 5 alone has nothing to scrub through — it is a plain lightbox.
       Anything above it is a real treatment and keeps its scrubber. */
    const plain = state.mode > 4.5 && state.mode < 5.5;
    root.classList.toggle('is-plain', plain);

    /* A fullscreen overlay reads as a page to most people, so Back should
       leave it rather than the site. Pushing a state that does not touch the
       hash keeps the hash router out of it. */
    if(!pushed){
      try{ history.pushState({ dlm:1 }, '', location.href); pushed = true; }catch(e){}
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
