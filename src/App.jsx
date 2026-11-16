// The page: one canvas with the story, the page parts over it, the project view and "All 48".
// The story itself runs outside React (journey/controller.js). React re-renders only when the hold,
// the chapter, the play state or an overlay changes, never per frame.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createJourney, WORLD_TITLES } from './journey/controller.js';
import { siteIdFromPath, sitePath, storyPath } from './lib/site.js';
import { TopBar, Intro, Caption, Foot } from './ui/Chrome.jsx';
import { ProjectView, AllSites } from './ui/Overlays.jsx';

const QS = new URLSearchParams(location.search);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches || QS.has('reduce');

export default function App() {
  const [content, setContent] = useState(null);
  useEffect(() => {
    fetch('/content.json').then((r) => r.json()).then(setContent).catch((e) => console.error('content.json', e));
  }, []);
  return content ? <Journey content={content} /> : null;
}

function Journey({ content }) {
  const { person, sites, categories } = content;
  const N = sites.length;
  const catLabel = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.label])), [categories]);
  const indexOf = useMemo(() => new Map(sites.map((s, i) => [s.id, i])), [sites]);

  const canvasRef = useRef(null), trackRef = useRef(null), capRef = useRef(null), introRef = useRef(null), nameRef = useRef(null);
  const railRefs = useRef([]);
  const ctl = useRef(null);

  const [plain, setPlain] = useState(false);
  const [capSite, setCapSite] = useState(-2);
  const [world, setWorld] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [sheetI, setSheetI] = useState(-1);
  const [allOpen, setAllOpen] = useState(false);
  const live = useRef({});
  live.current = { sheetI, allOpen, plain };

  // ---------- the project view has its own address, /site/<id>; Back closes it
  const openSite = useCallback((i) => {
    const s = sites[i]; if (!s) return;
    history.pushState({ site: s.id, fromStory: true }, '', sitePath(s.id));
    setSheetI(i);
  }, [sites]);
  const closeSheet = useCallback(() => {
    if (live.current.sheetI < 0) return;
    if (history.state && history.state.fromStory) { history.back(); return; }   // popstate closes it
    history.replaceState(null, '', storyPath());                                 // opened from a link: stay on this entry
    setSheetI(-1);
  }, []);
  useEffect(() => {
    const onPop = () => { const id = siteIdFromPath(); setSheetI(id && indexOf.has(id) ? indexOf.get(id) : -1); };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [indexOf]);

  const onEscape = useCallback(() => {
    const st = live.current;
    if (st.sheetI >= 0) closeSheet();
    else if (st.allOpen && !st.plain) setAllOpen(false);
  }, [closeSheet]);

  // ---------- start the story once
  const handlers = useRef({});
  handlers.current = { openSite, onEscape };
  useEffect(() => {
    const body = document.body;
    const plainMode = () => {
      body.classList.remove('boot'); body.classList.add('nogl'); body.dataset.theme = 'light';
      setPlain(true); setAllOpen(true); window.__ready = true;
    };
    let c = null;
    if (!QS.has('nogl')) {
      c = createJourney({
        content,
        els: { canvas: canvasRef.current, track: trackRef.current, cap: () => capRef.current, intro: () => introRef.current, capName: () => nameRef.current, railButtons: () => railRefs.current },
        reduce: REDUCE, flat: QS.has('flat'), p0: parseFloat(QS.get('p')) || 0,
        on: { site: setCapSite, world: setWorld, play: setPlaying, open: (i) => handlers.current.openSite(i), escape: () => handlers.current.onEscape() },
      });
    }
    if (c) ctl.current = c; else plainMode();
    // a link straight to a project: /site/<id>
    const id = siteIdFromPath();
    if (id) { if (indexOf.has(id)) setSheetI(indexOf.get(id)); else history.replaceState(null, '', storyPath()); }
    return () => { if (c) c.destroy(); ctl.current = null; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // without WebGL there is no controller to listen for Escape
  useEffect(() => {
    if (!plain) return;
    const onKey = (e) => { if (e.key === 'Escape') onEscape(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [plain, onEscape]);

  // the caption name is fitted to one line after React has put the new name in
  useLayoutEffect(() => { ctl.current && ctl.current.fitName(); }, [capSite]);

  // an open overlay stops Play, the keys and the frames behind it
  useEffect(() => {
    const open = sheetI >= 0 || (allOpen && !plain);
    ctl.current && ctl.current.setOverlay(open);
    document.body.classList.toggle('is-sheet', sheetI >= 0);
    document.body.classList.toggle('is-all', allOpen);
  }, [sheetI, allOpen, plain]);

  const c = () => ctl.current;
  return (
    <>
      <canvas id="gl" ref={canvasRef} aria-label={`One continuous journey through websites built by ${person.name}.`} />
      <div id="track" ref={trackRef} aria-hidden="true" />
      <TopBar person={person} count={N} onHome={() => c() && c().home()} onAll={() => setAllOpen(true)} />
      <Intro person={person} count={N} ref={introRef} />
      <Caption site={capSite} sites={sites} person={person} catLabel={catLabel} onOpen={openSite} ref={capRef} nameRef={nameRef} />
      <Foot titles={WORLD_TITLES} world={world} playing={playing} railRefs={railRefs}
        onPlay={() => c() && c().togglePlay()} onWorld={(w) => c() && c().goWorld(w)} />
      {allOpen && <AllSites sites={sites} categories={categories} plain={plain} onOpen={openSite} onClose={() => setAllOpen(false)} />}
      {plain && <p className="plain-foot">{person.contact}. <a href={'mailto:' + person.email}><u>{person.email}</u></a></p>}
      {sheetI >= 0 && <ProjectView key={sites[sheetI].id} site={sites[sheetI]} catLabel={catLabel} onClose={closeSheet} />}
    </>
  );
}
