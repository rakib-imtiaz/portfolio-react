// Flat-colour stand-ins for the world sets. Used first, to judge the blend of the story before any look is ported.
import * as THREE from 'three';
import { buildPlan } from '../plan.js';

export function flatSets(story) {
  const { globe, film, hall, index, dust } = story;
  return {
    globe(ctx) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x1b4fe4 });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(globe.G.R, 64, 40), mat); ball.quaternion.copy(globe.G.quat); ctx.scene.add(ball);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xffd21f });
      const pins = globe.G.pins.map((p) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), pinMat); ctx.scene.add(m); return m; });
      const day = new THREE.Color(0x1b4fe4), night = new THREE.Color(0x02040c);
      return {
        update(S) { const X = S.x.globe; ball.visible = X.on > 0.5; ball.position.copy(X.pos); mat.color.copy(day).lerp(night, X.night);
          pins.forEach((m, k) => { m.visible = ball.visible && X.night < 0.5; m.position.copy(X.pos).addScaledVector(globe.G.pins[k].n, globe.G.R); }); },
        dispose() { ctx.scene.remove(ball); ball.geometry.dispose(); mat.dispose(); pins.forEach((m) => { ctx.scene.remove(m); m.geometry.dispose(); }); pinMat.dispose(); },
      };
    },
    film(ctx) {
      const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 400; const g = cv.getContext('2d');
      g.fillStyle = '#111'; g.font = '800 330px "Archivo", "Arial Narrow", sans-serif'; if ('fontStretch' in g) g.fontStretch = 'extra-condensed'; g.textBaseline = 'alphabetic';
      g.textAlign = 'right'; g.fillText('LANDING', 980, 340); g.textAlign = 'left'; g.fillText('PAGES', 1160, 340);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const T = film.TYPE, wM = T.cap * 1.38 * (2048 / 400), hM = T.cap * 1.38;
      const geo = new THREE.PlaneGeometry(wM, hM); geo.translate((1070 - 1024) / 2048 * -wM, hM / 2 - T.cap * 0.08, 0);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      const pivot = new THREE.Group(); pivot.position.set(T.x, 0.01, T.z); const mesh = new THREE.Mesh(geo, mat); pivot.add(mesh); ctx.scene.add(pivot);
      return {
        update(S) { const X = S.x.film; pivot.visible = X.on > 0.5; pivot.rotation.x = -(1 - X.up) * Math.PI / 2; mat.opacity = (1 - X.fade); mat.color.setScalar(1); },
        dispose() { ctx.scene.remove(pivot); geo.dispose(); mat.dispose(); tex.dispose(); },
      };
    },
    hall(ctx) {
      const plan = buildPlan(), grp = new THREE.Group(); grp.rotation.y = Math.PI / 2; grp.position.set(hall.TX, 0, hall.TZ); ctx.scene.add(grp);
      const kinds = { floor: 0xb9b7b0, wall: 0xe9e7e2, ceil: 0xdedcd6, beam: 0xd2d0ca, jamb: 0xe2e0da, soffit: 0xd8d6d0, plinth: 0xe0ded8 };
      const mats = {}, lists = {};
      for (const p of plan.patches) {
        const L = lists[p.kind] || (lists[p.kind] = { pos: [], idx: [] });
        const U = new Set([0, p.w]), V = new Set([0, p.h]);
        for (const h of p.holes) { U.add(h.u0); U.add(h.u1); V.add(h.v0); V.add(h.v1); }
        const us = [...U].sort((a, b) => a - b), vs = [...V].sort((a, b) => a - b);
        for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
          const cs = (us[i] + us[i + 1]) / 2, ct = (vs[j] + vs[j + 1]) / 2;
          if (p.holes.some((h) => cs > h.u0 && cs < h.u1 && ct > h.v0 && ct < h.v1)) continue;
          const b = L.pos.length / 3;
          for (const [s, t] of [[us[i], vs[j]], [us[i + 1], vs[j]], [us[i + 1], vs[j + 1]], [us[i], vs[j + 1]]]) L.pos.push(p.o[0] + p.u[0] * s + p.v[0] * t, p.o[1] + p.u[1] * s + p.v[1] * t, p.o[2] + p.u[2] * s + p.v[2] * t);
          L.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
      }
      const meshes = [];
      for (const k of Object.keys(lists)) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lists[k].pos, 3)); g.setIndex(lists[k].idx);
        mats[k] = new THREE.MeshBasicMaterial({ color: kinds[k] || 0xdddddd, side: THREE.DoubleSide });
        const m = new THREE.Mesh(g, mats[k]); m.frustumCulled = false; grp.add(m); meshes.push(m);
      }
      const dark = new THREE.Color(0x07080A), c = new THREE.Color();
      return {
        update(S) { const X = S.x.hall; grp.visible = X.on > 0.5; for (const k of Object.keys(mats)) mats[k].color.copy(dark).lerp(c.set(kinds[k] || 0xdddddd), X.light); },
        dispose() { ctx.scene.remove(grp); meshes.forEach((m) => m.geometry.dispose()); Object.values(mats).forEach((m) => m.dispose()); },
      };
    },
    index(ctx) {
      const L = index.L, grp = new THREE.Group(); ctx.scene.add(grp);
      const mats = [], geos = [], texs = [];
      const build = () => {
        while (grp.children.length) grp.remove(grp.children[0]);
        L.rows.forEach((row) => {
          const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64 * row.lines.length; const g = cv.getContext('2d');
          g.fillStyle = '#11120f'; g.font = '800 62px "Archivo", "Arial Narrow", sans-serif'; if ('fontStretch' in g) g.fontStretch = 'extra-condensed'; g.textBaseline = 'alphabetic';
          row.lines.forEach((ln, k) => g.fillText(ln, 0, 54 + k * 64, 508));
          const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; texs.push(tex);
          const geo = new THREE.PlaneGeometry(L.colW, row.h); geos.push(geo);
          const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }); mats.push(mat);
          const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(L.colX + L.colW / 2, 0.003, L.PZ + row.vc); m.userData.r = row.r; grp.add(m);
        });
      };
      build();
      return {
        resize() { texs.splice(0).forEach((t) => t.dispose()); geos.splice(0).forEach((g) => g.dispose()); mats.splice(0).forEach((m) => m.dispose()); build(); },
        update(S) { const X = S.x.index; grp.visible = X.on > 0.5;
          for (const m of grp.children) { const d = Math.abs(m.userData.r - X.f); m.material.opacity = (d < 0.5 ? 1 : 0.3) * Math.min(1, Math.max(0, X.rowsIn * 3 - m.userData.r / 24)) * (1 - (X.out || 0)); } },
        dispose() { ctx.scene.remove(grp); texs.forEach((t) => t.dispose()); geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); },
      };
    },
    dust(ctx) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.625), mat); ctx.scene.add(m);
      return {
        update(S) { const X = S.x.dust; m.visible = X.on > 0.5; if (!m.visible) return;
          m.position.copy(X.pos); m.quaternion.copy(X.quat); m.scale.setScalar(X.w);
          const i = X.mix < 0.5 ? X.a : X.b, pl = ctx.planes[i]; mat.map = pl.hero || pl.thumb; mat.opacity = Math.abs(X.mix - 0.5) * 2 * 0.9 + 0.1; mat.needsUpdate = true; },
        dispose() { ctx.scene.remove(m); m.geometry.dispose(); mat.dispose(); },
      };
    },
  };
}
