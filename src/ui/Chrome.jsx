// The fixed page parts over the canvas: the top bar, the first-screen intro, the caption plate and the foot (Play + chapter rail).
// Per-frame values (--cap, --intro, the rail progress --k) are written by journey/controller.js through the refs.
import { pad2, canVisit } from '../lib/site.js';

export function TopBar({ person, count, onHome, onAll }) {
  return (
    <header className="top">
      <button className="brand" type="button" id="homeBtn" aria-label="Back to the start" onClick={onHome}>
        <strong>{person.name}</strong>
        <span>{person.role}</span>
      </button>
      <div className="top-r">
        <button className="link" type="button" id="allBtn" onClick={onAll}>All <span>{count}</span></button>
        <a className="pill" id="msgBtn" href={'mailto:' + person.email}>Message me</a>
      </div>
    </header>
  );
}

export function Intro({ person, count, ref }) {
  return (
    <section className="intro" id="intro" aria-hidden="true" ref={ref}>
      <h1>{person.name.split(' ').map((w, i) => <span key={i}>{w}</span>)}</h1>
      <p className="role">{person.role}</p>
      <p className="hint"><i></i>Scroll to travel through <b>{count}</b> websites</p>
    </section>
  );
}

// site: -2 nothing yet, -1 the contact wall, 0..N-1 a site
export function Caption({ site, sites, person, catLabel, onOpen, ref, nameRef }) {
  const N = sites.length;
  let num = '', cat = '', tag = false, status = null, name = '', line = '', visit = null, open = true;
  if (site === -1) {
    cat = 'Contact'; line = person.contact + '. ' + person.email;
    visit = { label: 'Message me', href: 'mailto:' + person.email }; open = false;
  } else if (site >= 0) {
    const s = sites[site];
    num = pad2(site + 1) + ' / ' + N; cat = catLabel[s.cat]; tag = !!s.concept;
    status = s.concept || !s.status ? null : s.status;
    name = s.name; line = s.line;
    visit = canVisit(s) ? { label: 'Visit', href: s.url, target: '_blank' } : null;
  }
  return (
    <section className="cap" id="cap" aria-live="polite" ref={ref}>
      <div className="cap-main">
        <p className="cap-meta">
          <span className="num" id="capNum">{num}</span>
          <span id="capCat">{cat}</span>
          <span className="tag" id="capTag" hidden={!tag}>Concept</span>
          <span className="st" id="capStatus" hidden={site >= -1 && !status}>{status || ''}</span>
        </p>
        <h2 id="capName" ref={nameRef}>{name}</h2>
        <p className="cap-line" id="capLine">{line}</p>
      </div>
      <div className="cap-act">
        <a className="btn solid" id="capVisit" hidden={site >= -1 && !visit} href={visit ? visit.href : undefined} target={visit && visit.target} rel="noopener">{visit ? visit.label : 'Visit'}</a>
        <button className="btn" type="button" id="capOpen" hidden={!open} onClick={() => site >= 0 && onOpen(site)}>Open</button>
      </div>
    </section>
  );
}

export function Foot({ titles, world, playing, onPlay, onWorld, railRefs }) {
  return (
    <nav className="foot" id="foot" aria-label="Chapters">
      <button className="play" type="button" id="playBtn" aria-pressed={playing ? 'true' : 'false'} onClick={onPlay}><i></i><span>{playing ? 'Pause' : 'Play'}</span></button>
      <ol className="rail" id="rail">
        {titles.map((t, i) => (
          <li key={i} className={i === world ? 'on' : undefined}>
            <button type="button" data-w={i} aria-label={`Chapter ${i + 1}: ${t}`} ref={(el) => { railRefs.current[i] = el; }} onClick={() => onWorld(i)}>
              <span><b>{pad2(i + 1)}</b>{t}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
