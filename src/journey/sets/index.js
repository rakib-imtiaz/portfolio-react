// The look of the Index world (from 02-index): a paper page seen from straight above. 48 project names in poster capitals,
// small numbers, the three category heads, a thin line from the name in focus to the frame, and a soft shadow under the frame.
// The names lie on the floor of the world, so the camera of the story can lift off the page and leave it behind.
import * as THREE from 'three';
import { fontsReady, setDisplay, setMono, makeAtlas, redTexture, FOG_GLSL } from '../type.js';

const VS = /* glsl */`
attribute float aRow; attribute float aU; attribute float aKind;
varying vec2 vUv; varying float vRow; varying float vU; varying float vKind; varying float vDepth;
void main(){ vUv = uv; vRow = aRow; vU = aU; vKind = aKind; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS = /* glsl */`
uniform sampler2D map; uniform vec3 uInk, uPale, uAcc; uniform float uF, uIn, uOut, uRows;
${FOG_GLSL}
varying vec2 vUv; varying float vRow; varying float vU; varying float vKind; varying float vDepth;
void main(){
  float a = texture2D(map, vUv).r, alpha; vec3 col;
  float wF = 1.0 - smoothstep(0.3, 0.62, abs(vRow - uF));                 // 1 on the row in focus
  if (vKind < 0.5) {                                                       // a name: cut sharp, and inked from the left when in focus
    float w = max(fwidth(a) * 0.75, 0.001); alpha = smoothstep(0.5 - w, 0.5 + w, a);
    col = mix(uPale, uInk, smoothstep(vU - 0.1, vU + 0.03, wF * 1.16));
  } else if (vKind < 1.5) { alpha = a; col = mix(uPale * 0.86, uAcc, wF); }      // a number
  else if (vKind < 2.5) { alpha = a; col = uInk; }                         // a category head
  else { alpha = 1.0; col = uInk; }                                        // a rule
  float rv = clamp((uIn * 1.75 - (max(vRow, 0.0) / uRows) * 0.55 - vU * 0.2) / 0.18, 0.0, 1.0);
  alpha *= rv * (1.0 - uOut) * (1.0 - fogAmount(vDepth));
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;
const SHADOW_FS = /* glsl */`
uniform vec2 uSize; uniform vec2 uInner; uniform float uA;
varying vec2 vUv;
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
void main(){
  vec2 p = (vUv - 0.5) * uSize + vec2(0.0, 0.035);
  float d = sdBox(p, uInner * 0.5);
  float tight = 1.0 - smoothstep(0.0, 0.05, d), wide = 1.0 - smoothstep(-0.05, 0.36, d);
  gl_FragColor = vec4(vec3(0.07, 0.065, 0.05), (tight * 0.16 + wide * wide * 0.2) * uA);
  #include <colorspace_fragment>
}`;

export function indexSet(story) {
  const { index } = story;
  return (ctx) => {
    const L = index.L, grp = new THREE.Group(); grp.visible = false; ctx.scene.add(grp);
    const U = { map: { value: null }, uInk: { value: new THREE.Color(0x11120f) }, uPale: { value: new THREE.Color(0xc9c5ba) }, uAcc: { value: new THREE.Color(0xf0421c) },
      uF: { value: 0 }, uIn: { value: 1 }, uOut: { value: 0 }, uRows: { value: story.N }, uFogColor: ctx.G.uFogColor, uFogDensity: ctx.G.uFogDensity };
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); mesh.frustumCulled = false; mesh.renderOrder = 1; grp.add(mesh);
    // the line from the name in focus to the frame, and its dot
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf0421c, transparent: true, depthWrite: false });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lineMat); line.rotation.x = -Math.PI / 2; line.renderOrder = 1; grp.add(line);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), lineMat); dot.rotation.x = -Math.PI / 2; dot.renderOrder = 1; grp.add(dot);
    // the shadow of the frame on the paper
    const shMat = new THREE.ShaderMaterial({ uniforms: { uSize: { value: new THREE.Vector2(3.6, 2.6) }, uInner: { value: new THREE.Vector2(2.6, 1.625) }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: SHADOW_FS, transparent: true, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), shMat); shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 0; grp.add(shadow);

    let tex = null, rowEnd = [], built = false, dead = false;
    const PX = 70, CELL = 84, BASE = 64;            // name size in the atlas, cell height, baseline inside the cell
    function build() {
      if (dead) return;
      const atlas = makeAtlas(2048, 2048), g = atlas.g;
      const pos = [], uv = [], row = [], au = [], kind = [], idx = [];
      const quad = (x0, x1, zTop, zBot, r, rI, u0, u1, k) => {
        const b = pos.length / 3, y = 0.0025;
        pos.push(x0, y, zBot, x1, y, zBot, x1, y, zTop, x0, y, zTop);
        uv.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[3]);
        row.push(rI, rI, rI, rI); au.push(u0, u1, u1, u0); kind.push(k, k, k, k); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      };
      const s = L.fs / PX, nameX = L.colX + L.colW * 0.085, nameW = L.colW * 0.915;
      rowEnd = [];
      for (const R of L.rows) {
        let end = 0;
        R.lines.forEach((ln, k) => {
          setDisplay(g, PX); g.filter = 'blur(1.1px)';
          const wpx = g.measureText(ln).width, fit = Math.min(1, nameW / (wpx * s));
          const r = atlas.add(wpx + 6, CELL, (c) => { setDisplay(c, PX); c.filter = 'blur(1.1px)'; c.fillStyle = '#fff'; c.fillText(ln, 3, BASE); });
          const base = L.PZ + R.v0 + (k + 0.8) * L.lh, w = (wpx + 6) * s * fit;
          quad(nameX - 3 * s, nameX - 3 * s + w, base - BASE * s, base + (CELL - BASE) * s, r, R.r, 0, w / nameW, 0);
          end = Math.max(end, w);
        });
        rowEnd.push(nameX + end);
        // the number
        const n = String(R.r + 1).padStart(2, '0'), NP = 26;
        setMono(g, NP, 500, 0.04); g.filter = 'none';
        const nw = g.measureText(n).width, nr = atlas.add(nw + 4, 34, (c) => { setMono(c, NP, 500, 0.04); c.filter = 'none'; c.fillStyle = '#fff'; c.fillText(n, 2, 26); });
        const ns = L.fs * 0.2 / NP, nb = L.PZ + R.v0 + 0.8 * L.lh - L.fs * 0.42;
        quad(L.colX, L.colX + (nw + 4) * ns, nb - 26 * ns, nb + 8 * ns, nr, R.r, 0, 0.05, 1);
      }
      for (const H of L.heads) {
        const HP = 30, label = H.label.toUpperCase(), cnt = String(H.count);
        setMono(g, HP, 600, 0.12); g.filter = 'none';
        const lw = g.measureText(label).width, cw = g.measureText(cnt).width;
        const lr = atlas.add(lw + 4, 40, (c) => { setMono(c, HP, 600, 0.12); c.filter = 'none'; c.fillStyle = '#fff'; c.fillText(label, 2, 30); });
        const cr = atlas.add(cw + 4, 40, (c) => { setMono(c, HP, 600, 0.12); c.filter = 'none'; c.fillStyle = '#fff'; c.fillText(cnt, 2, 30); });
        const hs = L.fs * 0.2 / HP, z = L.PZ + H.v + L.fs * 0.5, rI = L.rows.find((q) => q.i >= 0 && story.sites[q.i].cat === H.cat).r - 0.4;
        quad(L.colX, L.colX + (lw + 4) * hs, z - 30 * hs, z + 10 * hs, lr, rI, 0, 0.3, 2);
        quad(L.colX + L.colW - (cw + 4) * hs, L.colX + L.colW, z - 30 * hs, z + 10 * hs, cr, rI, 0.8, 1, 2);
        quad(L.colX, L.colX + L.colW, z - 44 * hs, z - 44 * hs + L.fs * 0.012, [0, 0, 0, 0], rI, 0, 1, 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('aRow', new THREE.Float32BufferAttribute(row, 1)); geo.setAttribute('aU', new THREE.Float32BufferAttribute(au, 1)); geo.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
      geo.setIndex(idx);
      mesh.geometry.dispose(); mesh.geometry = geo;
      if (tex) tex.dispose(); tex = redTexture(atlas.canvas, ctx.maxAniso); U.map.value = tex;
      atlas.canvas.width = atlas.canvas.height = 1;
      built = true; ctx.kick();
    }
    fontsReady().then(build);
    const gate = new THREE.Vector3();
    return {
      resize() { if (built) build(); },
      update(S) {
        const X = S.x.index; grp.visible = X.on > 0.5 && built; if (!grp.visible) return;
        U.uF.value = X.f; U.uIn.value = X.rowsIn; U.uOut.value = X.out || 0;
        index.gateAt(X.f, gate);
        const gA = (X.gate === undefined ? 1 : X.gate), view = ctx.view();
        shadow.visible = gA > 0.01; shadow.position.set(gate.x, 0.0012, gate.z); shMat.uniforms.uA.value = gA;
        // the link: from the end of the name to the left edge of the frame, on the focus line
        const r = Math.round(X.f), a = (X.link || 0) * gA * (view.k > 0.5 ? 1 : 0);
        line.visible = dot.visible = a > 0.01 && Math.abs(X.f - r) < 0.02 && rowEnd[r] !== undefined;
        if (line.visible) {
          const z = L.PZ + L.rows[r].vc, x0 = rowEnd[r] + L.fs * 0.18, x1 = gate.x - 1.3 - L.fs * 0.1, th = L.visH / view.H * 1.6;
          line.position.set((x0 + x1) / 2, 0.003, z); line.scale.set(Math.max(0.001, (x1 - x0) * a), th, 1); line.position.x = x0 + (x1 - x0) * a / 2;
          dot.position.set(x0 + (x1 - x0) * a, 0.0031, z); dot.scale.setScalar(th * 2.6);
          lineMat.opacity = Math.min(1, a * 3);
        }
      },
      dispose() { dead = true; ctx.scene.remove(grp); mesh.geometry.dispose(); mat.dispose(); if (tex) tex.dispose(); line.geometry.dispose(); dot.geometry.dispose(); lineMat.dispose(); shadow.geometry.dispose(); shMat.dispose(); },
    };
  };
}
