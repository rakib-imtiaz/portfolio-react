// Type in the 3D world. One system for the whole story: Archivo (extra-condensed heavy capitals for display) and Mona Sans Mono.
// Type is drawn white on black into a canvas, a little soft, and the shader cuts it at the middle grey.
// So the edge stays sharp when the camera is close, and one small texture is enough.
import * as THREE from 'three';

export const DISPLAY = '"Archivo", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
export const TEXT = '"Archivo", "Helvetica Neue", Arial, sans-serif';
export const MONO = '"Mona Sans Mono", ui-monospace, Consolas, monospace';

let ready = null;
export function fontsReady(ms = 2500) {
  if (!ready) ready = Promise.race([
    Promise.all([document.fonts.load('800 64px "Archivo"'), document.fonts.load('500 20px "Archivo"'), document.fonts.load('500 20px "Mona Sans Mono"')]).catch(() => {}),
    new Promise((r) => setTimeout(r, ms)),
  ]);
  return ready;
}
export function setDisplay(g, px, weight = 800, stretch = 'extra-condensed') { g.font = `${weight} ${px}px ${DISPLAY}`; if ('fontStretch' in g) g.fontStretch = stretch; if ('letterSpacing' in g) g.letterSpacing = '0px'; }
export function setText(g, px, weight = 500) { g.font = `${weight} ${px}px ${TEXT}`; if ('fontStretch' in g) g.fontStretch = 'normal'; if ('letterSpacing' in g) g.letterSpacing = '0px'; }
export function setMono(g, px, weight = 500, spacing = 0.08) { g.font = `${weight} ${px}px ${MONO}`; if ('fontStretch' in g) g.fontStretch = 'normal'; if ('letterSpacing' in g) g.letterSpacing = (px * spacing).toFixed(2) + 'px'; }

// canvas (white type on black) -> one-channel texture
export function redTexture(canvas, maxAniso = 4) {
  const w = canvas.width, h = canvas.height, src = canvas.getContext('2d').getImageData(0, 0, w, h).data, out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { const o = (h - 1 - y) * w, i = y * w * 4; for (let x = 0; x < w; x++) out[o + x] = src[i + x * 4]; }
  const t = new THREE.DataTexture(out, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = maxAniso; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}
// two channels: red and green from the canvas (the film title keeps the words in red and the count in green)
export function rgTexture(canvas, maxAniso = 4) {
  const w = canvas.width, h = canvas.height, src = canvas.getContext('2d').getImageData(0, 0, w, h).data, out = new Uint8Array(w * h * 2);
  for (let y = 0; y < h; y++) { const o = (h - 1 - y) * w * 2, i = y * w * 4; for (let x = 0; x < w; x++) { out[o + x * 2] = src[i + x * 4]; out[o + x * 2 + 1] = src[i + x * 4 + 1]; } }
  const t = new THREE.DataTexture(out, w, h, THREE.RGFormat, THREE.UnsignedByteType);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = maxAniso; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

// A shelf packer for lines of type. add(draw, w, h) returns the uv rect [u0, v0, u1, v1] (v up) of the cell.
export function makeAtlas(W = 2048, H = 1024) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
  let x = 2, y = 2, shelf = 0;
  return {
    canvas: cv, g,
    add(w, h, draw) {
      w = Math.ceil(w) + 4; h = Math.ceil(h) + 4;
      if (x + w > W) { x = 2; y += shelf; shelf = 0; }
      if (y + h > H) { console.warn('type atlas is full'); return [0, 0, 0, 0]; }
      g.save(); g.translate(x + 2, y + 2); draw(g); g.restore();
      const r = [(x + 2) / W, 1 - (y + h - 2) / H, (x + w - 2) / W, 1 - (y + 2) / H];
      x += w; shelf = Math.max(shelf, h);
      return r;
    },
  };
}

export const FOG_GLSL = /* glsl */`
uniform vec3 uFogColor; uniform float uFogDensity;
float fogAmount(float d) { return 1.0 - exp(-pow(d * uFogDensity, 2.0)); }`;
