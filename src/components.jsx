import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { PROFILE } from "./data";
import { THEMES } from "./themes";

export const ThemeCtx = createContext({ themeIndex: 0, cycleTheme: () => {} });

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
          <ThemeSwitch />
          <a className="gh-btn" href={PROFILE.github} target="_blank" rel="noopener noreferrer">
            GitHub ↗
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

/* ---------- ThemeSwitch — cycles the 20 design editions ---------- */
function ThemeSwitch() {
  const { themeIndex, cycleTheme } = useContext(ThemeCtx);
  const t = THEMES[themeIndex];
  return (
    <button
      className="theme-sw"
      onClick={cycleTheme}
      title={`Edition ${themeIndex + 1}/${THEMES.length}: ${t.name} — click for next design`}
      aria-label={`Switch design edition (current: ${t.name})`}
    >
      <span className="dot on" style={{ background: t.vars["--acc"] }} />
      <span className="sw-num">{String(themeIndex + 1).padStart(2, "0")}/{THEMES.length}</span>
      <span className="sw-name">{t.name}</span>
    </button>
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
