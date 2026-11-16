// The look of the Hall world (ported from 09-hall/main.js and shaders.js): the building of plan.js with its baked light
// (data/lightmap.png), the polished floor that mirrors the room, skylights, light tracks, the lettering on the walls, the soft
// shadows of the frames, the portrait frames and the survey drone on its plinth.
// New here: the light comes up bay after bay (S.x.hall.lightRaw), so the hall can appear out of the dark of the particles world.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { BAY, ZN, ZS, WT, HB, HB2, HR, SKY, PORTAL, EYE, ROOMS, X_END, PLINTH } from '../plan.js';
import { fontsReady, setDisplay, setText, setMono, redTexture } from '../type.js';
import { clamp } from '../util.js';

const NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a*vnoise(p); p = p*2.03 + 17.3; a *= .5; } return s; }
`;
const LIGHT = /* glsl */`
uniform sampler2D tLm; uniform vec2 lmSize; uniform float lmScale; uniform float exposure; uniform vec3 uWave; uniform vec3 uDark;
vec4 cubicW(float v){ vec4 n = vec4(1.,2.,3.,4.) - v; vec4 s = n*n*n; float x = s.x; float y = s.y - 4.*s.x; float z = s.z - 4.*s.y + 6.*s.x; float w = 6. - x - y - z; return vec4(x,y,z,w)*(1./6.); }
vec3 lightAt(vec2 uv){
  vec2 inv = 1./lmSize; vec2 c = uv*lmSize - .5; vec2 f = fract(c); c -= f;
  vec4 xc = cubicW(f.x), yc = cubicW(f.y);
  vec4 o = c.xxyy + vec2(-.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  o = (o + vec4(xc.yw, yc.yw)/s) * inv.xxyy;
  float sx = s.x/(s.x+s.y), sy = s.z/(s.z+s.w);
  vec3 v = mix(mix(texture2D(tLm, o.yw).rgb, texture2D(tLm, o.xw).rgb, sx), mix(texture2D(tLm, o.yz).rgb, texture2D(tLm, o.xz).rgb, sx), sy);
  return v*v*lmScale;
}
vec3 tone(vec3 c){ vec3 k = max(c - .68, 0.); return min(c, .68) + .32*(1. - exp(-k/.32)); }
// the light switches on bay after bay, away from uWave.x (a place along the hall). uWave.y = how far it has come, uWave.z = all on
float waveAt(float hx, float lead){ return max(1. - smoothstep(uWave.y + lead - 7., uWave.y + lead, abs(hx - uWave.x)), uWave.z); }
`;
const ARCH_VERT = /* glsl */`
attribute vec2 aLm; attribute float aKind;
varying vec2 vLm; varying vec3 vW; varying vec3 vN; varying float vKind; varying vec3 vH;
void main(){ vLm = aLm; vKind = aKind; vN = normal; vH = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const ARCH_FRAG = /* glsl */`
varying vec2 vLm; varying vec3 vW; varying vec3 vN; varying float vKind; varying vec3 vH;
${NOISE}${LIGHT}
void main(){
  vec3 e = lightAt(vLm);
  vec2 p = abs(vN.x) > .5 ? vH.zy : abs(vN.y) > .5 ? vH.xz : vH.xy;
  vec3 alb = mix(vec3(.86, .855, .84), vec3(.86, .86, .85), vKind);
  alb *= 1. + (fbm(p*.45) - .5)*.022 + (fbm(p*11.) - .5)*.014;
  vec3 c = tone(alb * e * exposure);
  c = mix(uDark, c, waveAt(vH.x, vH.y * 0.6));
  c += (hash12(gl_FragCoord.xy) - .5) / 255.;
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;
const FLOOR_VERT = /* glsl */`
uniform mat4 uTexMat;
attribute vec2 aLm; attribute vec2 aLoc;
varying vec4 vMir; varying vec2 vLm; varying vec2 vLoc; varying vec3 vW; varying vec3 vH;
void main(){ vLm = aLm; vLoc = aLoc; vH = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vMir = uTexMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FRAG = /* glsl */`
uniform sampler2D tMirror; uniform float bay;
varying vec4 vMir; varying vec2 vLm; varying vec2 vLoc; varying vec3 vW; varying vec3 vH;
${NOISE}${LIGHT}
void main(){
  vec3 e = lightAt(vLm);
  float cloud = fbm(vH.xz*.32), grain = fbm(vH.xz*24.);
  vec3 alb = vec3(.4, .39, .375) * (1. + (cloud - .5)*.14 + (grain - .5)*.025);
  vec2 g = abs(fract(vLoc/bay + .5) - .5) * bay; vec2 fw = fwidth(vLoc);
  vec2 ln = 1. - smoothstep(vec2(.004), vec2(.004) + fw*1.4, g);
  float joint = max(ln.x, ln.y) * clamp(.012/max(fw.x, fw.y), .12, 1.);
  alb *= 1. - .42*joint;
  float L = waveAt(vH.x, 0.);
  vec3 diff = alb * e * exposure;
  vec3 V = normalize(cameraPosition - vW);
  float fres = .06 + .94*pow(1. - clamp(V.y, 0., 1.), 3.6);
  vec2 ruv = vMir.xy / vMir.w;
  float n = hash12(gl_FragCoord.xy);
  vec3 r = vec3(0.);
  for (int i = 0; i < 9; i++) {
    float fi = (float(i) + n) / 9.; float a = fi*14.45; float rad = sqrt(fi);
    r += textureLod(tMirror, ruv + vec2(cos(a)*.0045, sin(a)*.02)*rad, 1.2).rgb;
  }
  r /= 9.;
  float gloss = .86 + (cloud - .5)*.4;
  vec3 c = mix(uDark, tone(diff), L)*(1. - fres*.55) + r * fres * gloss * (1. - .5*joint);
  c += (n - .5) / 255.;
  gl_FragColor = vec4(c, 1.);
  #include <colorspace_fragment>
}`;
const PLAIN_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vH;
void main(){ vUv = uv; vH = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WAVE = /* glsl */`
uniform vec3 uWave; uniform vec3 uDark;
float waveAt(float hx, float lead){ return max(1. - smoothstep(uWave.y + lead - 7., uWave.y + lead, abs(hx - uWave.x)), uWave.z); }`;
const SKY_FRAG = /* glsl */`
uniform float size; varying vec2 vUv; varying vec3 vH;
${WAVE}
void main(){
  vec2 d = min(vUv, 1. - vUv) * size, c = abs(vUv - .5) * size, fw = fwidth(vUv) * size;
  float edge = 1. - smoothstep(.05, .05 + max(fw.x, fw.y), min(d.x, d.y));
  float bar = 1. - smoothstep(.016, .016 + max(fw.x, fw.y), min(c.x, c.y));
  vec3 col = mix(vec3(.985, .992, 1.), vec3(.52, .53, .55), max(edge, bar*.8));
  gl_FragColor = vec4(mix(uDark, col, waveAt(vH.x, 4.5)), 1.);
  #include <colorspace_fragment>
}`;
const WELL_VERT = /* glsl */`
attribute vec2 aC; varying vec3 vP; varying vec3 vN; varying vec2 vC; varying vec3 vH;
void main(){ vC = aC; vN = normal; vP = position; vH = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WELL_FRAG = /* glsl */`
uniform vec3 sun; uniform float y0; uniform float well; uniform float hs;
varying vec3 vP; varying vec3 vN; varying vec2 vC; varying vec3 vH;
${WAVE}
void main(){
  float up = clamp((vP.y - y0) / well, 0., 1.);
  float t = (y0 + well - vP.y) / sun.y;
  vec2 x = abs(vP.xz + sun.xz*t - vC);
  float inside = min(hs - x.x, hs - x.y);
  float lit = smoothstep(0., .05, inside) * step(.02, dot(vN, sun));
  vec3 shade = mix(vec3(.66, .68, .71), vec3(.84, .86, .9), up*up);
  gl_FragColor = vec4(mix(uDark, mix(shade, vec3(1., .955, .86), lit), waveAt(vH.x, 4.)), 1.);
  #include <colorspace_fragment>
}`;
const SHADOW_FRAG = /* glsl */`
varying vec2 vUv; varying vec4 vSize; varying vec3 vH; varying float vShow;
${WAVE}
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
void main(){
  vec2 p = (vUv - .5) * vSize.xy - vec2(0., .04);
  float tight = 1. - smoothstep(0., .07, sdBox(p, vSize.zw*.5));
  float wide = 1. - smoothstep(-.06, .44, sdBox(p + vec2(0., .07), vSize.zw*.5));
  gl_FragColor = vec4(vec3(.05, .045, .04), (tight*.2 + wide*wide*.2) * waveAt(vH.x, 0.) * vShow);
  #include <colorspace_fragment>
}`;
const DARK_FRAG = /* glsl */`
uniform vec3 uCol; varying vec3 vH;
${WAVE}
void main(){ gl_FragColor = vec4(mix(uDark, uCol, waveAt(vH.x, vH.y * 0.6)), 1.);
  #include <colorspace_fragment>
}`;
const DECAL_FRAG = /* glsl */`
uniform sampler2D map; uniform vec3 uInk; uniform float uSharp; varying vec2 vUv; varying vec3 vH; uniform float uHx;
${WAVE}
void main(){
  float a = texture2D(map, vUv).r;
  if (uSharp > .5) { float w = max(fwidth(a) * .75, .001); a = smoothstep(.5 - w, .5 + w, a); }
  a *= waveAt(uHx, 2.);
  if (a < .004) discard;
  gl_FragColor = vec4(uInk, a);
  #include <colorspace_fragment>
}`;
const PIC_FRAG = /* glsl */`
uniform sampler2D map; uniform float uHx; varying vec2 vUv; varying vec3 vH;
${WAVE}
void main(){ vec3 c = texture2D(map, vUv).rgb; gl_FragColor = vec4(mix(uDark, c, waveAt(uHx, 0.)), 1.);
  #include <colorspace_fragment>
}`;

export function hallSet(story) {
  const { hall } = story, plan = hall.plan, person = story.person, sites = story.sites;
  return (ctx) => {
    const grp = new THREE.Group(); grp.rotation.y = Math.PI / 2; grp.position.set(hall.TX, 0, hall.TZ); grp.visible = false; ctx.scene.add(grp); grp.updateMatrixWorld(true);
    const disposables = [], uWave = { value: new THREE.Vector3(66, 0, 1) }, uDark = { value: new THREE.Color(0x07080A) };
    const shared = { tLm: { value: null }, lmSize: { value: new THREE.Vector2(2048, 504) }, lmScale: { value: 6 }, exposure: { value: 0.7 }, uWave, uDark };
    let dead = false, ready = false, drone = null, lights = [];
    const add = (m, order) => { m.frustumCulled = false; if (order !== undefined) m.renderOrder = order; grp.add(m); disposables.push(m.geometry, m.material); return m; };

    const tick = () => new Promise((r) => setTimeout(r, 30));       // the build is spread over several frames, so the story does not stutter
    async function build() {
      const [lmInfo, lmTex] = await Promise.all([fetch('/data/lightmap.json').then((r) => r.json()), new THREE.TextureLoader().loadAsync('/data/lightmap.png')]);
      if (dead) { lmTex.dispose(); return; }
      lmTex.flipY = false; lmTex.colorSpace = THREE.NoColorSpace; lmTex.generateMipmaps = false; lmTex.minFilter = lmTex.magFilter = THREE.LinearFilter; lmTex.needsUpdate = true;
      shared.tLm.value = lmTex; shared.lmSize.value.set(lmInfo.w, lmInfo.h); shared.lmScale.value = lmInfo.scale; shared.exposure.value = 0.66 / (lmInfo.wallMid * 0.855);
      disposables.push(lmTex);

      // ---- walls, beams, ceiling (one mesh) and the floor
      const pos = [], nor = [], lm = [], kind = [], idx = [], fpos = [], flm = [], floc = [], fidx = [];
      for (const p of plan.patches) {
        const [rx, ry] = lmInfo.rects[p.id];
        const U = new Set([0, p.w]), V = new Set([0, p.h]);
        for (const h of p.holes) { U.add(clamp(h.u0, 0, p.w)); U.add(clamp(h.u1, 0, p.w)); V.add(clamp(h.v0, 0, p.h)); V.add(clamp(h.v1, 0, p.h)); }
        const us = [...U].sort((a, b) => a - b), vs = [...V].sort((a, b) => a - b);
        const c = [p.u[1] * p.v[2] - p.u[2] * p.v[1], p.u[2] * p.v[0] - p.u[0] * p.v[2], p.u[0] * p.v[1] - p.u[1] * p.v[0]];
        const flip = c[0] * p.n[0] + c[1] * p.n[1] + c[2] * p.n[2] < 0;
        for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
          const s0 = us[i], s1 = us[i + 1], t0 = vs[j], t1 = vs[j + 1], cs = (s0 + s1) / 2, ct = (t0 + t1) / 2;
          if (s1 - s0 < 1e-5 || t1 - t0 < 1e-5) continue;
          if (p.holes.some((h) => cs > h.u0 && cs < h.u1 && ct > h.v0 && ct < h.v1)) continue;
          const corner = (s, t) => ({ pos: [p.o[0] + p.u[0] * s + p.v[0] * t, p.o[1] + p.u[1] * s + p.v[1] * t, p.o[2] + p.u[2] * s + p.v[2] * t], lm: [(rx + s * p.res) / lmInfo.w, (ry + t * p.res) / lmInfo.h] });
          const q = [corner(s0, t0), corner(s1, t0), corner(s1, t1), corner(s0, t1)];
          if (p.kind === 'floor') {
            const b = fpos.length / 3, r = p.room >= 0 ? ROOMS[p.room] : null;
            for (const cc of q) { fpos.push(cc.pos[0], 0, cc.pos[2]); flm.push(...cc.lm); floc.push(r ? cc.pos[0] - r.x0 : BAY / 2 + (cc.pos[0] - p.o[0]), cc.pos[2] - ZN); }
            if (flip) fidx.push(b, b + 2, b + 1, b, b + 3, b + 2); else fidx.push(b, b + 1, b + 2, b, b + 2, b + 3);
            continue;
          }
          const b = pos.length / 3;
          for (const cc of q) { pos.push(...cc.pos); nor.push(...p.n); lm.push(...cc.lm); kind.push(p.kind === 'beam' || p.kind === 'ceil' ? 1 : 0); }
          if (flip) idx.push(b, b + 2, b + 1, b, b + 3, b + 2); else idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('aLm', new THREE.Float32BufferAttribute(lm, 2)); g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1)); g.setIndex(idx);
      add(new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: ARCH_VERT, fragmentShader: ARCH_FRAG })), -40);
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3)); fg.setAttribute('aLm', new THREE.Float32BufferAttribute(flm, 2)); fg.setAttribute('aLoc', new THREE.Float32BufferAttribute(floc, 2)); fg.setIndex(fidx);
      const floor = add(new THREE.Mesh(fg, new THREE.ShaderMaterial({ uniforms: { ...shared, tMirror: { value: ctx.mirror.texture }, uTexMat: { value: ctx.mirror.texMat }, bay: { value: BAY } }, vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, side: THREE.DoubleSide })), -40);
      ctx.mirror.hide.push(floor); hallFloor = floor;

      await tick(); if (dead) return;
      // ---- skylights: glass at the top of a short well
      { const WELL = 0.6, sp = [], uv = [], si = [], wp = [], wn = [], wc = [], wi = [];
        plan.skylights.forEach((s) => {
          const b = sp.length / 3, y = HR + WELL;
          sp.push(s.x0, y, s.z0, s.x1, y, s.z0, s.x1, y, s.z1, s.x0, y, s.z1); uv.push(0, 0, 1, 0, 1, 1, 0, 1); si.push(b, b + 1, b + 2, b, b + 2, b + 3);
          const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
          const side = (ax, az, bx, bz, nx, nz) => { const k = wp.length / 3; wp.push(ax, HR, az, bx, HR, bz, bx, y, bz, ax, y, az); for (let i = 0; i < 4; i++) { wn.push(nx, 0, nz); wc.push(cx, cz); } wi.push(k, k + 1, k + 2, k, k + 2, k + 3); };
          side(s.x1, s.z0, s.x0, s.z0, 0, 1); side(s.x0, s.z1, s.x1, s.z1, 0, -1); side(s.x0, s.z0, s.x0, s.z1, 1, 0); side(s.x1, s.z1, s.x1, s.z0, -1, 0);
        });
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(si);
        add(new THREE.Mesh(sg, new THREE.ShaderMaterial({ uniforms: { size: { value: SKY }, uWave, uDark }, vertexShader: PLAIN_VERT, fragmentShader: SKY_FRAG, side: THREE.DoubleSide })), -40);
        const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3)); wg.setAttribute('aC', new THREE.Float32BufferAttribute(wc, 2)); wg.setIndex(wi);
        add(new THREE.Mesh(wg, new THREE.ShaderMaterial({ uniforms: { sun: { value: new THREE.Vector3(-0.6, 0.118, 0.78).normalize() }, y0: { value: HR }, well: { value: WELL }, hs: { value: SKY / 2 }, uWave, uDark }, vertexShader: WELL_VERT, fragmentShader: WELL_FRAG, side: THREE.DoubleSide })), -40); }

      await tick(); if (dead) return;
      // ---- small dark things: the shadow gap under the walls, the light tracks and the spots, the bezels of the portrait frames
      { const geos = [];
        const boxAt = (x0, y0, z0, x1, y1, z1) => { const bg = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); bg.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); geos.push(bg); };
        const G = 0.018, T = 0.012;
        ROOMS.forEach((r, ri) => {
          boxAt(r.x0, 0, ZN, r.x1, G, ZN + T); boxAt(r.x0, 0, ZS - T, r.x1, G, ZS);
          for (const [x, hasPortal] of [[r.x0, ri > 0], [r.x1 - T, ri < 2]]) { if (hasPortal) { boxAt(x, 0, ZN, x + T, G, PORTAL.z0); boxAt(x, 0, PORTAL.z1, x + T, G, ZS); } else boxAt(x, 0, ZN, x + T, G, ZS); }
          const ty = 4.74;
          boxAt(r.x0 + 0.3, ty, ZN + 2.28, r.x1 - 0.3, ty + 0.045, ZN + 2.32); boxAt(r.x0 + 0.3, ty, ZS - 2.32, r.x1 - 0.3, ty + 0.045, ZS - 2.28);
          boxAt(r.x0 + 2.28, ty, ZN + 2.3, r.x0 + 2.32, ty + 0.045, ZS - 2.3); boxAt(r.x1 - 2.32, ty, ZN + 2.3, r.x1 - 2.28, ty + 0.045, ZS - 2.3);
          for (const zc of [-BAY / 2, BAY / 2]) for (const x of [r.x0 + 2.3, r.x1 - 2.3]) boxAt(x - 0.012, ty + 0.045, zc - 0.012, x + 0.012, HB2, zc + 0.012);
          for (let k = 1; k < r.bays; k++) for (const z of [ZN + 2.3, ZS - 2.3]) boxAt(r.x0 + k * BAY - 0.012, ty + 0.045, z - 0.012, r.x0 + k * BAY + 0.012, HB, z + 0.012);
        });
        for (const wx of [ROOMS[0].x1, ROOMS[1].x1]) for (const z of [PORTAL.z0, PORTAL.z1 - T]) boxAt(wx, 0, z, wx + WT, G, z + T);
        for (const s of plan.spots) {
          const cg = new THREE.CylinderGeometry(0.05, 0.058, 0.2, 12); cg.rotateX(Math.PI / 2);
          cg.applyMatrix4(new THREE.Matrix4().lookAt(new THREE.Vector3(s.x, s.y - 0.1, s.z), new THREE.Vector3(s.tx, s.ty, s.tz), new THREE.Vector3(0, 1, 0)).setPosition(s.x, s.y - 0.11, s.z)); geos.push(cg);
          const stem = new THREE.BoxGeometry(0.02, 0.07, 0.02); stem.translate(s.x, s.y - 0.02, s.z); geos.push(stem);
        }
        for (const p of plan.pieces) if (p.kind === 'P' && p.room > 0) { const bz = new THREE.BoxGeometry(p.w + 0.036, p.h + 0.036, 0.05); bz.rotateY(Math.atan2(p.nx, p.nz)); bz.translate(p.x + p.nx * 0.03, p.y, p.z + p.nz * 0.03); geos.push(bz); }
        let n = 0; const flat = geos.map((q) => { const f = q.index ? q.toNonIndexed() : q; if (f !== q) q.dispose(); n += f.attributes.position.count; return f; });
        const arr = new Float32Array(n * 3); let o = 0; for (const f of flat) { arr.set(f.attributes.position.array, o); o += f.attributes.position.array.length; f.dispose(); }
        const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        add(new THREE.Mesh(mg, new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(0x232426) }, uWave, uDark }, vertexShader: PLAIN_VERT.replace('vUv = uv;', ''), fragmentShader: DARK_FRAG })), -39); }

      await tick(); if (dead) return;
      // ---- the soft shadow of every frame on its wall
      { const sp = [], uv = [], size = [], si = [];
        for (const p of plan.pieces) { if (p.room === 0) continue;
          shadowOf.push(p.kind === 'P' ? -1 : story.ix(p.id)); shadowW.push(p.w);
          const sw = p.w + 1.0, sh = p.h + 1.0, b = sp.length / 3, hx = p.tx * sw / 2, hz = p.tz * sw / 2, x = p.x + p.nx * 0.004, z = p.z + p.nz * 0.004, cy = p.y - 0.04;
          sp.push(x - hx, cy - sh / 2, z - hz, x + hx, cy - sh / 2, z + hz, x + hx, cy + sh / 2, z + hz, x - hx, cy + sh / 2, z - hz);
          uv.push(0, 0, 1, 0, 1, 1, 0, 1); si.push(b, b + 1, b + 2, b, b + 2, b + 3); for (let i = 0; i < 4; i++) size.push(sw, sh, p.w, p.h); }
        const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 4)); sg.setIndex(si);
        shadowShow = new THREE.BufferAttribute(new Float32Array(shadowOf.length * 4).fill(1), 1); shadowShow.setUsage(THREE.DynamicDrawUsage); sg.setAttribute('aShow', shadowShow);
        add(new THREE.Mesh(sg, new THREE.ShaderMaterial({ uniforms: { uWave, uDark }, vertexShader: PLAIN_VERT.replace('void main', 'attribute vec4 aSize; attribute float aShow; varying vec4 vSize; varying float vShow; void main').replace('vUv = uv;', 'vUv = uv; vSize = aSize; vShow = aShow;'), fragmentShader: SHADOW_FRAG,
          transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), -30); }

      // ---- lettering on the walls: one type system, the same condensed capitals as everywhere else
      await fontsReady(); if (dead) return;
      const INK = new THREE.Color(0x17181a), GREY = new THREE.Color(0x5c5e62);
      const decal = (wM, hM, ppm, x, y, z, nx, nz, draw, { sharp = 1, ink = INK } = {}) => {
        const c = document.createElement('canvas'); c.width = Math.round(wM * ppm); c.height = Math.round(hM * ppm);
        const g2 = c.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, c.width, c.height); g2.fillStyle = '#fff'; g2.textBaseline = 'alphabetic'; if (sharp) g2.filter = 'blur(1.2px)';
        draw(g2, ppm);
        const t = redTexture(c, ctx.maxAniso); c.width = c.height = 1; disposables.push(t);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), new THREE.ShaderMaterial({ uniforms: { map: { value: t }, uInk: { value: ink }, uSharp: { value: sharp }, uHx: { value: x }, uWave, uDark }, vertexShader: PLAIN_VERT, fragmentShader: DECAL_FRAG,
          transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        m.position.set(x + nx * 0.006, y, z + nz * 0.006); m.rotation.y = Math.atan2(nx, nz); add(m, -29); return m;
      };
      const cats = Object.fromEntries(story.categories.map((c) => [c.id, c.label]));
      for (const ri of [1, 2]) {
        await tick(); if (dead) return;
        const r = ROOMS[ri], label = cats[r.id].toUpperCase(), count = String(sites.filter((s) => s.cat === r.id).length);
        roomLabels.push(decal(8.4, 0.8, 200, r.x0 + 0.72 + 4.2, 3.72, ZN, 0, 1, (g2, ppm) => { setDisplay(g2, 0.62 * ppm); g2.fillText(label, 0, 0.62 * ppm); }));
        roomLabels.push(decal(1.2, 0.5, 200, r.x0 + 0.72 + measure(label, 0.62) + 0.14 + 0.6, 3.9, ZN, 0, 1, (g2, ppm) => { setMono(g2, 0.2 * ppm, 500, 0.02); g2.fillText(count, 0, 0.34 * ppm); }, { sharp: 0, ink: GREY }));
      }
      for (const m of roomLabels) m.visible = ctx.view().k > 0.5;
      const lintel = (label, x, nx) => decal(4.2, 0.42, 220, x, 4.32, 0, nx, 0, (g2, ppm) => { setDisplay(g2, 0.3 * ppm, 700, 'condensed'); g2.textAlign = 'center'; if ('letterSpacing' in g2) g2.letterSpacing = (0.012 * ppm) + 'px'; g2.fillText(label.toUpperCase(), 2.1 * ppm, 0.33 * ppm); });
      lintel(cats[ROOMS[2].id], ROOMS[1].x1, -1); lintel(cats[ROOMS[1].id], ROOMS[2].x0, 1); lintel(cats[ROOMS[0].id], ROOMS[1].x0, 1);
      await tick(); if (dead) return;
      // the contact wall, at the far end
      const C = hall.CONTACT;
      decal(C.w, 2.0, 200, X_END, EYE + 0.25 + 0.65, 0, -1, 0, (g2, ppm) => { setDisplay(g2, 1.86 * ppm); g2.fillText('MESSAGE ME', 0, 1.72 * ppm); });
      await tick(); if (dead) return;
      decal(C.w, 1.1, 200, X_END, EYE + 0.25 - 1.02, 0, -1, 0, (g2, ppm) => { setText(g2, 0.36 * ppm, 600); g2.fillText(person.email, 0.04 * ppm, 0.42 * ppm); setText(g2, 0.27 * ppm, 500); g2.globalAlpha = 0.62; g2.fillText(person.contact, 0.04 * ppm, 0.92 * ppm); }, { sharp: 0 });

      // ---- portrait frames: the phone view of the site next to them (where a phone capture exists)
      for (const p of plan.pieces) {
        if (p.kind !== 'P' || p.room === 0) continue;
        const s = sites.find((q) => q.id === p.id); if (!s || !s.media.heroMobile) continue;
        const img = new Image(); img.decoding = 'async';
        img.onload = () => { if (dead) return;
          const c = document.createElement('canvas'); c.width = 560; c.height = 700; const g2 = c.getContext('2d');
          const sw = img.naturalWidth, shh = sw * 700 / 560; g2.drawImage(img, 0, 0, sw, shh, 0, 0, 560, 700);
          const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ctx.maxAniso; disposables.push(t);
          const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.ShaderMaterial({ uniforms: { map: { value: t }, uHx: { value: p.x }, uWave, uDark }, vertexShader: PLAIN_VERT, fragmentShader: PIC_FRAG }));
          m.position.set(p.x + p.nx * 0.058, p.y, p.z + p.nz * 0.058); m.rotation.y = Math.atan2(p.nx, p.nz); add(m, -28); ctx.kick(); };
        img.src = ctx.root + s.media.heroMobile;
      }
      ready = true; ctx.kick();
      await new Promise((r) => setTimeout(r, 900)); if (dead) return;

      // ---- the survey drone from the Underhill Geomatics site, on its plinth: a real model from a real project
      const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(ctx.root + '/models/drone.glb', (gl) => {
        if (dead) return;
        const root = gl.scene, M = (color, roughness) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
        const mats = { prop: M(0x101114, 0.4), body: M(0x2c2e33, 0.46), dark: M(0x191a1d, 0.55), lens: M(0x040405, 0.1), metal: M(0x9a9da3, 0.34), light: new THREE.MeshBasicMaterial({ color: 0x35e07c }) };
        root.traverse((o) => { if (!o.isMesh) return; const n = o.name; disposables.push(o.geometry);
          o.material = /Propeller/.test(n) ? mats.prop : /Lens/.test(n) ? mats.lens : /Green_Light/.test(n) ? mats.light : /Main_Body|Battery|Computer/.test(n) ? mats.body : /Lathe|Support/.test(n) ? mats.metal : mats.dark; });
        disposables.push(...Object.values(mats));
        const bb = new THREE.Box3().setFromObject(root), size = bb.getSize(new THREE.Vector3());
        root.scale.setScalar(1.2 / Math.max(size.x, size.z)); bb.setFromObject(root); const c = bb.getCenter(new THREE.Vector3());
        root.position.set(-c.x, -bb.min.y, -c.z);
        drone = new THREE.Group(); drone.add(root); drone.position.set(PLINTH.x, PLINTH.h + 0.002, PLINTH.z); drone.rotation.y = -0.55; grp.add(drone);
        // the engine owns the two lights (see engine.js): place them as if they hung in this group
        const { hemi, key } = ctx.lights;
        key.position.set(PLINTH.x - 3, 7, PLINTH.z + 4); key.target.position.set(PLINTH.x, 1, PLINTH.z);
        grp.updateMatrixWorld(true); grp.localToWorld(key.position); grp.localToWorld(key.target.position);
        hemi.position.set(0, 1, 0); grp.localToWorld(hemi.position); lights = [hemi, key];
        ctx.kick();
      }, undefined, () => { /* the hall works without the model */ });
    }
    let hallFloor = null, shadowShow = null; const shadowOf = [], shadowW = [], roomLabels = [];
    // width of a label in metres at a given size (for the count that follows the room name)
    function measure(label, sizeM) { const g2 = document.createElement('canvas').getContext('2d'); setDisplay(g2, 100); return g2.measureText(label).width / 100 * sizeM; }
    build().catch((e) => console.error('hall', e));

    return {
      resize(view) { for (const m of roomLabels) m.visible = view.k > 0.5; },       // on a phone the room names would sit under the page header
      update(S) {
        const X = S.x.hall; grp.visible = X.on > 0.5 && ready; ctx.mirror.force = grp.visible;
        if (!grp.visible) { for (const l of lights) l.intensity = 0; return; }
        const raw = X.lightRaw === undefined ? 1 : X.lightRaw;
        uWave.value.set(ROOMS[1].x1 - 2, raw * 46, clamp((raw - 0.86) / 0.14));
        // a frame throws its shadow only when it hangs there, open
        if (shadowShow) { const arr = shadowShow.array; let ch = false;
          for (let k = 0; k < shadowOf.length; k++) { const i = shadowOf[k]; if (i < 0) continue; const pl = S.planes[i];
            const v = pl.vis && pl.grain < 0.5 ? clamp((pl.w / shadowW[k] - 0.6) / 0.4) * Math.min(1, pl.op) : 0;
            if (arr[k * 4] !== v) { arr[k * 4] = arr[k * 4 + 1] = arr[k * 4 + 2] = arr[k * 4 + 3] = v; ch = true; } }
          if (ch) shadowShow.needsUpdate = true; }
        if (drone) { const on = raw > 0.75; drone.visible = on; for (const l of lights) l.intensity = on ? (l.isHemisphereLight ? 2.1 : 1.5) * clamp((raw - 0.75) / 0.25) : 0; }
      },
      dispose() { dead = true; for (const l of lights) l.intensity = 0; ctx.mirror.force = false; const k = ctx.mirror.hide.indexOf(hallFloor); if (k >= 0) ctx.mirror.hide.splice(k, 1); ctx.scene.remove(grp); for (const d of disposables) d && d.dispose && d.dispose(); },
    };
  };
}
