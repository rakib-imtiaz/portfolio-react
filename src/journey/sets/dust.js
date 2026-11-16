// The look of the "dust" world (08-particles): a picture made of particles. Every particle is a small tile that carries
// its own piece of the site capture. Locked together the tiles are the capture, pixel for pixel, in the place of the
// site plane of the engine. In flight a tile is a grain of dust in the colour of its piece.
//
// Contract: dustSet(story) returns a factory (ctx) => ({ update(S, dt, camera), resize(view), dispose() }).
// S.x.dust: on, a / b (site indices: the picture that breaks, the picture that forms), mix (0 = a whole, 1 = b whole,
// linear in scroll), wave (which wave shape), pos / quat / w (the picture in world metres, height = w * 0.625),
// grains (how much of the loose dust shows). All motion is a pure function of these values: there is no clock here.
import * as THREE from 'three';
import { rng, clamp } from '../util.js';

const VS = /* glsl */`
attribute vec2 aRef; attribute vec4 aRnd;
uniform sampler2D uTexA; uniform sampler2D uTexB;
uniform float uMix, uMode, uBand, uPass, uCellM, uPxScale, uDpr, uCamZ, uSeed, uMaxR, uSpin, uDust;
uniform vec2 uDir, uOrigin, uPlane;
varying vec2 vRef; varying float vSwap; varying float vAlpha; varying vec3 vCol; varying float vSpan; varying float vRound; varying float vLift; varying float vDepth;

vec3 flow(vec3 p){
  return vec3(sin(p.y * 1.7 + p.z * 1.3) + sin(p.z * 2.1 + p.x * 0.7),
              sin(p.z * 1.5 + p.x * 1.9) + sin(p.x * 2.3 + p.y * 0.9),
              sin(p.x * 1.1 + p.y * 2.7) + sin(p.y * 1.9 + p.z * 0.5)) * 0.5;
}

void main(){
  vec2 q = aRef - 0.5;
  vec2 asp = vec2(uPlane.x / uPlane.y, 1.0);

  // where this particle sits on the wave: 0 = first to go, 1 = last
  float c;
  if (uMode < 0.5) { float ext = abs(uDir.x) * 0.5 * asp.x + abs(uDir.y) * 0.5; c = dot(q * asp, uDir) / (2.0 * ext) + 0.5; }
  else c = length((aRef - uOrigin) * asp) / uMaxR;
  float n = flow(vec3(q * asp * 4.2, uSeed * 0.37)).x * 0.5 + 0.5;      // a coherent, uneven front (not static noise)
  c = clamp(c, 0.0, 1.0) * 0.80 + n * 0.16 + aRnd.x * 0.04;
  float lt = clamp((uMix * (1.0 + uBand) - c) / uBand, 0.0, 1.0);
  float f = smoothstep(0.0, 0.40, lt) * (1.0 - smoothstep(0.52, 1.0, lt));

  vec3 p0 = vec3(q * uPlane, 0.0);
  float sc = uPlane.y;
  vec3 sp = vec3(q * asp * 2.6, uSeed);
  vec3 fl = flow(sp + vec3(0.0, 0.0, lt * 1.6)) + 0.5 * flow(sp * 2.7 + 3.1 + lt * 1.3);
  vec2 wind = uMode < 0.5 ? uDir : normalize((aRef - uOrigin) * asp + 0.0001);
  vec3 d = vec3(wind * (0.10 + 0.34 * aRnd.y) * sc, 0.0)
         + fl * vec3(0.19, 0.17, 0.10) * sc
         + vec3(0.0, 0.0, (0.06 + 0.80 * aRnd.z * aRnd.z) * uCamZ * 0.56);
  float ang = (lt * 1.2 + aRnd.w) * 6.2831;
  d.xy += vec2(cos(ang), sin(ang)) * 0.05 * sc;
  vec3 pos = p0 + d * f;
  // loose dust turns slowly around the picture centre
  float th = f * (0.35 + 0.65 * aRnd.y) * 0.5 * uSpin; float cs = cos(th), sn = sin(th);
  pos.xy = vec2(pos.x * cs - pos.y * sn, pos.x * sn + pos.y * cs);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(0.02, -mv.z);
  vDepth = length(mv.xyz);
  float persp = uCamZ / depth;
  float cellPx = uCellM * uPxScale / uCamZ;        // one cell in device pixels, at the picture plane
  vSwap = smoothstep(0.36, 0.64, lt);
  vRef = aRef;
  vSpan = (cellPx + 1.0) / cellPx;
  vCol = vec3(0.0); vLift = 0.0;

  if (uPass < 0.5) {
    // a tile: its own piece of the picture
    float vis = 1.0 - smoothstep(0.26, 0.40, f);
    float scale = 1.0 - 0.76 * smoothstep(0.02, 0.36, f);
    vLift = smoothstep(0.0, 0.10, f) * (1.0 - smoothstep(0.10, 0.30, f)) * 1.6;     // a glint where tiles leave and land
    gl_PointSize = (cellPx + 1.0) * scale * persp;
    vAlpha = vis; vRound = smoothstep(0.03, 0.18, f);
    if (vis <= 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  } else {
    // a grain of dust in the colour of its piece
    float vis = smoothstep(0.12, 0.40, f); vRound = 1.0;
    float big = smoothstep(1.22, 1.95, persp);
    gl_PointSize = min((1.3 + 2.3 * aRnd.w) * uDpr * persp * (1.0 + 2.6 * big), 64.0);
    vec3 col = mix(textureLod(uTexA, aRef, 2.0).rgb, textureLod(uTexB, aRef, 2.0).rgb, vSwap);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    vCol = (col * 1.35 + 0.03) * (1.0 + 0.5 * smoothstep(0.3, 0.0, lum));
    vAlpha = vis * (0.95 - 0.72 * big) * uDust;
    if (vAlpha <= 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
}`;

