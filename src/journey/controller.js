// The story loop: scroll, smoothing, the render loop, keys, pointer, Play and the review hooks.
// Ported from the concept's main.js. React owns the page parts; this file only:
//   - writes the per-frame values (--cap, --intro, the rail progress) straight to the DOM, so React does not re-render each frame
//   - tells React when the hold, the chapter or the play state changes (on.site, on.world, on.play)
// The picture itself is story.js (what) and engine.js (how).
import { clamp, lerp, makeView } from './util.js';
import { createEngine, makeState } from './engine.js';
import { createStory, WORLD_TITLES } from './story.js';
import { makeSets } from './sets/all.js';

export { WORLD_TITLES };
export const WORLD_IDS = ['fly', 'index', 'globe', 'spiral', 'film', 'dust', 'hall'];
const THEME = ['dark', 'light', 'light', 'dark', 'light', 'dark', 'light'];

// Returns null when WebGL 2 is not available (the page then shows the plain grid).
export function createJourney({ content, els, reduce = false, flat = false, p0 = 0, on }) {
  const { sites } = content;
  const N = sites.length;
  let wake = () => {};
  let story, engine;
  try {
    story = createStory(content);
    engine = createEngine({ canvas: els.canvas, sites, root: '', setFactories: makeSets(story, { flat }), onKick: () => wake() });
  } catch (e) {
    console.warn('WebGL is not available, showing the plain grid.', e);
    return null;
  }

  const body = document.body, root = document.documentElement.style;
  const S = makeState(N);
  const holds = story.holdSegs;
  const worldSpan = WORLD_IDS.map((_, wi) => { const ss = story.segs.filter((s) => s.w === wi && s.kind !== 'trans'); return [ss[0].p0, ss[ss.length - 1].p1]; });
  let view = makeView(innerWidth, innerHeight), maxScroll = 1, pNow = 0, pTarget = 0, raf = 0, last = 0, tween = null, playing = false;
  let overlay = false, dead = false, wheelT = 0;
  const shown = { site: -2, world: -1, theme: '' };

  function layout() {
    view = makeView(innerWidth, innerHeight);
    story.layout(view); engine.resize(view);
    const unit = clamp(view.H * 0.62, 400, 720);
    maxScroll = Math.round(story.total * unit);
    els.track.style.height = (reduce ? view.H : maxScroll + view.H) + 'px';
    const r = view.rect, fh = r.fw * view.aspect / 1.6;
    root.setProperty('--sx', ((r.cx - r.fw / 2) * view.W).toFixed(1) + 'px'); root.setProperty('--sy', ((r.cy - fh / 2) * view.H).toFixed(1) + 'px');
    root.setProperty('--sw', (r.fw * view.W).toFixed(1) + 'px'); root.setProperty('--sh', (fh * view.H).toFixed(1) + 'px');
    if (!reduce) scrollTo(0, pTarget * maxScroll);
    fitName();
    wake();
  }

  // the name is set as large as one line allows (desktop), so the plate keeps one height
  const ruler = document.createElement('canvas').getContext('2d');
  function fitName() {
    const el = els.capName(); if (!el) return;
    const name = el.textContent;
    if (view.W < 760 || !name) { el.style.fontSize = ''; return; }
    ruler.font = '800 100px "Archivo", "Arial Narrow", sans-serif'; if ('fontStretch' in ruler) ruler.fontStretch = 'extra-condensed';
    const w = ruler.measureText(name.toUpperCase()).width / 100, avail = view.rect.fw * view.W - 250;
    el.style.fontSize = clamp(avail / w * 0.98, 24, Math.min(54, view.H * 0.06)).toFixed(1) + 'px';
  }

  function applyUI() {
    const ui = S.ui;
    if (ui.site !== shown.site) { shown.site = ui.site; on.site(ui.site); }
    const capA = ui.cap;
    els.cap().style.setProperty('--cap', capA.toFixed(3)); body.classList.toggle('has-cap', capA > 0.01);
    els.intro().style.setProperty('--intro', ui.intro.toFixed(3)); body.classList.toggle('has-intro', ui.intro > 0.01);
    if (ui.world !== shown.world) {
      shown.world = ui.world;
      for (const id of WORLD_IDS) body.classList.toggle('w-' + id, id === WORLD_IDS[ui.world]);
      on.world(ui.world);
    }
    const th = S.ui.theme || THEME[ui.world];
    if (th !== shown.theme) {
      shown.theme = th; body.dataset.theme = th;
      const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = th === 'dark' ? '#05070b' : '#efece4';
    }
    els.railButtons().forEach((b, i) => b && b.style.setProperty('--k', clamp((pNow - worldSpan[i][0]) / (worldSpan[i][1] - worldSpan[i][0])).toFixed(3)));
  }

  let busy = false, running = false, frames = 0, slow = 0;
  function frame(now) {
    raf = 0;
    if (document.hidden || dead) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    if (tween) {
      const k = clamp((now - tween.t0) / tween.ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      scrollTo(0, lerp(tween.from, tween.to, e)); if (k >= 1) tween = null;
    } else if (playing) {
      scrollTo(0, Math.min(maxScroll, scrollY + maxScroll / 150 * dt));
      if (scrollY >= maxScroll - 1) setPlay(false);
    }
    if (!reduce) pTarget = clamp(scrollY / maxScroll);
    const d = pTarget - pNow;
    const moving = Math.abs(d) > 0.00002;
    pNow = moving ? pNow + d * (1 - Math.exp(-dt * 9)) : pTarget;
    draw(now);
    // if this GPU cannot hold the frame rate while the story moves, draw fewer pixels
    if (running) { frames++; if (dt > 0.026) slow++; if (frames >= 80) { if (slow > 44) engine.lowerPixelRatio(); frames = 0; slow = 0; } }
    running = moving || !!tween || playing;
    if (moving || tween || playing || busy) raf = requestAnimationFrame(frame); else last = 0;
  }
  function draw(now) {
    story.evaluate(pNow, S);
    const w = S.ui.kind === 'trans' ? story.segs[S.ui.seg].w : S.ui.world;
    const need = new Set([w - 1, w, w + 1, S.ui.kind === 'trans' ? w + 2 : w]);
    engine.needSets([...need].filter((i) => i >= 0 && i < 7).map((i) => WORLD_IDS[i]));
    // the large capture of this hold and of the next one
    const h = S.ui.hold; for (const n of [h, h + 1]) if (n >= 0 && n < holds.length && holds[n].site >= 0) engine.wantHero(holds[n].site);
    busy = engine.render(S, now);
    applyUI();
  }
  wake = () => { if (!raf && !dead && !document.hidden && !overlay) raf = requestAnimationFrame(frame); };

  // ---------- moving through the story
  function goP(p, ms) {
    p = clamp(p);
    if (reduce) { body.classList.add('cut'); setTimeout(() => { pTarget = pNow = p; wake(); body.classList.remove('cut'); }, 240); return; }
    const to = p * maxScroll, dist = Math.abs(to - scrollY);
    tween = { from: scrollY, to, t0: performance.now(), ms: ms || clamp(600 + dist * 0.45, 700, 2600) }; wake();
  }
  function step(dir) {
    const cur = reduce ? pTarget : clamp(scrollY / maxScroll);
    const n = holds.findIndex((s) => s.pc > cur + 0.0015);
    if (dir > 0) { if (n < 0) return; goP(holds[n].pc); }
    else { let m = -1; for (let i = 0; i < holds.length; i++) if (holds[i].pc < cur - 0.0015) m = i; if (m >= 0) goP(holds[m].pc); }
  }
  function setPlay(v) {
    playing = v; on.play(v);
    if (v) { if (scrollY >= maxScroll - 2) scrollTo(0, 0); tween = null; wake(); }
  }
  const stopPlay = () => { if (playing) setPlay(false); };

  // ---------- events (all removed by destroy)
  const offs = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  listen(window, 'scroll', () => wake(), { passive: true });
  listen(window, 'wheel', (e) => {
    tween = null; stopPlay();
    if (reduce && !overlay) { const now = performance.now(); if (now - wheelT > 520 && Math.abs(e.deltaY) > 8) { wheelT = now; step(e.deltaY > 0 ? 1 : -1); } }
  }, { passive: true });
  listen(window, 'touchstart', () => { tween = null; stopPlay(); }, { passive: true });
  listen(window, 'keydown', (e) => {
    if (e.key === 'Escape') { on.escape(); return; }
    if (overlay || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase(), onButton = tag === 'button' || tag === 'a';
    if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !onButton)) { e.preventDefault(); stopPlay(); step(1); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); stopPlay(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); stopPlay(); goP(0); }
    else if (e.key === 'End') { e.preventDefault(); stopPlay(); goP(1); }
  });
  if (reduce) {
    let ty = 0;
    listen(window, 'touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
    listen(window, 'touchend', (e) => { const dy = e.changedTouches[0].clientY - ty; if (Math.abs(dy) > 40 && !overlay) step(dy < 0 ? 1 : -1); }, { passive: true });
  }

  // pointer: parallax, and a click on any site opens it
  const cv = els.canvas; let down = null;
  listen(window, 'pointermove', (e) => {
    if (e.pointerType === 'mouse' && !reduce) engine.setPointer((e.clientX / view.W) * 2 - 1, (e.clientY / view.H) * 2 - 1);
    if (e.pointerType === 'mouse') cv.style.cursor = engine.pick(e.clientX, e.clientY) >= 0 ? 'pointer' : '';
    wake();
  }, { passive: true });
  listen(cv, 'pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  listen(cv, 'pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
    if (moved > 8 || dt > 600) return;
    const i = engine.pick(e.clientX, e.clientY); if (i >= 0) on.open(i);
  });
  listen(window, 'resize', layout);
  listen(document, 'visibilitychange', () => { if (!document.hidden) { last = 0; wake(); } });

  // ---------- start
  const firstOrder = [story.fly.holds[0], ...story.fly.holds, ...sites.map((s, i) => i)];
  engine.loadThumbs(firstOrder);
  history.scrollRestoration = 'manual';
  layout();
  const start = clamp(p0 || 0);
  if (reduce) { pTarget = pNow = start; } else { scrollTo(0, start * maxScroll); pTarget = pNow = start; }
  body.classList.remove('boot');
  draw(performance.now()); wake();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitName(); wake(); });

  // ---------- review hooks
  window.__seek = (p) => { p = clamp(p); tween = null; playing = false; if (!reduce) scrollTo(0, p * maxScroll); pTarget = pNow = p; draw(performance.now()); wake(); return p; };
  window.__story = story; window.__engine = engine; window.__state = S;
  window.__holds = () => holds.map((s) => ({ p: +s.pc.toFixed(4), p0: +s.p0.toFixed(4), p1: +s.p1.toFixed(4), world: WORLD_TITLES[s.w], site: s.site >= 0 ? sites[s.site].id : 'contact' }));
  window.__map = () => story.segs.map((s) => ({ kind: s.kind, world: WORLD_TITLES[s.w], p0: +s.p0.toFixed(4), p1: +s.p1.toFixed(4), site: s.kind === 'hold' ? (s.site >= 0 ? sites[s.site].id : 'contact') : undefined }));
  // frame times over the whole story: steps = how many frames from p = 0 to p = 1
  window.__measure = (steps = 900) => new Promise((res) => {
    const ts = []; let i = 0, t0 = 0;
    const stat = (a) => { const s = a.map((x) => x.dt).sort((x, y) => x - y); return s.length ? { n: s.length, avg: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), max: +s[s.length - 1].toFixed(2) } : null; };
    const summarise = () => {
      const out = { all: stat(ts) };
      story.segs.forEach((sg) => { const key = (sg.kind === 'trans' ? 'T ' + WORLD_TITLES[sg.w] + ' > ' + WORLD_TITLES[sg.w + 1] : WORLD_TITLES[sg.w]); (out[key] = out[key] || []).push(...ts.filter((x) => x.p >= sg.p0 && x.p < sg.p1)); });
      for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = stat(out[k]);
      res(out);
    };
    const tick = (now) => { if (t0) ts.push({ p: i / steps, dt: now - t0 }); t0 = now; if (i > steps) { summarise(); return; } window.__seek(i / steps); i++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  engine.whenThumbs().then(() => { window.__ready = true; wake(); });

  return {
    story, engine, holds,
    togglePlay() { if (reduce) return step(1); setPlay(!playing); },
    stopPlay,
    goWorld(w) { stopPlay(); goP(story.worldP[w]); },
    home() { stopPlay(); goP(0); },
    // the project view or "All 48" is open: no keys, no Play, no frames behind it
    setOverlay(open) { overlay = open; if (open) stopPlay(); else wake(); },
    fitName,
    destroy() {
      dead = true; if (raf) cancelAnimationFrame(raf); raf = 0;
      offs.forEach((off) => off());
      try { engine.destroy(); } catch (e) { /* nothing to free */ }
    },
  };
}
