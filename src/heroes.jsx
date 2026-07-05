import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { ThemeCtx } from "./components";
import { Reveal } from "./components";
import { DecryptText, MaskReveal, ParallaxMark } from "./fx";
import { GlitchText, RotatingText, ShuffleText } from "./textfx";
import { THEMES } from "./themes";

/* Per-family headline voice — the words + the animation change with the
   design language. glow rotates a keyword, swiss/mono glitch, serif/soft shuffle. */
const VOICE = {
  swiss:   { l1: <>Build. <em>Ship.</em></>, l2: <GlitchText text="Verify." /> },
  soft:    { l1: <>Design-minded</>, l2: <><ShuffleText text="full-stack" /> builds.</> },
  glow:    { l1: <>I build digital</>, l2: <RotatingText words={["experiences.", "products.", "platforms.", "interfaces."]} /> },
  serif:   { l1: <>Code. Craft.</>, l2: <ShuffleText text="Create impact." /> },
  mono:    { l1: <>BUILD. SHIP.</>, l2: <GlitchText text="VERIFY." /> },
  collage: { l1: <>Ideas, taped</>, l2: <><em>together</em> well.</> },
};

const SUB =
  "Full-stack developer crafting fast, accessible web applications — from AI platforms and multi-brand Next.js suites to pixel-perfect Shopify storefronts and PHP admin systems.";

const Kick = () => (
  <div className="kick"><DecryptText text="MOHAMMAD NOMAN — FULL-STACK DEVELOPER" /></div>
);

const Ctas = ({ center }) => (
  <div className="cta-row" style={center ? { justifyContent: "center" } : undefined}>
    <Link className="btn red" to="/work">View my work →</Link>
    <Link className="btn" to="/contact">Get in touch</Link>
  </div>
);

const H1 = ({ fam }) => (
  <MaskReveal as="h1">
    <span>{VOICE[fam].l1}</span>
    <span>{VOICE[fam].l2}</span>
  </MaskReveal>
);

/* ---------- SPLIT: semi-blurred photo bleeds behind, copy on the side ---------- */
const SplitHero = ({ ed }) => (
  <header className="hero hv-split">
    <img className="hv-split-bg" src={ed.img} alt="" aria-hidden="true" />
    <div className="hv-split-scrim" aria-hidden="true" />
    <ParallaxMark>01</ParallaxMark>
    <div className="wrap hv-split-in">
      <div className="hv-split-copy">
        <Kick />
        <H1 fam={ed.family} />
        <Reveal delay={240}><p className="sub">{SUB}</p></Reveal>
        <Reveal delay={320}>
          <div className="hero-foot"><Ctas /></div>
        </Reveal>
        <Reveal delay={400}>
          <span className="hv-split-tag">Mohammad Noman · Full-Stack</span>
        </Reveal>
      </div>
    </div>
  </header>
);

/* ---------- POSTER: brutalist asymmetric photo block + stacked type ---------- */
const PosterHero = ({ ed }) => (
  <header className="hero hv-poster">
    <div className="wrap hv-poster-in">
      <Reveal delay={120}>
        <div className="hv-block">
          <div className="hv-bar" />
          <img src={ed.img} alt="Mohammad Noman" />
        </div>
      </Reveal>
      <div>
        <Kick />
        <H1 fam={ed.family} />
        <Reveal delay={240}><p className="sub">{SUB}</p></Reveal>
        <Reveal delay={320}><div className="hero-foot"><Ctas /></div></Reveal>
      </div>
    </div>
  </header>
);

/* ---------- CENTER: stacked, avatar chip, glow behind ---------- */
const CenterHero = ({ ed }) => (
  <header className="hero hv-center">
    <div className="hv-glow" aria-hidden="true" />
    <div className="wrap hv-center-in">
      {ed.img && (
        <Reveal><img className="hv-avatar" src={ed.img} alt="Mohammad Noman" /></Reveal>
      )}
      <Kick />
      <H1 fam={ed.family} />
      <Reveal delay={240}><p className="sub" style={{ marginInline: "auto" }}>{SUB}</p></Reveal>
      <Reveal delay={320}><Ctas center /></Reveal>
    </div>
  </header>
);

