/* ============================================================
   shaders.js — the decomposition stack
   ------------------------------------------------------------
   Each series comes apart in its own language rather than every
   plate resolving into the same halftone:

     0  DITHER   —                   ordered threshold → 1-bit (unused; was
                                     Hwanggok's before mode 7 replaced it)
     1  PEEL     Hwanggok_Colorized  the generated colour lifted off as a sheet
                                     (modeMono below is the older version of
                                     this slot — kept, no longer called)
     2  DATA     reserved            band displacement, channel split, quantise
     3  METAL    Full Metal Plant    the iron surface hardening
     4  PIXEL    —                   the sampling grid coarsening (unused;
                                     Installation runs mode 5, plain, instead)
     5  NONE     Installation        no treatment — documentation, not a work
     6  CONTOUR  —                   iso-luminance line drawing (unused; was
                                     Hwanggok's before mode 7 replaced it)
     7  STREAK   Hwanggok            brightness-driven leftward comb/smear

   Colour space: on WebGL2 three gives hardware sRGB decode, so
   texture2D() returns LINEAR light, and a custom ShaderMaterial
   gets no automatic output encode — the framebuffer wants sRGB
   back. Everything in between is therefore done in sRGB, which is
   also the only space where thresholds and posterisation look
   correct.

   GLSL ES 1.00; three patches it for WebGL2. No derivative
   functions — anti-alias widths come from known cell sizes.
   ============================================================ */

