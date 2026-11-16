# Mohammad Noman, portfolio: The Journey

One page, one scroll, one unbroken 3D shot through seven worlds. The same 48 real websites re-arrange into each world: fly-through, index, globe, spiral, film set, particles and the hall. The story ends on the contact wall.

The design was approved as concept 11 in `C:\Nomans_workspace\portfolio\concepts\11-journey\`. This is the React build of it. The earlier portfolio is archived in `C:\Nomans_workspace\portfolio\_archive\portfolio-react_old_2026-11-16\`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # writes dist/
npm run preview    # serves dist/ on http://127.0.0.1:4610
```

## Folder layout

- `index.html`: the page head (title, description, Archivo from Google Fonts).
- `src/main.jsx`: mounts the app. There is no `<StrictMode>`, because it mounts effects twice and a WebGL canvas cannot get a second renderer.
- `src/App.jsx`: loads `content.json`, starts the story, owns the page state (caption, chapter, Play, project view, "All 48") and the `/site/<id>` address.
- `src/ui/Chrome.jsx`: top bar, intro, caption plate, Play and the chapter rail.
- `src/ui/Overlays.jsx`: the project view and "All 48".
- `src/journey/`: the 3D story. It is plain JavaScript, not React.
  - `controller.js`: scroll, smoothing, the render loop, keys, pointer and Play. It writes the per-frame values to the DOM, so React does not re-render on each frame.
  - `story.js`: every frame as a pure function of scroll progress `p` (0 to 1).
  - `engine.js`: one WebGL renderer, one camera, the 48 site planes, the mirror floor.
  - `sets/*.js`: the look of each world (index type, globe, film set, dust, hall).
  - `plan.js`, `type.js`, `util.js`: the hall plan, type in 3D, maths.
- `src/styles.css`: all styles.
- `public/`: the static files (see below).
- `tools/`: the scripts that fill `public/`.

## The static files in public/

`public/` is made from the concepts folder. Do not edit it by hand.

```bash
npm run assets     # = node tools/sync-assets.mjs && python tools/shrink-captures.py
```

- `sync-assets.mjs` copies only the files the site uses. It writes a public `content.json` with only the fields the site reads. Private staging links and client notes stay out.
- `shrink-captures.py` turns the full-page captures into WebP (quality 80). It needs Python with Pillow. Always run it after the sync.

Contents: `content.json`, `media/<id>/` (thumb, large capture, full-page captures), `live/<id>/` (the ten 3D builds for "Run it live"), `data/` (globe map, hall lightmap), `models/drone.glb`, `fonts/` (Mona Sans and Mona Sans Mono).

## Addresses

- `/`: the story. `/?p=0.55` starts at that point of the story.
- `/site/<id>`: opens the project view of one site, for example `/site/sherwood`. Close or Back returns to the story.
- `?reduce`: reduced motion (steps from hold to hold). The site also does this when the system asks for reduced motion.
- `?nogl`: the plain grid that shows when WebGL 2 is not available.

`vercel.json` sends every other address to `index.html`, except the static folders.

## Review hooks (in the browser console)

- `__seek(p)`: jump to `p`.
- `__holds()`, `__map()`: the scroll map.
- `__measure(steps)`: frame times across the whole story.
- `__ready`: `true` when the 48 thumbnails are loaded.

## Deploy

Vercel builds this repo from GitHub (`npm run build`, output `dist/`). Nothing deploys until the code is pushed. Do not push without the owner's go-ahead.