/* ---------- EDITORIAL: serif spread with rules + side portrait ---------- */
const EditorialHero = ({ ed }) => (
  <header className="hero hv-editorial">
    <div className="wrap">
      <Reveal><div className="hv-rule" /></Reveal>
      <div className="hv-ed-grid">
        <div>
          <Kick />
          <H1 fam={ed.family} />
          <Reveal delay={240}><p className="sub hv-ed-sub">{SUB}</p></Reveal>
          <Reveal delay={320}><div className="hero-foot"><Ctas /></div></Reveal>
        </div>
        <Reveal delay={200}>
          <figure className="hv-ed-photo">
            <img src={ed.img} alt="Mohammad Noman" />
            <figcaption>fig. 01 — the developer</figcaption>
          </figure>
        </Reveal>
      </div>
      <Reveal delay={140}><div className="hv-rule" /></Reveal>
    </div>
  </header>
);

/* ---------- CONSOLE: terminal window types itself ---------- */
const ConsoleHero = ({ ed }) => (
  <header className="hero hv-console">
    <div className="wrap">
      <Kick />
      <H1 fam={ed.family} />
      <Reveal delay={220}>
        <div className="hv-term">
          <div className="hv-term-bar"><i /><i /><i /><span>noman@portfolio — zsh</span></div>
          <div className="hv-term-body">
            <p><b>$</b> whoami</p>
            <p>mohammad-noman · full-stack developer</p>
            <p><b>$</b> ls ./skills</p>
            <p>next.js react typescript shopify-liquid php mysql python</p>
            <p><b>$</b> cat stats.txt</p>
            <p>70+ repos · 750+ shopify sections · 4 systems · 10 stores</p>
            <p><b>$</b> ./view --work<span className="hv-cursor">█</span></p>
          </div>
        </div>
      </Reveal>
      <Reveal delay={320}><div className="hero-foot" style={{ marginTop: "1.8rem" }}><Ctas /></div></Reveal>
    </div>
  </header>
);

/* ---------- BLEED: full-viewport photo, copy pinned low ---------- */
const BleedHero = ({ ed }) => (
  <header className="hero hv-bleed">
    <img className="hv-bg" src={ed.img} alt="" aria-hidden="true" />
    <div className="hv-scrim" aria-hidden="true" />
    <div className="wrap hv-bleed-in">
      <Kick />
      <H1 fam={ed.family} />
      <Reveal delay={240}><p className="sub">{SUB}</p></Reveal>
      <Reveal delay={320}><div className="hero-foot"><Ctas /></div></Reveal>
    </div>
  </header>
);

/* ---------- SHOWCASE: copy center, floating real project shots ---------- */
const SHOTS = [
  { img: "/assets/shots/sequoia-security.webp", cls: "s1", label: "Sequoia Security" },
  { img: "/assets/shots/crystal.webp", cls: "s2", label: "Crystal Empire" },
  { img: "/assets/shots/ca89.webp", cls: "s3", label: "CA89" },
  { img: "/assets/shots/quickride.webp", cls: "s4", label: "QuickRide" },
];
const ShowcaseHero = ({ ed }) => (
  <header className="hero hv-showcase">
    {SHOTS.map((s) => (
      <div key={s.cls} className={"hv-shot " + s.cls}>
        <figure>
          <img src={s.img} alt={s.label} loading="lazy" />
          <figcaption>{s.label}</figcaption>
        </figure>
      </div>
    ))}
    <div className="wrap hv-center-in">
      <Kick />
      <H1 fam={ed.family} />
      <Reveal delay={240}>
        <p className="sub" style={{ marginInline: "auto" }}>
          Every screenshot floating here is a real capture of shipped work.
        </p>
      </Reveal>
      <Reveal delay={320}><Ctas center /></Reveal>
    </div>
  </header>
);

const HEROES = {
  split: SplitHero,
  poster: PosterHero,
  center: CenterHero,
  editorial: EditorialHero,
  console: ConsoleHero,
  bleed: BleedHero,
  showcase: ShowcaseHero,
};

export function HomeHero() {
  const { themeIndex } = useContext(ThemeCtx);
  const ed = THEMES[themeIndex];
  const Hero = HEROES[ed.hero] || SplitHero;
  // key forces remount per edition so reveals & decrypt replay
  return <Hero key={ed.id} ed={ed} />;
}
