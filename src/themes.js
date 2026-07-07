// 11 DESIGN EDITIONS — ported from v3's "Twenty Ways In".
// Each edition = palette vars + a layout FAMILY (typography & section
// structure) + a HERO composition + its own photo treatment.
// family: swiss | soft | glow | serif | mono | collage
// hero:   split | poster | center | editorial | console | bleed | showcase

const FAM_SHAPES = {
  swiss:   { "--rad": "0px",    "--rbtn": "0px",    "--csh": "none" },
  soft:    { "--rad": "1.3rem", "--rbtn": "99px",   "--csh": "0 18px 60px rgba(20,18,30,0.10)" },
  glow:    { "--rad": "1rem",   "--rbtn": "0.8rem", "--csh": "0 24px 70px rgba(0,0,0,0.45)" },
  serif:   { "--rad": "0px",    "--rbtn": "99px",   "--csh": "none" },
  mono:    { "--rad": "0px",    "--rbtn": "0px",    "--csh": "none" },
  collage: { "--rad": "3px",    "--rbtn": "0px",    "--csh": "5px 6px 0 rgba(0,0,0,0.14)" },
};

const E = (id, name, family, hero, img, p) => ({
  id, name, family, hero, img,
  vars: {
    "--bg": p.bg, "--sur": p.sur, "--tx": p.tx, "--mut": p.mut,
    "--acc": p.acc, "--acc2": p.acc2 || p.acc, "--onacc": p.onacc,
    "--line": p.line,
    "--cbd": p.cbd,
    ...FAM_SHAPES[family],
  },
});

export const THEMES = [
  E("porcelain", "Porcelain", "soft", "split", "/assets/me/v3-bw.webp",
    { bg: "#f7f6fb", sur: "#ffffff", tx: "#17151f", mut: "#5f5a72", acc: "#7c6ff0", acc2: "#e0761f", onacc: "#ffffff", line: "rgba(23,21,31,.14)", cbd: "transparent" }),
  E("ember", "Ember", "glow", "editorial", "/assets/me/v3-office.webp",
    { bg: "#0d0906", sur: "#171009", tx: "#f5efe8", mut: "#c2b3a3", acc: "#ff7a2f", acc2: "#ff9d5c", onacc: "#160f08", line: "rgba(245,239,232,.13)", cbd: "rgba(255,122,47,.3)" }),
  E("neongrid", "Neon Grid", "mono", "console", null,
    { bg: "#05060f", sur: "#0b0d1e", tx: "#eef0ff", mut: "#8f9cc9", acc: "#8a4dff", acc2: "#2f7bff", onacc: "#ffffff", line: "rgba(160,170,255,.16)", cbd: "rgba(160,170,255,.35)" }),
  E("swiss", "Swiss Poster", "swiss", "poster", "/assets/me/v3-inkbw.webp",
    { bg: "#f2ede3", sur: "#faf7f0", tx: "#141414", mut: "#5c574d", acc: "#e02d1b", onacc: "#f2ede3", line: "rgba(17,17,17,.16)", cbd: "#141414" }),
  E("noir", "Noir Serif", "serif", "editorial", "/assets/me/v3-urban.webp",
    { bg: "#0a0a0a", sur: "#131313", tx: "#f4f2ee", mut: "#b5b1a6", acc: "#37d3b2", onacc: "#052019", line: "rgba(244,242,238,.14)", cbd: "rgba(244,242,238,.2)" }),
  E("gridsys", "Grid System", "swiss", "poster", "/assets/me/v3-office.webp",
    { bg: "#ececec", sur: "#f7f7f7", tx: "#141414", mut: "#616161", acc: "#e05a17", onacc: "#f7f7f7", line: "rgba(20,20,20,.18)", cbd: "#141414" }),
  E("midnight", "Midnight City", "glow", "bleed", "/assets/me/v3-urban.webp",
    { bg: "#05080f", sur: "#0a0f1c", tx: "#f2f5fb", mut: "#96a2c4", acc: "#6f8dff", acc2: "#5a6cff", onacc: "#060a12", line: "rgba(160,170,255,.14)", cbd: "rgba(160,170,255,.24)" }),
  E("cloudsoft", "Cloudsoft", "soft", "center", "/assets/me/v3-wc-portrait.webp",
    { bg: "#f3f3f8", sur: "#ffffff", tx: "#211d33", mut: "#6a6488", acc: "#6f5df0", acc2: "#ff9f74", onacc: "#ffffff", line: "rgba(33,29,51,.14)", cbd: "transparent" }),
  E("filmstrip", "Filmstrip", "mono", "poster", "/assets/me/v3-inkbw.webp",
    { bg: "#0c0c0a", sur: "#151512", tx: "#f2f2ea", mut: "#a5a596", acc: "#e8f222", onacc: "#0c0c0a", line: "rgba(242,242,234,.14)", cbd: "rgba(242,242,234,.3)" }),
  E("showcase", "Showcase", "glow", "showcase", null,
    { bg: "#0a0d18", sur: "#101528", tx: "#eef2ff", mut: "#9fb0d9", acc: "#7db1ff", acc2: "#c79bff", onacc: "#0a0d18", line: "rgba(238,242,255,.12)", cbd: "rgba(238,242,255,.22)" }),
  E("manuscript", "Manuscript", "serif", "editorial", "/assets/me/v3-wc-portrait.webp",
    { bg: "#f2ecdf", sur: "#faf6ec", tx: "#241c1e", mut: "#6a5c60", acc: "#7d4767", acc2: "#cf7f52", onacc: "#f2ecdf", line: "rgba(36,28,30,.18)", cbd: "#241c1e" }),
];

const KEY = "mn-edition";
const ALL_CLASSES = THEMES.flatMap((t) => ["d-" + t.id, "f-" + t.family, "h-" + t.hero]);

export function loadThemeIndex() {
  try {
    const id = localStorage.getItem(KEY);
    const i = THEMES.findIndex((t) => t.id === id);
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}

export function applyTheme(i) {
  const t = THEMES[i];
  const r = document.documentElement.style;
  Object.entries(t.vars).forEach(([k, v]) => r.setProperty(k, v));
  document.body.classList.remove(...ALL_CLASSES);
  document.body.classList.add("d-" + t.id, "f-" + t.family, "h-" + t.hero);
  try { localStorage.setItem(KEY, t.id); } catch { /* private mode */ }
}