const FS = /* glsl */`
uniform sampler2D uTexA; uniform sampler2D uTexB; uniform float uPass; uniform vec2 uCellUv;
uniform vec3 uFogColor; uniform float uFogDensity; uniform float uFogK;
varying vec2 vRef; varying float vLift; varying float vSwap; varying float vAlpha; varying vec3 vCol; varying float vSpan; varying float vRound; varying float vDepth;
void main(){
  vec2 pc = gl_PointCoord - 0.5;
  if (uPass < 0.5) {
    vec2 uv = vRef + vec2(pc.x, -pc.y) * uCellUv * vSpan;
    vec3 c = vSwap < 0.5 ? texture2D(uTexA, uv).rgb : texture2D(uTexB, uv).rgb;      // the same read as the site plane: the swap must not show
    c *= 1.0 + 0.22 * vLift;
    float fog = (1.0 - exp(-pow(vDepth * uFogDensity, 2.0))) * uFogK;
    c = mix(c, uFogColor, fog);
    float disc = mix(1.0, smoothstep(0.5, 0.36, length(pc)), vRound);
    if (vAlpha * disc < 0.01) discard;                // a round tile in flight must not leave a square in the depth
    gl_FragColor = vec4(c, vAlpha * disc);
  } else {
    float s = smoothstep(0.5, 0.04, length(pc));
    gl_FragColor = vec4(vCol * s * vAlpha, 1.0);
  }
  #include <colorspace_fragment>
}`;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function dustSet(story) {
  return (ctx) => {
    const { renderer, scene, planes, G } = ctx;
    const WAVES = story.dust.WAVES;          // the wave shapes of the story (fixed: the story replays exactly)
    const U = {
      uTexA: { value: ctx.blank }, uTexB: { value: ctx.blank }, uMix: { value: 1 }, uMode: { value: 0 }, uBand: { value: 0.56 }, uSpin: { value: 1 },
      uCellM: { value: 0.01 }, uPxScale: { value: 1000 }, uDpr: { value: 1 }, uCamZ: { value: 4 }, uSeed: { value: 0 }, uMaxR: { value: 1 }, uDust: { value: 1 },
      uDir: { value: new THREE.Vector2(1, 0) }, uOrigin: { value: new THREE.Vector2(0.5, 0.5) }, uPlane: { value: new THREE.Vector2(2.6, 1.625) }, uCellUv: { value: new THREE.Vector2(0.01, 0.01) },
      uFogColor: G.uFogColor, uFogDensity: G.uFogDensity, uFogK: { value: 1 },
    };
    const mk = (pass) => new THREE.ShaderMaterial({
      uniforms: { ...U, uPass: { value: pass } }, vertexShader: VS, fragmentShader: FS,
      transparent: true, depthTest: pass === 0, depthWrite: pass === 0,
      blending: pass === 0 ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const matTiles = mk(0), matDust = mk(1);
    const tiles = new THREE.Points(new THREE.BufferGeometry(), matTiles);
    const dust = new THREE.Points(tiles.geometry, matDust);
    tiles.frustumCulled = false; dust.frustumCulled = false; tiles.renderOrder = 0.5; dust.renderOrder = 8;
    const group = new THREE.Group(); group.add(tiles, dust); group.visible = false; scene.add(group);

    // The point size depends on the target that is drawn (the mirror pass of the engine is half size) and on its lens.
    const _sz = new THREE.Vector2();
    const sizeFor = (r, sc, camera, geo, material) => {
      const rt = r.getRenderTarget();
      const h = rt ? rt.height : r.getDrawingBufferSize(_sz).y;
      material.uniforms.uPxScale.value = h * camera.projectionMatrix.elements[5] * 0.5;
      material.uniformsNeedUpdate = true;
    };
    tiles.onBeforeRender = sizeFor; dust.onBeforeRender = sizeFor;

    let cols = 0, rows = 0;
    function buildGrid(c, r) {
      cols = c; rows = r;
      const count = c * r, ref = new Float32Array(count * 2), rnd = new Float32Array(count * 4), pos = new Float32Array(count * 3), R = rng(8088);
      let k = 0;
      for (let j = 0; j < r; j++) for (let i = 0; i < c; i++, k++) {
        ref[k * 2] = (i + 0.5) / c; ref[k * 2 + 1] = 1 - (j + 0.5) / r;
        rnd[k * 4] = R(); rnd[k * 4 + 1] = R(); rnd[k * 4 + 2] = R(); rnd[k * 4 + 3] = R();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aRef', new THREE.BufferAttribute(ref, 2));
      g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
      tiles.geometry.dispose(); tiles.geometry = g; dust.geometry = g;
      U.uCellUv.value.set(1 / c, 1 / r);
    }
    // One cell is about 3.7 CSS px at a hold (3 on a phone). Columns are a multiple of 8, so the cells are square (rows = columns * 5 / 8).
    function resize(view) {
      if (!view) return;
      const px = view.rect.fw * view.W, cell = px < 420 ? 3.0 : 3.7;
      const c = clamp(Math.round(px / cell / 8) * 8, 64, 320);
      if (c !== cols) buildGrid(c, c * 5 / 8);
      ctx.kick();
    }
    resize(ctx.view());

    const mine = new Set();          // the large captures this set holds in the engine
    const hold = (list) => {
      for (const i of mine) if (!list.includes(i)) { ctx.heroPins.delete(i); mine.delete(i); }
      for (const i of list) { if (!mine.has(i)) { mine.add(i); ctx.heroPins.add(i); } ctx.wantHero(i); }
    };
    const texOf = (i) => { const p = planes[i]; return (p && (p.hero || p.thumb)) || ctx.blank; };
    const order = story.dust.holds;
    const _n = new THREE.Vector3(), _v = new THREE.Vector3();
    let waveNow = -1;

    function update(S, dt, camera) {
      const X = S.x.dust, on = X.on > 0.5 && X.a >= 0 && X.b >= 0;
      group.visible = on;
      if (!on) { if (mine.size) hold([]); return false; }
      group.position.copy(X.pos); group.quaternion.copy(X.quat);
      U.uPlane.value.set(X.w, X.w * 0.625); U.uCellM.value = X.w / cols; U.uDpr.value = renderer.getPixelRatio();
      _n.set(0, 0, 1).applyQuaternion(X.quat);
      U.uCamZ.value = Math.max(0.2, Math.abs(_n.dot(_v.subVectors(camera.position, X.pos))));
      // the two pictures; the next one of the story loads one step ahead
      hold(X.a === X.b ? [X.b] : [X.a, X.b]);
      const nx = order[order.indexOf(X.b) + 1]; if (nx !== undefined && nx >= 0) ctx.wantHero(nx);
      U.uTexA.value = texOf(X.a); U.uTexB.value = texOf(X.b);
      U.uMix.value = ease(clamp(X.mix));
      const wi = ((X.wave | 0) % WAVES.length + WAVES.length) % WAVES.length;
      if (wi !== waveNow) {
        waveNow = wi; const w = WAVES[wi];
        U.uMode.value = w.mode; U.uDir.value.set(w.dir[0], w.dir[1]).normalize(); U.uOrigin.value.set(w.origin[0], w.origin[1]); U.uSeed.value = w.seed; U.uSpin.value = w.spin;
        let m = 0; for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) m = Math.max(m, Math.hypot((x - w.origin[0]) * 1.6, y - w.origin[1]));
        U.uMaxR.value = m;
      }
      U.uDust.value = 0.7 + 0.3 * clamp(X.grains);      // the dust of the breaking picture always shows; `grains` only lifts it
      U.uFogK.value = 1;
      return false;
    }

    function dispose() {
      hold([]);
      scene.remove(group);
      tiles.geometry.dispose(); matTiles.dispose(); matDust.dispose();
    }
    return { update, resize, dispose };
  };
}
