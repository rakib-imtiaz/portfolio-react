import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { PROFILE } from "./data";
import { THEMES } from "./themes";

export const ThemeCtx = createContext({ themeIndex: 0, cycleTheme: () => {}, setTheme: () => {} });

/* ---------- IntroGate: full-screen opening film per page ----------
   Plays ONCE per page per session (revisits skip straight to content).
   Portrait devices get the 9:16 edition of the film. */
export function IntroGate({ src }) {
  const seenKey = "intro-seen:" + src;
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(() => {
    try { return !!sessionStorage.getItem(seenKey); } catch { return false; }
  });
  const vidRef = useRef(null);

  // pick the portrait (-M) edition when the screen is taller than wide
  const [finalSrc] = useState(() =>
    typeof window !== "undefined" && window.innerHeight > window.innerWidth
      ? src.replace(".mp4", "-M.mp4")
      : src
  );

  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => setGone(true), 750);
  };

  useEffect(() => {
    // mark seen as soon as the film starts — a page only ever intros once per session
    if (!gone) { try { sessionStorage.setItem(seenKey, "1"); } catch { /* private mode */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.style.overflow = gone ? "" : "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [gone]);

  useEffect(() => {
    if (gone) return;
    // if the film can't start quickly (slow network), don't block the page
    const slowStart = setTimeout(() => {
      const v = vidRef.current;
      if (!v || v.readyState < 2 || v.paused) dismiss();
    }, 2500);
    // hard failsafe: never trap the visitor
    const hard = setTimeout(dismiss, 10000);
    return () => { clearTimeout(slowStart); clearTimeout(hard); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;
  return (
    <div className={"intro-gate" + (leaving ? " leaving" : "")}>
      <video
        ref={vidRef}
        src={finalSrc}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        onPlay={(e) => { e.currentTarget.playbackRate = 1.15; }}
      />
      <button className="intro-skip" onClick={dismiss}>Skip intro →</button>
    </div>
  );
}

/* ---------- Nav ---------- */
const LINKS = [
  { to: "/", label: "Home", num: "01" },
  { to: "/work", label: "Work", num: "02" },
  { to: "/shopify", label: "Shopify", num: "03" },
  { to: "/systems", label: "Systems", num: "04" },
  { to: "/contact", label: "Contact", num: "05" },
];

export function Nav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 30);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <>
      <nav className={"site" + (stuck ? " stuck" : "")}>
        <Link className="brand" to="/">
          <span className="bx">MN</span>
          <span>
            Mohammad Noman
            <small>Full-Stack Developer</small>
          </span>
        </Link>
        <div className="nlinks">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <ThemeControls />
          <a className="gh-btn" href={PROFILE.github} target="_blank" rel="noopener noreferrer">
            <svg className="gh-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub
          </a>
          <button className="nav-burger" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </nav>
      {open && (
        <div className="mobile-menu">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
              <span>{l.num}</span>
            </NavLink>
          ))}
          <a href={PROFILE.github} target="_blank" rel="noopener noreferrer">
            GitHub
            <span>↗</span>
          </a>
        </div>
      )}
    </>
  );
}

/* ---------- ThemeControls — glass picker + AUTO cycler ---------- */
function ThemeControls() {
  const { themeIndex, cycleTheme, setTheme } = useContext(ThemeCtx);
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(false);
  const ref = useRef(null);
  const t = THEMES[themeIndex];

  // close popover on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // AUTO: cycle editions on an interval while enabled
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(cycleTheme, 3200);
    return () => clearInterval(id);
  }, [auto, cycleTheme]);

  return (
    <div className="theme-ctl" ref={ref}>
      <button
        className={"glass-pill sw-pick" + (open ? " open" : "")}
        onClick={() => setOpen((o) => !o)}
        title={`Design: ${t.name} — click to choose`}
        aria-label={`Choose design edition (current: ${t.name})`}
        aria-expanded={open}
      >
        <span className="dot on" style={{ background: t.vars["--acc"] }} />
        <span className="sw-name">{t.name}</span>
        <span className="sw-caret" aria-hidden="true">▾</span>
      </button>

      <button
        className={"glass-pill auto-btn" + (auto ? " on" : "")}
        onClick={() => setAuto((a) => !a)}
        title={auto ? "Stop auto-cycling designs" : "Auto-cycle through designs"}
        aria-pressed={auto}
      >
        AUTO {auto ? "ON" : "OFF"}
      </button>

      {open && (
        <div className="glass-pop theme-pop" role="menu">
          <div className="pop-head">Design editions · {THEMES.length}</div>
          <div className="pop-grid">
            {THEMES.map((th, i) => (
              <button
                key={th.id}
                className={"pop-item" + (i === themeIndex ? " active" : "")}
                onClick={() => { setTheme(i); setOpen(false); }}
                role="menuitem"
                title={th.name}
              >
                <span className="dot" style={{ background: th.vars["--acc"] }} />
                <span className="pi-name">{th.name}</span>
                <span className="pi-num">{String(i + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Reveal-on-scroll ---------- */
export function Reveal({ children, as: Tag = "div", className = "", delay = 0, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => el.classList.add("in"), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return (
    <Tag ref={ref} className={`rv ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/* ---------- Section plate ---------- */
export function Plate({ lb, pl }) {
  return (
    <Reveal className="plate">
      <span className="lb">{lb}</span>
      <span className="pl">{pl}</span>
    </Reveal>
  );
}

/* ---------- Next page banner ---------- */
export function NextPage({ to, label }) {
  return (
    <Link className="next-page" to={to}>
      <div className="wrap">
        <div className="np-k">Next page</div>
        <div className="np-t">
          {label} <span className="arr">→</span>
        </div>
      </div>
    </Link>
  );
}

/* ---------- Footer ---------- */
export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <span>© 2026 {PROFILE.name} — Built with React + Remotion intros</span>
        <span>
          <a href={"mailto:" + PROFILE.email}>{PROFILE.email}</a>
          {" · "}
          <a href={PROFILE.github} target="_blank" rel="noopener noreferrer">{PROFILE.githubLabel}</a>
        </span>
      </div>
    </footer>
  );
}

/* ---------- ScrollToTop on route change ---------- */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
