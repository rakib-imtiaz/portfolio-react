// The hall, as data (copied from 09-hall/plan.js; the geometry is the same, so the baked lightmap fits).
// Only the hang list differs: a few sites swap places with a frame of the same room.
// Units are metres. x runs east along the building, y is up, z runs south.

export const BAY = 4.8;            // structural grid
export const ZN = -7.2, ZS = 7.2;  // inner faces of the north and south walls
export const DEPTH = ZS - ZN;
export const WT = 0.8;             // thickness of the walls between rooms
export const HB = 4.8;             // underside of the main beams
export const HB2 = 4.95;           // underside of the cross beams
export const HR = 5.7;             // underside of the roof (the skylight glass sits here)
export const BW = 0.4;             // beam width
export const SKY = 3.0;            // skylight size (square)
export const PORTAL = { z0: -2.2, z1: 2.2, h: 3.9 };
export const EYE = 1.6;            // eye height, and the centre height of every frame

// Rooms are the three categories from content.json. Nothing else is named.
export const ROOMS = [
  { id: 'shopify', x0: 0, x1: 33.6, bays: 7 },
  { id: 'landing', x0: 34.4, x1: 68.0, bays: 7 },
  { id: 'business', x0: 68.8, x1: 92.8, bays: 5 },
];
export const X_END = 92.8;
// A plinth in the Business room. It carries the survey drone from the Underhill Geomatics site.
export const PLINTH = { x: 78.2, z: 2.9, s: 1.1, h: 0.95 };

const SIZE = { F: [4.0, 2.5], R: [2.6, 1.625], P: [2.0, 2.5] };

// What hangs where. F = large frame, R = regular frame, P = portrait frame that plays a recorded clip
// of the site's live 3D. Lists read left to right as you face the wall.
const HANG = [
  { room: 0, wall: 'N', items: ['F:sherwood', 'R:carly', 'R:warrior-council', 'F:bear-river', 'R:back-to-earth', 'R:church-of-truth', 'F:pacha-mana', 'R:people-of-the-forest', 'R:vac-stack'] },
  { room: 0, wall: 'EN', items: ['R:omari'] },
  { room: 0, wall: 'ES', items: ['R:academy'] },
  { room: 0, wall: 'S', items: ['F:california-89', 'R:momsnbubs', 'R:jacqueline', 'F:waterhouse', 'R:find-a-spring', 'R:retreat-spaces', 'F:vior', 'P:vior:p-vior'] },

  { room: 1, wall: 'WN', items: ['R:manahouse'] },
  { room: 1, wall: 'N', items: ['F:sequoia-wildfire', 'P:sequoia-wildfire:table', 'F:meraki-audio', 'R:terra-atelier', 'F:aerie-dynamics', 'F:lumina-espresso', 'R:meridian-horology', 'F:marrow-moss'] },
  { room: 1, wall: 'EN', items: ['R:lumen-observatory'] },
  { room: 1, wall: 'ES', items: ['R:helios-grid'] },
  { room: 1, wall: 'S', items: ['F:cascade-bath', 'R:ad-copy', 'F:orbita-keys', 'R:vibeport', 'R:origin-aspect', 'F:manahouse-3d', 'P:manahouse-3d:p-manahouse3d', 'R:sequoia-rentals', 'R:structured-cabling'] },
  { room: 1, wall: 'WS', items: ['R:car-shades'] },

  { room: 2, wall: 'WN', items: ['R:sequoia-drone'] },
  { room: 2, wall: 'N', items: ['F:underhill', 'P:underhill:fly', 'F:sequoia-security', 'R:web-lumin', 'R:drone-peach', 'R:sequoia-security-v1'] },
  { room: 2, wall: 'S', items: ['F:sequoia-services', 'R:car-shades-portfolio', 'R:sequoia-boat-old', 'F:zafran', 'P:sequoia-services:seqintro'] },
  { room: 2, wall: 'WS', items: ['R:aniwa'] },
];

// A wall run: start point a, end point b (left to right as seen from inside), normal n into the room.
function wallRun(room, wall) {
  const r = ROOMS[room];
  switch (wall) {
    case 'N': return { a: [r.x0, ZN], b: [r.x1, ZN], n: [0, 1] };
    case 'S': return { a: [r.x1, ZS], b: [r.x0, ZS], n: [0, -1] };
    case 'W': return { a: [r.x0, ZS], b: [r.x0, ZN], n: [1, 0] };
    case 'E': return { a: [r.x1, ZN], b: [r.x1, ZS], n: [-1, 0] };
    case 'EN': return { a: [r.x1, ZN], b: [r.x1, PORTAL.z0], n: [-1, 0] };
    case 'ES': return { a: [r.x1, PORTAL.z1], b: [r.x1, ZS], n: [-1, 0] };
    case 'WS': return { a: [r.x0, ZS], b: [r.x0, PORTAL.z1], n: [1, 0] };
    case 'WN': return { a: [r.x0, PORTAL.z0], b: [r.x0, ZN], n: [1, 0] };
  }
  throw new Error('wall ' + wall);
}