export const VERT = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LIB = /* glsl */`
mat2 rot2(float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

float hash11(float p){
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 toSRGB(vec3 c){
  c = max(c, vec3(0.0));
  return mix(1.055 * pow(c, vec3(0.41666)) - 0.055, c * 12.92, step(c, vec3(0.0031308)));
}

/* recursive ordered dither — a Bayer matrix without array indexing,
   which GLSL ES 1.00 will not let us address dynamically */
float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }

/* Quantising each channel independently invents hues that were never in the
   photograph. Quantise tone instead and carry the chroma along with it. */
vec3 posteriseTone(vec3 c, float levels){
  float L  = luma(c);
  float Lq = floor(L * levels + 0.5) / levels;
  return c * clamp(Lq / max(L, 0.004), 0.0, 4.0);
}

float ruleFor(vec2 planePx){
  return clamp(max(planePx.x, planePx.y) / 48.0, 6.0, 46.0);
}

vec3 grainAdd(vec3 col, vec2 uv, vec2 planePx, float time, float amt){
  float g = hash21(uv * planePx + vec2(time * 53.0, time * 31.0)) - 0.5;
  return col + g * amt;
}

/* Average across one pixel block. At width 0 the four taps collapse onto the
   same point, so this degrades to a plain sample. Point-sampling a block
   centre instead would alias hard: the source is several times the plate's
   pixel size, so neighbouring blocks would grab unrelated texels. */
vec3 boxSample(sampler2D tex, vec2 uv, vec2 half4){
  vec3 s = texture2D(tex, uv + vec2(-half4.x, -half4.y)).rgb
         + texture2D(tex, uv + vec2( half4.x, -half4.y)).rgb
         + texture2D(tex, uv + vec2(-half4.x,  half4.y)).rgb
         + texture2D(tex, uv + vec2( half4.x,  half4.y)).rgb;
  return s * 0.25;
}

/* ---- 0 · DITHER — Hwanggok ---------------------------------------------
   The monochrome series already reads as a coarse screen print, so it comes
   apart the way a print does: an ordered threshold that coarsens until the
   image is a single bit deep. */
vec3 modeDither(vec3 c, vec2 uv, vec2 planePx, float t){
  float on     = smoothstep(0.02, 0.34, t);   /* the screen arrives */
  float coarse = smoothstep(0.30, 1.00, t);   /* cell grows, depth collapses */
  /* The cell has to be bigger than a pixel. At one device pixel the ordered
     pattern is indistinguishable from the photograph's own grain — and this
     series is grainy — so the middle stages read as no change at all. */
  float cellPx = mix(1.6, 6.0, coarse);
  float th     = bayer8(uv * planePx / cellPx);
  /* Dither each channel, not luminance. Thresholding luma alone collapses the
     plate to black and white — right for a monochrome series, wrong for
     colour photographs. Per channel it lands on an indexed palette instead,
     and a greyscale source still comes out greyscale because R=G=B quantise
     identically. */
  float levels = mix(255.0, mix(10.0, 4.0, pow(coarse, 0.6)), on);
  float steps  = max(levels - 1.0, 1.0);
  vec3  q      = floor(c * steps + th) / steps;
  return mix(c, clamp(q, 0.0, 1.0), on);
}

/* ---- 1 · MONO — Hwanggok_Colorized -------------------------------------
   The work applies generated colour to a monochrome capture. Taking it apart
   runs that backwards: the colour drains out, then the tone collapses. */
vec3 modeMono(vec3 c, float t){
  float drain = smoothstep(0.02, 0.66, t);   /* half gone by the second stage */
  float crush = smoothstep(0.62, 1.00, t);
  vec3  g     = vec3(luma(c));
  vec3  outc  = mix(c, g, drain);
  /* a gentle lift, not a hard stretch — these are night frames and a steep
     curve buries the shadows entirely */
  outc = mix(outc, clamp((outc - 0.45) * 1.20 + 0.45, 0.0, 1.0), drain * 0.5);
  float lv = mix(255.0, 7.0, crush);
  outc = mix(outc, floor(outc * lv + 0.5) / lv, crush);
  return outc;
}

/* ---- 1 · CHROMA PEEL — Hwanggok_Colorized ------------------------------
   Supersedes modeMono above (kept for reference, no longer called). Draining
   the colour to grey was the right idea and the wrong image of it: fading a
   slider to zero says the colour got weaker, when what the work is actually
   about is that the colour was never part of the photograph. A model put it
   there afterwards.

   So the colour is treated as a separate physical sheet laid over the
   capture. Luminance — the real exposure — stays exactly where it is, while
   chroma is read from a steadily displaced position, as if the tinted film
   were being peeled off the print: it lifts from one edge first, buckles
   along the way, slides clear, and only then is the frame monochrome. The
   end state matches where mono landed, but the route there shows the colour
   leaving as a layer rather than dimming in place. */
vec3 modeChromaPeel(sampler2D tex, vec2 uv, vec2 planePx, float t, float seed, vec3 c){
  float lift = smoothstep(0.02, 0.62, t);   /* the film comes loose */
  float gone = smoothstep(0.52, 1.00, t);   /* and finally leaves */

  /* which way, and from which edge, this particular frame peels */
  float ang  = hash11(seed * 53.1 + 7.7) * 6.2831853;
  vec2  away = vec2(cos(ang), sin(ang));
  float side = step(0.5, hash11(seed * 17.3 + 2.9));
  float grip = mix(uv.x, 1.0 - uv.x, side);        /* still stuck down at one edge */
  float peel = lift * mix(0.28, 1.0, grip);

  /* a slow buckle across the sheet, so it reads as material rather than as a
     uniform offset */
  float buckle = sin(uv.y * 16.0 + seed * 37.0) * 0.007 * lift;

  vec2 cuv = clamp(uv + away * peel * 0.085 + vec2(buckle, 0.0), 0.0008, 0.9992);

  vec3  lifted = toSRGB(texture2D(tex, cuv).rgb);
  float L      = luma(c);                          /* the capture does not move */
  vec3  chroma = lifted - vec3(luma(lifted));      /* colour only, from where the sheet now is */

  /* it saturates slightly as it detaches — a gel held up to the light — then
     goes entirely */
  vec3 outc = vec3(L) + chroma * mix(1.0, 1.5, lift) * (1.0 - gone);

  float crush = smoothstep(0.74, 1.00, t);
  float lv    = mix(255.0, 7.0, crush);
  outc = mix(outc, floor(outc * lv + 0.5) / lv, crush);
  return clamp(outc, 0.0, 1.0);
}

/* ---- 3 · METAL — Full Metal Plant --------------------------------------
   The plants were rendered with an iron surface. Here that surface keeps
   hardening: the tone curve steepens into specular, a brushed grain runs
   across it, and the whole thing cools towards steel. */
vec3 modeMetal(vec3 c, vec2 uv, vec2 planePx, float t){
  float s = smoothstep(0.02, 1.0, t);
  float L = luma(c);

  /* coarse horizontal brushing — fine noise averaged away to nothing and
     the plate simply got darker instead of harder */
  vec2  P    = uv * planePx;
  float row  = floor(P.y * 0.55);
  float fine = hash21(vec2(floor(P.x * 0.35), row));
  float band = hash11(row * 1.7);
  float brushed = (fine - 0.5) * 0.55 + (band - 0.5) * 0.45;

  /* an S-curve rather than a power: highlights harden into specular and
     shadows deepen, instead of the whole frame sinking */
  float k  = mix(1.0, 3.2, s);
  float Lc = clamp((L - 0.42) * k + 0.42, 0.0, 1.0);
  float m  = clamp(Lc + brushed * (0.10 + 0.30 * s), 0.0, 1.0);

  vec3 steel = vec3(0.86, 0.91, 1.00);
  vec3 metal = clamp(m * steel + pow(m, 6.0) * 0.35, 0.0, 1.0);
  return mix(c, metal, s);
}

/* ---- 6 · CONTOUR — Hwanggok --------------------------------------------
   The city in this series is assembled out of fragments of real places, and
   the criticism written about it talks about silkscreen texture and the
   punctum rather than anything digital. So it is reduced to a survey of
   itself: iso-luminance contours drawn over a photograph that recedes until
   only the drawing is left. Needs four extra taps for the gradient, since
   GLSL ES 1.00 has no derivatives here. */
vec3 modeContour(sampler2D tex, vec2 uv, vec2 planePx, float t, vec3 c){
  float on    = smoothstep(0.02, 0.34, t);   /* lines arrive */
  float strip = smoothstep(0.25, 1.00, t);   /* photograph recedes */
  float bands = mix(19.0, 8.0, smoothstep(0.05, 1.0, t));

  /* Read the tone from a blurred mip, never from the plate itself. These
     negatives are heavily grained, and at full resolution every speck crosses
     a threshold — the first attempt turned the whole frame into white noise.
     The bias deepens as it goes, so the drawing simplifies as well. */
  float bias = mix(3.0, 4.6, smoothstep(0.05, 1.0, t));
  vec2  px   = 1.0 / max(planePx, vec2(1.0));

  float l0 = floor(luma(toSRGB(texture2D(tex, uv, bias).rgb)) * bands);
  float lr = floor(luma(toSRGB(texture2D(tex, clamp(uv + vec2(px.x, 0.0), 0.0008, 0.9992), bias).rgb)) * bands);
  float lu = floor(luma(toSRGB(texture2D(tex, clamp(uv + vec2(0.0, px.y), 0.0008, 0.9992), bias).rgb)) * bands);

  /* a boundary is simply where two neighbours fall in different bands */
  float line = min(1.0, abs(l0 - lr) + abs(l0 - lu));

  vec3 base = mix(c, vec3(0.04), strip * 0.94);
  vec3 ink  = vec3(0.92, 0.94, 1.0) * line * mix(0.6, 1.0, strip) * on;
  return clamp(base + ink, 0.0, 1.0);
}

/* ---- 4 · PIXEL — Installation ------------------------------------------
   Room shots taken apart by the sampling grid alone: the blocks coarsen and
   the tone steps down, nothing else. */
vec3 modePixelColour(vec3 c, float t){
  float s  = smoothstep(0.30, 1.0, t);
  float lv = mix(255.0, 14.0, s);
  return mix(c, posteriseTone(c, lv), s);
}

/* ---- 7 · STREAK — Hwanggok (supersedes contour) ------------------------
   Replaces the iso-luminance contour as Hwanggok's active treatment. Each
   column casts its own reach to the left, sized by its own brightness, so
   highlights comb out into hairline trails while the near-black ground
   stays put — a photograph that is still itself on the right and dissolves
   into streaks on the left, rather than a filter laid over the whole frame.

   A first version picked a single winning tap per destination pixel with a
   hard reach cutoff. It read as pasted rectangles, not a continuous smear:
   the winner flips discretely from one destination pixel to the next
   whenever a neighbouring source's reach crosses the distance to it. Fixed
   two ways — a soft (smoothstep) edge on the cutoff instead of a hard
   if(), and a weighted blend across every tap instead of one winner, so
   neighbouring destinations shift gradually instead of jumping between
   sources.

   A second version read colour AND reach off the same blurred mip, the way
   modeContour reads one tone for its threshold — but here that blur lands
   directly in what's displayed, and the whole frame turned into a soft
   smudge with no distinct trails left. The fix is to split the two: colour
   stays a sharp, unbiased read, and only the value driving how far a tap
   reaches is taken from a gently blurred one, just enough to stop a single
   grain speck from spiking a streak that shouldn't be there.

   Every plate ran identical numbers at first, so the eighteen Hwanggok
   frames all combed the same distance in the same direction and the series
   read as one filter stamped on eighteen photographs. The seed (0..1, fixed
   per plate — see uSeed) now varies three things per image: how far the
   comb reaches, how high up the tonal range it bites, and a slight tilt off
   horizontal. The tilt stays small on purpose: swinging direction freely
   would break the series' read, while a few degrees is enough to stop two
   plates looking stamped from the same die. */
vec3 modeStreak(sampler2D tex, vec2 uv, vec2 planePx, float t, float seed, vec3 c){
  float amt = smoothstep(0.03, 1.0, t) * 0.95;
  if(amt <= 0.0001) return c;

  /* three decorrelated draws from the one seed */
  float rLen   = hash11(seed * 71.3 + 3.1);
  float rGamma = hash11(seed * 129.7 + 11.9);
  float rTilt  = hash11(seed * 37.7 + 57.3);

  float lenScale = mix(0.72, 1.34, rLen);          /* some plates barely comb, some run long */
  /* A gamma up at 2.4 meant only near-white specular pixels ever reached far
     enough to see, so the comb lived in the highlights and the picture looked
     almost untouched. Bringing it down lets the midtones — fur, concrete,
     foliage, the bulk of these frames — carry the streak too. */
  float gamma    = mix(1.25, 2.20, rGamma);        /* how far up the tones the streak bites */
  float tilt     = (rTilt - 0.5) * 0.10;           /* ±~3° off horizontal, no more */

  float maxLen   = mix(0.020, 0.34, amt) * lenScale;
  float lumaBias = mix(0.6, 1.6, amt);      /* gentle — stabilises reach only */

  /* aspect-corrected direction, so the tilt is a true angle rather than a
     shear that changes with the plate's proportions */
  vec2 dir = normalize(vec2(1.0, tilt * planePx.x / max(planePx.y, 1.0)));

  const int TAPS = 40;
  float stepUv = maxLen / float(TAPS);
  float reachDy = 1.5 / max(planePx.y, 1.0);

  vec3  num = vec3(0.0);
  float den = 0.0;
  for(int i = 0; i < TAPS; i++){
    float d   = float(i) * stepUv;
    vec2  suv = clamp(uv + dir * d, 0.0008, 0.9992);
    vec3  sc  = toSRGB(texture2D(tex, suv).rgb);                        /* sharp — this is what shows */
    float lm  = luma(toSRGB(texture2D(tex, suv, lumaBias).rgb));        /* soft — reach only */
    float lmUp = luma(toSRGB(texture2D(tex, clamp(suv + vec2(0.0, reachDy), 0.0008, 0.9992), lumaBias).rgb));
    float lmDn = luma(toSRGB(texture2D(tex, clamp(suv - vec2(0.0, reachDy), 0.0008, 0.9992), lumaBias).rgb));
    lm = (lm * 2.0 + lmUp + lmDn) * 0.25;
    float q     = pow(clamp(lm, 0.0, 1.0), gamma);   /* highlights reach further */
    float reach = q * maxLen;

    /* soft cutoff: full weight well inside reach, gone just past it —
       a hard if(d <= reach) is what produced the pasted-tile look */
    float lo = reach * 0.55;
    float hi = max(reach * 1.05, lo + 1e-4);
    float w  = (1.0 - smoothstep(lo, hi, d)) * (q + 0.015);

    num += w * sc;
    den += w;
  }
  vec3 streaked = clamp(num / max(den, 1e-4), 0.0, 1.0);
  return mix(c, streaked, amt);
}

/* ---- 7 · STREAK, hero variant -------------------------------------------
   The full comb is 40 taps × 4 texture reads across one full-screen quad.
   The hero draws roughly twenty overlapping sheets every frame, so the same
   loop there costs about two orders of magnitude more. This is the same
   shape at a tenth of the cost: 10 taps, one read each, a shorter reach.
   Enough that a Hwanggok sheet in the stack visibly combs rather than
   sitting there as an untouched photograph — which is what it did while
   mode 7 was skipped here entirely.

   The response curve matters more here than the loop does. The stack holds
   its sheets at t = 0.07 in front and 0.03 behind, so a ramp that starts
   climbing from zero returns an amount around 0.008 — arithmetically present
   and completely invisible, which is why the first attempt looked like
   nothing had changed. Streak is Hwanggok's identity rather than a hover
   flourish, so it gets a floor: clearly combed at rest, fully combed on
   hover. */
vec3 modeStreakLite(sampler2D tex, vec2 uv, vec2 planePx, float t, float seed, vec3 c){
  float amt = 0.34 + 0.54 * smoothstep(0.02, 0.55, t);

  float rLen  = hash11(seed * 71.3 + 3.1);
  float rTilt = hash11(seed * 37.7 + 57.3);

  float maxLen = mix(0.020, 0.115, amt) * mix(0.72, 1.34, rLen);
  float tilt   = (rTilt - 0.5) * 0.10;
  vec2  dir    = normalize(vec2(1.0, tilt * planePx.x / max(planePx.y, 1.0)));

  const int TAPS = 14;
  float stepUv = maxLen / float(TAPS);

  vec3  num = vec3(0.0);
  float den = 0.0;
  for(int i = 0; i < TAPS; i++){
    float d   = float(i) * stepUv;
    vec2  suv = clamp(uv + dir * d, 0.0008, 0.9992);
    vec3  sc  = toSRGB(texture2D(tex, suv, 1.2).rgb);
    float q   = pow(clamp(luma(sc), 0.0, 1.0), 1.7);
    float reach = q * maxLen;
    float lo = reach * 0.55;
    float hi = max(reach * 1.05, lo + 1e-4);
    float w  = (1.0 - smoothstep(lo, hi, d)) * (q + 0.015);
    num += w * sc;
    den += w;
  }
  return mix(c, clamp(num / max(den, 1e-4), 0.0, 1.0), amt);
}

/* ---- 8 · AFTERIMAGE — Midore --------------------------------------------
   The image does not break into pixels or colour channels. Instead, several
   complete photographic layers arrive at slightly different times: they drift
   a few pixels apart, hold as quiet translucent memories, then approach one
   another again. Slow phase changes keep the delay alive without turning the
   plate into a generic glitch effect. */
vec3 modeAfterimage(sampler2D tex, vec2 uv, vec2 planePx, float t, float time, vec3 c){
  float amt = smoothstep(0.02, 1.0, t);
  if(amt <= 0.0001) return c;

  vec2 px = 1.0 / max(planePx, vec2(1.0));
  float phase = time * 0.24;
  float reach = mix(0.0, 11.0, pow(amt, 0.82));

  /* Every tap carries the full colour image. The separation is between
     temporal layers, never between RGB channels. */
  vec2 d1 = vec2( cos(phase * 0.83),  sin(phase * 0.61)) * px * reach;
  vec2 d2 = vec2(-sin(phase * 0.57),  cos(phase * 0.71)) * px * reach * 0.68;
  vec2 d3 = vec2( sin(phase * 0.39), -cos(phase * 0.49)) * px * reach * 0.36;

  vec3 lag1 = toSRGB(texture2D(tex, clamp(uv + d1, 0.0008, 0.9992)).rgb);
  vec3 lag2 = toSRGB(texture2D(tex, clamp(uv + d2, 0.0008, 0.9992)).rgb);
  vec3 lag3 = toSRGB(texture2D(tex, clamp(uv + d3, 0.0008, 0.9992)).rgb);

  /* Broad, soft veils make neighbouring parts of the photograph remember a
     different layer. There is no tile grid and no hard mask boundary. */
  float veilA = 0.5 + 0.5 * sin(uv.y * 13.0 + uv.x * 2.7 - phase * 0.46);
  float veilB = 0.5 + 0.5 * sin(uv.x * 8.0  - uv.y * 3.1 + phase * 0.31 + 1.7);
  float mA = smoothstep(0.24, 0.76, veilA);
  float mB = smoothstep(0.30, 0.82, veilB) * 0.48;

  vec3 delayed = mix(lag1, lag2, mA);
  delayed = mix(delayed, lag3, mB);

  float blend = amt * mix(0.16, 0.44, amt);
  return clamp(mix(c, delayed, blend), 0.0, 1.0);
}
`;

