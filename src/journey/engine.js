// 11 Journey: the engine. One renderer, one camera, 48 site planes that live through the whole story.
// The story (story.js) writes a state for a scroll position. The engine draws that state. It keeps no story state.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

export const PW = 1, PH = 0.625;          // the plane geometry: 1 wide, 16:10. A plane's width in metres is its scale.

const PLANE_VS = /* glsl */`
uniform float uCurve; uniform float uBendY;
varying vec2 vUv; varying float vDepth;
void main(){
  vUv = uv; vec3 p = position;
  if (uCurve > 0.00001) { float a = p.x * uCurve; p.x = sin(a) / uCurve; p.z += (1.0 - cos(a)) / uCurve; }
  p.y -= sin(uv.x * 3.14159265) * uBendY * 0.053;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const PLANE_FS = /* glsl */`
uniform sampler2D uMap; uniform sampler2D uMapHi;
uniform float uHi, uLoaded, uOp, uLit, uSat, uBlur, uCorner, uEdge, uGrain, uBorder, uVblur, uClipOn, uFogK;
uniform vec3 uAccent, uBorderCol, uFogColor; uniform float uFogDensity; uniform vec4 uClip;
varying vec2 vUv; varying float vDepth;
const vec2 SIZE = vec2(1.0, 0.625);
float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 tap(vec2 uv, float b) { return texture2D(uMap, clamp(uv, 0.001, 0.999), b).rgb; }
void main(){
  if (uClipOn > 0.5) { vec2 f = gl_FragCoord.xy; if (f.x < uClip.x || f.y < uClip.y || f.x > uClip.z || f.y > uClip.w) discard; }
  vec2 p = (vUv - 0.5) * SIZE;
  float d = rbox(p, SIZE * 0.5, uCorner);
  float aa = max(fwidth(d), 0.00002);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  vec3 c;
  if (uVblur > 0.0005) {
    float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    c = vec3(0.0);
    for (int k = -4; k <= 4; k++) c += tap(vUv + vec2(0.0, (float(k) + j) * uVblur), 0.0);
    c /= 9.0;
  } else if (uBlur > 0.03) {
    vec2 px = exp2(uBlur) * vec2(0.0012, 0.0019);
    c = tap(vUv, uBlur) * 0.32;
    c += tap(vUv + vec2( px.x,  px.y), uBlur) * 0.17;
    c += tap(vUv + vec2(-px.x,  px.y), uBlur) * 0.17;
    c += tap(vUv + vec2( px.x, -px.y), uBlur) * 0.17;
    c += tap(vUv + vec2(-px.x, -px.y), uBlur) * 0.17;
  } else {
    c = texture2D(uMap, vUv).rgb;
    if (uHi > 0.001) c = mix(c, texture2D(uMapHi, vUv).rgb, uHi);
  }
  c = mix(uAccent * (0.5 + 0.3 * vUv.y), c, uLoaded);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat) * uLit;
  c += smoothstep(-0.0055, 0.0, d) * 0.09 * uEdge * min(uLit, 1.0);          // thin light edge so dark sites keep a shape
  if (uBorder > 0.0001) {                                                       // a card or a frame: a band inside the edge
    float di = rbox(p, SIZE * 0.5 - uBorder, max(uCorner - uBorder, 0.0));
    c = mix(c, uBorderCol, smoothstep(-aa, aa, di));
  }
  if (uGrain > 0.001) {                                                         // a grain of dust in the colour of the site
    vec3 g = uAccent * 1.5 + 0.06;
    float r = length(p) / 0.3125;
    float disc = smoothstep(1.0, 0.25, r);
    c = mix(c, g, smoothstep(0.0, 0.6, uGrain)); mask = mix(mask, disc, smoothstep(0.0, 0.3, uGrain));
  }
  float fog = (1.0 - exp(-pow(vDepth * uFogDensity, 2.0))) * uFogK;
  c = mix(c, uFogColor, fog);
  float a = mask * uOp;
  if (a < 0.004) discard;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;

