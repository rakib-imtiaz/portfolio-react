import React, { useEffect, useRef, useState } from "react";

const FINE = typeof window !== "undefined" && matchMedia("(pointer:fine)").matches;
const REDUCE = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- CountUp — eased odometer, fires when scrolled into view ---------- */
export function CountUp({ end, suffix = "", duration = 1400 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(REDUCE ? end : 0);

  useEffect(() => {
    if (REDUCE) return;
    const el = ref.current;
    if (!el) return;
    let raf;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / duration);
          const e = 1 - Math.pow(1 - p, 3);
          setVal(Math.round(end * e));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [end, duration]);

  return (
    <span ref={ref}>
      {val}
      {suffix && <i>{suffix}</i>}
    </span>
  );
}

/* ---------- DecryptText — cipher scramble that resolves left→right ---------- */
const CIPHER = "!<>-_\\/[]{}—=+*^?#$%&@";
export function DecryptText({ text, className = "", speed = 34, delay = 0, as: Tag = "span" }) {
  const ref = useRef(null);
  const [out, setOut] = useState(REDUCE ? text : "");

  useEffect(() => {
    if (REDUCE) return;
    const el = ref.current;
    if (!el) return;
    let timer, startT;
    const scramble = () => {
      let locked = 0;
      timer = setInterval(() => {
        locked += 1 + Math.floor(text.length / 26);
        if (locked >= text.length) {
          setOut(text);
          clearInterval(timer);
          return;
        }
        let s = text.slice(0, locked);
        for (let i = locked; i < text.length; i++) {
          const c = text[i];
          s += c === " " ? " " : CIPHER[Math.floor(Math.random() * CIPHER.length)];
        }
        setOut(s);
      }, speed);
    };
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        startT = setTimeout(scramble, delay);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); clearTimeout(startT); };
  }, [text, speed, delay]);

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {out || " "}
    </Tag>
  );
}

/* ---------- MaskReveal — each child line wipes up from a clipped mask ---------- */
export function MaskReveal({ children, stagger = 90, as: Tag = "div", className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0].isIntersecting) return;
        el.classList.add("mr-in");
        io.disconnect();
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const items = React.Children.toArray(children);
  return (
    <Tag ref={ref} className={`mask-reveal ${className}`}>
      {items.map((c, i) => (
        <span className="mr-line" key={i}>
          <span className="mr-inner" style={{ transitionDelay: `${i * stagger}ms` }}>
            {c}
          </span>
        </span>
      ))}
    </Tag>
  );
}

/* ---------- Tilt — 3D pointer tilt + glare sheen (ported from Edition I) ---------- */
export function Tilt({ children, max = 7, className = "", glare = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!FINE || REDUCE) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let rx = 0, ry = 0, mx = 50, my = 50;

    const move = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      ry = (px - 0.5) * 2 * max;
      rx = -(py - 0.5) * 2 * max;
      mx = px * 100;
      my = py * 100;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const apply = () => {
      raf = 0;
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      el.style.setProperty("--mx", mx + "%");
      el.style.setProperty("--my", my + "%");
    };
    const leave = () => {
      cancelAnimationFrame(raf); raf = 0;
      el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [max]);

  return (
    <div ref={ref} className={`tilt3d ${glare ? "glare" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ---------- Magnet — buttons lean toward the cursor ---------- */
export function Magnet({ children, strength = 0.32 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!FINE || REDUCE) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0, tx = 0, ty = 0;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * strength;
      ty = (e.clientY - (r.top + r.height / 2)) * strength;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const apply = () => {
      raf = 0;
      el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    };
    const leave = () => {
      cancelAnimationFrame(raf); raf = 0;
      el.style.transform = "translate(0,0)";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [strength]);
  return (
    <span ref={ref} className="magnet">
      {children}
    </span>
  );
}

/* ---------- ParallaxMark — the giant page number drifts on scroll ---------- */
export function ParallaxMark({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (REDUCE) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.transform = `translateY(${window.scrollY * 0.22}px)`;
      });
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={ref} className="pg-mark" aria-hidden="true">
      {children}
    </div>
  );
}
