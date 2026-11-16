// The look of the "globe" world, ported from 04-globe/globe.js: the Earth drawn in a shader from one distance-field image
// (data/earth.png: Natural Earth 110m, coast distance in R, borders in G). Paper land, ink coast, one cobalt sea, yellow pins.
// Contract: globeSet(story) returns a factory (ctx) => ({ update(S, dt, camera), resize(view), dispose() }).
// The story gives S.x.globe: on, pos (centre), night (0..1), haze (0..1), focus (site index), label (0..1), cards [{ i, pin, px, py, pz }].
import * as THREE from 'three';

const RAD = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const rgb = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
const PAPER = 0xefece4, TAG = '#f3f0e8', INK = '#0c1020', INK2 = '#555a69', PINY = '#ffd21f';
const DISPLAY = '"Archivo", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';

const VERT = /* glsl */`
varying vec3 vObj; varying vec3 vVN; varying vec3 vVP;
void main() {
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vVP = mv.xyz; vVN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;
// The colours are written as they are (no colour-space step), the same as 04, so the map keeps its exact inks.
const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap;
uniform vec3 uOcean, uShelf, uDeep, uLand, uLandEdge, uInk, uLight, uSun, uPaper;
uniform float uNight, uHaze;
varying vec3 vObj; varying vec3 vVN; varying vec3 vVP;
const float PI = 3.141592653589793;
const float DEG = 57.29577951;
float sd(vec2 uv) { return (texture2D(uMap, uv).r - 0.5) * 4.0; }
float line(float v, float s, float dv) { float f = abs(fract(v / s - 0.5) - 0.5) * s; return 1.0 - smoothstep(0.5 * dv, 1.3 * dv, f); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 n = normalize(vObj);
  float lat = asin(clamp(n.y, -1.0, 1.0)), lon = atan(n.x, n.z);
  vec2 uv = vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);          // row 0 of the data is the north pole
  vec4 m = texture2D(uMap, uv);
  float d = (m.r - 0.5) * 4.0;                                   // degrees to the coast, land positive
  float dpp = max(length(fwidth(n)) * DEG, 1e-5);                // degrees per pixel here
  float land = smoothstep(-0.7 * dpp, 0.7 * dpp, d);

  // water: a pale shelf at the coast, deeper further out, engraved water lines when close enough to see them
  float od = clamp(-d / 2.0, 0.0, 1.0);
  vec3 sea = mix(uShelf, uOcean, smoothstep(0.0, 0.5, od));
  sea = mix(sea, uDeep, smoothstep(0.55, 1.0, od) * 0.3);
  float w1 = line(-d, 0.5, dpp) * (1.0 - smoothstep(0.05, 0.11, dpp)) * (1.0 - smoothstep(0.4, 1.8, -d));
  float w2 = line(-d, 0.125, dpp) * (1.0 - smoothstep(0.012, 0.026, dpp)) * (1.0 - smoothstep(0.1, 0.55, -d));
  sea = mix(sea, vec3(1.0), max(w1 * 0.26, w2 * 0.2) * step(0.02, -d));
  // the land lies on the water like cut paper: a soft shadow to its south-east
  float o = clamp(5.0 * dpp, 0.05, 0.42);
  vec2 off = vec2(-o / max(cos(lat), 0.2) / 360.0, -o / 180.0) * 0.8;
  sea *= 1.0 - 0.2 * smoothstep(-0.5 * o, 0.3 * o, sd(uv + off));

  // land: paper, a little darker at its edge; borders; a fine ink coast
  vec3 ground = mix(uLandEdge, uLand, smoothstep(0.0, 0.55, d));
  float border = 1.0 - smoothstep(0.45 * dpp, 1.25 * dpp, m.g);
  ground = mix(ground, uInk, border * 0.34);

  // graticule: 10 degrees always, 2 degrees and half degrees as the camera comes down
  float latD = lat * DEG, lonD = lon * DEG;
  float dLat = fwidth(latD), dLon = min(fwidth(lonD), fwidth(atan(-n.x, -n.z) * DEG));
  float pole = 1.0 - smoothstep(78.0, 87.0, abs(latD));
  float g = max(line(latD, 10.0, dLat), line(lonD, 10.0, dLon) * pole) * 0.75;
  float g2 = max(line(latD, 2.0, dLat), line(lonD, 2.0, dLon) * pole) * (1.0 - smoothstep(0.03, 0.07, dpp)) * 0.55;
  float g3 = max(line(latD, 0.5, dLat), line(lonD, 0.5, dLon) * pole) * (1.0 - smoothstep(0.008, 0.016, dpp)) * 0.4;
  float grid = max(g, max(g2, g3));
  sea = mix(sea, vec3(1.0), grid * 0.17);
  ground = mix(ground, uInk, grid * 0.13);

  vec3 col = mix(sea, ground, land);
  float coast = 1.0 - smoothstep(0.35 * dpp, 1.15 * dpp, abs(d));
  col = mix(col, uInk, coast * 0.85);

  // light: one soft key from the upper left, a darker limb, a small shine on the water
  vec3 vn = normalize(vVN), v = normalize(-vVP);
  float lit = mix(0.74, 1.05, smoothstep(-0.4, 0.95, dot(vn, uLight)));
  float limb = pow(1.0 - clamp(dot(vn, v), 0.0, 1.0), 2.4);
  col *= lit;
  col = mix(col, uDeep * 0.62, limb * mix(0.82, 0.36, land));
  float sp = pow(max(dot(vn, normalize(uLight + v)), 0.0), 46.0);
  col += vec3(0.42, 0.5, 0.6) * sp * (1.0 - land) * 0.55;

  // night: the light turns away and the terminator crosses the face. At the end only a thin lit limb is left.
  float sunD = dot(vn, uSun);
  float day = mix(1.0, smoothstep(-0.06, 0.2, sunD), smoothstep(0.0, 0.05, uNight));
  vec3 dark = mix(vec3(0.011, 0.02, 0.05), vec3(0.03, 0.036, 0.06), land);
  dark = mix(dark, vec3(0.085, 0.12, 0.23), coast * 0.6);
  dark += vec3(0.014, 0.02, 0.04) * grid;
  vec3 dusk = col * mix(vec3(1.0), vec3(1.06, 0.8, 0.62), (1.0 - day) * uNight);      // the last light is warm
  col = mix(dark, dusk, day);
  float rim = pow(1.0 - clamp(dot(vn, v), 0.0, 1.0), 3.2) * smoothstep(-0.55, 0.25, sunD) * uNight;
  col += vec3(0.3, 0.5, 1.0) * rim * 0.95;

  // far away the globe stands in paper haze, like a pale sun
  col = mix(col, uPaper, uHaze * 0.9);
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;
const HALO_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HALO_FRAG = /* glsl */`
precision highp float; varying vec2 vUv; uniform vec3 uCol; uniform float uA;
void main() { float r = length(vUv - 0.5) * 2.0 * 1.3; float a = (1.0 - smoothstep(0.93, 1.16, r)) * uA; gl_FragColor = vec4(uCol, a); }`;
// leader lines: thin ink ribbons, with a round dot where a line meets its card
const LEAD_VERT = /* glsl */`attribute float aA; varying vec2 vUv; varying float vA; void main(){ vUv = uv; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LEAD_FRAG = /* glsl */`
precision highp float; varying vec2 vUv; varying float vA; uniform vec3 uCol;
void main() {
  float a = vA;
  if (vUv.x > 1.5) { float r = length(vUv - vec2(2.5, 0.5)) * 2.0; float w = fwidth(r); a *= 1.0 - smoothstep(1.0 - w, 1.0, r); }
  else { float e = abs(vUv.y - 0.5) * 2.0; float w = fwidth(e); a *= 1.0 - smoothstep(1.0 - w * 1.2, 1.0, e); }
  if (a < 0.004) discard;
  gl_FragColor = vec4(uCol, a);
}`;

// the soft shadow a card throws on the map
const SHAD_VERT = /* glsl */`attribute vec4 aSize; attribute float aA; varying vec2 vUv; varying vec4 vSize; varying float vA;
void main(){ vUv = uv; vSize = aSize; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHAD_FRAG = /* glsl */`
precision highp float; varying vec2 vUv; varying vec4 vSize; varying float vA;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main() {
  vec2 p = (vUv - 0.5) * vSize.xy; float m = (vSize.x - vSize.z) * 0.5;
  float a = 1.0 - smoothstep(-0.35 * m, m, sdBox(p, vSize.zw * 0.5));
  a = a * a * vA; if (a < 0.003) discard;
  gl_FragColor = vec4(0.03, 0.075, 0.3, a);
}`;

const LAKES = [[[-120.139, 39.168], [-120.1, 39.187], [-120.08, 39.224], [-120.05, 39.238], [-120.026, 39.236], [-120.0, 39.227], [-119.95, 39.246], [-119.93, 39.205], [-119.935, 39.15], [-119.945, 39.09],
  [-119.95, 39.0], [-119.945, 38.965], [-119.98, 38.94], [-120.04, 38.935], [-120.085, 38.955], [-120.1, 39.0], [-120.12, 39.035], [-120.16, 39.085], [-120.158, 39.14]]];
const EDGES = [
  [[-120.0, 42.0], [-120.0, 39.0], [-114.633, 35.002]],        // California and Nevada
  [[-124.21, 42.0], [-114.04, 42.0]],                           // the 42nd parallel: Oregon above, California and Nevada below
];
// names on the map. near / far are camera heights over the ground, as a share of the radius.
const MARKS = [
  { t: 'Pacific Ocean', lat: 30, lon: -143, sea: 1, big: 1, near: 0.55, far: 8 },
  { t: 'Canada', lat: 59.5, lon: -119, big: 1, near: 0.55, far: 8 },
  { t: 'United States', lat: 41, lon: -106, big: 1, near: 0.55, far: 8 },
  { t: 'British Columbia', lat: 52.3, lon: -124.4, near: 0, far: 0.95 },
  { t: 'Alberta', lat: 53.4, lon: -114.6, near: 0, far: 0.95 },
  { t: 'Washington', lat: 47.35, lon: -120.2, near: 0, far: 0.95 },
  { t: 'Oregon', lat: 43.9, lon: -120.4, near: 0, far: 0.95 },
  { t: 'California', lat: 37.9, lon: -121.2, near: 0, far: 0.95 },
  { t: 'Nevada', lat: 39.9, lon: -117.9, near: 0, far: 0.95 },
  { t: 'Lake Tahoe', lat: 38.84, lon: -119.98, lake: 1, near: 0, far: 0.22 },
];
const PIN_PATH = 'M17 43.5C17 43.5 4 28.2 4 17a13 13 0 1 1 26 0c0 11.2-13 26.5-13 26.5Z';
const coord = (p) => `${Math.abs(p.lat).toFixed(2)}°${p.lat >= 0 ? 'N' : 'S'}  ${Math.abs(p.lon).toFixed(2)}°${p.lon >= 0 ? 'E' : 'W'}`;

export function globeSet(story) {
  const G = story.globe.G, R = G.R;
  return (ctx) => {
    const { scene } = ctx;
    const disposables = [];
    const keep = (o) => { disposables.push(o); return o; };
    let dead = false;

    const root = new THREE.Group(); root.visible = false; scene.add(root);          // at the centre of the globe
    const turned = new THREE.Group(); turned.quaternion.copy(G.quat); root.add(turned);   // things fixed to the ground
    const world = new THREE.Group(); world.visible = false; scene.add(world);        // things placed in world space each frame

    /* ---------------------------------------------------------------- the ball */
    const sea = new THREE.DataTexture(new Uint8Array([64, 255, 0, 255]), 1, 1); sea.needsUpdate = true;      // until the map has loaded: open sea
    keep(sea);
    const U = { uMap: { value: sea }, uOcean: { value: rgb(0x1b4fe4) }, uShelf: { value: rgb(0x4f84ff) }, uDeep: { value: rgb(0x0a2a9c) }, uLand: { value: rgb(0xfbf8f1) }, uLandEdge: { value: rgb(0xe6dfd0) },
      uInk: { value: rgb(0x0b1a52) }, uLight: { value: new THREE.Vector3(-0.52, 0.62, 0.59).normalize() }, uSun: { value: new THREE.Vector3(0, 0, 1) }, uPaper: { value: rgb(PAPER) }, uNight: { value: 0 }, uHaze: { value: 0 } };
    const ball = new THREE.Mesh(keep(new THREE.SphereGeometry(R, 128, 80)), keep(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U })));
    ball.frustumCulled = false; turned.add(ball);
    // the map: the two channels the shader reads, packed as RG (half the memory of the RGB image)
    let mapTex = null;
    (async () => {
      try {
        const r = await fetch('/data/earth.png'); if (!r.ok) throw new Error('earth.png');
        const bmp = await createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        const w = bmp.width, h = bmp.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const c2 = cv.getContext('2d', { willReadFrequently: true }); c2.drawImage(bmp, 0, 0); bmp.close && bmp.close();
        const src = c2.getImageData(0, 0, w, h).data, rg = new Uint8Array(w * h * 2);
        for (let i = 0, j = 0; i < src.length; i += 4, j += 2) { rg[j] = src[i]; rg[j + 1] = src[i + 1]; }
        cv.width = cv.height = 1;
        if (dead) return;
        const t = new THREE.DataTexture(rg, w, h, THREE.RGFormat, THREE.UnsignedByteType);
        t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
        mapTex = t; U.uMap.value = t; ctx.kick();
      } catch (e) { console.warn('globe: the map did not load', e); }
    })();

    // the soft shadow the globe throws on the paper
    const haloMat = keep(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, uniforms: { uCol: { value: rgb(0x0a1d66) }, uA: { value: 0.3 } } }));
    const halo = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), haloMat); halo.renderOrder = -30; halo.frustumCulled = false; world.add(halo);

    /* ---------------------------------------------------------------- map detail the 110m data does not hold: Lake Tahoe, two state lines */
    const vectors = [];
    {
      const lift = 1.0006 * R, V2 = (a) => a.map(([lon, lat]) => new THREE.Vector2(lon, lat));
      const dense = (pts, step = 0.05) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } out.push(pts[pts.length - 1]); return out; };
      const toPos = (pts) => { const arr = new Float32Array(pts.length * 3), v = new THREE.Vector3(); pts.forEach(([lon, lat], i) => { G.unit(lat, lon, v).multiplyScalar(lift); arr.set([v.x, v.y, v.z], i * 3); }); return arr; };
      const lakeFill = keep(new THREE.MeshBasicMaterial({ color: 0x3a72f2, depthTest: false, depthWrite: false, transparent: true }));
      const lakeEdge = keep(new THREE.LineBasicMaterial({ color: 0x0b1a52, depthTest: false, depthWrite: false, transparent: true }));
      const edge = keep(new THREE.LineDashedMaterial({ color: 0x0b1a52, depthTest: false, depthWrite: false, transparent: true, opacity: 0.45, dashSize: 0.0011 * R, gapSize: 0.0008 * R }));
      for (const poly of LAKES) {
        const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.BufferAttribute(toPos(poly), 3));
        geo.setIndex(THREE.ShapeUtils.triangulateShape(V2(poly), []).flat());
        const m = new THREE.Mesh(geo, lakeFill); m.renderOrder = 0.4; m.frustumCulled = false;
        const lg = keep(new THREE.BufferGeometry()); lg.setAttribute('position', new THREE.BufferAttribute(toPos(dense([...poly, poly[0]], 0.01)), 3));
        const l = new THREE.Line(lg, lakeEdge); l.renderOrder = 0.45; l.frustumCulled = false;
        const cen = poly.reduce((a, [lon, lat]) => [a[0] + lon / poly.length, a[1] + lat / poly.length], [0, 0]);
        turned.add(m, l); vectors.push({ objs: [m, l], mats: [lakeFill, lakeEdge], base: [1, 1], n: G.unit(cen[1], cen[0]).applyQuaternion(G.quat), far: 1.0 });
      }
      for (const pts of EDGES) {
        const lg = keep(new THREE.BufferGeometry()); lg.setAttribute('position', new THREE.BufferAttribute(toPos(dense(pts)), 3));
        const l = new THREE.Line(lg, edge); l.computeLineDistances(); l.renderOrder = 0.45; l.frustumCulled = false;
        const mid = pts[Math.floor(pts.length / 2)];
        turned.add(l); vectors.push({ objs: [l], mats: [edge], base: [0.45], n: G.unit(mid[1], mid[0]).applyQuaternion(G.quat), far: 1.6 });
      }
    }

    /* ---------------------------------------------------------------- type: drawn on canvases, once the font is there */
    const setFont = (c, weight, px, stretch) => { c.font = `${weight} ${px}px ${DISPLAY}`; if ('fontStretch' in c) c.fontStretch = stretch; };
    const tracked = (c, text, x, y, track) => { for (const ch of text) { c.fillText(ch, x, y); x += c.measureText(ch).width + track; } return x; };
    const trackedW = (c, text, track) => { let w = 0; for (const ch of text) w += c.measureText(ch).width + track; return w - track; };
    const canvasTex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ctx.maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
    const flatMat = (tex) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });

    // the pin (04's drawing): 1 unit tall, the tip at the origin
    const PS = 6, PPAD = 6, pinCv = document.createElement('canvas'); pinCv.width = (34 + PPAD * 2) * PS; pinCv.height = (46 + PPAD * 2) * PS;
    { const c = pinCv.getContext('2d'); c.scale(PS, PS); c.translate(PPAD, PPAD);
      const path = new Path2D(PIN_PATH);
      c.save(); c.shadowColor = 'rgba(6, 18, 80, 0.45)'; c.shadowBlur = 3 * PS; c.shadowOffsetY = 3 * PS; c.fillStyle = PINY; c.fill(path); c.restore();
      c.fillStyle = PINY; c.fill(path); c.lineWidth = 2.4; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke(path);
      c.beginPath(); c.arc(17, 17, 4.6, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); }
    const pinTex = keep(canvasTex(pinCv));
    const pinGeo = keep(new THREE.PlaneGeometry((34 + PPAD * 2) / 46, (46 + PPAD * 2) / 46)); pinGeo.translate(0, (46 + PPAD * 2) / 92 - (PPAD + 2.5) / 46, 0);
    const footGeo = keep(new THREE.CircleGeometry(3.2, 20)); footGeo.rotateX(-Math.PI / 2);
    const ringGeo = keep(new THREE.RingGeometry(11, 13.4, 56)); ringGeo.rotateX(-Math.PI / 2);
    const pins = G.pins.map((p) => {
      const mat = keep(new THREE.MeshBasicMaterial({ map: pinTex, transparent: true, depthWrite: false }));
      const mesh = new THREE.Mesh(pinGeo, mat); mesh.renderOrder = 1.6; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
      const fm = keep(new THREE.MeshBasicMaterial({ color: 0x0b1020, transparent: true, depthTest: false, depthWrite: false }));
      const foot = new THREE.Mesh(footGeo, fm); foot.renderOrder = 1.2; foot.frustumCulled = false;
      const rm = keep(new THREE.MeshBasicMaterial({ color: 0x0b1020, transparent: true, depthTest: false, depthWrite: false, opacity: 0 }));
      const ring = new THREE.Mesh(ringGeo, rm); ring.renderOrder = 1.2; ring.frustumCulled = false;
      world.add(mesh, foot, ring);
      return { p, mesh, mat, foot, fm, ring, rm, on: 0, P: new THREE.Vector3(), head: new THREE.Vector3(), facing: 0, wpp: 0 };
    });

    // the tags of the towns: one tag for each set of towns that share a site (Tahoe City and Truckee: one store, two towns)
    const groups = [];
    for (const p of G.pins) { const key = p.sites.join('|'); let g = groups.find((x) => x.key === key); if (!g) groups.push((g = { key, pins: [], sites: p.sites })); g.pins.push(p); }
    const TS = 3;
    for (const g of groups) {
      g.title = `${g.pins.map((p) => p.name).join(' + ')}, ${g.pins[0].region}`.toUpperCase();
      g.sub = g.pins.map(coord);
      g.cv = document.createElement('canvas'); g.tex = keep(canvasTex(g.cv)); g.mat = keep(flatMat(g.tex));
      g.mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), g.mat); g.mesh.renderOrder = 2.4; g.mesh.frustumCulled = false; g.mesh.visible = false; world.add(g.mesh);
      g.n = g.pins.reduce((a, p) => a.add(p.n), new THREE.Vector3()).normalize();
    }
    function drawTags() {
      for (const g of groups) {
        const c = g.cv.getContext('2d');
        setFont(c, 800, 25 * TS, 'extra-condensed'); const tw = c.measureText(g.title).width / TS;
        setFont(c, 600, 11.5 * TS, 'semi-condensed'); const sw = Math.max(...g.sub.map((s) => c.measureText(s).width / TS));
        const padX = 11, w = Math.ceil(Math.max(tw, sw) + padX * 2), h = Math.round(7 + 23 + 3 + g.sub.length * 13.5 + 6), sh = 18;
        g.wPx = w + sh * 2; g.hPx = h + sh * 2; g.plateW = w; g.plateH = h;
        g.cv.width = g.wPx * TS; g.cv.height = g.hPx * TS;
        c.setTransform(TS, 0, 0, TS, 0, 0); c.clearRect(0, 0, g.wPx, g.hPx);
        c.save(); c.shadowColor = 'rgba(8, 20, 80, 0.42)'; c.shadowBlur = 13 * TS; c.shadowOffsetY = 7 * TS; c.fillStyle = TAG; c.beginPath(); c.roundRect(sh, sh, w, h, 9); c.fill(); c.restore();
        c.fillStyle = TAG; c.beginPath(); c.roundRect(sh, sh, w, h, 9); c.fill(); c.strokeStyle = 'rgba(12, 16, 32, 0.12)'; c.lineWidth = 1; c.stroke();
        c.textBaseline = 'alphabetic'; c.fillStyle = INK; setFont(c, 800, 25, 'extra-condensed'); c.fillText(g.title, sh + padX, sh + 7 + 20);
        c.fillStyle = INK2; setFont(c, 600, 11.5, 'semi-condensed'); g.sub.forEach((s, k) => c.fillText(s, sh + padX, sh + 7 + 23 + 3 + 10.5 + k * 13.5));
        g.tex.needsUpdate = true;
      }
    }
    // names on the map
    const marks = MARKS.map((m) => {
      const cv = document.createElement('canvas'), tex = keep(canvasTex(cv)), mat = keep(flatMat(tex));
      const mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), mat); mesh.renderOrder = 0.8; mesh.frustumCulled = false; mesh.visible = false; world.add(mesh);
      return { m, cv, tex, mat, mesh, n: G.unit(m.lat, m.lon).applyQuaternion(G.quat), wPx: 10, hPx: 10 };
    });
    function drawMarks() {
      for (const k of marks) {
        const c = k.cv.getContext('2d'), px = k.m.big ? 13 : k.m.lake ? 10 : 11, track = px * (k.m.sea ? 0.34 : k.m.big ? 0.3 : k.m.lake ? 0.16 : 0.22), text = k.m.t.toUpperCase();
        setFont(c, 700, px * TS, 'normal'); const w = Math.ceil(trackedW(c, text, track * TS) / TS) + 8;
        k.wPx = w; k.hPx = px + 8; k.cv.width = w * TS; k.cv.height = k.hPx * TS;
        c.setTransform(TS, 0, 0, TS, 0, 0); c.clearRect(0, 0, w, k.hPx); setFont(c, 700, px, 'normal'); c.textBaseline = 'alphabetic';
        c.fillStyle = k.m.sea ? 'rgba(255, 255, 255, 0.66)' : k.m.lake ? 'rgba(12, 16, 32, 0.58)' : 'rgba(12, 16, 32, 0.44)';
        tracked(c, text, 4, px + 2, track); k.tex.needsUpdate = true;
      }
    }
    const drawType = () => { if (dead) return; drawTags(); drawMarks(); ctx.kick(); };
    drawType();
    if (document.fonts && document.fonts.load) {
      Promise.race([Promise.all([document.fonts.load('800 75px "Archivo"'), document.fonts.load('600 34px "Archivo"'), document.fonts.load('700 33px "Archivo"')]), new Promise((r) => setTimeout(r, 2500))]).then(drawType, drawType);
      if (document.fonts.ready) document.fonts.ready.then(drawType);
    }

    // leader lines from the pins to the cards
    const MAXL = 12, leadGeo = keep(new THREE.BufferGeometry());
    leadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXL * 8 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    leadGeo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(MAXL * 8), 1).setUsage(THREE.DynamicDrawUsage));
    { const uv = new Float32Array(MAXL * 16), idx = [];
      for (let i = 0; i < MAXL; i++) { uv.set([0, 0, 0, 1, 1, 1, 1, 0, 2, 0, 2, 1, 3, 1, 3, 0], i * 16); const b = i * 8; idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b + 4, b + 5, b + 6, b + 4, b + 6, b + 7); }
      leadGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); leadGeo.setIndex(idx); }
    const leadMat = keep(new THREE.ShaderMaterial({ vertexShader: LEAD_VERT, fragmentShader: LEAD_FRAG, uniforms: { uCol: { value: rgb(0x0c1020) } }, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    const leads = new THREE.Mesh(leadGeo, leadMat); leads.renderOrder = 2; leads.frustumCulled = false; world.add(leads);

    const MAXS = 8, shadGeo = keep(new THREE.BufferGeometry());
    shadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXS * 12), 3).setUsage(THREE.DynamicDrawUsage));
    shadGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAXS * 16), 4).setUsage(THREE.DynamicDrawUsage));
    shadGeo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(MAXS * 4), 1).setUsage(THREE.DynamicDrawUsage));
    { const uv = new Float32Array(MAXS * 8), idx = []; for (let i = 0; i < MAXS; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
      shadGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); shadGeo.setIndex(idx); }
    const shads = new THREE.Mesh(shadGeo, keep(new THREE.ShaderMaterial({ vertexShader: SHAD_VERT, fragmentShader: SHAD_FRAG, transparent: true, depthTest: false, depthWrite: false })));
    shads.renderOrder = 2.6; shads.frustumCulled = false; world.add(shads);

    /* ---------------------------------------------------------------- each frame */
    const Y = new THREE.Vector3(0, 1, 0), cdir = new THREE.Vector3(), cv3 = new THREE.Vector3(), t3 = new THREE.Vector3(), up = new THREE.Vector3(), rt = new THREE.Vector3(), fw = new THREE.Vector3(),
      a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3(), d3 = new THREE.Vector3(), e3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), m3 = new THREE.Matrix3(), q4 = new THREE.Quaternion();
    const L0 = new THREE.Vector3(-0.68, 0.6, 0.1).normalize();
    const pinById = Object.fromEntries(pins.map((k) => [k.p.id, k]));
    function update(S, dt, camera) {
      const X = S.x.globe, on = X.on > 0.5;
      root.visible = on; world.visible = on;
      if (!on) return false;
      const view = ctx.view(), tanV = Math.tan(camera.fov * RAD / 2), pxAt = (dist) => 2 * dist * tanV / view.H;       // world units for one CSS px at a distance
      const night = clamp(X.night || 0), haze = clamp(X.haze || 0), small = clamp((view.W - 420) / 500, 0, 1);       // small = 0 on a phone
      root.position.copy(X.pos);
      U.uNight.value = night; U.uHaze.value = haze;
      up.set(0, 1, 0).applyQuaternion(camera.quaternion); rt.set(1, 0, 0).applyQuaternion(camera.quaternion); fw.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const camC = cv3.copy(camera.position).sub(X.pos), dist = camC.length(), height = (dist - R) / R;
      cdir.copy(camC).divideScalar(dist);                                                 // from the centre to the camera, world
      // the sun, in view space: at noon it stands behind the camera, at night it has gone round to the far upper left
      m3.setFromMatrix4(camera.matrixWorldInverse);
      a3.copy(cdir).applyMatrix3(m3).normalize(); t3.copy(L0).addScaledVector(a3, -L0.dot(a3)).normalize();
      const th = night * 2.62;
      U.uSun.value.copy(a3).multiplyScalar(Math.cos(th)).addScaledVector(t3, Math.sin(th)).normalize();

      // the shadow on the paper: a disc behind the silhouette, seen from the camera
      const sil = dist / Math.sqrt(Math.max(dist * dist - R * R, 0.01));
      halo.visible = night < 0.98; haloMat.uniforms.uA.value = 0.3 * (1 - night) * (1 - haze * 0.75);
      m4.lookAt(camera.position, X.pos, up); halo.quaternion.setFromRotationMatrix(m4);
      a3.set(1, 0, 0).applyQuaternion(halo.quaternion); b3.set(0, 1, 0).applyQuaternion(halo.quaternion);
      halo.position.copy(X.pos).addScaledVector(a3, 0.035 * R * sil).addScaledVector(b3, -0.05 * R * sil); halo.scale.setScalar(R * sil * 2 * 1.3);

      const dayA = (1 - smooth(0, 0.3, night)) * (1 - smooth(0.25, 0.9, haze));
      for (const f of vectors) {
        const vis = f.n.dot(cdir) - R / dist > 0.02 && height < f.far && dayA > 0.01, a = vis ? dayA * (1 - smooth(f.far * 0.75, f.far, height)) : 0;
        for (let i = 0; i < f.objs.length; i++) { f.objs[i].visible = a > 0.01; f.mats[i].opacity = f.base[i] * a; }
      }

      // pins: upright on the ground, about the same size on screen at every height
      const focusPins = G.pinOf[X.focus] ? G.pins.filter((p) => p.sites.includes(X.focus)) : [];
      for (const k of pins) {
        const P = k.P.copy(X.pos).addScaledVector(k.p.n, R), facing = k.p.n.dot(cdir) - R / dist, d = P.distanceTo(camera.position), wpp = pxAt(d);
        const lit = focusPins.includes(k.p) ? clamp(X.label) : 0, a = dayA * smooth(0.0, 0.03, facing);
        k.facing = facing; k.wpp = wpp;
        const vis = a > 0.01; k.mesh.visible = vis; k.foot.visible = vis; k.ring.visible = vis && lit > 0.01;
        if (!vis) continue;
        const hgt = (30 + 16 * small) * (1 + 0.2 * lit) * wpp;
        a3.copy(camera.position).sub(P).normalize(); b3.copy(k.p.n).cross(a3).normalize(); c3.copy(b3).cross(k.p.n);
        m4.makeBasis(b3.multiplyScalar(hgt), d3.copy(k.p.n).multiplyScalar(hgt), c3.multiplyScalar(hgt)).setPosition(P);
        k.mesh.matrix.copy(m4); k.mesh.matrixWorldNeedsUpdate = true; k.mat.opacity = a;
        k.head.copy(P).addScaledVector(k.p.n, hgt * 0.6);
        q4.setFromUnitVectors(Y, k.p.n);
        k.foot.position.copy(P).addScaledVector(k.p.n, 0.0006 * R); k.foot.quaternion.copy(q4); k.foot.scale.setScalar(wpp * (0.7 + 0.3 * small)); k.fm.opacity = a;
        k.ring.position.copy(k.foot.position); k.ring.quaternion.copy(q4); k.ring.scale.setScalar(wpp * (0.8 + 0.45 * small)); k.rm.opacity = a * lit * 0.7;
      }

      // the tag of the town in focus: below its pins, in the left column
      for (const g of groups) {
        const lit = g.sites.includes(X.focus) ? clamp(X.label) : 0, a = lit * dayA * smooth(0, 0.03, g.n.dot(cdir) - R / dist);
        g.mesh.visible = a > 0.01; if (!g.mesh.visible) continue;
        // the plate hangs under the pins. Wide window: its right part under them, inside the left column, clear of the big card.
        // Phone: centred under them. It is placed in screen pixels, then put back in the world at the depth of the pins.
        a3.copy(X.pos).addScaledVector(g.n, R); const depth = Math.max(0.01, b3.copy(a3).sub(camera.position).dot(fw)), wpp = pxAt(depth), sc = 0.78 + 0.22 * small;
        c3.copy(a3).project(camera); const cx0 = (c3.x * 0.5 + 0.5) * view.W, cy0 = (-c3.y * 0.5 + 0.5) * view.H;
        let lowY = -1e9, leftX = 1e9, midX = 0;
        for (const p of g.pins) { c3.copy(X.pos).addScaledVector(p.n, R).project(camera); const x = (c3.x * 0.5 + 0.5) * view.W, y = (-c3.y * 0.5 + 0.5) * view.H; lowY = Math.max(lowY, y); leftX = Math.min(leftX, x); midX += x / g.pins.length; }
        const halfW = g.plateW * sc / 2, colR = (view.rect.cx - view.rect.fw / 2) * view.W - 14;
        const cx = view.k > 0.5 ? clamp(leftX + 30 * sc - halfW, 12 + halfW, Math.max(12 + halfW, colR - halfW)) : clamp(midX, 10 + halfW, view.W - 10 - halfW);
        const cy = lowY + (13 + g.plateH / 2) * sc;
        g.mesh.position.copy(a3).addScaledVector(rt, (cx - cx0) * wpp).addScaledVector(up, -(cy - cy0) * wpp);
        g.mesh.quaternion.copy(camera.quaternion); g.mesh.scale.set(g.wPx * sc * wpp, g.hPx * sc * wpp, 1); g.mat.opacity = a;
      }
      for (const k of marks) {
        const facing = k.n.dot(cdir) - R / dist, range = smooth(k.m.near * 0.82, k.m.near, height) * (1 - smooth(k.m.far * 0.8, k.m.far, height)), a = dayA * range * smooth(0.02, 0.1, facing) * (k.m.sea ? 1 : 1);
        k.mesh.visible = a > 0.01; if (!k.mesh.visible) continue;
        a3.copy(X.pos).addScaledVector(k.n, R * 1.0004); const wpp = pxAt(a3.distanceTo(camera.position)), sc = 0.8 + 0.2 * small;
        k.mesh.position.copy(a3); k.mesh.quaternion.copy(camera.quaternion); k.mesh.scale.set(k.wPx * sc * wpp, k.hPx * sc * wpp, 1); k.mat.opacity = a;
      }

      // leader lines: from the head of a pin to the nearest point of its card
      const lp = leadGeo.attributes.position.array, la = leadGeo.attributes.aA.array; let nL = 0;
      const cards = X.cards || [];
      for (const cd of cards) {
        if (nL >= MAXL) break;
        const st = S.planes[cd.i], k = pinById[cd.pin]; if (!st || !k || !st.vis || st.op < 0.02 || !k.mesh.visible) continue;
        const hw = st.w / 2, hh = st.w * 0.3125;
        a3.set(1, 0, 0).applyQuaternion(st.quat); b3.set(0, 1, 0).applyQuaternion(st.quat); c3.set(0, 0, 1).applyQuaternion(st.quat);
        // where the pin shows on the plane of the card (as seen from the camera), then the nearest point of the card to it
        d3.copy(k.head).sub(camera.position); const den = d3.dot(c3); if (Math.abs(den) < 1e-6) continue;
        const tt = e3.copy(st.pos).sub(camera.position).dot(c3) / den; if (tt <= 0) continue;
        d3.multiplyScalar(tt).add(camera.position).sub(st.pos);
        const lx = d3.dot(a3), ly = d3.dot(b3); if (Math.abs(lx) < hw && Math.abs(ly) < hh) continue;           // the pin is behind its card
        const Q = e3.copy(st.pos).addScaledVector(a3, clamp(lx, -hw, hw)).addScaledVector(b3, clamp(ly, -hh, hh));
        const dQ = Q.distanceTo(camera.position), dH = k.head.distanceTo(camera.position), wQ = pxAt(dQ) * 0.8, wH = k.wpp * 0.8;
        d3.copy(k.head).sub(Q); const len = d3.length(); if (len < 1e-5) continue;
        // a card that is still far from its pin on screen (it is flying in) has no line yet
        c3.copy(Q).project(camera); const qx = c3.x, qy = c3.y; if (Math.abs(qx) > 1.0 || Math.abs(qy) > 1.0) continue;      // the card is off the screen
        c3.copy(k.head).project(camera);
        const lenPx = Math.hypot((c3.x - qx) * view.W, (c3.y - qy) * view.H) * 0.5, isBig = cd.i === X.focus ? clamp(X.label) : 0;
        const near = Math.max(isBig, 1 - smooth(0.12, 0.2, lenPx / Math.max(view.W, view.H)));
        const al = dayA * clamp(st.op) * smooth(0.0, 0.03, k.facing) * near;
        if (al < 0.01) continue;
        const pQ = a3.copy(d3).cross(c3.copy(Q).sub(camera.position)).normalize(), pH = b3.copy(d3).cross(c3.copy(k.head).sub(camera.position)).normalize();
        const o = nL * 24;
        lp[o] = Q.x - pQ.x * wQ; lp[o + 1] = Q.y - pQ.y * wQ; lp[o + 2] = Q.z - pQ.z * wQ; lp[o + 3] = Q.x + pQ.x * wQ; lp[o + 4] = Q.y + pQ.y * wQ; lp[o + 5] = Q.z + pQ.z * wQ;
        lp[o + 6] = k.head.x + pH.x * wH; lp[o + 7] = k.head.y + pH.y * wH; lp[o + 8] = k.head.z + pH.z * wH; lp[o + 9] = k.head.x - pH.x * wH; lp[o + 10] = k.head.y - pH.y * wH; lp[o + 11] = k.head.z - pH.z * wH;
        // the dot at the card
        const r = pxAt(dQ) * 3.4;
        lp[o + 12] = Q.x - (rt.x + up.x) * r; lp[o + 13] = Q.y - (rt.y + up.y) * r; lp[o + 14] = Q.z - (rt.z + up.z) * r; lp[o + 15] = Q.x - (rt.x - up.x) * r; lp[o + 16] = Q.y - (rt.y - up.y) * r; lp[o + 17] = Q.z - (rt.z - up.z) * r;
        lp[o + 18] = Q.x + (rt.x + up.x) * r; lp[o + 19] = Q.y + (rt.y + up.y) * r; lp[o + 20] = Q.z + (rt.z + up.z) * r; lp[o + 21] = Q.x + (rt.x - up.x) * r; lp[o + 22] = Q.y + (rt.y - up.y) * r; lp[o + 23] = Q.z + (rt.z - up.z) * r;
        for (let q = 0; q < 8; q++) la[nL * 8 + q] = al;
        nL++;
      }
      // the shadows of the cards on the map
      const sp = shadGeo.attributes.position.array, ss = shadGeo.attributes.aSize.array, sa = shadGeo.attributes.aA.array; let nS = 0;
      for (const cd of cards) {
        if (nS >= MAXS) break;
        const st = S.planes[cd.i]; if (!st || !st.vis || st.op < 0.02 || dayA < 0.01) continue;
        const w = st.w, h = w * 0.625, mg = w * 0.1 + pxAt(st.pos.distanceTo(camera.position)) * 5, qw = w + mg * 2, qh = h + mg * 2;
        a3.set(1, 0, 0).applyQuaternion(st.quat); b3.set(0, 1, 0).applyQuaternion(st.quat);
        c3.copy(st.pos).addScaledVector(b3, -mg * 0.42);
        const o = nS * 12; let q = 0;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { sp[o + q * 3] = c3.x + a3.x * sx * qw / 2 + b3.x * sy * qh / 2; sp[o + q * 3 + 1] = c3.y + a3.y * sx * qw / 2 + b3.y * sy * qh / 2; sp[o + q * 3 + 2] = c3.z + a3.z * sx * qw / 2 + b3.z * sy * qh / 2;
          ss[nS * 16 + q * 4] = qw; ss[nS * 16 + q * 4 + 1] = qh; ss[nS * 16 + q * 4 + 2] = w; ss[nS * 16 + q * 4 + 3] = h; sa[nS * 4 + q] = 0.4 * dayA * clamp(st.op); q++; }
        nS++;
      }
      shads.visible = nS > 0; shadGeo.setDrawRange(0, nS * 6);
      if (nS) { shadGeo.attributes.position.needsUpdate = true; shadGeo.attributes.aSize.needsUpdate = true; shadGeo.attributes.aA.needsUpdate = true; }
      leads.visible = nL > 0; leadGeo.setDrawRange(0, nL * 12);
      if (nL) { leadGeo.attributes.position.needsUpdate = true; leadGeo.attributes.aA.needsUpdate = true; }
      return false;
    }

    function dispose() {
      dead = true;
      scene.remove(root); scene.remove(world);
      for (const o of disposables) o.dispose && o.dispose();
      if (mapTex) mapTex.dispose();
    }
    return { update, resize() {}, dispose };
  };
}