const SKY_VS = /* glsl */`varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = /* glsl */`
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uGlow;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir); float h = abs(d.y);
  float t = pow(smoothstep(0.0, 0.7, h), 0.55);
  vec3 c = mix(uHor, uTop, t);
  c += uGlow * exp(-h * 7.5);
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const FLOOR_VS = /* glsl */`
uniform mat4 uTexMat;
varying vec3 vW; varying vec4 vMir;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vMir = uTexMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FS = /* glsl */`
uniform vec3 uCol, uCol2, uFogColor;
uniform float uFogDensity, uFront, uFrontSoft, uRefl, uFresMin, uFresPow, uSeam, uSeamPitch, uBlur, uSweep, uSweepSoft;
uniform vec3 uSweepCol; uniform vec2 uSweepDir;
uniform sampler2D tMirror;
varying vec3 vW; varying vec4 vMir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;
  float fr = uFrontSoft > 0.0 ? smoothstep(uFront - uFrontSoft, uFront + uFrontSoft, vW.z) : 0.0;      // a second surface that spreads over the floor
  vec3 base = mix(uCol, uCol2, fr);
  if (uSeam > 0.001) {
    vec2 q = vW.xz / uSeamPitch; vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(0.0001));
    float seam = (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(5.0, 28.0, dist)) * uSeam;
    base *= 1.0 - seam * 0.085;
  }
  if (uSweepSoft > 0.0) {                                                                                // light that crosses the floor
    float s = smoothstep(uSweep - uSweepSoft, uSweep + uSweepSoft, dot(vW.xz, uSweepDir));
    base = mix(base, uSweepCol, s);
  }
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  vec3 col = mix(base, uFogColor, fog);
  float refl = uRefl * (1.0 - fr) * mix(uFresMin, 1.0, pow(1.0 - clamp(V.y, 0.0, 1.0), uFresPow));
  if (refl > 0.003) {
    float n = noise(vW.xz * 0.21) * 0.6 + noise(vW.xz * 0.68) * 0.4;
    refl *= 0.86 + 0.14 * n;
    vec2 uv = vMir.xy / vMir.w;
    // a soft mirror: the picture is smeared mostly up and down, as on a polished floor
    float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 r = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < 12; i++) {
      float t = (float(i) + j) / 12.0 * 2.0 - 1.0;
      float wgt = exp(-t * t * 2.2);
      r += textureLod(tMirror, uv + vec2(sin(float(i) * 2.4 + j * 6.28) * 0.004, t * 0.02) * uBlur, 0.7 + 0.7 * uBlur).rgb * wgt; wsum += wgt;
    }
    r /= wsum;
    col = mix(col, r, refl * (1.0 - fog));
  }
  col += (hash(gl_FragCoord.xy + 3.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const INST_VS = /* glsl */`
attribute vec4 aCol;
varying vec2 vUv; varying vec4 vCol; varying float vDepth; varying vec3 vN;
void main(){
  vUv = uv; vCol = aCol; vN = normal;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vDepth = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const HALO_FS = /* glsl */`
uniform float uFogDensity;
varying vec2 vUv; varying vec4 vCol; varying float vDepth;
void main(){
  vec2 quad = vec2(29.0, 23.0), size = vec2(16.0, 10.0);
  vec2 p = (vUv - 0.5) * quad;
  float d = length(max(abs(p) - size * 0.5, 0.0));
  float edge = (quad.x - size.x) * 0.5;
  float a = exp(-d * 0.62) * (1.0 - smoothstep(edge * 0.3, edge, d));
  float f = exp(-pow(vDepth * uFogDensity, 2.0));
  gl_FragColor = vec4(vCol.rgb * a * vCol.a * f, 1.0);
  #include <colorspace_fragment>
}`;
const BODY_FS = /* glsl */`
uniform vec3 uFogColor; uniform float uFogDensity; uniform float uBodyLit;
varying vec4 vCol; varying float vDepth; varying vec3 vN;
void main(){
  float s = vN.x > 0.5 ? 0.17 : vN.x < -0.5 ? 0.045 : vN.y > 0.5 ? 0.23 : vN.y < -0.5 ? 0.02 : 0.07;
  vec3 c = vec3(s) * mix(0.25, 1.0, uBodyLit);
  float fog = 1.0 - exp(-pow(vDepth * uFogDensity, 2.0));
  gl_FragColor = vec4(mix(c, uFogColor, fog), 1.0);
  #include <colorspace_fragment>
}`;
const SHADOW_VS = /* glsl */`
attribute float aA;
varying vec2 vUv; varying float vA; varying float vDepth;
void main(){ vUv = uv; vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
const SHADOW_FS = /* glsl */`
uniform float uFogDensity;
varying vec2 vUv; varying float vA; varying float vDepth;
void main(){
  float e = mix(0.012, 0.11, vUv.y);
  float a = smoothstep(0.0, e, vUv.x) * smoothstep(0.0, e, 1.0 - vUv.x) * smoothstep(0.0, e * 1.6, 1.0 - vUv.y);
  a *= mix(1.0, 0.45, vUv.y) * vA * exp(-pow(vDepth * uFogDensity, 2.0));
  gl_FragColor = vec4(0.03, 0.028, 0.024, a);
  #include <colorspace_fragment>
}`;

export function makePlaneState(i) {
  return { i, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), w: 2.6, op: 1, lit: 1, sat: 1, blur: 0, corner: 0.015, curve: 0, bendY: 0, vblur: 0,
    hi: 0, border: 0, borderCol: 0xffffff, body: 0, bez: 0, grain: 0, clip: 0, halo: 0, shadow: 0, edge: 1, fogK: 1, order: 0, vis: true, pick: true };
}
export function resetPlane(p) {
  p.pos.set(0, -999, 0); p.quat.identity(); p.w = 2.6; p.op = 1; p.lit = 1; p.sat = 1; p.blur = 0; p.corner = 0.015; p.curve = 0; p.bendY = 0; p.vblur = 0;
  p.hi = 0; p.border = 0; p.borderCol = 0xffffff; p.body = 0; p.bez = 0; p.grain = 0; p.clip = 0; p.halo = 0; p.shadow = 0; p.edge = 1; p.fogK = 1; p.order = 0; p.vis = true; p.pick = true;
}
export function copyPlane(a, b) {          // a <- b
  a.pos.copy(b.pos); a.quat.copy(b.quat);
  for (const k of ['w', 'op', 'lit', 'sat', 'blur', 'corner', 'curve', 'bendY', 'vblur', 'hi', 'border', 'borderCol', 'body', 'bez', 'grain', 'clip', 'halo', 'shadow', 'edge', 'fogK', 'order', 'vis', 'pick']) a[k] = b[k];
}
export function makeEnv() {
  return { skyTop: new THREE.Color(0x04060a), skyHor: new THREE.Color(0x0a0e14), glow: new THREE.Color(0x000000), fogCol: new THREE.Color(0x0c1016), fogDen: 0.03,
    floor: { on: 1, col: new THREE.Color(0x030406), col2: new THREE.Color(0xefece4), front: 0, frontSoft: 0, refl: 0, fresMin: 0.16, fresPow: 1.7, seam: 0, seamPitch: 2.275, blur: 1,
      sweep: 0, sweepSoft: 0, sweepCol: new THREE.Color(0x000000), sweepDir: new THREE.Vector2(1, 0) },
    sun: new THREE.Vector3(0.96, 0, -0.72), shadowA: 0, bodyLit: 0, clip: [0, 0, 1, 1] };
}
export function mixEnv(out, a, b, t) {
  out.skyTop.copy(a.skyTop).lerp(b.skyTop, t); out.skyHor.copy(a.skyHor).lerp(b.skyHor, t); out.glow.copy(a.glow).lerp(b.glow, t);
  out.fogCol.copy(a.fogCol).lerp(b.fogCol, t); out.fogDen = lerp(a.fogDen, b.fogDen, t);
  const f = out.floor, fa = a.floor, fb = b.floor;
  f.on = lerp(fa.on, fb.on, t) > 0.01 ? 1 : 0; f.col.copy(fa.col).lerp(fb.col, t); f.col2.copy(fb.col2);
  for (const k of ['refl', 'fresMin', 'fresPow', 'seam', 'seamPitch', 'blur']) f[k] = lerp(fa[k], fb[k], t);
  f.front = 0; f.frontSoft = 0; f.sweep = 0; f.sweepSoft = 0;
  out.sun.copy(a.sun).lerp(b.sun, t); out.shadowA = lerp(a.shadowA, b.shadowA, t); out.bodyLit = lerp(a.bodyLit, b.bodyLit, t);
  for (let i = 0; i < 4; i++) out.clip[i] = lerp(a.clip[i], b.clip[i], t);
  return out;
}
export function makeState(n) {
  const planes = []; for (let i = 0; i < n; i++) planes.push(makePlaneState(i));
  return { p: 0, cam: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 42, near: 0.05, far: 1600, par: 0.05 }, planes, env: makeEnv(), x: {}, ui: {} };
}
export function mixCam(out, a, b, t) { out.pos.lerpVectors(a.pos, b.pos, t); out.quat.slerpQuaternions(a.quat, b.quat, t); out.fov = lerp(a.fov, b.fov, t); out.par = lerp(a.par, b.par, t); return out; }

export function createEngine({ canvas, sites, root = '../', setFactories = {}, onKick = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  if (!gl || !renderer.capabilities.isWebGL2) throw new Error('no webgl2');
  let dprCap = 1.5, dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x04060a, 1);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const N = sites.length;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1.6, 0.05, 1600);

  // The lights of the one lit model (the drone in the hall). They stay in the scene for the whole story and are at 0 until
  // the hall uses them. three keys every shader on the number of visible lights, so lights that came in with the hall made
  // every shader on screen compile again (a 0.5 s stall). Only the drone's materials read lights, so nothing else changes.
  const lights = { hemi: new THREE.HemisphereLight(0xffffff, 0x8f8d88, 0), key: new THREE.DirectionalLight(0xfff4e2, 0) };
  scene.add(lights.hemi, lights.key, lights.key.target);
  let VW = 2, VH = 2;

  // uniforms shared by everything in the world
  const G = {
    uFogColor: { value: new THREE.Color(0x0c1016) }, uFogDensity: { value: 0.03 }, uClip: { value: new THREE.Vector4(0, 0, 1e5, 1e5) },
  };

  // ------------------------------------------------------------ sky and floor
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() } },
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false }));
  sky.renderOrder = -100; sky.frustumCulled = false; scene.add(sky);

  const mirrorRT = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true });
  mirrorRT.texture.generateMipmaps = true; mirrorRT.texture.minFilter = THREE.LinearMipmapLinearFilter; mirrorRT.texture.colorSpace = THREE.NoColorSpace;
  const texMat = new THREE.Matrix4();
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color() }, uCol2: { value: new THREE.Color() }, uFogColor: G.uFogColor, uFogDensity: G.uFogDensity, uFront: { value: 0 }, uFrontSoft: { value: 0 },
      uRefl: { value: 0 }, uFresMin: { value: 0.16 }, uFresPow: { value: 1.7 }, uSeam: { value: 0 }, uSeamPitch: { value: 2.275 }, uBlur: { value: 1 },
      uSweep: { value: 0 }, uSweepSoft: { value: 0 }, uSweepCol: { value: new THREE.Color() }, uSweepDir: { value: new THREE.Vector2(1, 0) },
      tMirror: { value: mirrorRT.texture }, uTexMat: { value: texMat } },
    vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = -50; floor.frustumCulled = false; scene.add(floor);

  // the mirror pass (same maths as three's Reflector, for the plane y = 0)
  const vcam = new THREE.PerspectiveCamera();
  const mirror = { on: false, force: false, hide: [], y: 0, texture: mirrorRT.texture, texMat };
  const _n = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _t = new THREE.Vector3(), _l = new THREE.Vector3(), _rot = new THREE.Matrix4(), _pl = new THREE.Plane(), _cp = new THREE.Vector4(), _q4 = new THREE.Vector4(), _o = new THREE.Vector3();
  function renderMirror() {
    _o.set(0, mirror.y, 0);
    _v.subVectors(_o, camera.position);
    if (_v.dot(_n) > 0) return false;
    _v.reflect(_n).negate().add(_o);
    _rot.extractRotation(camera.matrixWorld);
    _l.set(0, 0, -1).applyMatrix4(_rot).add(camera.position);
    _t.subVectors(_o, _l).reflect(_n).negate().add(_o);
    vcam.position.copy(_v); vcam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n); vcam.lookAt(_t);
    vcam.far = camera.far; vcam.near = camera.near; vcam.updateMatrixWorld();
    vcam.projectionMatrix.copy(camera.projectionMatrix);
    texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
    _pl.setFromNormalAndCoplanarPoint(_n, _o).applyMatrix4(vcam.matrixWorldInverse);
    _cp.set(_pl.normal.x, _pl.normal.y, _pl.normal.z, _pl.constant);
    const pm = vcam.projectionMatrix.elements;
    _q4.x = (Math.sign(_cp.x) + pm[8]) / pm[0]; _q4.y = (Math.sign(_cp.y) + pm[9]) / pm[5]; _q4.z = -1; _q4.w = (1 + pm[10]) / pm[14];
    _cp.multiplyScalar(2 / _cp.dot(_q4));
    pm[2] = _cp.x; pm[6] = _cp.y; pm[10] = _cp.z + 1 - 0.003; pm[14] = _cp.w;
    const hidden = [floor, ...mirror.hide].filter((o) => o.visible);
    for (const o of hidden) o.visible = false;
    const clipWas = [];
    for (const pl of planes) { clipWas.push(pl.u.uClipOn.value); pl.u.uClipOn.value = 0; }
    renderer.setRenderTarget(mirrorRT); renderer.clear(); renderer.render(scene, vcam); renderer.setRenderTarget(null);
    planes.forEach((pl, i) => { pl.u.uClipOn.value = clipWas[i]; });
    for (const o of hidden) o.visible = true;
    return true;
  }

  // ------------------------------------------------------------ the 48 planes
  const blank = new THREE.DataTexture(new Uint8Array([20, 22, 26, 255]), 1, 1); blank.needsUpdate = true; blank.colorSpace = THREE.SRGBColorSpace;
  const planeGeo = new THREE.PlaneGeometry(PW, PH, 24, 1);
  const planes = sites.map((site, i) => {
    const accent = new THREE.Color(site.accent || '#555555');
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: blank }, uMapHi: { value: blank }, uHi: { value: 0 }, uLoaded: { value: 0 }, uOp: { value: 1 }, uLit: { value: 1 }, uSat: { value: 1 }, uBlur: { value: 0 },
        uCorner: { value: 0.006 }, uEdge: { value: 1 }, uGrain: { value: 0 }, uBorder: { value: 0 }, uVblur: { value: 0 }, uClipOn: { value: 0 }, uFogK: { value: 1 },
        uAccent: { value: accent }, uBorderCol: { value: new THREE.Color(0xffffff) }, uFogColor: G.uFogColor, uFogDensity: G.uFogDensity, uClip: G.uClip,
        uCurve: { value: 0 }, uBendY: { value: 0 } },
      vertexShader: PLANE_VS, fragmentShader: PLANE_FS, transparent: true, depthWrite: true, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(planeGeo, mat); mesh.userData.i = i; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    const hsl = {}; const glow = accent.clone(); glow.getHSL(hsl, THREE.SRGBColorSpace);
    glow.setHSL(hsl.h, clamp(hsl.s * 1.2 + 0.06, 0, 0.8), clamp(hsl.l * 0.8 + 0.2, 0.32, 0.56), THREE.SRGBColorSpace);
    return { i, site, mesh, mat, u: mat.uniforms, accent, glow, thumb: null, hero: null, heroLoading: false, heroAt: 0, hi: 0, loaded: 0, wantHi: 0, vis: false, pick: false, clip: 0 };
  });
  const meshes = planes.map((p) => p.mesh);

  // bodies (the thickness of a standing screen), halos and shadows: one draw call each
  const inst = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4)); geo.attributes.aCol.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
  const uBodyLit = { value: 0 };
  const bodies = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.ShaderMaterial({ uniforms: { uFogColor: G.uFogColor, uFogDensity: G.uFogDensity, uBodyLit }, vertexShader: INST_VS, fragmentShader: BODY_FS }));
  const halos = inst(new THREE.PlaneGeometry(29 / 16, 23 / 16), new THREE.ShaderMaterial({ uniforms: { uFogDensity: G.uFogDensity }, vertexShader: INST_VS, fragmentShader: HALO_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  halos.renderOrder = -5;
  const shGeo = new THREE.BufferGeometry();
  shGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 12), 3).setUsage(THREE.DynamicDrawUsage));
  shGeo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(N * 4), 1).setUsage(THREE.DynamicDrawUsage));
  { const uv = new Float32Array(N * 8), idx = []; for (let i = 0; i < N; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
    shGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); shGeo.setIndex(idx); }
  const shadows = new THREE.Mesh(shGeo, new THREE.ShaderMaterial({ uniforms: { uFogDensity: G.uFogDensity }, vertexShader: SHADOW_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  shadows.frustumCulled = false; shadows.renderOrder = -20; scene.add(shadows);

  // ------------------------------------------------------------ textures: thumbs for all, the large capture only near a hold
  let dirty = true;
  const kick = () => { dirty = true; onKick(); };
  async function bitmap(url) { const r = await fetch(url); if (!r.ok) throw new Error(url); return createImageBitmap(await r.blob(), { imageOrientation: 'flipY' }); }
  function texFrom(bmp) {
    const t = new THREE.Texture(bmp); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = maxAniso; t.needsUpdate = true; return t;
  }
  async function loadTexture(url) { const t = texFrom(await bitmap(url)); renderer.initTexture(t); return t; }
  let thumbsLeft = N; const thumbWaiters = [];
  async function loadThumbs(order) {
    const queue = [...new Set([...order, ...planes.map((p) => p.i)])]; let k = 0;
    const worker = async () => { while (k < queue.length) { const pl = planes[queue[k++]];
      try { pl.thumb = await loadTexture(root + pl.site.media.thumb); pl.u.uMap.value = pl.thumb; } catch (e) { /* the site colour stays */ }
      thumbsLeft--; kick(); } };
    await Promise.all(Array.from({ length: 4 }, worker));
    thumbWaiters.splice(0).forEach((f) => f());
  }
  const heroKeep = 4; const heroPins = new Set();
  function wantHero(i) {
    const pl = planes[i]; pl.heroAt = performance.now();
    if (pl.hero || pl.heroLoading) return;
    pl.heroLoading = true;
    loadTexture(root + pl.site.media.hero).then((t) => {
      pl.hero = t; pl.heroLoading = false; pl.u.uMapHi.value = t; kick();
      const have = planes.filter((q) => q.hero).sort((a, b) => a.heroAt - b.heroAt);
      while (have.length > heroKeep) { const old = have.shift(); if (old === pl || heroPins.has(old.i)) continue; dropHero(old); }
      heroWaiters.splice(0).forEach((f) => f());
    }).catch(() => { pl.heroLoading = false; });
  }
  const heroWaiters = [];
  function dropHero(pl) { if (!pl.hero) return; pl.hero.dispose(); pl.hero = null; pl.hi = 0; pl.u.uHi.value = 0; pl.u.uMapHi.value = blank; }

  // ------------------------------------------------------------ sets: the look of each world, built one world ahead
  const sets = {};      // name -> { obj, state: 'building'|'ready' }
  const ctx = { THREE, scene, renderer, camera, G, sites, planes, root, maxAniso, loadTexture, kick, wantHero, heroPins, mirror, lights, view: () => ctxView, blank };
  let ctxView = null;
  function needSets(names) {
    let made = false;
    for (const name of names) {
      if (sets[name] || !setFactories[name]) continue;
      const rec = sets[name] = { obj: null };
      try { rec.obj = setFactories[name](ctx); made = true; } catch (e) { console.error('set ' + name, e); }
    }
    for (const name of Object.keys(sets)) if (!names.includes(name)) { try { sets[name].obj && sets[name].obj.dispose && sets[name].obj.dispose(); } catch (e) { console.error(e); } delete sets[name]; }
    if (made) scheduleWarm();
  }

  // ------------------------------------------------------------ warm-up, so that the first frame of a world does not stall
  // A set is built one world ahead. Its shaders are compiled then (in parallel where the driver has KHR_parallel_shader_compile),
  // for the screen and for the mirror pass, and its textures go to the GPU one per tick after the image is decoded.
  // Sets finish some parts later (fetches, the drone), so the warm-up runs a few times after a set is made.
  const upQ = [], queued = new WeakSet(), gone = new WeakSet();
  let upTimer = 0, dead = false;
  const warmTimers = new Set();
  function compileAll() {
    if (!renderer.compileAsync) return;
    const prev = renderer.getRenderTarget(), pm = planes[0] && planes[0].mat;
    try {
      renderer.compileAsync(scene, camera).catch(() => {});
      renderer.setRenderTarget(mirrorRT); renderer.compileAsync(scene, camera).catch(() => {}); renderer.setRenderTarget(prev);
      // the site planes also draw double-sided when they bend (the same program for all 48)
      if (pm) { const side = pm.side; pm.side = side === THREE.DoubleSide ? THREE.FrontSide : THREE.DoubleSide; renderer.compileAsync(planes[0].mesh, camera, scene).catch(() => {}); pm.side = side; }
    } catch (e) { /* a help only: anything missed compiles on its first draw */ }
    renderer.setRenderTarget(prev);
  }
  const MAPS = ['map', 'lightMap', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'];
  function queueTextures() {
    const found = new Set();
    scene.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of MAPS) if (m[k] && m[k].isTexture) found.add(m[k]);
        if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) found.add(v); }
      }
    });
    for (const t of found) {
      if (queued.has(t) || t.isRenderTargetTexture || !t.image || t.version === 0) continue;
      queued.add(t); t.addEventListener('dispose', () => gone.add(t)); upQ.push(t);
    }
    pump();
  }
  function pump() {
    if (upTimer || !upQ.length || dead) return;
    upTimer = setTimeout(async () => {
      const t = upQ.shift();
      try {
        const img = t.image;
        if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && img.decode) await img.decode().catch(() => {});
        if (!gone.has(t) && !dead) renderer.initTexture(t);     // a no-op when it is already on the GPU
      } catch (e) { /* it goes up on its first draw instead */ }
      upTimer = 0; pump();
    }, 24);
  }
  function scheduleWarm() {
    for (const ms of [40, 600, 1500, 3000, 6000]) {
      const id = setTimeout(() => { warmTimers.delete(id); if (!dead) { compileAll(); queueTextures(); } }, ms);
      warmTimers.add(id);
    }
  }
  scheduleWarm();

  // ------------------------------------------------------------ apply a state and draw
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _nn = new THREE.Vector3(), _rr = new THREE.Vector3(), _uu = new THREE.Vector3(), _c = new THREE.Color();
  const par = new THREE.Vector2(), parT = new THREE.Vector2();
  let lastT = 0, frameCount = 0;
  function resize(view) {
    ctxView = view; VW = view.W; VH = view.H;
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false);
    camera.aspect = VW / VH; camera.setViewOffset(VW, VH, 0, view.shift * VH, VW, VH);
    mirrorRT.setSize(Math.max(4, Math.round(VW * dpr * 0.5)), Math.max(4, Math.round(VH * dpr * 0.5)));
    for (const k of Object.keys(sets)) sets[k].obj && sets[k].obj.resize && sets[k].obj.resize(view);
    kick();
  }
  function render(S, now = performance.now()) {
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016); lastT = now;
    let busy = false;
    // pointer parallax: a small slide, never a tilt
    if (Math.abs(parT.x - par.x) + Math.abs(parT.y - par.y) > 0.0006) { const k = 1 - Math.exp(-dt * 5); par.x = lerp(par.x, parT.x, k); par.y = lerp(par.y, parT.y, k); busy = true; }
    const cam = S.cam;
    camera.fov = cam.fov; camera.near = cam.near; camera.far = cam.far; camera.updateProjectionMatrix();
    camera.quaternion.copy(cam.quat);
    _rr.set(1, 0, 0).applyQuaternion(cam.quat); _uu.set(0, 1, 0).applyQuaternion(cam.quat);
    camera.position.copy(cam.pos).addScaledVector(_rr, par.x * cam.par).addScaledVector(_uu, -par.y * cam.par * 0.6);
    camera.updateMatrixWorld(true);

    const env = S.env;
    G.uFogColor.value.copy(env.fogCol); G.uFogDensity.value = env.fogDen;
    const cl = env.clip, pr = renderer.getPixelRatio();
    G.uClip.value.set(cl[0] * VW * pr, (1 - cl[3]) * VH * pr, cl[2] * VW * pr, (1 - cl[1]) * VH * pr);
    sky.position.copy(camera.position);
    sky.material.uniforms.uTop.value.copy(env.skyTop); sky.material.uniforms.uHor.value.copy(env.skyHor); sky.material.uniforms.uGlow.value.copy(env.glow);
    const f = env.floor, fu = floorMat.uniforms;
    floor.visible = f.on > 0.5; floor.position.set(camera.position.x, 0, camera.position.z);
    fu.uCol.value.copy(f.col); fu.uCol2.value.copy(f.col2); fu.uFront.value = f.front; fu.uFrontSoft.value = f.frontSoft; fu.uRefl.value = f.refl; fu.uFresMin.value = f.fresMin; fu.uFresPow.value = f.fresPow;
    fu.uSeam.value = f.seam; fu.uSeamPitch.value = f.seamPitch; fu.uBlur.value = f.blur; fu.uSweep.value = f.sweep; fu.uSweepSoft.value = f.sweepSoft; fu.uSweepCol.value.copy(f.sweepCol); fu.uSweepDir.value.copy(f.sweepDir);
    uBodyLit.value = env.bodyLit;

    const bm = bodies.instanceMatrix.array, hm = halos.instanceMatrix.array, bc = bodies.geometry.attributes.aCol.array, hc = halos.geometry.attributes.aCol.array;
    const sp = shGeo.attributes.position.array, sa = shGeo.attributes.aA.array;
    let anyBody = false, anyHalo = false, anyShadow = false;
    for (let i = 0; i < N; i++) {
      const st = S.planes[i], pl = planes[i], u = pl.u, m = pl.mesh;
      const show = st.vis && st.op > 0.003 && st.w > 0.0005;
      pl.vis = show; pl.pick = show && (st.pick === 2 || (!!st.pick && st.op > 0.5 && st.grain < 0.5)); pl.clip = st.clip;
      m.visible = show;
      // texture state
      if (pl.thumb && pl.loaded < 1) { pl.loaded = Math.min(1, pl.loaded + dt * 3.2); busy = true; }
      u.uLoaded.value = pl.loaded;
      const hiT = st.hi > 0.5 && pl.hero ? 1 : 0;
      if (st.hi > 0.5) { pl.heroAt = now; if (!pl.hero) wantHero(i); }
      if (Math.abs(pl.hi - hiT) > 0.002) { pl.hi = lerp(pl.hi, hiT, 1 - Math.exp(-dt * 9)); busy = true; } else pl.hi = hiT;
      u.uHi.value = pl.hi;
      _m.identity();
      if (show) {
        m.position.copy(st.pos); m.quaternion.copy(st.quat); m.scale.setScalar(st.w); m.renderOrder = st.order;
        u.uOp.value = st.op; u.uLit.value = st.lit; u.uSat.value = st.sat; u.uBlur.value = st.blur; u.uCorner.value = st.corner / st.w; u.uCurve.value = st.curve * st.w;
        u.uBendY.value = st.bendY; u.uVblur.value = st.vblur; u.uBorder.value = st.border / st.w; u.uBorderCol.value.set(st.borderCol); u.uGrain.value = st.grain;
        u.uClipOn.value = st.clip; u.uEdge.value = st.edge; u.uFogK.value = st.fogK;
        m.material.side = st.curve > 0 ? THREE.DoubleSide : THREE.FrontSide;
      }
      // body
      if (show && st.body > 0.01 && st.grain < 0.4) {
        anyBody = true; const th = 0.081 * st.body;
        _nn.set(0, 0, 1).applyQuaternion(st.quat);
        _p.copy(st.pos).addScaledVector(_nn, -th / 2 - 0.003); _s.set(st.w + 2 * st.bez, st.w * PH + 2 * st.bez, th);
        _m.compose(_p, st.quat, _s);
      } else _m.makeScale(0, 0, 0);
      _m.toArray(bm, i * 16);
      // halo
      if (show && st.halo > 0.004) {
        anyHalo = true;
        _nn.set(0, 0, 1).applyQuaternion(st.quat);
        _p.copy(st.pos).addScaledVector(_nn, -0.0375 * st.w - 0.01); _s.setScalar(st.w); _m.compose(_p, st.quat, _s);
        hc[i * 4] = pl.glow.r; hc[i * 4 + 1] = pl.glow.g; hc[i * 4 + 2] = pl.glow.b; hc[i * 4 + 3] = st.halo * st.op * pl.loaded;
      } else { _m.makeScale(0, 0, 0); hc[i * 4 + 3] = 0; }
      _m.toArray(hm, i * 16);
      // shadow: the bottom edge, thrown along the sun
      const k4 = i * 12;
      if (show && st.shadow > 0.004 && env.shadowA > 0.004) {
        anyShadow = true;
        _rr.set(1, 0, 0).applyQuaternion(st.quat); _uu.set(0, 1, 0).applyQuaternion(st.quat);
        const hw = st.w / 2 + st.bez, hh = st.w * PH / 2 + st.bez;
        const ax = st.pos.x - _rr.x * hw - _uu.x * hh, az = st.pos.z - _rr.z * hw - _uu.z * hh, bx = st.pos.x + _rr.x * hw - _uu.x * hh, bz = st.pos.z + _rr.z * hw - _uu.z * hh;
        const top = st.pos.y + Math.abs(_uu.y) * hh, lx = env.sun.x * top, lz = env.sun.z * top;
        sp[k4] = ax; sp[k4 + 1] = 0.006; sp[k4 + 2] = az; sp[k4 + 3] = bx; sp[k4 + 4] = 0.006; sp[k4 + 5] = bz;
        sp[k4 + 6] = bx + lx; sp[k4 + 7] = 0.006; sp[k4 + 8] = bz + lz; sp[k4 + 9] = ax + lx; sp[k4 + 10] = 0.006; sp[k4 + 11] = az + lz;
        const a = st.shadow * env.shadowA * st.op; sa[i * 4] = sa[i * 4 + 1] = sa[i * 4 + 2] = sa[i * 4 + 3] = a;
      } else { for (let q = 0; q < 12; q++) sp[k4 + q] = 0; sa[i * 4] = sa[i * 4 + 1] = sa[i * 4 + 2] = sa[i * 4 + 3] = 0; }
    }
    bodies.visible = anyBody; halos.visible = anyHalo; shadows.visible = anyShadow;
    if (anyBody) bodies.instanceMatrix.needsUpdate = true;
    if (anyHalo) { halos.instanceMatrix.needsUpdate = true; halos.geometry.attributes.aCol.needsUpdate = true; }
    shGeo.attributes.position.needsUpdate = true; shGeo.attributes.aA.needsUpdate = true;

    for (const k of Object.keys(sets)) { const o = sets[k].obj; if (o && o.update) { if (o.update(S, dt, camera) === true) busy = true; } }

    mirror.on = floor.visible && f.refl > 0.004 || mirror.force;
    if (mirror.on) renderMirror();
    renderer.render(scene, camera);
    frameCount++;
    const wasDirty = dirty; dirty = false;
    return busy || wasDirty;
  }

  const ray = new THREE.Raycaster(), _v2 = new THREE.Vector2();
  function pick(x, y) {
    _v2.set((x / VW) * 2 - 1, -(y / VH) * 2 + 1); ray.setFromCamera(_v2, camera);
    const c = G.uClip.value, pr = renderer.getPixelRatio(), fx = x * pr, fy = (VH - y) * pr;
    const list = meshes.filter((m) => { const pl = planes[m.userData.i]; return pl.pick && !(pl.clip > 0.5 && (fx < c.x || fx > c.z || fy < c.y || fy > c.w)); });
    const hit = ray.intersectObjects(list, false)[0];
    return hit ? hit.object.userData.i : -1;
  }
  function project(v, out = {}) { _p.copy(v).project(camera); out.x = (_p.x * 0.5 + 0.5) * VW; out.y = (-_p.y * 0.5 + 0.5) * VH; out.behind = _p.z > 1; return out; }

  return {
    renderer, scene, camera, planes, G, ctx, sets, mirror,
    resize, render, pick, project, kick, loadThumbs, wantHero, needSets,
    setPointer(nx, ny) { parT.set(nx, ny); kick(); },
    destroy() { dead = true; for (const id of warmTimers) clearTimeout(id); warmTimers.clear(); clearTimeout(upTimer); renderer.dispose(); },
    // a slow GPU: draw fewer pixels (never below ratio 1)
    lowerPixelRatio() { if (dpr <= 1) return false; dprCap = Math.max(1, dpr - 0.25); if (ctxView) resize(ctxView); return true; },
    get pixelRatio() { return dpr; },
    get dirty() { return dirty; }, get frames() { return frameCount; }, get thumbsLeft() { return thumbsLeft; },
    whenThumbs() { return thumbsLeft <= 0 ? Promise.resolve() : new Promise((r) => thumbWaiters.push(r)); },
    whenHeroes() { return planes.some((p) => p.heroLoading) ? new Promise((r) => heroWaiters.push(r)) : Promise.resolve(); },
    info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tex: renderer.info.memory.textures, geo: renderer.info.memory.geometries, heroes: planes.filter((p) => p.hero).length }; },
  };
}
