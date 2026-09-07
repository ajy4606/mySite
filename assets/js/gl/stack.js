/* ============================================================
   stack.js — the index hero
   ------------------------------------------------------------
   The works are held in space as a stack of physical sheets.
   At rest they sit almost flush; as the cursor enters they pull
   apart along depth, exposing every layer's edge. The front sheet
   cycles: it lifts past the camera and re-enters at the back.
   ============================================================ */

import * as THREE from '../../vendor/three.module.min.js';
import { VERT, FRAG_PLATE } from './shaders.js?v=20260907';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Seconds for a hovered sheet to fill from rest to fully decomposed, and to
   drain back once the cursor leaves. The fill is deliberately long: the point
   is watching the work come apart, not arriving at a state. Draining is
   quicker — leaving should read as a release, not as a second animation. */
const T_FILL  = 2.4;
const T_DRAIN = 0.8;

/* Kept in step with the identical helper in delaminate.js, so a plate combs
   the same way in the hero as it does in the viewer. FNV-1a. */
function seedFor(str){
  let h = 2166136261;
  for(let i = 0; i < str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100003) / 100003;
}

export function createStack(opts){
  const {
    host,                 // .hero element
    items,                // [{ src, title, kr, meta, href }]
    onChange,             // (index, item) => void
    reduced = false
  } = opts;

  const canvas = document.createElement('canvas');
  host.prepend(canvas);

  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({
      canvas, antialias:true, alpha:true,
      powerPreference:'high-performance'
    });
  }catch(e){
    canvas.remove();
    return null;                       // caller keeps the static fallback
  }
  if(!renderer.getContext()){ canvas.remove(); return null; }

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.z = 3.4;

  /* The stack sits a little high so there is air under it for the label. When
     the fan opens, the front sheet also travels upward — far enough that its
     top edge used to leave the frame. It gets that height back by sliding the
     whole group down as it opens; the drop is small enough that the label
     underneath keeps its air. See layout() for the size that has to fit. */
  const GROUP_Y  = 0.10;
  const FAN_DROP = 0.09;
  /* Vertical travel per step of the open fan. Read by both targetFor and
     layout() — if these two disagree the sheet is sized against a lift it
     does not actually make, and the frame either clips or wastes space. */
  const FAN_Y = 0.105;

  const group = new THREE.Group();
  group.rotation.set(0.045, -0.10, 0);
  group.position.y = GROUP_Y;
  scene.add(group);

  const N = items.length;
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);

  /* ---- meshes ---------------------------------------------------------- */
  const sheets = items.map((item, i) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_PLATE,
      transparent: true,
      depthWrite: false,
      uniforms:{
        uTex:     { value: null },
        uPlanePx: { value: new THREE.Vector2(900, 675) },
        uT:       { value: 0 },
        uTime:    { value: 0 },
        uDim:     { value: 0 },
        uOpacity: { value: 1 },
        uHasTex:  { value: 0 },
        uMode:    { value: item.mode ?? 2 },
        /* per-sheet, stable across reloads — see seedFor in delaminate.js for
           why this hashes the path rather than using the index */
        uSeed:    { value: seedFor((item.src || String(i)).split('?')[0]) }
      }
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = {
      i, item,
      aspect: 1.333,
      cur:  { x:0, y:0, z:0, rz:0, op:1, dim:0, t:0 },
      flying: false
    };
    group.add(mesh);
    return mesh;
  });

  let order = sheets.map((_, i) => i);   // order[0] is the front sheet

  /* ---- textures -------------------------------------------------------- */
  let loaded = 0;
  const total = N;
  const onProgress = opts.onProgress || (() => {});
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

  items.forEach((item, i) => {
    loader.load(item.src, (tex) => {
      tex.colorSpace   = THREE.SRGBColorSpace;
      tex.minFilter    = THREE.LinearMipmapLinearFilter;
      tex.magFilter    = THREE.LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy   = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const m = sheets[i];
      m.material.uniforms.uTex.value = tex;
      m.material.uniforms.uHasTex.value = 1;
      m.userData.aspect = tex.image.width / tex.image.height;
      layout();
      onProgress(++loaded / total);
    }, undefined, () => { onProgress(++loaded / total); });
  });

  /* ---- slot geometry --------------------------------------------------- */
  // fan: 0 = flush stack, 1 = pulled apart
  let fan = 0, fanTarget = 0;

  function slotOf(mesh){ return order.indexOf(mesh.userData.i); }

  function targetFor(slot){
    // lateral offsets are measured from the middle of the stack so the pile
    // stays centred in frame; depth still runs strictly front-to-back.
    // On a phone the frame is far narrower than it is tall, so the same world
    // offsets would throw the outer sheets off both edges — the spread moves
    // onto the vertical axis instead.
    const k = slot - (N - 1) / 2;
    const sx = spread, sy = 1 + (1 - spread) * 0.9;
    const tight = { x: k * 0.055 * sx, y: -k * 0.038 * sy, z: -slot * 0.100, rz: (slot % 2 ? 1 : -1) * 0.006 };
    const open  = { x: k * 0.200 * sx, y: -k * FAN_Y * sy, z: -slot * 0.340, rz: (slot % 2 ? 1 : -1) * 0.026 };
    return {
      x:  lerp(tight.x,  open.x,  fan),
      y:  lerp(tight.y,  open.y,  fan),
      z:  lerp(tight.z,  open.z,  fan),
      rz: lerp(tight.rz, open.rz, fan),
      op: 1,
      dim: clamp(slot / (N + 1), 0, 1) * (1 - fan * 0.35),
      /* barely there at rest — the sheet is a print, not an effect. Hovering
         is what runs each work through its own treatment. */
      t:  slot === 0 ? 0.07 : 0.03
    };
  }

  /* ---- sizing ---------------------------------------------------------- */
  let W = 1, H = 1, dpr = 1;
  let spread = 1;          // how much lateral room the frame can spare

  function layout(){
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    // how much of the frame a sheet may occupy
    const visH = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * camera.position.z;
    const visW = visH * camera.aspect;
    const boxW = visW * (W < 760 ? 0.72 : 0.56);
    const pxPerUnit = (H / visH) * dpr;

    // 16:9 and wider keep the full spread; a phone gets about a third of it
    spread = Math.min(1, camera.aspect / 1.55);

    /* A sheet has to fit the frame at its highest, not at rest. The fan lifts
       the front one by half the pile's vertical travel, and a narrow frame
       moves the spread onto this axis, so the lift grows as the window
       narrows — which is why a phone clipped worse than a desktop. Size the
       sheet against that worst case, after the group's own slide down. */
    const sy = 1 + (1 - spread) * 0.9;
    const fanLift = ((N - 1) / 2) * FAN_Y * sy;
    const headroom = visH / 2 - 0.05 - fanLift - (GROUP_Y - FAN_DROP);
    const boxH = Math.min(visH * (W < 760 ? 0.58 : 0.70), headroom * 2);

    sheets.forEach(m => {
      const a = m.userData.aspect;
      const s = Math.min(boxW / a, boxH);
      const w = s * a, h = s;
      m.scale.set(w, h, 1);
      m.material.uniforms.uPlanePx.value.set(w * pxPerUnit, h * pxPerUnit);
    });
  }

  /* ---- pointer --------------------------------------------------------- */
  const ptr = { x:0, y:0, tx:0, ty:0, inside:false };
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)');
  const usesMobileAutoplayEffect = () => innerWidth <= 820 || coarsePointer.matches;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1;

  function pointerMove(e){
    const r = host.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ptr.tx = px * 2 - 1;
    ptr.ty = py * 2 - 1;
    ndc.set(ptr.tx, -ptr.ty);
  }

  /* Whether the stack is "held" is decided by the cursor's position against the
     hero's box, not by pointerleave. The fixed header overlays the hero, so
     leave fires as soon as the cursor drifts up into it, which used to drop the
     fan and the wheel capture while the cursor was still visibly on the work. */
  function setHeld(on){
    if(on === ptr.inside) return;
    ptr.inside = on;
    fanTarget = on ? 1 : 0;
    host.classList.toggle('is-wheel-ready', on);
    if(on) pauseAuto();
    else { ptr.tx = ptr.ty = 0; resumeAuto(900); }
  }

  /* Scrolling through the hero opens the stack too — it is the most obvious
     input on the page, and without it the layers look inert to anyone who
     scrolls before reaching for the cursor.

     The ramp is steep on purpose. The hero is one viewport tall and leaves as
     you scroll, so a gentle ramp would only finish opening once the stack had
     already travelled off the top of the screen. At this rate one notch of the
     wheel (~100px) is already half open, and it is fully fanned by ~180px,
     while the stack is still sitting well inside the frame. */
  let scrollFan = 0;
  function readScroll(){
    const r = host.getBoundingClientRect();
    const past = -r.top / Math.max(1, r.height);
    scrollFan = Math.min(1, Math.max(0, past) * 5.0);
  }
  window.addEventListener('scroll', readScroll, { passive:true });
  readScroll();

  let suppressClickUntil = 0;
  host.addEventListener('click', (e) => {
    if(performance.now() < suppressClickUntil) return;
    if(e.target.closest('.hero-ticks') || e.target.closest('a')) return;
    const hit = pick();
    const idx = hit >= 0 ? hit : order[0];
    const item = items[idx];
    if(item && item.href) location.hash = item.href;
  });

  function pick(){
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(sheets, false);
    if(!hits.length) return -1;
    // prefer the sheet nearest the front of the stack among the hits
    let best = -1, bestSlot = 1e9;
    for(const h of hits){
      const s = slotOf(h.object);
      if(s < bestSlot){ bestSlot = s; best = h.object.userData.i; }
    }
    return best;
  }

  /* ---- cycling --------------------------------------------------------- */
  let cycleAt = performance.now();
  /* Give each work enough time to settle after the preloader and to be read.
     Manual wheel, keyboard and touch navigation remain immediate. */
  const CYCLE = 6800;
  let autoPaused = false, autoTimer = 0, transitioning = false, transitionTimer = 0;

  function pauseAuto(){
    autoPaused = true;
    clearTimeout(autoTimer);
  }

  function resumeAuto(delay = 0){
    clearTimeout(autoTimer);
    const resume = () => {
      /* A tapped mobile control can retain focus long after the finger leaves.
         Treating that sticky focus like desktop keyboard focus stopped both
         autoplay and the no-hover treatment for the rest of the visit. */
      if(ptr.inside || (!usesMobileAutoplayEffect() && host.contains(document.activeElement))){
        autoPaused = true;
        return;
      }
      autoPaused = false;
      cycleAt = performance.now();
    };
    if(delay) autoTimer = setTimeout(resume, delay);
    else resume();
  }

  function holdAuto(delay = usesMobileAutoplayEffect() ? 850 : 5000){
    pauseAuto();
    resumeAuto(delay);
  }

  function lockTransition(){
    transitioning = true;
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => { transitioning = false; }, 500);
  }

  function advance(){
    const frontId = order.shift();
    order.push(frontId);
    const m = sheets[frontId];
    m.userData.flying = 'out';
    m.renderOrder = 10;
    setTimeout(() => {
      // re-enter silently at the back
      const slot = slotOf(m);
      const t = targetFor(slot);
      Object.assign(m.userData.cur, t, { op:0 });
      m.userData.flying = false;
      m.renderOrder = 0;
    }, 430);
    emit();
  }

  function retreat(){
    const rearId = order.pop();
    order.unshift(rearId);
    const m = sheets[rearId];
    const t = targetFor(0);
    Object.assign(m.userData.cur, t, {
      x:t.x - 0.10, y:t.y + 0.42, z:2.6, rz:t.rz + 0.05, op:0
    });
    m.userData.flying = 'in';
    m.renderOrder = 10;
    setTimeout(() => {
      m.userData.flying = false;
      m.renderOrder = 0;
    }, 430);
    emit();
  }

  function step(direction, source = 'manual'){
    if(transitioning) return false;
    const current = order[0];
    if(direction > 0 && current >= N - 1) return false;
    if(direction < 0 && current <= 0) return false;
    lockTransition();
    if(direction > 0) advance(); else retreat();
    cycleAt = performance.now();
    if(source !== 'auto') holdAuto();
    return true;
  }

  function goTo(index){
    let guard = 0;
    while(order[0] !== index && guard++ < N * 2) order.push(order.shift());
    cycleAt = performance.now();
    holdAuto();
    emit();
  }

  /* The cursor is tracked on the document rather than on the hero itself. The
     header is fixed and sits on top of the hero, so a pointerleave fires the
     moment the cursor drifts up into it — which used to hand the wheel
     straight back to the page mid-browse. A hit test against the hero's box
     keeps the whole area live, overlays included. */
  let cursor = null;
  function cursorOverHero(){
    if(!cursor) return false;
    const r = host.getBoundingClientRect();
    return cursor.x >= r.left && cursor.x <= r.right &&
           cursor.y >= r.top  && cursor.y <= r.bottom;
  }
  /* Tracked on the document, not the hero: the cursor has to keep steering the
     parallax and the raycast while it is over the fixed header, which sits on
     top of the hero but is not inside it.

     Note: deliberately not gated on `reduced`. Reduced-motion asks us to drop
     motion the viewer did not ask for — the autoplay, the drift, the parallax,
     all disabled in the frame loop. Hovering and wheeling are the viewer's own
     instructions; gating those leaves the hero inert and the stack unbrowsable
     for anyone with the setting on. */
  document.addEventListener('pointermove', (e) => {
    if(e.pointerType === 'touch') return;
    cursor = { x: e.clientX, y: e.clientY };
    if(!finePointer.matches || innerWidth <= 820) return;
    const over = cursorOverHero();
    setHeld(over);
    if(over) pointerMove(e);
  }, { passive:true });
  document.addEventListener('pointerleave', () => { cursor = null; setHeld(false); });

  /* Desktop: one deliberate wheel gesture advances one work. At either edge
     the event is left untouched, so native page scrolling resumes at once. */
  let wheelAccum = 0, wheelLastAt = 0, wheelGestureLocked = false, wheelIdleTimer = 0;
  host.addEventListener('wheel', (e) => {
    if(!finePointer.matches || innerWidth <= 820 || !cursorOverHero()) return;
    const r = host.getBoundingClientRect();
    /* Browsing survives a little drift. Requiring the hero to sit exactly at
       the top meant a single stray notch released it for good. */
    const shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if(shown < r.height * 0.55 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

    const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? innerHeight : 1);
    const delta = e.deltaY * unit;
    const direction = Math.sign(delta);
    const current = order[0];
    if((direction > 0 && current >= N - 1) || (direction < 0 && current <= 0)) return;

    e.preventDefault();
    pauseAuto();
    const now = performance.now();
    if(now - wheelLastAt > 180 || Math.sign(wheelAccum) !== direction) wheelAccum = 0;
    wheelLastAt = now;
    wheelAccum += delta;

    clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => {
      wheelAccum = 0;
      wheelGestureLocked = false;
    }, 180);

    if(wheelGestureLocked || Math.abs(wheelAccum) < 72) return;
    if(step(direction, 'wheel')){
      wheelGestureLocked = true;
      wheelAccum = 0;
    }
  }, { passive:false });

  /* Mobile: horizontal intent only. Vertical movement is never cancelled and
     remains the browser's native page scroll. */
  let touchStart = null;
  host.addEventListener('pointerdown', (e) => {
    if(e.pointerType !== 'touch' || innerWidth > 820) return;
    touchStart = { id:e.pointerId, x:e.clientX, y:e.clientY, at:performance.now() };
    pauseAuto();
  }, { passive:true });
  host.addEventListener('pointerup', (e) => {
    if(!touchStart || e.pointerId !== touchStart.id) return;
    const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    const horizontal = Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.25;
    if(horizontal && performance.now() - touchStart.at < 900){
      step(dx < 0 ? 1 : -1, 'touch');
      suppressClickUntil = performance.now() + 500;
    }
    touchStart = null;
    holdAuto();
  }, { passive:true });
  host.addEventListener('pointercancel', (e) => {
    if(touchStart && e.pointerId === touchStart.id) touchStart = null;
    holdAuto();
  }, { passive:true });

  host.addEventListener('focusin', () => {
    if(!usesMobileAutoplayEffect()) pauseAuto();
  });
  host.addEventListener('focusout', (e) => {
    if(!usesMobileAutoplayEffect() && !host.contains(e.relatedTarget)) resumeAuto(900);
  });
  host.addEventListener('keydown', (e) => {
    if(e.key === 'ArrowRight' || e.key === 'ArrowDown'){
      if(step(1, 'keyboard')) e.preventDefault();
    }else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){
      if(step(-1, 'keyboard')) e.preventDefault();
    }
  });

  function emit(){
    if(onChange) onChange(order[0], items[order[0]]);
  }

  /* ---- loop ------------------------------------------------------------ */
  const clock = new THREE.Clock();
  let running = true, visible = true, raf = 0;

  function frame(){
    raf = requestAnimationFrame(frame);
    if(!running || !visible) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    const time = clock.elapsedTime;

    if(!reduced && !autoPaused && !transitioning && now - cycleAt > CYCLE){
      cycleAt = now;
      lockTransition();
      advance();
    }

    /* A phone has no hover state, so the current work quietly travels through
       its own treatment during the same interval that leads to autoplay. It
       reaches the complete state just before the sheet advances. Manual
       navigation resets cycleAt and therefore starts the next work cleanly. */
    const mobileCycle = clamp((now - cycleAt) / (CYCLE - 250), 0, 1);
    const mobileAutoT = !reduced && !autoPaused && !transitioning && usesMobileAutoplayEffect()
      /* Start above the almost-invisible rest state, then spend the full
         interval revealing the work. The eased curve makes the treatment
         legible in the first second without dumping the final effect on the
         image as soon as the page opens. */
      ? 0.20 + 0.80 * Math.pow(mobileCycle, 0.72)
      : null;

    /* the fan answers the viewer directly, so it stays available even under
       reduced motion — only the unattended drift and cycling are dropped */
    fan = lerp(fan, Math.max(fanTarget, scrollFan), 1 - Math.pow(0.001, dt));

    const par = reduced ? 0 : 1;
    ptr.x = lerp(ptr.x, ptr.tx * par, 1 - Math.pow(0.004, dt));
    ptr.y = lerp(ptr.y, ptr.ty * par, 1 - Math.pow(0.004, dt));

    group.rotation.y = -0.10 + ptr.x * 0.11;
    group.rotation.x =  0.045 + ptr.y * 0.06;
    group.position.x = ptr.x * 0.06;
    /* opening the fan sends the front sheet up; the pile gives that back */
    group.position.y = GROUP_Y - FAN_DROP * fan;

    hovered = ptr.inside ? pick() : -1;

    for(const m of sheets){
      const u = m.userData;
      const slot = slotOf(m);
      let tgt = targetFor(slot);

      if(u.flying === 'out'){
        tgt = { x:u.cur.x + 0.10, y:u.cur.y + 0.42, z: 2.6, rz:u.cur.rz - 0.05, op:0, dim:0, t:0.55 };
      }
      /* Hovering a sheet runs that work all the way through its own
         decomposition — the dither, the drain, the data, the iron — and holds
         there. Each series stops where its own treatment ends, so the same
         gesture reads differently on every plate. */
      /* Only mode 5 means "no treatment". Testing `mode > 4.5` pinned every
         mode above it to zero too, which is why contour never showed here. */
      const mode = m.material.uniforms.uMode.value;
      const untreated = mode > 4.5 && mode < 5.5;
      if(u.i === hovered && !u.flying && !untreated){
        tgt = Object.assign({}, tgt, { t: 1 });
      }
      if(mobileAutoT !== null && u.i === order[0] && !u.flying && !untreated){
        tgt = Object.assign({}, tgt, { t: Math.max(tgt.t, mobileAutoT) });
      }
      if(untreated) tgt = Object.assign({}, tgt, { t: 0 });

      const k  = 1 - Math.pow(u.flying ? 0.00004 : 0.0009, dt);
      const ks = 1 - Math.pow(0.004, dt);
      u.cur.x  = lerp(u.cur.x,  tgt.x,  k);
      u.cur.y  = lerp(u.cur.y,  tgt.y,  k);
      u.cur.z  = lerp(u.cur.z,  tgt.z,  k);
      u.cur.rz = lerp(u.cur.rz, tgt.rz, k);
      u.cur.op = lerp(u.cur.op, tgt.op, ks);
      u.cur.dim= lerp(u.cur.dim,tgt.dim,ks);

      /* t fills at a fixed rate rather than easing toward the target. An
         exponential approach spends its whole tail near the end: it crawls
         the last few percent and never reads as having arrived at 100%. */
      const step = dt / (tgt.t > u.cur.t ? T_FILL : T_DRAIN);
      u.cur.t += clamp(tgt.t - u.cur.t, -step, step);

      m.position.set(u.cur.x, u.cur.y, u.cur.z);
      m.rotation.z = u.cur.rz;
      m.material.uniforms.uOpacity.value = u.cur.op;
      m.material.uniforms.uDim.value     = u.cur.dim;
      m.material.uniforms.uT.value       = u.cur.t;
      m.material.uniforms.uTime.value    = time;
      m.renderOrder = u.flying ? 10 : (N - slot);
    }

    renderer.render(scene, camera);
  }

  /* ---- lifecycle ------------------------------------------------------- */
  const ro = new ResizeObserver(layout);
  ro.observe(host);

  const io = new IntersectionObserver(
    (es) => { visible = es[0].isIntersecting; if(visible) cycleAt = performance.now(); },
    { threshold: 0 }
  );
  io.observe(host);

  document.addEventListener('visibilitychange', () => {
    if(document.hidden) visible = false;
    else { visible = true; cycleAt = performance.now(); }
  });

  layout();
  emit();
  frame();

  return {
    goTo,
    next: () => step(1),
    previous: () => step(-1),
    current: () => order[0],
    /* re-run onChange without moving the stack — the caption is built from
       the current language, so switching KO/EN has to repaint it */
    refresh: () => emit(),
    pause(){ running = false; },
    resume(){ running = true; cycleAt = performance.now(); },
    destroy(){
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      sheets.forEach(m => {
        if(m.material.uniforms.uTex.value) m.material.uniforms.uTex.value.dispose();
        m.material.dispose();
      });
      geo.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
}
