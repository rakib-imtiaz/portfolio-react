import React from "react";
import { IntroGate, Plate, Reveal, NextPage, Footer } from "../components";
import { DecryptText, MaskReveal, Tilt, ParallaxMark } from "../fx";
import { BUILDS, SEQUOIA, MORE } from "../data";

export default function Work() {
  return (
    <>
      <IntroGate src="/intros/Intro-Work.mp4" />

      <header className="hero" style={{ minHeight: "72vh" }}>
        <ParallaxMark>02</ParallaxMark>
        <div className="wrap">
          <div className="kick">
            <DecryptText text="SELECTED PROJECTS — AI, WEB APPS & TOOLING" />
          </div>
          <MaskReveal as="h1">
            <span>Software,</span>
            <em>end to end.</em>
          </MaskReveal>
          <Reveal delay={220}>
            <p className="sub">
              Flagship products — AI platforms, production web apps, applied
              research and tooling. Live screenshots where deployed; every one
              links to its repo.
            </p>
          </Reveal>
        </div>
      </header>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Plate lb="01" pl="Featured builds" />
          <div className="builds">
            {BUILDS.map((b, i) => (
              <Reveal className="build" key={b.n}>
                <Tilt className="b-vwrap" max={5}>
                  <div className="b-visual">
                    <span className="badge">{b.badge}</span>
                    {b.img ? (
                      <img src={b.img} alt={`${b.n} screenshot`} loading="lazy" />
                    ) : (
                      <div className="b-cover">
                        <div className="big">{b.n}</div>
                        <div className="lang">{b.lang}</div>
                      </div>
                    )}
                  </div>
                </Tilt>
                <div className="b-text">
                  <div className="b-num">
                    {String(i + 1).padStart(2, "0")} / {String(BUILDS.length).padStart(2, "0")}
                  </div>
                  <h3>{b.n}</h3>
                  <div className="b-role">{b.role}</div>
                  <p>{b.desc}</p>
                  <div className="b-stack">
                    {b.stack.map((s) => (
                      <span className="chip" key={s}>{s}</span>
                    ))}
                  </div>
                  <div className="b-links">
                    {b.live && (
                      <a className="b-link solid" href={b.live} target="_blank" rel="noopener noreferrer">
                        Live site ↗
                      </a>
                    )}
                    <a className="b-link" href={b.repo} target="_blank" rel="noopener noreferrer">
                      View repository ↗
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Plate lb="02" pl="Case study · Multi-brand suite" />
          <Reveal className="seq">
            <div className="tag"><i />The Sequoia Group</div>
            <h3>
              Four products, <em>one operator.</em>
            </h3>
            <p>{SEQUOIA.desc}</p>
            <div className="seq-thumbs">
              {SEQUOIA.thumbs.map((t) => (
                <Tilt key={t.alt} max={8}>
                  <div className="st">
                    <img src={t.img} alt={t.alt} loading="lazy" />
                  </div>
                </Tilt>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Plate lb="03" pl="More on GitHub" />
          <MaskReveal as="h2" className="sec-h">
            <span>Selected <em>other</em> projects.</span>
          </MaskReveal>
          <div style={{ marginTop: "2rem" }}>
            {MORE.map((m, i) => (
              <Reveal
                as="a"
                className="mrow"
                key={m.n}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                delay={i * 40}
              >
                <div className="mnum">{String(i + 1).padStart(2, "0")}</div>
                <div className="mname">
                  {m.n}
                  <span>{m.t}</span>
                </div>
                <div className="mstack">
                  {m.stack.map((s) => (
                    <span className="chip" key={s}>{s}</span>
                  ))}
                </div>
                <div className="mlink">Repo ↗</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <NextPage to="/shopify" label="Shopify Stores" />
      <Footer />
    </>
  );
}
