import React from "react";
import { IntroGate, Plate, Reveal, NextPage, Footer } from "../components";
import { DecryptText, MaskReveal, Tilt, ParallaxMark } from "../fx";
import { SYSTEMS } from "../data";

export default function Systems() {
  return (
    <>
      <IntroGate src="/intros/Intro-Systems.mp4" />

      <header className="hero" style={{ minHeight: "72vh" }}>
        <ParallaxMark>04</ParallaxMark>
        <div className="wrap">
          <div className="kick">
            <DecryptText text="MANAGEMENT SYSTEMS · PHP / MYSQL" />
          </div>
          <MaskReveal as="h1">
            <span>Full-stack</span>
            <em>systems.</em>
          </MaskReveal>
          <Reveal delay={220}>
            <p className="sub">
              End-to-end admin platforms built in PHP &amp; MySQL with PDO,
              session auth and role-based dashboards. Each screenshot is the
              real running dashboard, rendered locally from source.
            </p>
          </Reveal>
        </div>
      </header>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Plate lb="01" pl="Admin platforms" />
          <div className="gal">
            {SYSTEMS.map((s, i) => (
              <Reveal key={s.n} delay={(i % 2) * 70}>
                <Tilt max={4}>
                  <a className="shot" href={s.url} target="_blank" rel="noopener noreferrer">
                    <div className="shot-img">
                      <img src={s.img} alt={`${s.n} dashboard screenshot`} loading="lazy" />
                    </div>
                    <span className="live"><i />Source ↗</span>
                    <div className="shot-body">
                      <div>
                        <h4>{s.n}</h4>
                        <div className="t">{s.t}</div>
                      </div>
                      <div className="n">{s.meta}</div>
                    </div>
                  </a>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <NextPage to="/contact" label="Say Hello" />
      <Footer />
    </>
  );
}
