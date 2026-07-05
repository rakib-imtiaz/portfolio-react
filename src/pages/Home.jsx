import React from "react";
import { IntroGate, Plate, Reveal, NextPage, Footer } from "../components";
import { CountUp, MaskReveal } from "../fx";
import { HomeHero } from "../heroes";
import { PROFILE, APPROACH } from "../data";

const MARQ = [
  { logo: "nextdotjs", label: "Next.js" },
  { logo: "react", label: "React" },
  { logo: "typescript", label: "TypeScript" },
  { logo: "shopify", label: "Shopify" },
  { logo: "php", label: "PHP" },
  { logo: "mysql", label: "MySQL" },
  { logo: "python", label: "Python" },
  { logo: "playwright", label: "Playwright" },
  { label: "Available for projects" },
];

export default function Home() {
  return (
    <>
      <IntroGate src="/intros/Intro-Home.mp4" />

      <HomeHero />

      <div className="marq" aria-hidden="true">
        <div className="marq-track">
          {[...MARQ, ...MARQ].map((m, i) => (
            <span className="marq-item" key={i}>
              {m.logo && (
                <i
                  className="logo-ico"
                  style={{
                    WebkitMaskImage: `url(/assets/logos/${m.logo}.svg)`,
                    maskImage: `url(/assets/logos/${m.logo}.svg)`,
                  }}
                  aria-hidden="true"
                />
              )}
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <section className="blk">
        <div className="wrap">
          <Plate lb="01" pl="Proof of work" />
          <Reveal className="stats">
            <div className="stat"><b><CountUp end={70} suffix="+" /></b><span className="sl">Public repositories</span></div>
            <div className="stat"><b><CountUp end={10} /></b><span className="sl">Live Shopify stores</span></div>
            <div className="stat"><b><CountUp end={750} suffix="+" /></b><span className="sl">Custom sections shipped</span></div>
            <div className="stat"><b><CountUp end={4} /></b><span className="sl">Management systems</span></div>
          </Reveal>
        </div>
      </section>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Plate lb="02" pl="The person behind the work" />
          <div className="about-grid">
            <div>
              <Reveal>
                <p className="statement">
                  {PROFILE.blurb.split("—")[0]}— <em>real clients, real deployments</em>, across BC, Kuwait and beyond.
                </p>
              </Reveal>
              <Reveal delay={120}>
                <div className="tags">
                  {["Full-stack", "AI / ML", "Next.js · React", "Shopify Liquid", "PHP · MySQL", "Flutter", "Playwright QA"].map((t) => (
                    <span className="chip" key={t}>{t}</span>
                  ))}
                </div>
              </Reveal>
            </div>
            <Reveal delay={150}>
              <figure className="portrait photo-hover">
                <img src="/assets/me/v3-laptop2.webp" alt="Mohammad Noman at work" loading="lazy" />
                <figcaption>Mohammad Noman · Full-Stack Developer</figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Plate lb="03" pl="How I work" />
          <MaskReveal as="h2" className="sec-h">
            <span>Pragmatic, <em>verified</em>, shipped.</span>
          </MaskReveal>
          <div className="appr" style={{ marginTop: "2.2rem" }}>
            {APPROACH.map((a, i) => (
              <Reveal key={a.n} delay={i * 80}>
                <div className="ap ap-hover">
                  <i>{a.n}</i>
                  <h4>{a.h}</h4>
                  <p>{a.p}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <NextPage to="/work" label="The Work" />
      <Footer />
    </>
  );
}
