import React, { useEffect, useRef, useState } from "react";

const REDUCE =
  typeof window !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================================================
   Text effects used across the hero headlines.
   - GlitchText   : RGB-split glitch (swiss / mono editions)
   - RotatingText : cycles a keyword + its colour (glow editions)
   - ShuffleText  : letters shuffle into place (serif / soft editions)
   Dependency-free so the bundle stays light.
   ============================================================ */

/* ---------- GlitchText ---------- */
export function GlitchText({ text, className = "" }) {
  return (
    <span className={"glitch " + className} data-text={text} aria-label={text}>
      {text}
    </span>
  );
}

/* ---------- RotatingText — swaps word + colour on a timer ---------- */
export function RotatingText({ words, interval = 2200, className = "" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (REDUCE || words.length < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [words, interval]);
  const palette = ["var(--acc)", "var(--acc2)", "var(--acc)"];
  return (
    <span className={"rot-text " + className} aria-label={words[0]}>
      <span className="rot-inner" key={i} style={{ color: palette[i % palette.length] }}>
        {words[i]}
      </span>
    </span>
  );
}

/* ---------- ShuffleText — glyph shuffle that settles L→R ---------- */
const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#%&$*";
export function ShuffleText({ text, className = "" }) {
  const ref = useRef(null);
  const [out, setOut] = useState(REDUCE ? text : "");

  useEffect(() => {
    if (REDUCE) return;
    const el = ref.current;
    if (!el) return;
    const chars = [...text];
    let timer;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        let frame = 0;
        const total = 26;
        timer = setInterval(() => {
          frame += 1;
          const revealPer = (total - 8) / Math.max(1, chars.length);
          const s = chars
            .map((c, idx) => {
              if (c === " ") return " ";
              const revealAt = 5 + idx * revealPer;
              return frame >= revealAt
                ? c
                : POOL[Math.floor(Math.random() * POOL.length)];
            })
            .join("");
          setOut(s);
          if (frame >= total) {
            setOut(text);
            clearInterval(timer);
          }
        }, 40);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); };
  }, [text]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      {out || " "}
    </span>
  );
}
