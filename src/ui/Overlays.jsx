// The two full-screen views: the project view (one site, its full page or its live build) and "All 48".
import { Fragment, useEffect, useRef, useState } from 'react';
import { canVisit } from '../lib/site.js';

export function ProjectView({ site: s, catLabel, onClose }) {
  const [live, setLive] = useState(false);
  const closeRef = useRef(null);
  useEffect(() => {
    // take the focus, and give it back when the view closes
    const before = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (before && before.focus && document.contains(before)) before.focus({ preventScroll: true }); };
  }, []);
  const narrow = innerWidth < 760 && s.media.fullMobile;
  const m = narrow ? s.media.fullMobile : s.media.full;
  const visit = canVisit(s);
  return (
    <div className="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="shName">
      <div className="sheet-bar">
        <div className="sheet-id">
          <p className="cap-meta">
            <span id="shCat">{catLabel[s.cat]}</span>
            <span className="tag" id="shTag" hidden={!s.concept}>Concept</span>
            <span className="st" id="shStatus" hidden={s.concept || !s.status}>{s.concept ? '' : s.status || ''}</span>
          </p>
          <h2 id="shName">{s.name}</h2>
          <p className="cap-line" id="shLine">{s.line}</p>
        </div>
        <div className="sheet-act">
          <button className="btn" type="button" id="shLive" hidden={!s.liveLocal} onClick={() => setLive((v) => !v)}>{live ? 'Show the capture' : 'Run it live'}</button>
          <a className="btn solid" id="shVisit" hidden={!visit} href={visit ? s.url : undefined} target="_blank" rel="noopener">Visit</a>
          <button className="btn" type="button" id="shClose" aria-label="Close" ref={closeRef} onClick={onClose}>Close</button>
        </div>
      </div>
      <div className={'sheet-body' + (live ? ' live' : '')} id="shBody">
        {live
          ? <iframe src={s.liveLocal} title={`${s.name}, running live`} allow="autoplay; fullscreen" />
          : <img className={narrow ? 'phone' : undefined} src={m.src} width={m.w} height={m.h} alt={`${s.name}: the full page`} decoding="async" />}
      </div>
    </div>
  );
}

export function AllSites({ sites, categories, plain, onOpen, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => { if (!plain) closeRef.current?.focus({ preventScroll: true }); }, [plain]);
  const N = sites.length;
  return (
    <div className="all" id="all" role={plain ? undefined : 'dialog'} aria-modal={plain ? undefined : 'true'} aria-label={`All ${N} websites`}>
      <div className="all-bar">
        <h2>All <span id="allCount2">{N}</span> websites</h2>
        <button className="btn" type="button" id="allClose" ref={closeRef} onClick={onClose}>Close</button>
      </div>
      <div className="all-body" id="allBody">
        {categories.map((c) => {
          const list = sites.map((s, i) => [s, i]).filter(([s]) => s.cat === c.id);
          return (
            <Fragment key={c.id}>
              <h3 className="all-cat">{c.label} <span>{list.length}</span></h3>
              <div className="all-grid">
                {list.map(([s, i]) => (
                  <button className="card" type="button" key={s.id} onClick={() => onOpen(i)}>
                    <img src={s.media.thumb} alt="" loading="lazy" width="720" height="450" />
                    <b>{s.name}{s.concept ? <i>Concept</i> : null}</b>
                    <small>{s.line}</small>
                  </button>
                ))}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
