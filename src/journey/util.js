// Small maths helpers shared by the story, the engine and the sets.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const seg = (t, a, b) => clamp((t - a) / (b - a));            // progress of t inside [a, b]
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const ease5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const es = (t, a, b) => ease(seg(t, a, b));                   // eased sub-interval
export const bump = (t) => Math.sin(Math.PI * clamp(t));             // 0 → 1 → 0
export const wrapPi = (a) => a - TAU * Math.round(a / TAU);

// cubic-bezier easing (same maths as CSS)
export function bezierEase(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return (x) => {
    let t = x;
    for (let i = 0; i < 6; i++) { const f = ((ax * t + bx) * t + cx) * t - x; const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= f / d; }
    t = clamp(t);
    return ((ay * t + by) * t + cy) * t;
  };
}

// deterministic random numbers (the story must replay exactly)
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const AX = Object.freeze(new THREE.Vector3(1, 0, 0)), AY = Object.freeze(new THREE.Vector3(0, 1, 0)), AZ = Object.freeze(new THREE.Vector3(0, 0, 1));
export const Q_ID = Object.freeze(new THREE.Quaternion());
export const Q_FLAT = Object.freeze(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));   // lies on the floor, top edge toward -z

const _n = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Matrix4();

// The viewport: where a site sits at a hold, and the lens rules.
export function makeView(W, H) {
  const aspect = W / H;
  const k = clamp((aspect - 0.75) / (1.25 - 0.75));       // 0 = phone portrait, 1 = desktop
  // very wide windows: the site keeps its height on screen, so it takes a smaller share of the width
  const fwWide = 0.615 * Math.min(1, 1.7 / aspect);
  const rect = { fw: lerp(0.92, fwWide, k), cx: lerp(0.5, 0.97 - fwWide / 2, k), cy: lerp(0.3, 0.43, k) };
  // A lens shift, as on an architecture camera: the optical centre sits at the height of the site rectangle, not at the middle of
  // the window. So at a hold the camera is level with the middle of the site and looks straight at it, on a desk or on a phone.
  return { W, H, aspect, k, portrait: aspect < 0.9, rect, shift: 0.5 - rect.cy };
}
// vertical field of view for this window: wide windows keep the lens of the world, narrow windows open it up
export function fovFor(base, view) {
  const tv = Math.tan(THREE.MathUtils.degToRad(base) / 2);
  const minTanH = tv * 1.6 * 0.5;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(tv, minTanH / view.aspect)));
}
export const tanV = (fov) => Math.tan(THREE.MathUtils.degToRad(fov) / 2);

// Camera that sees a plane (centre, quat, width w) face-on inside the screen rect.
export function frameOn(pos, quat, w, rect, fov, view, cam) {
  _n.set(0, 0, 1).applyQuaternion(quat); _r.set(1, 0, 0).applyQuaternion(quat); _u.set(0, 1, 0).applyQuaternion(quat);
  const visW = w / rect.fw, visH = visW / view.aspect, d = visH / (2 * tanV(fov));
  cam.pos.copy(pos).addScaledVector(_n, d).addScaledVector(_r, -(rect.cx - 0.5) * visW).addScaledVector(_u, (rect.cy - 0.5 + view.shift) * visH);
  cam.quat.copy(quat); cam.fov = fov; cam.d = d;
  return cam;
}
// The inverse: stand a plane in front of a camera so that it fills the rect. dist = how far in front.
export function placeInRect(cam, dist, rect, view, pl) {
  _n.set(0, 0, 1).applyQuaternion(cam.quat); _r.set(1, 0, 0).applyQuaternion(cam.quat); _u.set(0, 1, 0).applyQuaternion(cam.quat);
  const visH = 2 * dist * tanV(cam.fov), visW = visH * view.aspect;
  pl.pos.copy(cam.pos).addScaledVector(_n, -dist).addScaledVector(_r, (rect.cx - 0.5) * visW).addScaledVector(_u, -(rect.cy - 0.5 + view.shift) * visH);
  pl.quat.copy(cam.quat); pl.w = rect.fw * visW;
  return pl;
}
export function lookQuat(from, to, up, out) { _m.lookAt(from, to, up); return out.setFromRotationMatrix(_m); }
export const yawQuat = (yaw, out = new THREE.Quaternion()) => out.setFromAxisAngle(AY, yaw);
export function eulerQuat(pitch, yaw, roll, out) { return out.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')); }
const _e = new THREE.Euler();

export function hexRGB(hex) { const c = new THREE.Color(hex); return c; }
