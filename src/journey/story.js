// 11 Journey: the story. Every frame is a pure function of the scroll position p (0 to 1).
// evaluate(p, S) fills a state: the camera, the 48 site planes, the sky / floor / fog, and one small
// parameter block per world set (S.x.<world>). Nothing here keeps time.
//
// Global space: metres, y up, the journey travels toward -z. A "big screen" is 2.6 m wide.
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, seg, ease, es, bump, wrapPi, bezierEase, rng, V3, AX, AY, Q_ID, Q_FLAT, fovFor, tanV, frameOn, placeInRect, lookQuat, yawQuat, eulerQuat } from './util.js';
import { makeState, resetPlane, copyPlane, mixEnv, mixCam } from './engine.js';
import { buildPlan, EYE, ROOMS, X_END, PORTAL } from './plan.js';

export const SW = 2.6, SH = 1.625;
const PAPER = 0xefece4, INK = 0x11120f, BLACK = 0x050607;
const WORLD_IDS = ['fly', 'index', 'globe', 'spiral', 'film', 'dust', 'hall'];
export const WORLD_TITLES = ['Fly-through', 'Index', 'Globe', 'Spiral', 'Film', 'Particles', 'Hall'];

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _col = new THREE.Color();
const NUM = ['w', 'op', 'lit', 'sat', 'blur', 'corner', 'curve', 'bendY', 'vblur', 'border', 'body', 'bez', 'grain', 'halo', 'shadow', 'edge', 'fogK'];
function mixPlane(out, a, b, t) {
  out.pos.lerpVectors(a.pos, b.pos, t); out.quat.slerpQuaternions(a.quat, b.quat, t);
  for (const k of NUM) out[k] = a[k] + (b[k] - a[k]) * t;
  out.hi = t < 0.5 ? a.hi : b.hi; out.clip = t < 0.5 ? a.clip : b.clip; out.borderCol = t < 0.5 ? a.borderCol : b.borderCol; out.order = t < 0.5 ? a.order : b.order;
  out.vis = a.vis || b.vis; out.pick = t < 0.5 ? a.pick : b.pick;
  if (!a.vis) out.op = b.op * t; else if (!b.vis) out.op = a.op * (1 - t);
  return out;
}
function setEnvFlat(env, sky, fog, den) { env.skyTop.set(sky); env.skyHor.set(sky); env.glow.set(0); env.fogCol.set(fog); env.fogDen = den; env.floor.on = 0; env.floor.col.set(fog); env.floor.refl = 0; env.floor.seam = 0; env.floor.front = 0; env.floor.frontSoft = 0; env.floor.sweepSoft = 0; env.shadowA = 0; env.bodyLit = 0; env.clip[0] = 0; env.clip[1] = 0; env.clip[2] = 1; env.clip[3] = 1; }