/* ---- the full stack, used by the delamination viewer -------------------- */
export const DECOMPOSE = /* glsl */`
vec3 decompose(sampler2D tex, vec2 uv, vec2 planePx, float t, float time, float mode, float seed){
  /* mode 5 — no treatment at all. The exhibition views are documentation of
     the works, not works themselves; taking them apart says nothing. */
  if(mode > 4.5 && mode < 5.5) return clamp(toSRGB(texture2D(tex, uv).rgb), 0.0, 1.0);

  bool isDither = mode < 0.5;
  bool isData   = mode > 1.5 && mode < 2.5;
  bool isPixel  = mode > 3.5 && mode < 4.5;

  float ruling  = ruleFor(planePx);

  /* Datamosh residue (E). Data's own progress is patchy rather than uniform —
     tiles a few times the quantisation grid's size each get their own fixed
     delay, so as t advances some visibly haven't caught up: still close to
     the photograph while their neighbours have already broken into blocks.
     No feedback texture or previous-frame state needed — each tile just runs
     the rest of this function against an earlier, delayed t of its own. */
  float regionPx = ruling * 9.0;
  vec2  rCell    = floor(uv * planePx / regionPx);
  float delay    = isData ? hash21(rCell + 11.7) * 0.45 : 0.0;
  float tLocal   = max(0.0, t - delay);

  /* --- sampling: only the data and pixel modes disturb the grid ---------
     Ramps are placed so that each of the four stages (0 / .34 / .66 / 1) is
     visibly different — an effect that only shows up in the last stretch
     reads as nothing happening at all. Data's block/tone escalation runs on
     tLocal (so a lagging tile is also visibly less quantised, less posterised
     — behind on every axis, not just blurrier); the row/channel disturbance
     below stays on the plate's own global t, since staggering a horizontal
     band mid-row would tear it at the tile edge instead of reading as lag. */
  float s2 = pow(smoothstep(0.10, 0.95, t), 0.65);            /* pixel: block coarsening */
  float s3 = smoothstep(0.12, 0.85, t);                       /* data: band displacement */
  float sq = smoothstep(0.40, 1.00, isData ? tLocal : t);     /* data: grid quantisation */

  float blockPx = 1.0;
  if(isPixel) blockPx = mix(1.0, ruling * 3.4, s2);
  if(isData)  blockPx = mix(1.0, ruling * 3.0, sq);   /* A — was 1.9: blocks read as blocks now */

  vec2 u = uv;
  float band = 0.0;
  if(isData){
    float rows  = 84.0;
    float ry    = floor(uv.y * rows);
    float churn = floor(time * 2.0);
    band = step(0.70, hash11(ry * 1.37 + churn * 7.13));                     /* A — was 0.86: ~3x more rows glitch */
    u.x += (hash11(ry * 2.11 + churn * 3.7) - 0.5) * 0.14 * band * s3;       /* A — was 0.075 */
  }

  /* Dither, come apart. A screen laid flat over the picture reads as a
     filter; for the units to read as units they have to leave the grid. The
     plate is cut into tiles a few dither cells wide, each tile slides off its
     own position, and a share of them drop away entirely. */
  float dScatter = smoothstep(0.38, 1.00, t);
  float dTile    = mix(1.6, 5.2, smoothstep(0.28, 1.00, t)) * 4.0;
  vec2  dCell    = floor(uv * planePx / dTile);
  if(isDither){
    vec2 jitter = (vec2(hash21(dCell + 7.1), hash21(dCell + 41.9)) - 0.5)
                * dTile * 2.1 * dScatter;
    u = uv + jitter / max(planePx, vec2(1.0));
  }

  vec2 g       = max(planePx / blockPx, vec2(1.0));
  vec2 blockUV = 1.0 / g;
  float quant  = (isPixel ? s2 : (isData ? sq : 0.0));

  /* Channel misregistration is applied BEFORE quantisation and sized as a
     fraction of a block. Applied after, each channel would land in an
     unrelated block and the plate would read as random colour. */
  float caPx = blockPx * (0.12 + 0.70 * band) * s3;   /* A — band term was 0.35 */
  float ca   = isData ? caPx / max(planePx.x, 1.0) : 0.0;

  /* D — a vertical nudge on blue only, on the same rows that already glitch
     horizontally. Pure-horizontal misregistration reads as a camera's own
     chromatic aberration; adding a vertical component off the row grid reads
     as a decode desync instead — the axis a lens could never produce. */
  float rowParity = mod(floor(uv.y * planePx.y), 2.0) < 1.0 ? 1.0 : -1.0;
  float caY = isData ? (caPx * 0.4 / max(planePx.y, 1.0)) * band * rowParity : 0.0;

  vec2 uR = clamp(u + vec2(ca, 0.0),               0.0008, 0.9992);
  vec2 uG = clamp(u,                               0.0008, 0.9992);
  vec2 uB = clamp(vec2(u.x - ca, u.y + caY),       0.0008, 0.9992);

  vec2 qR = mix(uR, (floor(uR * g) + 0.5) * blockUV, quant);
  vec2 qG = mix(uG, (floor(uG * g) + 0.5) * blockUV, quant);
  vec2 qB = mix(uB, (floor(uB * g) + 0.5) * blockUV, quant);

  /* A — a tighter box (was 0.25 of the block) so a quantised tile reads as a
     flat swatch instead of a small soft-averaged mosaic: harder pixel edges. */
  vec2 h4 = blockUV * 0.06 * quant;
  vec3 lin = vec3(
    boxSample(tex, qR, h4).r,
    boxSample(tex, qG, h4).g,
    boxSample(tex, qB, h4).b
  );

  /* Brushed metal reflects anisotropically. A short smear along x sells the
     surface in a way the noise alone cannot. */
  if(mode > 2.5 && mode < 3.5){
    float sm = smoothstep(0.08, 1.0, t);
    float o  = sm * 2.5 / max(planePx.x, 1.0);
    vec3 a = texture2D(tex, clamp(uG + vec2(o, 0.0), 0.0008, 0.9992)).rgb;
    vec3 b = texture2D(tex, clamp(uG - vec2(o, 0.0), 0.0008, 0.9992)).rgb;
    lin = mix(lin, (lin + a + b) / 3.0, sm);
  }

  vec3 c = toSRGB(lin);

  /* --- the series' own treatment ---------------------------------------- */
  if(mode < 0.5){
    c = modeDither(c, uv, planePx, t);
    /* a share of the tiles falls away — the plate loses material, it does not
       merely acquire a texture */
    float keep = step(hash21(dCell + 3.3), mix(1.0, 0.83, dScatter));
    c *= mix(1.0, mix(0.10, 1.0, keep), dScatter);
  }else if(mode < 1.5){
    c = modeChromaPeel(tex, uv, planePx, t, seed, c);
  }else if(mode < 2.5){
    float ptAmt = smoothstep(0.45, 1.0, tLocal);        /* E — tone follows the tile's own lag too */
    float lv    = mix(255.0, 9.0, ptAmt);               /* A — was 16: coarser final tone steps */
    c = mix(c, posteriseTone(c, lv), ptAmt);

    /* B — opacity dropout. A scattered few quantised tiles don't get
       recoloured (Midore's own photographs already carry too wide a colour
       range for one fill hue to sit inside them without clashing) — they
       fade instead, toward either a faint ghost of their own true colour or
       toward near-black, as if that tile's data simply isn't there. Reuses
       the same tile grid (g) the quantisation above already sampled onto,
       so a dropout always lines up with exactly one visible block. Gated on
       tLocal and backloaded hard past 0.55, so early scrubbing stays close
       to the photograph and the breakdown is a late-stage event. */
    vec2  qCell = floor(u * g);
    float ch    = hash21(qCell + 3.3);
    float prob  = 0.09 * smoothstep(0.55, 1.0, tLocal);
    if(ch < prob){
      float strength = 0.55 + 0.45 * hash21(qCell + 8.8);
      float flavour  = hash21(qCell + 2.1);
      vec3  trueSrc  = toSRGB(texture2D(tex, uv).rgb);
      vec3  target   = flavour < 0.55 ? trueSrc * 0.16 : vec3(0.02, 0.02, 0.025);
      c = mix(c, target, strength);
    }
  }else if(mode < 3.5){
    c = modeMetal(c, uv, planePx, t);
  }else if(mode < 4.5){
    c = modePixelColour(c, t);
  }else if(mode < 6.5){
    c = modeContour(tex, uv, planePx, t, c);
  }else if(mode < 7.5){
    c = modeStreak(tex, uv, planePx, t, seed, c);
  }else{
    c = modeAfterimage(tex, uv, planePx, t, time, c);
  }

  return clamp(grainAdd(c, uv, planePx, time, 0.014 + 0.030 * t), 0.0, 1.0);
}
`;

