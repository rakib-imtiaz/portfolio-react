// The look of the Film world (from 07-film): the giant chapter type that stands on the set, its hard shadow, the dark back of
// the wall of sites, and the glow of the screens on the floor at night. Sky, floor, slab bodies and slab shadows are the engine's.
import * as THREE from 'three';
import { fontsReady, setDisplay, rgTexture, FOG_GLSL } from '../type.js';
import { ease, clamp } from '../util.js';

const VS = /* glsl */`
varying vec2 vUv; varying float vDepth;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = length(mv.xyz); gl_Position = projectionMatrix * mv; }`;
// red channel = the words, green channel = the count
const TYPE_FS = /* glsl */`
uniform sampler2D map; uniform vec3 uInk; uniform vec3 uAccent; uniform float uSide; uniform float uVis;
${FOG_GLSL}
varying vec2 vUv; varying float vDepth;
void main(){
  vec4 t = texture2D(map, vUv);
  float a = max(t.r, t.g);
  float w = max(fwidth(a) * 0.75, 0.0005);
  float alpha = smoothstep(0.5 - w, 0.5 + w, a);
  if (alpha < 0.01) discard;
  vec3 col = mix(uInk, uAccent, step(t.r, t.g - 0.001));
  col = mix(col, col * 0.5 + vec3(0.03), uSide);
  col = mix(col, uFogColor, fogAmount(vDepth) * 0.35);
  gl_FragColor = vec4(col, alpha * uVis);
  #include <colorspace_fragment>
}`;
const SHADOW_FS = /* glsl */`
uniform sampler2D map; uniform float uUseMap; uniform float uA;
${FOG_GLSL}
varying vec2 vUv; varying float vDepth;
void main(){
  float e = mix(0.012, 0.11, vUv.y);
  float a = smoothstep(0.0, e, vUv.x) * smoothstep(0.0, e, 1.0 - vUv.x) * smoothstep(0.0, e * 1.6, 1.0 - vUv.y);
  if (uUseMap > 0.5) { vec4 t = texture2D(map, vUv, vUv.y * 3.5); a = smoothstep(0.30, 0.70, max(t.r, t.g)); }
  a *= mix(1.0, 0.45, vUv.y) * uA * (1.0 - fogAmount(vDepth));
  gl_FragColor = vec4(0.03, 0.028, 0.024, a);
  #include <colorspace_fragment>
}`;
const GLOW_FS = /* glsl */`
uniform vec3 uColor; uniform float uGlow;
${FOG_GLSL}
varying vec2 vUv; varying float vDepth;
void main(){
  float side = smoothstep(0.0, 0.42, vUv.x) * smoothstep(0.0, 0.42, 1.0 - vUv.x);
  float a = pow(1.0 - vUv.y, 2.0) * smoothstep(0.0, 0.06, vUv.y) * side * uGlow * 0.22 * (1.0 - fogAmount(vDepth));
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <colorspace_fragment>
}`;
const BACK_FS = /* glsl */`
uniform float uLit; uniform float uVis;
${FOG_GLSL}
varying vec2 vUv; varying float vDepth;
void main(){ vec3 c = vec3(0.07) * mix(0.25, 1.0, uLit); gl_FragColor = vec4(mix(c, uFogColor, fogAmount(vDepth)), uVis);
  #include <colorspace_fragment>
}`;