export function createStory(content) {
  const sites = content.sites, N = sites.length;
  const ix = (id) => { const i = sites.findIndex((s) => s.id === id); if (i < 0) throw new Error('no site ' + id); return i; };
  let view = null;
  const Sa = makeState(N), Sb = makeState(N), Sc = makeState(N);
  const tmpCam = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 42, par: 0.05 }, tmpCam2 = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 42, par: 0.05 };
  const tmpPl = makeState(1).planes[0], tmpPl2 = makeState(1).planes[0];
  const newX = () => ({
    fly: { on: 0 }, index: { on: 0, f: 0, rowsIn: 1, link: 0 }, globe: { on: 0, pos: new THREE.Vector3(), night: 0, focus: -1, label: 0, cards: [] },
    spiral: { on: 0 }, film: { on: 0, up: 1, night: 0, light: 1, fade: 0 }, dust: { on: 0, a: -1, b: -1, mix: 1, wave: 0, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), w: SW, grains: 1 },
    hall: { on: 0, light: 1, lightX: 0 },
  });
  for (const s of [Sa, Sb, Sc]) s.x = newX();

  /* ====================================================================== 1. FLY-THROUGH
     48 huge screens over a dark mirror floor, in 8 lanes (01-flythrough). */
  const fly = (() => {
    const K = 0.1625, LANE = 37 * K, ROW = 48 * K, ZGAP = 16 * K, CY = SH / 2 + 1.1 * K, Z0 = 190, FOV = 42;
    const LANES = [
      ['shopify', ['sherwood', 'vior', 'carly', 'warrior-council', 'omari', 'academy']],
      ['shopify', ['pacha-mana', 'church-of-truth', 'waterhouse', 'back-to-earth', 'momsnbubs', 'find-a-spring']],
      ['shopify', ['california-89', 'bear-river', 'vac-stack', 'people-of-the-forest', 'jacqueline', 'retreat-spaces']],
      ['landing', ['sequoia-wildfire', 'meraki-audio', 'terra-atelier', 'helios-grid', 'orbita-keys', 'vibeport', 'ad-copy']],
      ['landing', ['manahouse-3d', 'lumina-espresso', 'meridian-horology', 'cascade-bath', 'lumen-observatory', 'manahouse']],
      ['landing', ['sequoia-rentals', 'aerie-dynamics', 'marrow-moss', 'origin-aspect', 'structured-cabling', 'car-shades']],
      ['business', ['zafran', 'sequoia-security', 'sequoia-services', 'car-shades-portfolio', 'web-lumin', 'sequoia-security-v1']],
      ['business', ['underhill', 'sequoia-drone', 'aniwa', 'sequoia-boat-old', 'drone-peach']],
    ];
    const stops = new Array(N);
    { let zone = -1, prev = null, zoneStart = 0; const xs = [];
      LANES.forEach(([cat, ids], lane) => {
        if (cat !== prev) { zone++; prev = cat; zoneStart = lane; }
        const inZone = LANES.filter((l) => l[0] === cat).length, k = lane - zoneStart, slot = inZone === 3 ? [1, 0, 2][k] : k;
        const x = (zoneStart + slot) * LANE + zone * ZGAP;
        ids.forEach((id, row) => { stops[ix(id)] = { x, z: Z0 - row * ROW, row, lane }; xs.push(x); });
      });
      const mid = (Math.min(...xs) + Math.max(...xs)) / 2; for (const s of stops) s.x -= mid; }
    const holds = ['sherwood', 'vior', 'bear-river'].map(ix);
    const glow = sites.map((s) => { const c = new THREE.Color(s.accent || '#1a1410'), h = {}; c.getHSL(h, THREE.SRGBColorSpace); return c.setHSL(h.h, clamp(h.s * 1.3, 0, 0.75), clamp(h.l * 0.26 + 0.03, 0.04, 0.1), THREE.SRGBColorSpace); });
    const EASE_FLY = bezierEase(0.55, 0.0, 0.12, 1.0);
    const cams = holds.map(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: FOV, par: 0.07, d: 3 }));
    let fov = FOV;
    function layout() {
      fov = fovFor(FOV, view);
      holds.forEach((i, j) => { const s = stops[i]; frameOn(_a.set(s.x, CY, s.z), Q_ID, SW, view.rect, fov, view, cams[j]); cams[j].par = 0.07; });
    }
    function env(S, gcol, camY) {
      const e = S.env;
      e.skyTop.set(0x04060a); e.skyHor.set(0x0a0e14); e.glow.copy(gcol);
      e.fogCol.set(0x0a0e14).add(gcol); e.fogDen = lerp(0.0394, 0.0068, smooth(0.65, 13, camY));
      const f = e.floor; f.on = 1; f.col.set(0x030406); f.refl = 0.74; f.fresMin = 0.16; f.fresPow = 1.7; f.seam = 0; f.blur = 1.25; f.front = 0; f.frontSoft = 0; f.sweepSoft = 0;
      e.shadowA = 0; e.bodyLit = 0; e.clip[0] = 0; e.clip[1] = 0; e.clip[2] = 1; e.clip[3] = 1;
    }
    // every screen at its stop. landed = 1 when the camera rests on `focus`
    function planes(S, focus, landed) {
      for (let i = 0; i < N; i++) {
        const p = S.planes[i], s = stops[i];
        p.pos.set(s.x, CY, s.z); p.quat.identity(); p.w = SW; p.corner = 0.039; p.body = 1; p.bez = -0.04; p.edge = 1;
        p.lit = i === focus ? lerp(0.98, 1, landed) : lerp(0.96, 0.62, landed);
        p.halo = 0.17 * (i === focus ? 1.2 : 1) * (0.55 + 0.45 * p.lit);
        p.hi = i === focus ? 1 : 0;
      }
    }
    function flight(j, t, cam) {
      const A = cams[j], B = cams[j + 1], sB = stops[holds[j + 1]], sA = stops[holds[j]];
      const u = EASE_FLY(t);
      const at = (uu, out) => {
        out.lerpVectors(A.pos, B.pos, uu);
        if (Math.abs(sA.x - sB.x) < 0.1) {            // next screen in the same lane: thread the gap beside it
          const uA = clamp(A.d / ROW, 0.12, 0.88), warp = Math.log(0.5) / Math.log(uA), sn = Math.sin(Math.PI * Math.pow(uu, warp));
          const side = -1, xc = sB.x + side * LANE / 2, xl = lerp(A.pos.x, B.pos.x, uA);
          out.x += (xc - xl) * sn * sn;
        } else out.y += clamp(A.pos.distanceTo(B.pos) * 0.15, 0, 8.4) * Math.pow(Math.sin(Math.PI * uu), 0.75);
        return out;
      };
      at(u, cam.pos);
      const ax = B.pos.x - cam.pos.x, ay = B.pos.y - cam.pos.y, az = sB.z - cam.pos.z;
      const k = smooth(0, 0.22, u) * smooth(3 * K, 34 * K, -az);
      const yaw = clamp(Math.atan2(-ax, Math.max(-az, 0.001)), -0.95, 0.95) * k * 0.88;
      let pitch = clamp(Math.atan2(ay, Math.hypot(ax, az)), -1.2, 0.5) * k * 0.92;
      pitch += (1 - k) * -Math.atan((cam.pos.y - lerp(A.pos.y, B.pos.y, u)) / (150 * K));
      const x0 = at(clamp(u - 0.02), _a).x, x1 = at(clamp(u + 0.02), _b).x;
      const roll = clamp(-(x1 - x0) / 0.04 * 0.012, -0.11, 0.11) * Math.sin(Math.PI * t);
      eulerQuat(pitch, yaw, roll, cam.quat); cam.fov = fov + 6 * Math.sin(Math.PI * t) * Math.sin(Math.PI * t); cam.par = 0.07;
    }
    function pose(j, t, S) {
      S.x.fly.on = 1; S.cam.near = 0.05; S.cam.far = 1600;
      if (t <= 0) {
        const c = cams[j]; S.cam.pos.copy(c.pos); S.cam.quat.copy(c.quat); S.cam.fov = fov; S.cam.par = c.par;
        planes(S, holds[j], 1); env(S, glow[holds[j]], c.pos.y); S.x.fly.focus = holds[j];
        return;
      }
      flight(j, t, S.cam);
      const first = t < 0.5, landed = first ? 1 - smooth(0, 0.2, t) : smooth(0.72, 1, t), f = first ? holds[j] : holds[j + 1];
      planes(S, f, landed);
      if (t > 0.3 && t < 0.5) S.planes[holds[j]].hi = 0;
      _col.copy(glow[holds[j]]).lerp(glow[holds[j + 1]], smooth(0.2, 0.8, t)); env(S, _col, S.cam.pos.y); S.x.fly.focus = f;
    }
    return { id: 'fly', holds, pose, layout, stops, K, LANE, ROW, CY, Z0, glow, env, planes, travelLen: [1.25, 1.2] };
  })();

  /* ====================================================================== 2. INDEX
     A paper page seen from straight above: the names in poster type, and one frame where the sites roll past (02-index). */
  const index = (() => {
    const FOV = 42, PX = 0, PZ = 158;
    const ORDER = ['sherwood', 'vior', 'bear-river', 'pacha-mana', 'carly', 'waterhouse', 'church-of-truth', 'back-to-earth', 'california-89', 'people-of-the-forest', 'warrior-council',
      'vac-stack', 'omari', 'academy', 'momsnbubs', 'jacqueline', 'find-a-spring', 'retreat-spaces',
      'sequoia-wildfire', 'manahouse-3d', 'meraki-audio', 'lumina-espresso', 'aerie-dynamics', 'sequoia-rentals', 'origin-aspect', 'manahouse', 'vibeport', 'structured-cabling', 'terra-atelier',
      'meridian-horology', 'helios-grid', 'cascade-bath', 'orbita-keys', 'marrow-moss', 'lumen-observatory', 'ad-copy', 'car-shades',
      'zafran', 'underhill', 'sequoia-security', 'sequoia-services', 'sequoia-drone', 'car-shades-portfolio', 'sequoia-boat-old', 'drone-peach', 'sequoia-security-v1', 'web-lumin', 'aniwa'].map(ix);
    const rowOf = new Array(N); ORDER.forEach((i, r) => { rowOf[i] = r; });
    const holds = ['pacha-mana', 'waterhouse', 'back-to-earth'].map(ix);
    const L = { fov: FOV, visW: 4, visH: 3, hI: 3, fs: 0.19, lh: 0.17, colX: 0, colW: 1.2, focusY: 0.43, pitch: SH + 0.22, rows: [], heads: [], PX, PZ, order: ORDER, rowOf, maxChars: 16 };
    function wrap(name, max) {
      const words = name.toUpperCase().split(' '), lines = []; let cur = '';
      for (const w of words) { if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
      if (cur) lines.push(cur); return lines;
    }
    function layout() {
      const r = view.rect;
      L.fov = fovFor(FOV, view); L.visW = SW / r.fw; L.visH = L.visW / view.aspect; L.hI = L.visH / (2 * tanV(L.fov));
      const wide = view.k > 0.5;
      L.colX = PX - L.visW / 2 + L.visW * (wide ? 0.028 : 0.05); L.colW = L.visW * (wide ? 0.295 : 0.9);
      L.maxChars = wide ? 15 : 22;
      L.fs = L.colW * 0.915 / (L.maxChars * 0.43); L.lh = L.fs * 0.86; L.focusY = wide ? r.cy : 0.66;
      L.rows = []; L.heads = [];
      let v = L.fs * 0.6, cat = null;
      ORDER.forEach((i, rI) => {
        const s = sites[i];
        if (s.cat !== cat) { cat = s.cat; v += L.fs * (rI ? 1.5 : 0); L.heads.push({ v, cat, label: s.catLabel, count: sites.filter((q) => q.cat === cat).length }); v += L.fs * 0.9; }
        const lines = wrap(s.name, L.maxChars), h = lines.length * L.lh;
        L.rows.push({ i, r: rI, v0: v, vc: v + h / 2, h, lines, is3d: !!s.is3d, concept: !!s.concept });
        v += h + L.fs * 0.34;
      });
      L.height = v;
    }
    const vAt = (f) => { const a = clamp(Math.floor(f), 0, N - 1), b = Math.min(N - 1, a + 1), k = clamp(f - a); return lerp(L.rows[a].vc, L.rows[b].vc, k); };
    function camAt(f, cam) { cam.pos.set(PX, L.hI, PZ + vAt(f) + (0.5 - L.focusY - view.shift) * L.visH); cam.quat.copy(Q_FLAT); cam.fov = L.fov; cam.par = 0.03; return cam; }
    function gateAt(f, out) {     // centre of the frame on the page
      const r = view.rect;
      out.set(PX + (r.cx - 0.5) * L.visW, 0.004, PZ + vAt(f) + (r.cy - L.focusY) * L.visH); return out;
    }
    // speed: how fast the reel moves (0 at rest). It bends and blurs the sheets.
    function at(f, S, speed = 0) {
      S.x.index.on = 1; S.x.index.f = f; S.x.index.rowsIn = 1; S.x.index.gate = 1; S.x.index.link = 1 - clamp(Math.abs(speed) * 3);
      camAt(f, S.cam); S.cam.near = 0.05; S.cam.far = 1600;
      gateAt(f, _a);
      for (let i = 0; i < N; i++) {
        const p = S.planes[i], d = rowOf[i] - f;
        p.pos.set(_a.x, 0.004, _a.z + d * L.pitch); p.quat.copy(Q_FLAT); p.w = SW; p.corner = 0.014; p.clip = 1; p.edge = 0; p.fogK = 0;
        p.vis = Math.abs(d) < 3.2; p.hi = Math.abs(d) < 0.5 ? 1 : 0; p.bendY = -speed * 1.5; p.vblur = Math.abs(speed) * 0.008; p.order = 2;
      }
      const e = S.env; setEnvFlat(e, PAPER, PAPER, 0.004);
      e.floor.on = 1; e.floor.col.set(PAPER);
      const r = view.rect, fh = r.fw * view.aspect / 1.6;
      e.clip[0] = r.cx - r.fw / 2; e.clip[1] = r.cy - fh / 2; e.clip[2] = r.cx + r.fw / 2; e.clip[3] = r.cy + fh / 2;
      S.x.index.focus = ORDER[clamp(Math.round(f), 0, N - 1)];
    }
    function pose(j, t, S) {
      if (t <= 0) return at(rowOf[holds[j]], S, 0);
      const fa = rowOf[holds[j]], fb = rowOf[holds[j + 1]], e = ease(t);
      at(lerp(fa, fb, e), S, (ease(Math.min(1, t + 0.02)) - ease(Math.max(0, t - 0.02))) / 0.04 * 0.33);
    }
    return { id: 'index', holds, pose, layout, at, camAt, gateAt, L, rowOf, ORDER, travelLen: [1.1, 1.1] };
  })();

  /* ====================================================================== 3. GLOBE
     A real globe. A client's site stands on a pin at the client's town (04-globe). Only towns named in `client`. */
  const globe = (() => {
    const R = 12, C = V3(0, 14, 100), FOV = 30;
    const GAZ = [
      { id: 'kamloops', re: /\bKamloops\b/i, name: 'Kamloops', region: 'BC', lat: 50.6745, lon: -120.3273 },
      { id: 'coquitlam', re: /\bCoquitlam\b/i, name: 'Coquitlam', region: 'BC', lat: 49.2838, lon: -122.7932 },
      { id: 'nevada-city', re: /\bNevada City\b/i, name: 'Nevada City', region: 'CA', lat: 39.2616, lon: -121.0161 },
      { id: 'tahoe-city', re: /\bTahoe City\b/i, name: 'Tahoe City', region: 'CA', lat: 39.1721, lon: -120.1388 },
      { id: 'truckee', re: /\bTruckee\b/i, name: 'Truckee', region: 'CA', lat: 39.328, lon: -120.1833 },
    ];
    const RAD = Math.PI / 180;
    const unit = (lat, lon, out = new THREE.Vector3()) => { const f = lat * RAD, l = lon * RAD; return out.set(Math.cos(f) * Math.sin(l), Math.sin(f), Math.cos(f) * Math.cos(l)); };
    // turn the globe so that the west coast of North America faces the camera that comes from +z, north up
    const quat = new THREE.Quaternion();
    { const n0 = unit(45, -121.5), tN = V3(0, 1, 0).addScaledVector(n0, -n0.y).normalize(), tE = tN.clone().cross(n0);
      const D0 = V3(0, 0.45, 1).normalize(), U = V3(0, 1, 0).addScaledVector(D0, -D0.y).normalize(), X = U.clone().cross(D0);
      const Lm = new THREE.Matrix4().makeBasis(tE, tN, n0), Gm = new THREE.Matrix4().makeBasis(X, U, D0);
      quat.setFromRotationMatrix(Gm.multiply(Lm.transpose())); }
    const north = V3(0, 1, 0).applyQuaternion(quat);
    const pins = GAZ.map((g) => ({ ...g, sites: sites.map((s, i) => (s.client && g.re.test(s.client) ? i : -1)).filter((i) => i >= 0), n: unit(g.lat, g.lon).applyQuaternion(quat) })).filter((p) => p.sites.length);
    const pinOf = new Array(N).fill(null), slot = new Array(N).fill(0);
    for (const p of pins) p.sites.forEach((i, k) => { if (!pinOf[i]) { pinOf[i] = p; slot[i] = k; } });
    const pinned = sites.map((s, i) => i).filter((i) => pinOf[i]);
    const holds = ['california-89', 'sequoia-rentals', 'zafran'].map(ix);
    const D0 = V3(0, 0.45, 1).normalize();
    let fov = FOV;
    const G = { R, C, quat, pins, pinOf, pinned, unit, north, D0, fov: FOV, GAZ };
    function layout() { fov = fovFor(FOV, view); G.fov = fov; }
    function frameAt(n, tN, tE) { tN.copy(north).addScaledVector(n, -north.dot(n)).normalize(); tE.copy(tN).cross(n); }
    // camera over the point n (unit, from the centre) at height alt
    const tN = new THREE.Vector3(), tE = new THREE.Vector3(), P = new THREE.Vector3(), T = new THREE.Vector3();
    // The camera stands south of the point, on its meridian, and looks north and a little east. So the meridian of the pin runs
    // straight up the left column (north is up there), the pin sits at the screen share px, and the curved horizon shows above it.
    function camOver(n, alt, off, cam, px = 0.24) {
      frameAt(n, tN, tE);
      // py = how far down the screen the pin sits. The optical axis is at the height of the site rectangle (the lens shift of the engine).
      const k = view.k, back = alt * lerp(0.74, 2.0, k), py = lerp(0.79, 0.575, k), tv = tanV(fov);
      const pitch = Math.max(0.1, Math.atan(alt / back) - Math.atan((py - view.rect.cy) * 2 * tv)), g = alt / Math.tan(pitch);
      const psi = Math.atan((0.5 - lerp(0.5, px, k)) * 2 * tv * view.aspect * 1.04);
      P.copy(C).add(off).addScaledVector(n, R);
      T.copy(P).addScaledVector(tN, g - back).addScaledVector(tE, Math.hypot(g, alt) * Math.tan(psi));
      cam.pos.copy(P).addScaledVector(n, alt).addScaledVector(tN, -back);
      lookQuat(cam.pos, T, n, cam.quat); cam.fov = fov; cam.par = 0.02; return cam;
    }
    // cards: every pinned site stands at its pin as a small card that faces the camera. m[i] = 1 puts site i in the hold rect.
    const up = new THREE.Vector3(), rt = new THREE.Vector3();
    // Where the cards of a town stand from its pin at each hold: [x, y] of the middle of the set, in card widths (wide window, phone).
    // They stay in the left column, clear of the big card, the tag of the town and the name at the top left.
    const AN = (a) => ({ 'tahoe-city': a.sierra, truckee: a.sierra, 'nevada-city': a.nevada, kamloops: a.kamloops, coquitlam: a.coquitlam });
    const ANCH = [
      AN({ sierra: [0.66, 0.7, 0.7, 0.7], nevada: [-0.62, 0.72, -0.62, 0.7], kamloops: [0.7, 0.95, 0.2, 0.95], coquitlam: [-0.1, 0.55, -0.6, 0.55] }),
      AN({ sierra: [0.66, 0.7, 0.7, 0.7], nevada: [-0.62, 0.72, -0.62, 0.7], kamloops: [-0.74, 1.13, 0, 0.98], coquitlam: [-0.1, 0.66, -0.3, 0.6] }),
      AN({ sierra: [0.66, 0.7, 0.7, 0.7], nevada: [-0.62, 0.72, -0.62, 0.7], kamloops: [-0.95, 0.94, 0.2, 0.98], coquitlam: [-0.62, 0.72, -0.5, 0.6] }),
    ];
    const PINX = [0.24, 0.27, 0.145];          // where the pin of the site in focus sits across the screen at each hold
    let ancA = -1, ancB = -1, ancE = 0;        // set by pose() during a travel; otherwise the hold of the site in focus
    function cards(S, cam, off, focus, m) {
      const X = S.x.globe; X.on = 1; X.pos.copy(C).add(off); X.cards.length = 0; X.focus = focus; X.label = m;
      up.set(0, 1, 0).applyQuaternion(cam.quat); rt.set(1, 0, 0).applyQuaternion(cam.quat);
      const hA = ancA >= 0 ? ancA : Math.max(0, holds.indexOf(focus)), hB = ancA >= 0 ? ancB : hA, he = ancA >= 0 ? ancE : 0, vk = view.k;
      const dRef = pinOf[focus] ? P.copy(C).add(off).addScaledVector(pinOf[focus].n, R).distanceTo(cam.pos) : 1e9;
      for (const i of pinned) {
        const p = S.planes[i], pin = pinOf[i];
        P.copy(C).add(off).addScaledVector(pin.n, R);
        // near the camera a card keeps its size on screen; a town far behind the one in focus has smaller cards, as things far away do
        const dist = P.distanceTo(cam.pos), w = lerp(0.092, 0.11, vk) * Math.min(dist, dRef * 1.1), n = pin.sites.length, k = slot[i];
        const a0 = ANCH[hA][pin.id], a1 = ANCH[hB][pin.id];
        const ax = lerp(lerp(a0[2], a0[0], vk), lerp(a1[2], a1[0], vk), he), ay = lerp(lerp(a0[3], a0[1], vk), lerp(a1[3], a1[1], vk), he);
        const ox = ax * w + (n > 1 ? ((k % 2) - 0.5) * 1.08 * w : 0), oy = ay * w + (n > 1 ? (0.5 - Math.floor(k / 2)) * 0.7 * w : 0);
        p.pos.copy(P).addScaledVector(pin.n, 0.012 * dist).addScaledVector(rt, ox).addScaledVector(up, oy);
        p.quat.copy(cam.quat); p.w = w; p.corner = 0.035 * w; p.border = 0.028 * w; p.borderCol = 0xffffff; p.fogK = 0; p.edge = 0; p.order = 3; p.lit = 1; p.vis = pin.n.dot(_d.copy(cam.pos).sub(C).sub(off).normalize()) > 0.2;
        if (i !== focus && vk < 1) p.op = 1 - m * (1 - vk);          // a phone at a hold: the map, the pin, the tag and the one site. The small cards come back when the camera lifts.
        if (i === focus && m > 0) {
          placeInRect(cam, 0.7, view.rect, view, tmpPl);
          p.pos.lerp(tmpPl.pos, m); p.w = lerp(p.w, tmpPl.w, m); p.corner = lerp(p.corner, 0.004, m); p.border = lerp(p.border, 0.0035, m); p.hi = m > 0.4 ? 1 : 0; p.order = 5; p.vis = true;
        }
        X.cards.push({ i, pin: pin.id, px: P.x, py: P.y, pz: P.z });
      }
    }
    function envG(S) { setEnvFlat(S.env, PAPER, PAPER, 0.03); }
    const ALT = 1.15, n1 = new THREE.Vector3(), zero = new THREE.Vector3();
    const holdN = (j) => pinOf[holds[j]].n;
    function pose(j, t, S) {
      S.cam.near = 0.05; S.cam.far = 1600; envG(S);
      for (let i = 0; i < N; i++) S.planes[i].vis = false;
      if (t <= 0) { camOver(holdN(j), ALT, zero, S.cam, PINX[j]); cards(S, S.cam, zero, holds[j], 1); return; }
      const e = ease(t), a = holdN(j), b = holdN(j + 1);
      n1.copy(a).lerp(b, e).normalize();
      const hop = clamp(a.angleTo(b) * R * 0.9, 0.6, 3.2);
      camOver(n1, ALT + hop * Math.sin(Math.PI * e), zero, S.cam, lerp(PINX[j], PINX[j + 1], e));
      const first = t < 0.5;
      ancA = j; ancB = j + 1; ancE = e;
      cards(S, S.cam, zero, first ? holds[j] : holds[j + 1], first ? 1 - es(t, 0.02, 0.4) : es(t, 0.6, 0.98));
      ancA = -1;
    }
    return { id: 'globe', holds, pose, layout, G, camOver, cards, envG, ALT, holdN, pinOf, pinned, travelLen: [1.5, 1.3] };
  })();

  /* ====================================================================== 4. SPIRAL
     The sites are the wall of a spiral, and the camera stands inside it (05-gallery). */
  const spiral = (() => {
    const KS = 0.278, R = 10 * KS, TPT = 12, DA = TAU / TPT, TW = R * DA * 0.93, TH = TW / 1.6, GAP = R * DA * 0.07, PITCH = TH + GAP, RISE = PITCH / TPT, POP = 1.05 * KS, FOV = 54;
    const AXIS = V3(0, 22.6, 119.2);
    // the ribbon, 12 sites for each turn (so the drum opens into a clean 12 x 4 sheet). Column 3 holds the four screens of the film.
    const RIBBON = [
      'momsnbubs', 'vac-stack', 'car-shades', 'sequoia-wildfire', 'sequoia-boat-old', 'manahouse', 'omari', 'retreat-spaces', 'sequoia-drone', 'terra-atelier', 'people-of-the-forest', 'zafran',
      'bear-river', 'find-a-spring', 'orbita-keys', 'manahouse-3d', 'underhill', 'sherwood', 'marrow-moss', 'sequoia-rentals', 'aniwa', 'pacha-mana', 'vior', 'sequoia-security',
      'lumen-observatory', 'carly', 'waterhouse', 'origin-aspect', 'helios-grid', 'california-89', 'church-of-truth', 'aerie-dynamics', 'back-to-earth', 'lumina-espresso', 'web-lumin', 'cascade-bath',
      'sequoia-services', 'meridian-horology', 'vibeport', 'meraki-audio', 'jacqueline', 'structured-cabling', 'warrior-council', 'ad-copy', 'academy', 'car-shades-portfolio', 'drone-peach', 'sequoia-security-v1'].map(ix);
    if (new Set(RIBBON).size !== N) throw new Error('spiral ribbon must hold every site once');
    const kOf = new Array(N); RIBBON.forEach((i, k) => { kOf[i] = k; });
    const holds = ['find-a-spring', 'aniwa', 'carly', 'church-of-truth'].map(ix);
    let fov = FOV;
    const wide = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: FOV, par: 0.14 };
    function layout() { fov = fovFor(FOV, view); wide.pos.set(AXIS.x, AXIS.y - 0.05, AXIS.z + (view.portrait ? 6.2 : 3.6) * KS); wide.fov = fov; }
    // kf = ribbon position in front of the camera, z = lens (1 = pushed in on the site, 0 = pulled back), spin = blur from speed
    function at(kf, z, S, spin = 0) {
      S.x.spiral.on = 1; S.cam.near = 0.03; S.cam.far = 1600;
      const kc = Math.round(kf);
      for (let i = 0; i < N; i++) {
        const p = S.planes[i], k = kOf[i], a = wrapPi((k - kf) * DA), dy = (k - kf) * RISE;
        const dTile = Math.hypot(a / DA, dy / PITCH), f = z * (1 - smooth(0.18, 0.8, dTile));
        const r = R - POP * f;
        p.pos.set(AXIS.x + r * Math.sin(a), AXIS.y + dy, AXIS.z - r * Math.cos(a)); yawQuat(-a, p.quat);
        p.w = TW; p.curve = (1 - f) / R; p.corner = 0.085 * KS; p.fogK = 0; p.edge = 1;
        p.vis = Math.abs(a) < 1.95 && Math.abs(dy) < PITCH * 3.4;
        const fall = 1 - smooth(1.2, 4.2, dTile) * 0.72, browse = 0.96 * fall, rest = lerp(0.5 * fall, 1, f);
        p.lit = lerp(browse, rest, z); p.blur = z * (1 - f) * 1.15 + smooth(2.2, 4.5, dTile) * 1.2 + spin; p.sat = lerp(1, lerp(0.8, 1, f), z);
        p.halo = (0.08 + 0.12 * f) * p.lit; p.order = f > 0.4 ? 3 : 2; p.hi = f > 0.5 ? 1 : 0;
        if (k === kc && z > 0.02) { tmpPl.pos.copy(p.pos); tmpPl.quat.copy(p.quat); }
      }
      // the lens: face-on to the site in focus, or pulled back to the middle of the drum
      const fp = S.planes[RIBBON[clamp(kc, 0, N - 1)]];
      _a.set(AXIS.x, AXIS.y, AXIS.z - (R - POP));
      frameOn(_a, Q_ID, TW, view.rect, fov, view, tmpCam);
      mixCam(S.cam, wide, tmpCam, z); S.cam.fov = fov; S.cam.par = lerp(0.14, 0.035, z);
      setEnvFlat(S.env, BLACK, BLACK, 0.012);
      S.x.spiral.focus = z > 0.5 ? RIBBON[clamp(kc, 0, N - 1)] : -1; void fp;
    }
    function pose(j, t, S) {
      if (t <= 0) return at(kOf[holds[j]], 1, S);
      const ka = kOf[holds[j]], kb = kOf[holds[j + 1]], e = ease(t);
      const z = 1 - smooth(0, 0.3, t) * (1 - smooth(0.7, 1, t));
      at(lerp(ka, kb, e), z, S, Math.min(0.7, Math.sin(Math.PI * t) * 0.5));
    }
    return { id: 'spiral', holds, pose, layout, at, kOf, RIBBON, KS, R, DA, TW, TH, PITCH, RISE, POP, TPT, AXIS, wide, travelLen: [1.2, 1.2, 1.2] };
  })();

  /* ====================================================================== 5. FILM
     A sunlit set, a long lens, big standing screens, giant chapter type and a wall of all the other sites (07-film). */
  const film = (() => {
    const FOV = 28, BEZ = 0.026, SY = BEZ + SH / 2;
    const holds = ['sequoia-wildfire', 'manahouse-3d', 'origin-aspect', 'meraki-audio'].map(ix);
    const SLAB = [V3(-1.2, SY, 62), V3(0.35, SY, 43.5), V3(5.6, SY, 35.5), V3(10.4, SY, 27)];
    const TYPE = { x: -0.4, z: 51.5, cap: 2.05, gap: 1.25, words: ['LANDING', 'PAGES'], count: '19' };       // the two words stand on both sides of a gap at x; the camera passes through it
    // the wall is the opened spiral: 4 rows of 12, without the column of the four screens
    const WALL = { x: 5.0, z: 18.5, cols: 11, rows: 4, tw: spiral.TW, px: spiral.R * spiral.DA, py: spiral.PITCH, y0: 0.14, gapCol: 3 };
    const slotOf = new Array(N).fill(null);
    spiral.RIBBON.forEach((i, k) => { const c = k % 12, row = Math.floor(k / 12); slotOf[i] = c === WALL.gapCol ? null : { col: c < WALL.gapCol ? c : c - 1, row }; });
    const wallPos = (sl, out) => out.set(WALL.x + (sl.col - (WALL.cols - 1) / 2) * WALL.px, WALL.y0 + sl.row * WALL.py + WALL.tw * 0.3125, WALL.z);
    let fov = FOV;
    const curveCache = new Map();
    const cams = holds.map(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: FOV, par: 0.05 }));
    function layout() {
      fov = fovFor(FOV, view);
      SLAB[1].x = TYPE.x + (view.rect.cx - 0.5) * (SW / view.rect.fw);          // the second screen stands behind the gap between the two words
      holds.forEach((i, j) => { frameOn(SLAB[j], Q_ID, SW, view.rect, fov, view, cams[j]); cams[j].par = 0.06; }); curveCache.clear();
    }
    function env(S, night = 0) {
      const e = S.env;
      e.skyTop.set(0xDDD6C8).lerp(_col.set(0x020203), night); e.skyHor.set(0xF1EDE4).lerp(_col.set(0x0B0D11), night); e.glow.set(0);
      e.fogCol.copy(e.skyHor); e.fogDen = 0.0085;
      const f = e.floor; f.on = 1; f.col.set(0xDCD5C6).lerp(_col.set(0x090A0D), night); f.refl = lerp(0.2, 0.62, night); f.fresMin = lerp(0.55, 0.5, night); f.fresPow = 2.2; f.seam = 1; f.seamPitch = 2.275; f.blur = lerp(1.2, 0.9, night);
      f.front = 0; f.frontSoft = 0; f.sweepSoft = 0;
      e.sun.set(0.96, 0, -0.72); e.shadowA = 0.3 * (1 - night); e.bodyLit = 1 - night * 0.8;
      e.clip[0] = 0; e.clip[1] = 0; e.clip[2] = 1; e.clip[3] = 1;
    }
    function planes(S, focus) {
      for (let i = 0; i < N; i++) {
        const p = S.planes[i], h = holds.indexOf(i);
        p.quat.identity(); p.body = 1; p.bez = BEZ; p.shadow = 1; p.corner = 0.0; p.edge = 0; p.lit = 1; p.fogK = 1;
        if (h >= 0) { p.pos.copy(SLAB[h]); p.w = SW; p.hi = i === focus ? 1 : 0; }
        else { wallPos(slotOf[i], p.pos); p.w = WALL.tw; p.bez = 0.012; p.shadow = 0; p.body = 0.6; }
      }
    }
    // the camera never turns: it cranes and dollies. via = points the path passes
    function path(j, t, cam) {
      const A = cams[j], B = cams[j + 1];
      const key = j;
      let c = curveCache.get(key);
      if (!c) {
        const pts = [A.pos.clone()];
        if (j === 0) { pts.push(V3(A.pos.x + 0.2, 2.9, A.pos.z - 0.6), V3(lerp(A.pos.x, TYPE.x, 0.5), 3.5, SLAB[0].z + 0.5), V3(TYPE.x, 2.3, TYPE.z + 5.5), V3(TYPE.x, TYPE.cap * 0.5, TYPE.z + 0.6)); }
        if (j === 1) { pts.push(V3(lerp(A.pos.x, B.pos.x, 0.6), SY + 0.25, lerp(A.pos.z, B.pos.z, 0.25))); }
        if (j === 2) { pts.push(V3(lerp(A.pos.x, B.pos.x, 0.35), 2.7, lerp(A.pos.z, B.pos.z, 0.45))); }
        pts.push(B.pos.clone());
        c = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); curveCache.set(key, c);
      }
      const e = ease(t);
      c.getPoint(e, cam.pos);
      const lift = cam.pos.y - lerp(A.pos.y, B.pos.y, e);
      eulerQuat(-Math.atan(lift / 14), 0, 0, cam.quat); cam.fov = fov; cam.par = 0.06;
    }
    function pose(j, t, S) {
      S.x.film.on = 1; S.x.film.up = 1; S.x.film.night = 0; S.x.film.light = 1; S.x.film.fade = 0; S.cam.near = 0.05; S.cam.far = 1600;
      env(S, 0);
      if (t <= 0) { const c = cams[j]; S.cam.pos.copy(c.pos); S.cam.quat.copy(c.quat); S.cam.fov = fov; S.cam.par = c.par; planes(S, holds[j]); S.x.film.focus = holds[j]; return; }
      path(j, t, S.cam); planes(S, t < 0.5 ? holds[j] : holds[j + 1]); S.x.film.focus = -1;
    }
    return { id: 'film', holds, pose, layout, env, planes, SLAB, TYPE, WALL, wallPos, slotOf, SY, BEZ, cams, travelLen: [1.7, 1.2, 1.2] };
  })();

  /* ====================================================================== 7. HALL (defined before the dust: the dust settles on its wall)
     A bright exhibition hall at real scale. Every frame on the wall is a site (09-hall). The building is 09's, turned so that
     its length runs along -z, and placed so that one frame of the Landing room stands where the last film screen stood. */
  const hall = (() => {
    const FOV = 52;
    const plan = buildPlan();
    const pieces = plan.pieces.filter((p) => p.kind !== 'P');
    const pieceOf = new Array(N).fill(null);
    for (const p of pieces) pieceOf[ix(p.id)] = p;
    const dustId = ix('helios-grid'), dp = pieceOf[dustId];
    const TX = film.SLAB[3].x - dp.z, TZ = film.SLAB[3].z + dp.x;        // hall (x, z) -> global (z + TX, -x + TZ)
    const hg = (x, y, z, out = new THREE.Vector3()) => out.set(z + TX, y, -x + TZ);
    const hq = (nx, nz, out = new THREE.Quaternion()) => yawQuat(Math.atan2(nz, -nx), out);      // a wall normal (hall) -> the plane that faces along it
    const holds = ['underhill', 'sequoia-security', 'web-lumin', 'sequoia-services'].map(ix); holds.push(-1);   // -1 = the contact wall
    const CONTACT = { x: X_END, z: 0, w: 9.2, h: 3.3 };
    let fov = FOV;
    const cams = holds.map(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: FOV, par: 0.04, yaw: 0 }));
    const framePos = (p, out) => hg(p.x + p.nx * 0.035, p.y, p.z + p.nz * 0.035, out);
    function layout() {
      fov = fovFor(FOV, view);
      holds.forEach((i, j) => {
        const c = cams[j];
        if (i >= 0) { const p = pieceOf[i]; frameOn(framePos(p, _a), hq(p.nx, p.nz, _q), p.w, view.rect, fov, view, c); c.yaw = Math.atan2(p.nz, -p.nx); }
        else { frameOn(hg(CONTACT.x - 0.02, EYE + 0.25, 0, _a), hq(-1, 0, _q), CONTACT.w, { fw: lerp(0.94, 0.8, view.k), cx: 0.5, cy: lerp(0.36, 0.47, view.k) }, fov, view, c); c.yaw = Math.atan2(0, 1); }
        c.par = 0.04;
      });
    }
    function env(S) { setEnvFlat(S.env, 0xe9e9e6, 0xe9e9e6, 0.0); S.env.bodyLit = 1; }
    function planes(S, focus) {
      for (let i = 0; i < N; i++) {
        const p = S.planes[i], pc = pieceOf[i];
        framePos(pc, p.pos); hq(pc.nx, pc.nz, p.quat); p.w = pc.w; p.corner = 0; p.fogK = 0; p.edge = 0; p.lit = 1; p.body = 0.6; p.bez = 0.018;
        p.vis = pc.room > 0; p.hi = i === focus ? 1 : 0;
      }
    }
    // a walk: the position eases from stop to stop, the body turns the short way, and it looks a little ahead on the way
    function walk(j, t, cam) {
      const A = cams[j], B = cams[j + 1], e = ease(t);
      cam.pos.lerpVectors(A.pos, B.pos, e);
      let dy = wrapPi(B.yaw - A.yaw);
      if (Math.abs(Math.abs(dy) - Math.PI) < 0.01) dy = -Math.PI;          // north wall to south wall: turn through the east, toward the contact wall
      let yaw = A.yaw + dy * ease(seg(t, 0.12, 0.88));
      if (Math.abs(dy) < 0.01) {        // same wall: step back from it and glance along the walk
        _a.set(0, 0, 1).applyQuaternion(A.quat); cam.pos.addScaledVector(_a, 0.9 * bump(t));
        const dir = Math.sign(_b.subVectors(B.pos, A.pos).dot(_c.set(1, 0, 0).applyQuaternion(A.quat)));
        yaw += -dir * 0.3 * Math.sin(Math.PI * t) * Math.sin(Math.PI * t);
      } else if (Math.abs(dy) > 3) {    // the long turn keeps to the middle of the room
        cam.pos.x = lerp(cam.pos.x, hg(0, 0, 0, _a).x, 0.55 * bump(t));
      }
      yawQuat(yaw, cam.quat); cam.fov = fov; cam.par = 0.04;
      cam.pos.y = lerp(A.pos.y, B.pos.y, e);
    }
    function pose(j, t, S) {
      S.x.hall.on = 1; S.x.hall.light = 1; S.cam.near = 0.05; S.cam.far = 400; env(S);
      if (t <= 0) { const c = cams[j]; S.cam.pos.copy(c.pos); S.cam.quat.copy(c.quat); S.cam.fov = fov; S.cam.par = c.par; planes(S, holds[j]); S.x.hall.focus = holds[j]; return; }
      walk(j, t, S.cam); planes(S, t < 0.5 ? holds[j] : holds[j + 1]); S.x.hall.focus = -1;
    }
    return { id: 'hall', holds, pose, layout, env, planes, plan, pieces, pieceOf, hg, hq, TX, TZ, framePos, dustId, dp, CONTACT, cams, travelLen: [1.1, 1.0, 1.5, 1.4] };
  })();

  /* ====================================================================== 6. PARTICLES
     One black stage. A picture made of particles holds a real site, then breaks into dust and forms the next (08-particles).
     The other 47 sites are grains of dust in their own colours. */
  const dust = (() => {
    const FOV = 36;
    const holds = ['lumen-observatory', 'aerie-dynamics', 'helios-grid'].map(ix);
    const first = film.holds[3];
    const PD = hall.framePos(hall.dp, new THREE.Vector3());          // where the picture hangs (and where the frame will be)
    const rnd = rng(11), G = sites.map(() => ({ x: (rnd() - 0.5) * 2, y: rnd(), z: rnd(), s: 0.045 + rnd() * 0.07, ph: rnd() * TAU, r: 0.6 + rnd() * 0.4 }));
    // The waves of the story, in order (S.x.dust.wave). Fixed, so that the story replays exactly. mode 0 = a line: the front travels along
    // dir and the wind blows the dust the same way. mode 1 = a ring that opens from origin (uv of the picture). The set (sets/dust.js) draws them.
    const WAVES = [
      { mode: 0, dir: [-1, 0.26], origin: [0.5, 0.5], seed: 7.3, spin: 1 },        // film -> particles: the standing screen breaks, right to left
      { mode: 1, dir: [1, 0], origin: [0.66, 0.42], seed: 21.9, spin: -1 },        // a ring opens where the grain of the next site lands
      { mode: 0, dir: [-0.86, -0.5], origin: [0.5, 0.5], seed: 33.1, spin: 1 },    // right to left again, falling
    ];
    // where a wave starts and where it ends, as points on the picture
    const ends = WAVES.map((w) => {
      if (w.mode === 1) { let far = [0, 0], fd = -1; for (const c of [[0.04, 0.04], [0.96, 0.04], [0.04, 0.96], [0.96, 0.96]]) { const d = Math.hypot((c[0] - w.origin[0]) * 1.6, c[1] - w.origin[1]); if (d > fd) { fd = d; far = c; } } return { from: w.origin, to: far }; }
      return { from: [0.5 - 0.46 * Math.sign(w.dir[0]), 0.5 - 0.46 * Math.sign(w.dir[1])], to: [0.5 + 0.46 * Math.sign(w.dir[0]), 0.5 + 0.46 * Math.sign(w.dir[1])] };
    });
    const onPicture = (uv, out) => out.set(PD.x + (uv[0] - 0.5) * SW, PD.y + (uv[1] - 0.5) * SH, PD.z + 0.04);
    let fov = FOV;
    const C = { x: 0, y: 1.5, z: 0, th: 0.52, tv: 0.325, d: 4, x0: -0.3, y0: -0.5 };       // the camera of this world: the grains fill what it sees
    function layout() {
      fov = fovFor(FOV, view);
      frameOn(PD, Q_ID, SW, view.rect, fov, view, tmpCam); C.x = tmpCam.pos.x; C.y = tmpCam.pos.y; C.z = tmpCam.pos.z; C.d = tmpCam.d; C.tv = tanV(fov); C.th = C.tv * view.aspect;
      const r = view.rect, fh = r.fw * view.aspect / 1.6;
      C.x0 = (r.cx - r.fw / 2) * 2 - 1; C.y0 = 1 - (r.cy + fh / 2) * 2;        // left and bottom edge of the picture in the view (-1 to 1)
    }
    // A grain keeps its place in the view (more of them on the side of the empty column, near ones large and faint, far ones small)
    // and turns on a small ring as the story moves. u = a time-like value from the scroll.
    // A grain in front of the picture plane never crosses the picture: it stays in the column beside it (below it on a phone).
    const depthOf = (i) => 1.7 + Math.pow(G[i].z, 1.3) * 9.4;
    function grain(i, u, out) {
      const g = G[i], D = depthOf(i), a = g.ph + u * 1.25 * g.r;
      let sx = -1.06 + 2.12 * Math.pow((g.x + 1) / 2, 1 + 0.6 * view.k), sy = (g.y - 0.5) * 2.1;
      if (D < C.d + 0.6) { if (view.k > 0.5) sx = lerp(-1.04, C.x0 - 0.3, (g.x + 1) / 2); else sy = lerp(-1.02, C.y0 - 0.16, g.y); }
      sy -= 2 * (view.shift || 0);          // sx, sy are places on the screen (-1 to 1); the lens of the engine is shifted up by view.shift
      out.set(C.x + (sx * C.th + Math.cos(a) * 0.1) * D, Math.max(0.1, C.y + (sy * C.tv + Math.sin(a * 1.3 + g.ph) * 0.06) * D), C.z - D + Math.sin(a) * 0.35);
      return out;
    }
    function grains(S, u, skip) {
      for (let i = 0; i < N; i++) {
        const p = S.planes[i];
        if (i === skip) { p.pos.copy(PD); p.quat.identity(); p.w = SW; p.op = 0.005; p.pick = 2; p.hi = 1; p.order = 0; p.edge = 0; continue; }
        const D = depthOf(i);
        grain(i, u, p.pos); p.quat.copy(S.cam.quat); p.w = G[i].s * Math.pow(D / 4.5, 0.62); p.op = lerp(0.4, 1, smooth(1.7, 4.4, D));
        p.grain = 1; p.fogK = 0; p.edge = 0; p.corner = 0; p.pick = false; p.lit = 1; p.order = 1;
      }
    }
    function cam(S) { frameOn(PD, Q_ID, SW, view.rect, fov, view, S.cam); S.cam.par = 0.04; S.cam.near = 0.05; S.cam.far = 400; }
    function pose(j, t, S) {
      const X = S.x.dust; X.on = 1; X.pos.copy(PD); X.quat.identity(); X.w = SW; X.grains = 1;
      setEnvFlat(S.env, 0x07080A, 0x07080A, 0.0);
      cam(S);
      if (t <= 0) { X.a = holds[j]; X.b = holds[j]; X.mix = 1; X.wave = j; grains(S, j * 1.0, holds[j]); X.focus = holds[j]; return; }
      const a = holds[j], b = holds[j + 1], e = ends[(j + 1) % ends.length];
      X.a = a; X.b = b; X.mix = t; X.wave = j + 1; grains(S, j + ease(t), t < 0.5 ? a : b); X.focus = -1;
      // the grain of the site that forms flies to the picture, and the wave starts where it lands;
      // the grain of the site that broke leaves the picture where the wave ends
      if (t < 0.5) { const p = S.planes[b], k = es(t, 0, 0.15); p.pos.lerp(onPicture(e.from, _a), k); p.w = lerp(p.w, 0.11, k); p.op = lerp(p.op, 1, k) * (1 - es(t, 0.13, 0.2)); p.order = 3; }
      else { const p = S.planes[a], k = 1 - es(t, 0.76, 1); p.pos.lerp(onPicture(e.to, _a), k); p.op *= es(t, 0.76, 0.84); p.order = 3; }
    }
    return { id: 'dust', holds, pose, layout, PD, first, grain, grains, cam, G, WAVES, travelLen: [1.5, 1.5] };
  })();

  const WORLDS = [fly, index, globe, spiral, film, dust, hall];

  /* ====================================================================== THE SIX TRANSITIONS */

  // 1. Fly-through -> Index: the camera rises to the high view; the screens tip back and lie on the floor, row after row;
  //    paper spreads over the dark floor behind the falling row; the flat sites slide into one reel and the names print.
  function T1(v, S) {
    fly.pose(fly.holds.length - 1, 0, Sa); index.pose(0, 0, Sb);
    const { Z0, ROW, CY, stops } = fly, zc = Z0 - 3 * ROW - 1.4;
    // camera: landed -> high oblique view -> straight above -> down to the page
    const span = lerp(1.25, 1, view.k);
    tmpCam.pos.set(0, 30 * span, Z0 + 22 * span); lookQuat(tmpCam.pos, _a.set(0, 0, zc), AY, tmpCam.quat); tmpCam.fov = Sa.cam.fov; tmpCam.par = 0.1;
    tmpCam2.pos.set(0, lerp(120, 70, view.k), zc); tmpCam2.quat.copy(Q_FLAT); tmpCam2.fov = Sb.cam.fov; tmpCam2.par = 0.1;
    mixCam(S.cam, Sa.cam, tmpCam, es(v, 0, 0.4)); mixCam(S.cam, S.cam, tmpCam2, es(v, 0.3, 0.66)); mixCam(S.cam, S.cam, Sb.cam, es(v, 0.6, 1));
    S.cam.near = 0.05; S.cam.far = 1600;
    const grow = 1 + 0.72 * es(v, 0.04, 0.4), base = CY - SH / 2;
    for (let i = 0; i < N; i++) {
      const p = S.planes[i], a = Sa.planes[i], b = Sb.planes[i], s = stops[i];
      const tip = es(v, 0.3 + 0.04 * s.row, 0.46 + 0.04 * s.row), th = tip * Math.PI / 2, w = SW * grow, h = w * 0.625;
      copyPlane(p, a);
      p.w = w; p.pos.set(s.x, lerp(base, 0.006, tip) + Math.cos(th) * h / 2, s.z - Math.sin(th) * h / 2); p.quat.setFromAxisAngle(AX, -th);
      p.lit = lerp(a.lit, 1, es(v, 0, 0.3)); p.halo = a.halo * (1 - es(v, 0.05, 0.36)); p.body = 1 - tip; p.corner = lerp(a.corner, 0.03, tip); p.hi = 0; p.fogK = 1 - tip;
      const o = index.rowOf[i], g = es(v, 0.6 + 0.1 * (o / 47), 0.86 + 0.12 * (o / 47));
      if (g > 0) { p.pos.lerp(b.pos, g); p.pos.y += 0.004 + (47 - o) * 0.012 * Math.sin(Math.PI * g); p.quat.slerp(b.quat, g); p.w = lerp(w, b.w, es(g, 0, 0.6)); p.corner = lerp(0.03, b.corner, g); p.vis = g < 0.999 ? true : b.vis; p.edge = 0; }
      p.clip = v > 0.6 ? 1 : 0; p.order = 2; if (v > 0.9) p.hi = b.hi;
    }
    // the floor: paper follows the falling rows
    mixEnv(S.env, Sa.env, Sb.env, es(v, 0.3, 0.66));
    fly.env(Sc, fly.glow[fly.holds[2]], S.cam.pos.y); S.env.fogDen = lerp(Sc.env.fogDen, Sb.env.fogDen, es(v, 0.3, 0.7));
    const f = S.env.floor; f.on = 1;
    if (v < 0.7) { f.col.copy(Sa.env.floor.col); f.col2.set(PAPER); f.refl = Sa.env.floor.refl; f.front = lerp(Z0 + ROW * 1.5, Z0 - ROW * 8.5, seg(v, 0.27, 0.69)); f.frontSoft = 2.2; f.blur = Sa.env.floor.blur; f.fresMin = 0.16; f.fresPow = 1.7; }
    else { f.col.set(PAPER); f.refl = 0; }
    S.env.glow.copy(Sa.env.glow).multiplyScalar(1 - es(v, 0.1, 0.5));
    const c = S.env.clip, cb = Sb.env.clip, ck = es(v, 0.7, 0.98);
    for (let k = 0; k < 4; k++) c[k] = lerp(k < 2 ? 0 : 1, cb[k], ck);
    S.x.fly.on = v < 0.7 ? 1 : 0; S.x.fly.focus = -1;
    const X = S.x.index; X.on = v > 0.55 ? 1 : 0; X.f = Sb.x.index.f; X.rowsIn = es(v, 0.7, 1); X.gate = es(v, 0.8, 1); X.link = es(v, 0.94, 1); X.focus = v > 0.9 ? Sb.x.index.focus : -1;
  }

  // 2. Index -> Globe: one more site rolls into the frame; the camera lifts its eyes from the page; the globe rises over the far edge
  //    of the paper like a sunrise; the site in the frame shrinks to a card and flies to its pin, and the other pinned sites follow.
  function T2(v, S) {
    const fA = index.rowOf[index.holds[2]], fB = index.rowOf[ix('california-89')], e0 = es(v, 0, 0.2);
    index.at(lerp(fA, fB, e0), Sa, (ease(Math.min(1, seg(v, 0, 0.2) + 0.02)) - ease(Math.max(0, seg(v, 0, 0.2) - 0.02))) / 0.04 * 0.33 * (v < 0.2 ? 1 : 0));
    globe.pose(0, 0, Sb);
    const rise = _c.set(0, -(1 - es(v, 0.2, 0.66)) * 27, 0);
    // camera: page -> eyes up, the page lies below and the horizon is in the upper third -> to the pin
    tmpCam.pos.copy(Sa.cam.pos).add(_a.set(-0.6, 4.6, 16)); lookQuat(tmpCam.pos, _a.set(globe.G.C.x, 2.2, globe.G.C.z), AY, tmpCam.quat); tmpCam.fov = lerp(Sa.cam.fov, Sb.cam.fov, 0.3); tmpCam.par = 0.05;
    mixCam(S.cam, Sa.cam, tmpCam, es(v, 0.17, 0.5)); mixCam(S.cam, S.cam, Sb.cam, es(v, 0.5, 1));
    S.cam.near = 0.05; S.cam.far = 1600;
    for (let i = 0; i < N; i++) copyPlane(S.planes[i], Sa.planes[i]);
    // cards on the globe, for the camera of this frame
    for (let i = 0; i < N; i++) resetPlane(Sc.planes[i]);
    const focus = globe.holds[0];
    globe.cards(Sc, S.cam, rise, focus, es(v, 0.86, 1));
    let k = 0;
    for (const i of globe.pinned) {
      const p = S.planes[i], a = Sa.planes[i], g = Sc.planes[i];
      if (i === focus) {
        // frame -> a small card in front of the camera -> its pin -> (hold) the rect
        placeInRect(S.cam, 2.4, { fw: 0.2, cx: lerp(0.5, 0.56, view.k), cy: 0.5 }, view, tmpPl2);
        copyPlane(tmpPl, a); tmpPl.vis = true;
        tmpPl2.corner = 0.02; tmpPl2.border = 0.02; tmpPl2.borderCol = 0xffffff; tmpPl2.op = 1; tmpPl2.lit = 1; tmpPl2.sat = 1; tmpPl2.blur = 0; tmpPl2.curve = 0; tmpPl2.bendY = 0; tmpPl2.vblur = 0; tmpPl2.body = 0; tmpPl2.bez = 0; tmpPl2.grain = 0; tmpPl2.halo = 0; tmpPl2.shadow = 0; tmpPl2.edge = 0; tmpPl2.fogK = 0; tmpPl2.hi = 1; tmpPl2.clip = 0; tmpPl2.vis = true; tmpPl2.order = 5; tmpPl2.pick = true;
        mixPlane(p, tmpPl, tmpPl2, es(v, 0.2, 0.5)); copyPlane(tmpPl, p); mixPlane(p, tmpPl, g, es(v, 0.44, 0.84));
        p.clip = v < 0.2 ? 1 : 0; p.hi = 1; p.vis = true; p.order = 5;
      } else {
        const m = es(v, 0.3 + 0.035 * k, 0.8 + 0.03 * k); k++;
        copyPlane(tmpPl, a); tmpPl.vis = true; if (!a.vis) tmpPl.op = 0;
        mixPlane(p, tmpPl, g, m); p.pos.y += Math.sin(Math.PI * m) * 5; p.clip = m > 0.02 ? 0 : a.clip; p.vis = m > 0.02 ? true : a.vis; p.op = lerp(a.vis ? 1 : smooth(0.02, 0.2, m), g.op, m);
      }
    }
    for (let i = 0; i < N; i++) if (!globe.pinOf[i]) { const p = S.planes[i]; p.op = 1 - es(v, 0.5, 0.8); p.fogK = 1; if (v > 0.8) p.vis = false; }
    mixEnv(S.env, Sa.env, Sb.env, es(v, 0.25, 0.8));
    const c = S.env.clip, ca = Sa.env.clip, ck = es(v, 0.16, 0.36);
    for (let q = 0; q < 4; q++) c[q] = lerp(ca[q], q < 2 ? 0 : 1, ck);
    // a horizon to rise over: the paper floor is a touch darker than the sky, and the sky is light where the globe comes up
    const hz = es(v, 0.15, 0.4) * (1 - es(v, 0.62, 0.9));
    S.env.floor.on = v < 0.93 ? 1 : 0; S.env.floor.col.set(PAPER).multiplyScalar(1 - 0.085 * hz); S.env.glow.set(0xfff6e0).multiplyScalar(0.05 * hz);
    S.env.fogCol.set(PAPER).multiplyScalar(1 - 0.04 * hz); S.env.fogDen = lerp(0.004, Sb.env.fogDen, es(v, 0.55, 0.9));
    const X = S.x.index; X.on = v < 0.8 ? 1 : 0; X.f = Sa.x.index.f; X.rowsIn = 1; X.gate = 1 - es(v, 0.16, 0.3); X.link = v < 0.18 ? Sa.x.index.link : 0; X.out = es(v, 0.45, 0.8); X.focus = -1;
    const Gx = S.x.globe; Gx.on = v > 0.1 ? 1 : 0; Gx.pos.copy(globe.G.C).add(rise); Gx.night = 0; Gx.cards = Sc.x.globe.cards; Gx.focus = focus; Gx.label = es(v, 0.86, 1); Gx.haze = 1 - es(v, 0.3, 0.8);
  }

  // 3. Globe -> Spiral: the globe turns to its night side and the paper goes black; the camera rises and levels; the cards lift off
  //    their pins, the rest of the 48 come up from behind the globe along a spiral path, and the ribbon winds around the camera.
  function T3(v, S) {
    const last = globe.holds.length - 1;
    globe.pose(last, 0, Sa); spiral.pose(0, 0, Sb);
    const n = globe.holdN(last);
    const sink = _c.set(0, -es(v, 0.5, 1) * 34, 0);
    // camera: at the pin -> high over the coast, looking down -> level, in the middle of the drum
    globe.camOver(n, 9.5, _a.set(0, 0, 0), tmpCam); tmpCam.fov = lerp(Sa.cam.fov, Sb.cam.fov, 0.5); tmpCam.par = 0.08;
    mixCam(S.cam, Sa.cam, tmpCam, es(v, 0, 0.5)); mixCam(S.cam, S.cam, Sb.cam, es(v, 0.36, 0.94));
    S.cam.near = 0.04; S.cam.far = 1600;
    for (let i = 0; i < N; i++) resetPlane(Sc.planes[i]);
    globe.cards(Sc, S.cam, sink, globe.holds[last], 1 - es(v, 0, 0.22));
    // the ribbon winds around the camera, wherever the camera is; at the end the camera stands on the axis of the drum
    const { R, DA, RISE, AXIS, kOf, TW } = spiral, kf = kOf[spiral.holds[0]];
    const ax = _ax.copy(S.cam.pos).lerp(AXIS, es(v, 0.55, 0.98));
    const wv = es(v, 0.18, 0.96), land = es(v, 0.8, 1);
    for (let i = 0; i < N; i++) {
      const p = S.planes[i], b = Sb.planes[i], k = kOf[i];
      // the path of the ribbon: it comes from far below, wide, and tightens to its place
      const kk = k - 24 * Math.pow(1 - wv, 1.3), rr = R * (1 + 2.2 * (1 - wv)), a = (kk - kf) * DA, dy = (kk - kf) * RISE * (1 + 3.5 * (1 - wv));
      tmpPl.pos.set(ax.x + rr * Math.sin(a), ax.y + dy, ax.z - rr * Math.cos(a)); yawQuat(-a, tmpPl.quat);
      copyPlane(tmpPl2, b); tmpPl2.pos.copy(tmpPl.pos); tmpPl2.quat.copy(tmpPl.quat); tmpPl2.vis = true; tmpPl2.w = TW; tmpPl2.curve = wv / R; tmpPl2.lit = 0.95; tmpPl2.blur = 0.5 * (1 - wv); tmpPl2.sat = 1; tmpPl2.halo = 0.14 * wv; tmpPl2.hi = 0; tmpPl2.fogK = 1; tmpPl2.order = 2;
      if (globe.pinOf[i]) { const g = Sc.planes[i]; copyPlane(tmpPl, g); tmpPl.vis = true; mixPlane(p, tmpPl, tmpPl2, es(v, 0.2 + 0.02 * (k % 7), 0.62 + 0.02 * (k % 7))); p.vis = true; }
      else { copyPlane(p, tmpPl2); p.op = es(v, 0.18, 0.32); p.vis = v > 0.18; }
      if (land > 0) { copyPlane(tmpPl, p); mixPlane(p, tmpPl, b, land); p.vis = land > 0.5 ? b.vis : true; }
    }
    const night = es(v, 0.06, 0.5);
    setEnvFlat(S.env, PAPER, PAPER, 0.03);
    S.env.skyTop.lerp(_col.set(BLACK), night); S.env.skyHor.copy(S.env.skyTop); S.env.fogCol.copy(S.env.skyTop); S.env.fogDen = lerp(0.03, lerp(0.05, Sb.env.fogDen, es(v, 0.6, 1)), night);
    const Gx = S.x.globe; Gx.on = v < 0.96 ? 1 : 0; Gx.pos.copy(globe.G.C).add(sink); Gx.night = night; Gx.cards = v < 0.5 ? Sc.x.globe.cards : []; Gx.focus = globe.holds[last]; Gx.label = 1 - es(v, 0, 0.15); Gx.haze = 0;
    S.x.spiral.on = v > 0.2 ? 1 : 0; S.x.spiral.focus = -1;
  }

  // 4. Spiral -> Film: the drum opens flat like a sheet; the sheet squares up into the wall; the light crosses the floor of the set;
  //    four sites step out of the wall and grow into standing screens; the chapter type stands up from the floor.
  function T4(v, S) {
    const last = spiral.holds.length - 1;
    spiral.pose(last, 0, Sa); film.pose(0, 0, Sb);
    const { R, DA, PITCH, AXIS, kOf, TW } = spiral, kf = kOf[spiral.holds[last]];
    const u0 = es(v, 0, 0.14), u1 = es(v, 0.04, 0.46), u2 = es(v, 0.34, 0.66), u3 = es(v, 0.52, 1);
    const W = film.WALL;
    for (let i = 0; i < N; i++) {
      const p = S.planes[i], a0 = Sa.planes[i], b = Sb.planes[i], k = kOf[i];
      const A = (k - kf) * DA, m = Math.round(A / TAU), a = A - TAU * m;
      // the sheet: the cylinder with less and less curve
      const kap = (1 - u1) / R;
      copyPlane(tmpPl, a0); tmpPl.vis = true;
      if (kap > 1e-4) { const ang = a * R * kap; tmpPl.pos.set(AXIS.x + Math.sin(ang) / kap, 0, AXIS.z - Math.cos(ang) / kap + (1 / kap - R)); yawQuat(-ang, tmpPl.quat); }
      else { tmpPl.pos.set(AXIS.x + R * a, 0, AXIS.z - R); tmpPl.quat.identity(); }
      tmpPl.pos.y = AXIS.y + a * (PITCH / TAU) * (1 - u1) + m * PITCH;
      tmpPl.curve = kap; tmpPl.lit = lerp(a0.lit, 0.95, u1); tmpPl.blur = a0.blur * (1 - u1); tmpPl.sat = 1; tmpPl.halo = a0.halo * (1 - u1); tmpPl.w = TW; tmpPl.hi = 0; tmpPl.op = a0.vis ? 1 : u1;
      mixPlane(p, a0.vis ? a0 : tmpPl, tmpPl, u0);
      // the column of the four screens steps forward, and the sheet closes the gap: this is the wall
      const sl = film.slotOf[i];
      if (sl) _a.set(AXIS.x + (sl.col - (W.cols - 1) / 2) * W.px, AXIS.y + (sl.row - 2) * W.py, AXIS.z - R);
      else _a.set(tmpPl.pos.x + 0.3, tmpPl.pos.y, AXIS.z - R + 1.1);
      p.pos.lerp(_a, u2);
      // move to the set
      copyPlane(tmpPl, p); mixPlane(p, tmpPl, b, u3); p.vis = true; p.hi = v > 0.85 ? b.hi : 0; p.fogK = u3; p.order = 2;
      p.body = b.body * es(v, 0.6, 0.9); p.shadow = b.shadow;
    }
    // camera: inside the drum -> back, to see the sheet whole -> the first screen of the film
    tmpCam.pos.set(AXIS.x, AXIS.y, AXIS.z + lerp(26, 13, view.k)); tmpCam.quat.identity(); tmpCam.fov = lerp(Sa.cam.fov, Sb.cam.fov, 0.5); tmpCam.par = 0.1;
    mixCam(S.cam, Sa.cam, tmpCam, es(v, 0.06, 0.5)); mixCam(S.cam, S.cam, Sb.cam, es(v, 0.5, 1));
    S.cam.near = 0.04; S.cam.far = 1600;
    const lightUp = es(v, 0.42, 0.86);
    mixEnv(S.env, Sa.env, Sb.env, lightUp);
    const f = S.env.floor; f.on = v > 0.4 ? 1 : 0;
    if (f.on) { f.col.set(BLACK); f.sweepCol.copy(Sb.env.floor.col); f.sweepDir.set(0.8, -0.6); f.sweep = lerp(60, -90, seg(v, 0.42, 0.9)); f.sweepSoft = 9; f.seam = 1; f.seamPitch = 2.275; f.refl = Sb.env.floor.refl * lightUp; f.fresMin = Sb.env.floor.fresMin; f.fresPow = Sb.env.floor.fresPow; }
    // dawn: the horizon is first, the top of the sky follows
    S.env.skyHor.copy(Sa.env.skyHor).lerp(Sb.env.skyHor, es(v, 0.4, 0.72)); S.env.skyTop.copy(Sa.env.skyTop).lerp(Sb.env.skyTop, es(v, 0.56, 0.92));
    S.env.glow.set(0xffa860).multiplyScalar(0.3 * bump(seg(v, 0.4, 0.84))); S.env.fogCol.copy(S.env.skyHor);
    S.env.sun.copy(Sb.env.sun).multiplyScalar(lerp(3.2, 1, es(v, 0.5, 1))); S.env.shadowA = Sb.env.shadowA * es(v, 0.55, 0.95); S.env.bodyLit = lightUp;
    S.env.fogDen = lerp(0.012, Sb.env.fogDen, u3);
    S.x.spiral.on = v < 0.3 ? 1 : 0; S.x.spiral.focus = -1;
    const X = S.x.film; X.on = v > 0.4 ? 1 : 0; X.up = es(v, 0.6, 0.97); X.light = lightUp; X.night = 0; X.fade = 0; X.focus = v > 0.92 ? film.holds[0] : -1;
  }

  // 5. Film -> Particles: night falls on the set and the screens glow on the dark floor; the screen in focus breaks into dust in its
  //    own colours and forms the next site; every other screen shrinks to a grain of its colour and drifts off.
  function T5(v, S) {
    const last = film.holds.length - 1, fi = film.holds[last];
    film.pose(last, 0, Sa); dust.pose(0, 0, Sb);
    const night = es(v, 0, 0.42), out = es(v, 0.42, 0.9);
    film.env(Sc, night);
    mixEnv(S.env, Sc.env, Sb.env, out); S.env.floor.on = v < 0.88 ? 1 : 0; S.env.floor.seam = 1 - out; S.env.shadowA = Sc.env.shadowA;
    // the picture: from the standing screen up to the height of the frame
    const X = S.x.dust; X.on = v > 0.36 ? 1 : 0; X.a = fi; X.b = dust.holds[0]; X.mix = seg(v, 0.4, 1); X.wave = 0;
    X.pos.lerpVectors(Sa.planes[fi].pos, dust.PD, es(v, 0.45, 0.95)); X.quat.identity(); X.w = SW; X.grains = 1; X.focus = -1;
    frameOn(X.pos, Q_ID, SW, view.rect, lerp(Sa.cam.fov, Sb.cam.fov, es(v, 0.3, 1)), view, S.cam); S.cam.par = 0.05; S.cam.near = 0.05; S.cam.far = 1600;
    dust.grains(Sc, -1 + es(v, 0.3, 1), -1);
    for (let i = 0; i < N; i++) {
      const p = S.planes[i], a = Sa.planes[i], g = Sc.planes[i];
      if (i === fi) { copyPlane(p, a); p.pos.copy(X.pos); p.body = a.body * (1 - es(v, 0.3, 0.4)); p.shadow = 0; if (v > 0.38) { p.op = 0.005; p.pick = 2; } p.hi = 1; continue; }
      // every other screen folds into a grain where it stands, and then the grain drifts off
      const st = dust.G[i].z * 0.2, m = seg(v, 0.34 + st, 0.78 + st);
      copyPlane(p, a); p.lit = 1; p.halo = 0.1 * night * (1 - es(m, 0, 0.2));
      if (m > 0) {
        const fold = es(m, 0, 0.4), fly = es(m, 0.28, 1);
        p.pos.lerpVectors(a.pos, g.pos, fly); p.pos.y += Math.sin(Math.PI * fly) * 0.7; p.quat.slerpQuaternions(a.quat, S.cam.quat, fold);
        p.w = lerp(a.w, g.w, fold); p.grain = es(m, 0.2, 0.4); p.op = lerp(1, g.op, fly); p.corner = a.corner * (1 - fold); p.fogK = lerp(a.fogK, 0, fold); p.edge = 0; p.pick = false; p.vis = true; p.order = 1;
      }
      p.body = a.body * (1 - es(m, 0, 0.1)); p.shadow = a.shadow * (1 - es(m, 0, 0.1));
      if (i === dust.holds[0] && v > 0.9) p.op = lerp(p.op, 0.005, es(v, 0.9, 1));
    }
    const Fx = S.x.film; Fx.on = v < 0.9 ? 1 : 0; Fx.up = 1; Fx.night = night; Fx.light = 1; Fx.fade = out; Fx.focus = -1;
  }

  // 6. Particles -> Hall: the grains fly to the walls and open into the framed sites; daylight runs down the hall bay after bay;
  //    the picture of dust turns out to hang on a white wall; the camera steps back, walks through the portal and stops at a frame.
  function T6(v, S) {
    const last = dust.holds.length - 1, di = dust.holds[last];
    dust.pose(last, 0, Sa); hall.pose(0, 0, Sb);
    const light = es(v, 0.16, 0.72);
    // camera: at the picture -> back into the room, looking down its length -> through the portal -> the first frame
    const { hg } = hall, yawE = 0;          // facing hall east = global -z
    const B0 = tmpCam; hg(ROOMS[1].x1 - 9.5, EYE, 0.9, B0.pos); yawQuat(yawE, B0.quat); B0.fov = Sb.cam.fov; B0.par = 0.05;
    const B1 = tmpCam2; hg(ROOMS[1].x1 + 0.4, EYE, 0, B1.pos); yawQuat(yawE, B1.quat); B1.fov = Sb.cam.fov; B1.par = 0.05;
    mixCam(S.cam, Sa.cam, B0, es(v, 0.3, 0.64)); mixCam(S.cam, S.cam, B1, es(v, 0.56, 0.86)); mixCam(S.cam, S.cam, Sb.cam, es(v, 0.76, 1));
    S.cam.near = 0.05; S.cam.far = 400;
    for (let i = 0; i < N; i++) {
      const p = S.planes[i], a = Sa.planes[i], b = Sb.planes[i];
      if (i === di) { copyPlane(p, b); p.hi = 1; p.vis = true; p.body = b.body * es(v, 0.36, 0.56); if (v < 0.34) { p.op = 0.005; p.pick = 2; } continue; }
      // a grain flies to its place on the wall, and there it opens into the framed site
      const st = dust.G[i].y * 0.26, m = seg(v, 0.04 + st, 0.54 + st), fly = es(m, 0, 0.66), open = es(m, 0.56, 1);
      copyPlane(p, b); p.vis = true;
      p.pos.lerpVectors(a.pos, b.pos, fly); p.quat.slerpQuaternions(a.quat, b.quat, fly); p.w = lerp(a.w, b.w, open);
      p.grain = 1 - es(m, 0.58, 0.8); p.op = lerp(a.op, 1, fly) * (b.vis ? 1 : 1 - fly); p.body = b.body * es(m, 0.9, 1); p.pick = m > 0.95; p.hi = v > 0.9 ? b.hi : 0;
      if (m >= 1) p.vis = b.vis;
      p.lit = lerp(0.9, 1, light);
    }
    setEnvFlat(S.env, 0x07080A, 0x07080A, 0); S.env.skyTop.lerp(Sb.env.skyTop, light); S.env.skyHor.copy(S.env.skyTop); S.env.fogCol.copy(S.env.skyTop); S.env.bodyLit = light;
    const X = S.x.dust; X.on = v < 0.34 ? 1 : 0; X.a = di; X.b = di; X.mix = 1; X.pos.copy(dust.PD); X.quat.identity(); X.w = SW; X.grains = 1 - es(v, 0, 0.3); X.focus = -1;
    const H = S.x.hall; H.on = 1; H.light = light; H.lightRaw = seg(v, 0.16, 0.72); H.focus = v > 0.94 ? hall.holds[0] : -1;
  }
  const TRANS = [T1, T2, T3, T4, T5, T6], TLEN = [3.0, 3.0, 2.8, 3.0, 2.6, 3.2];

  /* ====================================================================== the scroll map */
  const segs = []; let total = 0;
  WORLDS.forEach((W, wi) => {
    W.holds.forEach((site, j) => {
      segs.push({ kind: 'hold', w: wi, j, site, len: wi === 0 && j === 0 ? 1.0 : 0.9 });
      if (j < W.holds.length - 1) segs.push({ kind: 'travel', w: wi, j, len: (W.travelLen && W.travelLen[j]) || 1.2 });
    });
    if (wi < WORLDS.length - 1) segs.push({ kind: 'trans', w: wi, len: TLEN[wi] });
  });
  for (const s of segs) { s.u0 = total; total += s.len; }
  for (const s of segs) { s.p0 = s.u0 / total; s.p1 = (s.u0 + s.len) / total; s.pc = (s.p0 + s.p1) / 2; }
  const holdSegs = segs.filter((s) => s.kind === 'hold');
  holdSegs.forEach((s, n) => { s.n = n; });
  holdSegs[0].pc = 0; holdSegs[holdSegs.length - 1].pc = 1;
  const worldP = WORLDS.map((W, wi) => segs.find((s) => s.kind === 'hold' && s.w === wi).pc);
  function locate(p) {
    const u = clamp(p) * total;
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (segs[m].u0 <= u) lo = m; else hi = m - 1; }
    const s = segs[lo]; return { s, k: lo, t: clamp((u - s.u0) / s.len) };
  }

  function layout(v) { view = v; for (const W of WORLDS) W.layout && W.layout(); }

  function evaluate(p, S) {
    if (!S.x.fly) S.x = newX();
    for (let i = 0; i < N; i++) { resetPlane(S.planes[i]); resetPlane(Sa.planes[i]); resetPlane(Sb.planes[i]); resetPlane(Sc.planes[i]); }
    for (const st of [S, Sa, Sb, Sc]) { const X = st.x; for (const k of WORLD_IDS) { X[k].on = 0; X[k].focus = -1; } X.index.out = 0; X.globe.haze = 0; X.globe.night = 0; X.film.fade = 0; X.film.night = 0; X.film.up = 1; X.film.light = 1; X.hall.light = 1; X.hall.lightRaw = 1; X.dust.grains = 1; }
    const { s, k, t } = locate(p);
    const W = WORLDS[s.w], ui = S.ui;
    S.p = p;
    ui.world = s.w; ui.kind = s.kind; ui.t = t; ui.seg = k; ui.hold = -1; ui.cap = 0; ui.site = -1; ui.contact = false; ui.intro = 0;
    if (s.kind === 'hold') {
      W.pose(s.j, 0, S); ui.hold = s.n; ui.cap = 1; ui.site = s.site;
    } else if (s.kind === 'travel') {
      W.pose(s.j, t, S);
      const a = segs[k - 1], b = segs[k + 1];
      ui.cap = Math.max(1 - t / 0.14, (t - 0.86) / 0.14, 0); ui.site = t < 0.5 ? a.site : b.site; ui.hold = t < 0.5 ? a.n : b.n;
    } else {
      TRANS[s.w](t, S);
      const a = segs[k - 1], b = segs[k + 1];
      ui.cap = Math.max(1 - t / 0.05, (t - 0.95) / 0.05, 0); ui.site = t < 0.5 ? a.site : b.site; ui.hold = t < 0.5 ? a.n : b.n;
      ui.world = t < 0.5 ? s.w : s.w + 1;
    }
    ui.contact = ui.site === -1; ui.intro = k === 0 ? 1 - smooth(0.3, 0.6, t) : 0;
    ui.focus = ui.cap > 0.5 ? ui.site : -1;
    return S;
  }

  return { layout, evaluate, locate, segs, holdSegs, worldP, total, worlds: WORLDS, fly, index, globe, spiral, film, dust, hall, sites, ix, N, person: content.person, categories: content.categories };
}