export function buildPlan() {
  const boxes = [];   // solid boxes, for ray tracing and for click blocking
  const patches = []; // lit rectangles (each gets a piece of the lightmap)
  const skylights = [];
  const pieces = [];  // the frames
  const spots = [];

  const WALL = [0.86, 0.855, 0.84], FLOOR = [0.4, 0.39, 0.375], CEIL = [0.86, 0.86, 0.85];
  const box = (min, max, alb = WALL) => { boxes.push({ min, max, alb }); return boxes.length - 1; };
  const patch = (p) => { p.id = patches.length; p.holes = p.holes || []; patches.push(p); return p; };

  // ground and shell
  box([-2, -1, ZN - 2], [X_END + 2, 0, ZS + 2], FLOOR);
  box([-0.8, 0, ZN - 0.8], [X_END + 0.8, HR, ZN]);
  box([-0.8, 0, ZS], [X_END + 0.8, HR, ZS + 0.8]);
  box([-0.8, 0, ZN], [0, HR, ZS]);
  box([X_END, 0, ZN], [X_END + 0.8, HR, ZS]);

  // walls between rooms, each with one portal
  const dividers = [ROOMS[0].x1, ROOMS[1].x1];
  for (const wx of dividers) {
    box([wx, 0, ZN], [wx + WT, HR, PORTAL.z0]);
    box([wx, 0, PORTAL.z1], [wx + WT, HR, ZS]);
    box([wx, PORTAL.h, PORTAL.z0], [wx + WT, HR, PORTAL.z1]);
    const pw = PORTAL.z1 - PORTAL.z0;
    patch({ kind: 'jamb', room: -1, o: [wx, 0, PORTAL.z0], u: [1, 0, 0], v: [0, 1, 0], w: WT, h: PORTAL.h, n: [0, 0, 1], res: 16, alb: WALL });
    patch({ kind: 'jamb', room: -1, o: [wx, 0, PORTAL.z1], u: [1, 0, 0], v: [0, 1, 0], w: WT, h: PORTAL.h, n: [0, 0, -1], res: 16, alb: WALL });
    patch({ kind: 'soffit', room: -1, o: [wx, PORTAL.h, PORTAL.z0], u: [1, 0, 0], v: [0, 0, 1], w: WT, h: pw, n: [0, -1, 0], res: 16, alb: WALL });
    patch({ kind: 'floor', room: -1, o: [wx, 0, PORTAL.z0], u: [1, 0, 0], v: [0, 0, 1], w: WT, h: pw, n: [0, 1, 0], res: 12, alb: FLOOR });
  }

  {
    const { x, z, s, h } = PLINTH, a = s / 2;
    box([x - a, 0, z - a], [x + a, h, z + a]);
    patch({ kind: 'plinth', room: 2, o: [x - a, h, z - a], u: [1, 0, 0], v: [0, 0, 1], w: s, h: s, n: [0, 1, 0], res: 16, alb: WALL });
    patch({ kind: 'plinth', room: 2, o: [x - a, 0, z - a], u: [1, 0, 0], v: [0, 1, 0], w: s, h, n: [0, 0, -1], res: 16, alb: WALL });
    patch({ kind: 'plinth', room: 2, o: [x - a, 0, z + a], u: [1, 0, 0], v: [0, 1, 0], w: s, h, n: [0, 0, 1], res: 16, alb: WALL });
    patch({ kind: 'plinth', room: 2, o: [x - a, 0, z - a], u: [0, 0, 1], v: [0, 1, 0], w: s, h, n: [-1, 0, 0], res: 16, alb: WALL });
    patch({ kind: 'plinth', room: 2, o: [x + a, 0, z - a], u: [0, 0, 1], v: [0, 1, 0], w: s, h, n: [1, 0, 0], res: 16, alb: WALL });
  }

  ROOMS.forEach((r, ri) => {
    const len = r.x1 - r.x0;
    const portalHole = { u0: PORTAL.z0 - ZN, u1: PORTAL.z1 - ZN, v0: 0, v1: PORTAL.h };
    patch({ kind: 'floor', room: ri, o: [r.x0, 0, ZN], u: [1, 0, 0], v: [0, 0, 1], w: len, h: DEPTH, n: [0, 1, 0], res: 12, alb: FLOOR });
    patch({ kind: 'wall', room: ri, o: [r.x0, 0, ZN], u: [1, 0, 0], v: [0, 1, 0], w: len, h: HR, n: [0, 0, 1], res: 16, alb: WALL });
    patch({ kind: 'wall', room: ri, o: [r.x0, 0, ZS], u: [1, 0, 0], v: [0, 1, 0], w: len, h: HR, n: [0, 0, -1], res: 16, alb: WALL });
    patch({ kind: 'wall', room: ri, o: [r.x0, 0, ZN], u: [0, 0, 1], v: [0, 1, 0], w: DEPTH, h: HR, n: [1, 0, 0], res: 16, alb: WALL, holes: ri > 0 ? [portalHole] : [] });
    patch({ kind: 'wall', room: ri, o: [r.x1, 0, ZN], u: [0, 0, 1], v: [0, 1, 0], w: DEPTH, h: HR, n: [-1, 0, 0], res: 16, alb: WALL, holes: ri < 2 ? [portalHole] : [] });

    // skylights, one per bay
    const holes = [];
    for (let i = 0; i < r.bays; i++) for (const zc of [-BAY, 0, BAY]) {
      const xc = r.x0 + (i + 0.5) * BAY;
      skylights.push({ room: ri, x0: xc - SKY / 2, x1: xc + SKY / 2, z0: zc - SKY / 2, z1: zc + SKY / 2 });
      holes.push({ u0: xc - SKY / 2 - r.x0, u1: xc + SKY / 2 - r.x0, v0: zc - SKY / 2 - ZN, v1: zc + SKY / 2 - ZN });
    }
    patch({ kind: 'ceil', room: ri, o: [r.x0, HR, ZN], u: [1, 0, 0], v: [0, 0, 1], w: len, h: DEPTH, n: [0, -1, 0], res: 6, alb: CEIL, holes });

    // main beams span the room north to south
    for (let k = 1; k < r.bays; k++) {
      const xc = r.x0 + k * BAY;
      box([xc - BW / 2, HB, ZN], [xc + BW / 2, HR, ZS], CEIL);
      patch({ kind: 'beam', room: ri, o: [xc - BW / 2, HB, ZN], u: [0, 0, 1], v: [0, 1, 0], w: DEPTH, h: HR - HB, n: [-1, 0, 0], res: 8, alb: CEIL });
      patch({ kind: 'beam', room: ri, o: [xc + BW / 2, HB, ZN], u: [0, 0, 1], v: [0, 1, 0], w: DEPTH, h: HR - HB, n: [1, 0, 0], res: 8, alb: CEIL });
      patch({ kind: 'beam', room: ri, o: [xc - BW / 2, HB, ZN], u: [1, 0, 0], v: [0, 0, 1], w: BW, h: DEPTH, n: [0, -1, 0], res: 8, alb: CEIL });
    }
    // cross beams run the length of the room
    for (const zc of [-BAY / 2, BAY / 2]) {
      box([r.x0, HB2, zc - BW / 2], [r.x1, HR, zc + BW / 2], CEIL);
      patch({ kind: 'beam', room: ri, o: [r.x0, HB2, zc - BW / 2], u: [1, 0, 0], v: [0, 1, 0], w: len, h: HR - HB2, n: [0, 0, -1], res: 8, alb: CEIL });
      patch({ kind: 'beam', room: ri, o: [r.x0, HB2, zc + BW / 2], u: [1, 0, 0], v: [0, 1, 0], w: len, h: HR - HB2, n: [0, 0, 1], res: 8, alb: CEIL });
      patch({ kind: 'beam', room: ri, o: [r.x0, HB2, zc - BW / 2], u: [1, 0, 0], v: [0, 0, 1], w: len, h: BW, n: [0, -1, 0], res: 8, alb: CEIL });
    }
  });

  // the frames
  for (const run of HANG) {
    const { a, b, n } = wallRun(run.room, run.wall);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const items = run.items.map((s) => { const [k, id, clip] = s.split(':'); return { k, id, clip: clip || null, w: SIZE[k][0], h: SIZE[k][1] }; });
    const used = items.reduce((s, i) => s + i.w, 0);
    const gap = (L - used) / (items.length + 1);
    let d = gap;
    for (const it of items) {
      const c = d + it.w / 2; d += it.w + gap;
      const piece = {
        index: pieces.length, id: it.id, kind: it.k, clip: it.clip, room: run.room, wall: run.wall,
        w: it.w, h: it.h, x: a[0] + t[0] * c, y: EYE, z: a[1] + t[1] * c, nx: n[0], nz: n[1], tx: t[0], tz: t[1],
      };
      pieces.push(piece);
      // one warm ceiling spot per frame, on a track 2.3 m off the wall
      spots.push({ x: piece.x + n[0] * 2.3, y: 4.72, z: piece.z + n[1] * 2.3, tx: piece.x, ty: EYE + 0.3, tz: piece.z, wide: it.k === 'F' ? 1 : 0 });
    }
  }

  return { boxes, patches, skylights, pieces, spots };
}

// Where a visitor may stand: inside a room (0.7 m off the walls) or inside a portal.
export const WALK = [
  ...ROOMS.map((r, i) => ({ room: i, x0: r.x0 + 0.7, x1: r.x1 - 0.7, z0: ZN + 0.7, z1: ZS - 0.7 })),
  ...[ROOMS[0].x1, ROOMS[1].x1].map((wx, i) => ({ portal: i, x0: wx - 0.75, x1: wx + WT + 0.75, z0: PORTAL.z0 + 0.6, z1: PORTAL.z1 - 0.6 })),
];
export function roomAt(x) { for (let i = 0; i < ROOMS.length; i++) if (x <= ROOMS[i].x1 + WT / 2) return i; return ROOMS.length - 1; }
