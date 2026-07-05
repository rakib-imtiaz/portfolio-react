import React from "react";
import { IntroGate, Plate, Reveal, NextPage, Footer } from "../components";
import { DecryptText, ParallaxMark } from "../fx";
import { PROFILE } from "../data";

export default function Contact() {
  return (
    <>
      <IntroGate src="/intros/Intro-Contact.mp4" />

      <header className="hero" style={{ minHeight: "60vh" }}>
        <ParallaxMark>05</ParallaxMark>
        <div className="wrap">
          <div className="kick">
            <DecryptText text="GET IN TOUCH — AVAILABLE FOR PROJECTS" />
          </div>
          <div className="big-mail">
            <a href={"mailto:" + PROFILE.email}>
              <DecryptText text="Let's build" />
            </a>
            <a href={"mailto:" + PROFILE.email}>
              <DecryptText text="something " delay={160} />
              <DecryptText as="em" text="real." delay={320} />
              {" ↗"}
            </a>
          </div>
        </div>
      </header>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Plate lb="01" pl="Details" />
          <div className="about-grid">
            <div>
              <Reveal>
                <p className="statement">
                  Have a product to ship, a store to rebuild, or a system that
                  needs a backbone? <em>Email me</em> — I answer fast, and I ship faster.
                </p>
              </Reveal>
              <Reveal delay={100}>
                <div className="c-meta">
                  <div className="cm">
                    <span>Email</span>
                    <a href={"mailto:" + PROFILE.email}>{PROFILE.email}</a>
                  </div>
                  <div className="cm">
                    <span>GitHub</span>
                    <a href={PROFILE.github} target="_blank" rel="noopener noreferrer">
                      {PROFILE.githubLabel}
                    </a>
                  </div>
                  <div className="cm">
                    <span>Role</span>
                    {PROFILE.role}
                  </div>
                  <div className="cm">
                    <span>Status</span>
                    Available for projects
                  </div>
                </div>
              </Reveal>
              <Reveal delay={180}>
                <div style={{ marginTop: "2rem" }}>
                  <a className="btn red" href={"mailto:" + PROFILE.email}>Start an email →</a>
                </div>
              </Reveal>
            </div>
            <Reveal delay={150}>
              <figure className="portrait photo-hover">
                <img src="/assets/me/v3-wc-portrait.webp" alt="Mohammad Noman" loading="lazy" />
                <figcaption>{PROFILE.name} · {PROFILE.role}</figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      <NextPage to="/" label="Back to Start" />
      <Footer />
    </>
  );
}
