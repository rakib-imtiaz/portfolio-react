import React from "react";
import { IntroGate, Plate, Reveal, NextPage, Footer } from "../components";
import { DecryptText, MaskReveal, Tilt, ParallaxMark } from "../fx";
import { STORES } from "../data";

export default function Shopify() {
  return (
    <>
      <IntroGate src="/intros/Intro-Shopify.mp4" />

      <header className="hero" style={{ minHeight: "72vh" }}>
        <ParallaxMark>03</ParallaxMark>
        <div className="wrap">
          <div className="kick">
            <DecryptText text="SHOPIFY STOREFRONTS — LIVE" />
          </div>
          <MaskReveal as="h1">
            <span>Stores I've</span>
            <em>shipped.</em>
          </MaskReveal>
          <Reveal delay={220}>
            <p className="sub">
              React / Bolt / Kimi prototypes rebuilt into fast, fully-editable
              Shopify Liquid themes — 750+ custom sections across 10 stores,
              each verified with automated visual QA. Every image is a real capture.
            </p>
          </Reveal>
        </div>
      </header>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Plate lb="01" pl="Storefront gallery" />
          <div className="gal">
            {STORES.map((s, i) => (
              <Reveal key={s.n} delay={(i % 2) * 70}>
                <Tilt max={4}>
                  <a className="shot" href={s.url} target="_blank" rel="noopener noreferrer">
                    <div className="shot-img">
                      <img src={s.img} alt={`${s.n} storefront screenshot`} loading="lazy" />
                    </div>
                    <span className="live"><i />Live store ↗</span>
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
          <Reveal>
            <p className="sec-sub" style={{ marginTop: "1.4rem", fontSize: "0.78rem" }}>
              ↳ Live store links open the merchant's Shopify site; some are staging
              stores behind a storefront password (12345).
            </p>
          </Reveal>
        </div>
      </section>

      <NextPage to="/systems" label="PHP Systems" />
      <Footer />
    </>
  );
}