/* ---- full-screen delamination viewer ------------------------------------ */
export const FRAG_DELAM = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2  uPlanePx;
uniform float uT;
uniform float uTime;
uniform float uFade;
uniform float uMode;
uniform float uSeed;
${LIB}
${DECOMPOSE}
void main(){
  gl_FragColor = vec4(decompose(uTex, vUv, uPlanePx, uT, uTime, uMode, uSeed), uFade);
}
`;

/* ---- hero stack sheet ---------------------------------------------------
   The sheets sit at a very low t, so each one only shows a trace of its own
   treatment. Kept cheap: one tap for dither, mono and metal, a quantised tap
   for pixel, three for data — across five overlapping planes.
   ------------------------------------------------------------------------ */
export const FRAG_PLATE = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2  uPlanePx;
uniform float uT;
uniform float uTime;
uniform float uDim;
uniform float uOpacity;
uniform float uHasTex;
uniform float uMode;
uniform float uSeed;
${LIB}
void main(){
  bool isDither = uMode < 0.5;
  bool isData   = uMode > 1.5 && uMode < 2.5;
  bool isPixel  = uMode > 3.5 && uMode < 4.5;
  bool isPlain  = uMode > 4.5 && uMode < 5.5;

  float ruling = ruleFor(uPlanePx);
  vec2  u = vUv;
  float ca = 0.0;

  /* the tiles slide off the grid here too, so a hovered sheet reads as coming
     apart rather than as a screen dropped on top of it */
  float dScatter = smoothstep(0.20, 0.62, uT);
  float dTile    = mix(1.6, 5.2, smoothstep(0.15, 0.62, uT)) * 4.0;
  vec2  dCell    = floor(vUv * uPlanePx / dTile);
  if(isDither){
    vec2 jitter = (vec2(hash21(dCell + 7.1), hash21(dCell + 41.9)) - 0.5)
                * dTile * 2.1 * dScatter;
    u = vUv + jitter / max(uPlanePx, vec2(1.0));
  }

  if(isPixel){
    float blockPx = mix(1.0, ruling * 2.2, smoothstep(0.02, 0.35, uT));
    vec2  g = max(uPlanePx / blockPx, vec2(1.0));
    u = (floor(u * g) + 0.5) / g;
  }
  if(isData){
    /* the hero sheets are small and briefly seen, so the displacement has to
       be wider than on a full-screen plate or the hover reads as nothing */
    float on   = smoothstep(0.05, 0.62, uT);
    float ry   = floor(vUv.y * 84.0);
    float band = step(0.78, hash11(ry * 1.37 + floor(uTime * 2.0) * 7.13));
    u.x += (hash11(ry * 2.11) - 0.5) * 0.085 * band * on;
    ca = (0.003 + 0.012 * band) * on;
  }
  u = clamp(u, 0.0008, 0.9992);

  vec3 lin = texture2D(uTex, u).rgb;
  if(ca > 0.0){
    lin.r = texture2D(uTex, clamp(u + vec2(ca, 0.0), 0.0008, 0.9992)).r;
    lin.b = texture2D(uTex, clamp(u - vec2(ca, 0.0), 0.0008, 0.9992)).b;
  }

  vec3 c = toSRGB(lin);
  c = mix(vec3(0.085, 0.085, 0.092), c, uHasTex);

  if(!isPlain){
    if(uMode < 0.5){
      c = modeDither(c, vUv, uPlanePx, uT);
      float keep = step(hash21(dCell + 3.3), mix(1.0, 0.83, dScatter));
      c *= mix(1.0, mix(0.10, 1.0, keep), dScatter);
    }
    else if(uMode < 1.5)  c = modeChromaPeel(uTex, vUv, uPlanePx, uT, uSeed, c);
    else if(uMode > 2.5 && uMode < 3.5) c = modeMetal(c, vUv, uPlanePx, uT);
    else if(uMode > 5.5 && uMode < 6.5) c = modeContour(uTex, vUv, uPlanePx, uT, c);
    else if(uMode > 6.5 && uMode < 7.5) c = modeStreakLite(uTex, vUv, uPlanePx, uT, uSeed, c);
    else if(uMode > 7.5) c = modeAfterimage(uTex, vUv, uPlanePx, uT, uTime, c);
  }

  /* recede: darken and lose contrast with depth */
  c = mix(c, vec3(0.075, 0.075, 0.082), uDim * 0.78);

  /* the cut side of a sheet catches light */
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = smoothstep(0.0, 0.005, min(e.x, e.y));
  c = mix(c * 1.3 + 0.10, c, edge);

  if(!isPlain) c = grainAdd(c, vUv, uPlanePx, uTime, 0.014 + 0.030 * uT);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), uOpacity);
}
`;