export function filmSet(story) {
  const { film } = story, T = film.TYPE, WALL = film.WALL;
  return (ctx) => {
    const grp = new THREE.Group(); grp.visible = false; ctx.scene.add(grp);
    const fog = { uFogColor: ctx.G.uFogColor, uFogDensity: ctx.G.uFogDensity };
    const uInk = { value: new THREE.Color(0x0e0e0c) }, uAccent = { value: new THREE.Color(0xf0421c) }, uVis = { value: 1 }, uMap = { value: null };
    const INK_DAY = new THREE.Color(0x0e0e0c), INK_NIGHT = new THREE.Color(0xf0421c), ACC_DAY = new THREE.Color(0xf0421c), ACC_NIGHT = new THREE.Color(0xeee9df);
    const disposables = [];
    // ---- the type: a stack of flat layers on a hinge at the baseline
    const hinge = new THREE.Group(); hinge.position.set(T.x, 0.004, T.z); grp.add(hinge);
    const N = 10, DEPTH = T.cap * 0.14;
    let tex = null, built = false, dead = false, box = { x0: -6, x1: 6, top: 2.3, v0: 0 };
    const shGeo = new THREE.BufferGeometry();
    shGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); shGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(8), 2)); shGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const shMat = new THREE.ShaderMaterial({ uniforms: { map: uMap, uUseMap: { value: 1 }, uA: { value: 0 }, ...fog }, vertexShader: VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const typeShadow = new THREE.Mesh(shGeo, shMat); typeShadow.frustumCulled = false; typeShadow.renderOrder = -20; grp.add(typeShadow);
    disposables.push(shGeo, shMat);
    function build() {
      if (dead) return;
      const m = document.createElement('canvas').getContext('2d');
      setDisplay(m, 200);
      const cap200 = m.measureText('H').actualBoundingBoxAscent || 146, wA = m.measureText(T.words[0]).width, wB = m.measureText(T.words[1]).width;
      const gap200 = T.gap / T.cap * cap200, CS = 0.4;
      setDisplay(m, 200 * CS, 700); const wC = m.measureText(T.count).width + 200 * 0.08;
      const tot200 = wA + gap200 + wB + wC, k = Math.min(2000 / tot200, 3), pad = 20, px = 200 * k, cap = cap200 * k;
      const cv = document.createElement('canvas'); cv.width = Math.ceil(tot200 * k) + pad * 2; cv.height = Math.ceil(cap) + pad * 2;
      const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'lighter'; g.filter = 'blur(1.3px)'; g.textBaseline = 'alphabetic';
      setDisplay(g, px); g.fillStyle = '#f00';
      g.fillText(T.words[0], pad, pad + cap); g.fillText(T.words[1], pad + (wA + gap200) * k, pad + cap);
      setDisplay(g, px * CS, 700); g.fillStyle = '#0f0';
      const cc = g.measureText('8').actualBoundingBoxAscent || cap * CS;
      g.fillText(T.count, pad + (wA + gap200 + wB) * k + px * 0.06, pad + cc);
      if (tex) tex.dispose(); tex = rgTexture(cv, ctx.maxAniso); uMap.value = tex;
      const s = T.cap / cap, Ww = cv.width * s, Hw = cv.height * s, gapC = (pad + (wA + gap200 / 2) * k) * s, padW = pad * s;
      while (hinge.children.length) { const c = hinge.children[0]; hinge.remove(c); c.geometry.dispose(); c.material.dispose(); }
      const geo = new THREE.PlaneGeometry(Ww, Hw); geo.translate(Ww / 2 - gapC, Hw / 2 - padW, 0);
      for (let i = N - 1; i >= 0; i--) {
        const mat = new THREE.ShaderMaterial({ uniforms: { map: uMap, uInk, uAccent, uSide: { value: i === 0 ? 0 : 1 }, uVis, ...fog }, vertexShader: VS, fragmentShader: TYPE_FS, transparent: true, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(i === 0 ? geo : geo.clone(), mat); mesh.position.z = -i * DEPTH / (N - 1); mesh.frustumCulled = false; mesh.renderOrder = -2; hinge.add(mesh);
      }
      box = { x0: -gapC, x1: Ww - gapC, top: Hw - padW, v0: pad / cv.height };
      shGeo.attributes.uv.array.set([0, box.v0, 1, box.v0, 1, 1, 0, 1]); shGeo.attributes.uv.needsUpdate = true;
      cv.width = cv.height = 1; built = true; ctx.kick();
    }
    fontsReady().then(build);

    // ---- the back of the wall and its shadow
    const corners = [null, null];
    story.sites.forEach((s, i) => { const sl = film.slotOf[i]; if (!sl) return; if (sl.col === 0 && sl.row === 0) corners[0] = i; if (sl.col === WALL.cols - 1 && sl.row === WALL.rows - 1) corners[1] = i; });
    const backMat = new THREE.ShaderMaterial({ uniforms: { uLit: { value: 1 }, uVis: { value: 1 }, ...fog }, vertexShader: VS, fragmentShader: BACK_FS, transparent: true });
    const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), backMat); back.renderOrder = -3; grp.add(back);
    const wsGeo = new THREE.BufferGeometry();
    wsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); wsGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); wsGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const wsMat = new THREE.ShaderMaterial({ uniforms: { map: uMap, uUseMap: { value: 0 }, uA: { value: 0 }, ...fog }, vertexShader: VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const wallShadow = new THREE.Mesh(wsGeo, wsMat); wallShadow.frustumCulled = false; wallShadow.renderOrder = -21; grp.add(wallShadow);
    disposables.push(back.geometry, backMat, wsGeo, wsMat);

    // ---- night: each standing screen lights the floor in front of it
    const glows = film.holds.map((i) => {
      const col = new THREE.Color(story.sites[i].accent || '#888888'), hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * 1.1 + 0.1), Math.max(0.5, hsl.l));
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); geo.setIndex([0, 2, 1, 0, 3, 2]);
      const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: col }, uGlow: { value: 0 }, ...fog }, vertexShader: VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = -19; grp.add(mesh); disposables.push(geo, mat);
      return { i, mesh, geo, mat };
    });

    return {
      update(S) {
        const X = S.x.film; grp.visible = X.on > 0.5; if (!grp.visible) return;
        const env = S.env, night = X.night, fade = X.fade || 0;
        // type
        const up = clamp(X.up) * (1 - ease(clamp((fade - 0.15) / 0.75))), ang = up * Math.PI / 2;
        hinge.visible = typeShadow.visible = built;
        hinge.rotation.x = -(Math.PI / 2 - ang);
        uInk.value.copy(INK_DAY).lerp(INK_NIGHT, night); uAccent.value.copy(ACC_DAY).lerp(ACC_NIGHT, night);
        uVis.value = Math.min(1, X.light * 1.5) * (1 - clamp((fade - 0.75) / 0.25));
        // its shadow: the baseline, thrown along the sun by the height the type has reached
        const h = box.top * Math.sin(ang), back0 = Math.cos(ang) * box.top;       // while it rises the top is still behind the hinge
        const a = shGeo.attributes.position.array, sx = env.sun.x * h, sz = env.sun.z * h - back0;
        a.set([T.x + box.x0, 0.008, T.z, T.x + box.x1, 0.008, T.z, T.x + box.x1 + sx, 0.008, T.z + sz, T.x + box.x0 + sx, 0.008, T.z + sz]); shGeo.attributes.position.needsUpdate = true;
        shMat.uniforms.uA.value = env.shadowA * Math.min(1, up * 1.4) * uVis.value; typeShadow.visible = built && shMat.uniforms.uA.value > 0.004;
        // the wall
        const p0 = S.planes[corners[0]], p1 = S.planes[corners[1]], flat = Math.abs(p0.pos.z - p1.pos.z) < 0.02 && p0.curve < 0.001;
        const wv = flat ? Math.min(1, X.light * 2) * (1 - clamp((fade - 0.1) / 0.3)) : 0;
        back.visible = wv > 0.01;
        if (back.visible) {
          const m = 0.07, w = Math.abs(p1.pos.x - p0.pos.x) + WALL.tw + 2 * m, hh = Math.abs(p1.pos.y - p0.pos.y) + WALL.tw * 0.625 + 2 * m;
          back.position.set((p0.pos.x + p1.pos.x) / 2, (p0.pos.y + p1.pos.y) / 2, p0.pos.z - 0.13); back.scale.set(w, hh, 0.14);
          backMat.uniforms.uLit.value = env.bodyLit; backMat.uniforms.uVis.value = wv;
          const top = back.position.y + hh / 2, x0 = back.position.x - w / 2, x1 = back.position.x + w / 2, z = back.position.z, lx = env.sun.x * top, lz = env.sun.z * top;
          wsGeo.attributes.position.array.set([x0, 0.007, z, x1, 0.007, z, x1 + lx, 0.007, z + lz, x0 + lx, 0.007, z + lz]); wsGeo.attributes.position.needsUpdate = true;
          wsMat.uniforms.uA.value = env.shadowA * wv * (back.position.y - hh / 2 < 0.4 ? 1 : 0);
        }
        wallShadow.visible = back.visible && wsMat.uniforms.uA.value > 0.004;
        // night glow
        for (const gl of glows) {
          const p = S.planes[gl.i], amt = night * (1 - fade) * (p.grain < 0.1 && p.op > 0.5 ? 1 : 0) * (p.w > 2 ? 1 : 0);
          gl.mesh.visible = amt > 0.01; if (!gl.mesh.visible) continue;
          const w = p.w, e = w * 0.2, z0 = p.pos.z + 0.02, r = 3.6, x = p.pos.x;
          gl.geo.attributes.position.array.set([x - w / 2 - e, 0.009, z0, x + w / 2 + e, 0.009, z0, x + w / 2 + e + 0.8, 0.009, z0 + r, x - w / 2 - e - 0.8, 0.009, z0 + r]); gl.geo.attributes.position.needsUpdate = true;
          gl.mat.uniforms.uGlow.value = amt;
        }
      },
      dispose() { dead = true; ctx.scene.remove(grp); for (const c of hinge.children) { c.geometry.dispose(); c.material.dispose(); } if (tex) tex.dispose(); for (const d of disposables) d.dispose(); },
    };
  };
}
