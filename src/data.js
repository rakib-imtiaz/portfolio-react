export const PROFILE = {
  name: "Mohammad Noman",
  role: "Full-Stack Developer",
  email: "m.noman2112@gmail.com",
  github: "https://github.com/rakib-imtiaz",
  githubLabel: "github.com/rakib-imtiaz",
  blurb:
    "I'm Mohammad Noman — a full-stack developer who ships the whole thing, not just a slice of it. From AI legal platforms and multi-brand Next.js suites to pixel-perfect Shopify storefronts and PHP admin systems — real clients, real deployments, across BC, Kuwait and beyond.",
};

export const STATS = [
  { n: "70+", l: "Public repositories" },
  { n: "10", l: "Live Shopify stores" },
  { n: "750+", l: "Custom sections shipped" },
  { n: "4", l: "Management systems" },
];

export const BUILDS = [
  {
    n: "Sequoia Security",
    role: "Next.js 16 marketing site · Live",
    img: "/assets/shots/sequoia-security.webp",
    badge: "Next.js 16 · React 19",
    desc: "A ground-up rebuild for a regional BC security operator — data-driven architecture, 11 services across two categories, JSON-LD SEO and rate-limited quote forms. The flagship of a four-product suite built for the same client.",
    stack: ["Next.js 16", "React 19", "Tailwind v4", "Framer Motion", "Zod", "Resend"],
    live: "https://sequoia-security-redesigned.vercel.app",
    repo: "https://github.com/rakib-imtiaz/sequoia_security_redesigned",
  },
  {
    n: "NomosAI",
    role: "AI Legal-Tech Platform · Lead build",
    img: null,
    badge: "Next.js 15",
    desc: "An AI platform for legal teams: case analysis with success-rate prediction, automated document generation (contracts, NDAs, petitions), a conversational research assistant with citation validation, and voice-to-text client intake with auto lawyer-assignment.",
    stack: ["Next.js 15", "TypeScript", "Tailwind", "shadcn/ui", "PostgreSQL", "Python"],
    repo: "https://github.com/rakib-imtiaz/Learningly_AI",
    lang: "TypeScript · 97%",
  },
  {
    n: "Face-VLM Research",
    role: "Applied ML research pipeline",
    img: null,
    badge: "Python · PyTorch",
    desc: "A research pipeline that extracts facial features from the LFW dataset using five vision-language models, regenerates faces from those descriptions with multiple diffusion models, and scores the results with FID — fully modular and automatable.",
    stack: ["Python", "PyTorch", "PaliGemma · LLaVA · CogVLM", "Stable Diffusion XL", "pytorch-fid"],
    repo: "https://github.com/rakib-imtiaz/face_vlm_project",
    lang: "Python",
  },
  {
    n: "QuickRide",
    role: "Taxi-booking platform · Live",
    img: "/assets/shots/quickride.webp",
    badge: "Google Maps API",
    desc: "A taxi-booking web app: pick-up & destination selection on an interactive map, vehicle-type choice and live fare estimates, powered by the Google Maps, Directions and Places APIs.",
    stack: ["JavaScript", "Bootstrap 5", "Google Maps API", "Vercel"],
    live: "https://quick-ride-rho.vercel.app",
    repo: "https://github.com/rakib-imtiaz/quick_ride",
  },
  {
    n: "Car Shades KW",
    role: "Product landing site · Live",
    img: "/assets/shots/carshades.webp",
    badge: "React · TS 88%",
    desc: "A conversion-focused landing site for a Kuwait car-parking-shade manufacturer — premium imagery, services, projects & testimonials, with a quote CTA. Built in React + TypeScript and deployed on Vercel.",
    stack: ["React", "TypeScript", "Tailwind", "Vercel"],
    live: "https://car-parking-shades-landing.vercel.app",
    repo: "https://github.com/rakib-imtiaz/car-parking-shades-landing",
  },
  {
    n: "Store Migration Toolkit",
    role: "Data-migration tooling · New",
    img: null,
    badge: "Python · Node",
    desc: "A store-migration toolkit built for real client moves: a Python scraper that pulls every blog article from a Lightspeed eCom storefront via sitemap + JSON-LD parsing (with Open Graph fallbacks), exporting both full-fidelity JSON and a Shopify/Matrixify-ready CSV.",
    stack: ["Python", "BeautifulSoup4", "lxml", "Node.js", "CSV / JSON"],
    repo: "https://github.com/rakib-imtiaz",
    lang: "Python · Node",
  },
];

export const SEQUOIA = {
  title: "Four products, one operator.",
  desc: "A connected family of web products built for a single Kamloops, BC operator: physical security, drone survey, equipment rentals and boat hire — Next.js & React front-ends with Stripe + Firebase backends, all live on Vercel.",
  thumbs: [
    { img: "/assets/shots/sequoia-security.webp", alt: "Sequoia Security" },
    { img: "/assets/shots/sequoia-drone.webp", alt: "Sequoia Drone" },
    { img: "/assets/shots/sequoia-rentals.webp", alt: "Sequoia Rentals" },
    { img: "/assets/shots/sequoia-boat.webp", alt: "Sequoia Boat" },
  ],
};

export const STORES = [
  { n: "Crystal Empire Gems", t: "Crystals & Healing Jewelry", meta: "154 sections", img: "/assets/shots/crystal.webp", url: "https://crystal-empire-gems-revamp.myshopify.com/" },
  { n: "CA89", t: "Lifestyle Apparel Brand", meta: "118 sections", img: "/assets/shots/ca89.webp", url: "https://ca-89-paid.myshopify.com/" },
  { n: "Jacqueline", t: "Fashion & Beauty", meta: "121 sections", img: "/assets/shots/jacqueline.webp", url: "https://jacqueline-94568.myshopify.com/" },
  { n: "The Retreat Spaces", t: "Wellness Retreats", meta: "50 sections", img: "/assets/shots/retreat.webp", url: "https://theretreatspaces.myshopify.com/" },
  { n: "Pinnacle Health", t: "Health & Wellness", meta: "82 sections", img: "/assets/shots/pinnacle.webp", url: "https://pinnacle-health-3.myshopify.com/" },
  { n: "Galactic Lighthouse", t: "Membership & Community", meta: "65 templates", img: "/assets/shots/gallactic.webp", url: "https://galactic-lighthouse.myshopify.com/" },
  { n: "Back to Earth", t: "Premium Organic · Youth Programs", meta: "98 sections", img: "/assets/shots/backtoearth.webp", url: "https://back-to-earth-4.myshopify.com/" },
  { n: "People of the Forest", t: "Nature-Inspired Apparel", meta: "79 sections", img: "/assets/shots/forest.webp", url: "https://people-of-the-forest-2.myshopify.com/" },
];

export const SYSTEMS = [
  { n: "Bayside Clinic Management", t: "Healthcare · appointments, records, billing", meta: "PHP · MySQL · PDO", img: "/assets/shots/clinic.webp", url: "https://github.com/rakib-imtiaz/pharmacy_management_system_new" },
  { n: "Hospital Management (HMS)", t: "Beds, patients & appointments", meta: "PHP · MySQL", img: "/assets/shots/hospital.webp", url: "https://github.com/rakib-imtiaz/pharmacy_management_system" },
  { n: "Aeronix — Aviation MS", t: "Flights, routes, aircraft & bookings", meta: "PHP · MySQL · PDO", img: "/assets/shots/aviation.webp", url: "https://github.com/rakib-imtiaz/aviation_management_system" },
  { n: "E-Commerce / Inventory", t: "Products, orders, supply chain", meta: "PHP · MySQL · Tailwind", img: "/assets/shots/ecommerce.webp", url: "https://github.com/rakib-imtiaz/Ecommerce_System_Inventory_and_Supply_Chain_Management" },
];

export const MORE = [
  { n: "LegalTech", t: "Legal services web platform", stack: ["Next.js", "TypeScript", "Tailwind"], url: "https://github.com/rakib-imtiaz/LegalTech" },
  { n: "Smart Expense Tracker", t: "Auto-categorizing expense app + analytics", stack: ["Python", "Flask", "JavaScript"], url: "https://github.com/rakib-imtiaz/smart_expense_tracker" },
  { n: "Emergency Blood Donation", t: "Donor–recipient coordination platform", stack: ["JavaScript", "Node", "Client/Server"], url: "https://github.com/rakib-imtiaz/emergency_blood_donation_management_system_new" },
  { n: "Lakeside Eco Sports", t: "Conversion-focused tour-site redesign", stack: ["HTML/CSS/JS", "Vite", "Playwright"], url: "https://github.com/rakib-imtiaz/lakesideecosports" },
  { n: "Structured Cabling Services", t: "In-suite cabling service site", stack: ["Next.js", "TypeScript", "Tailwind"], url: "https://github.com/rakib-imtiaz/In-Suite-Structured-Cabling-Services" },
  { n: "Flutter Application", t: "Cross-platform mobile app", stack: ["Flutter", "Dart", "iOS/Android"], url: "https://github.com/rakib-imtiaz/flutter_application_1" },
  { n: "Gazetteer", t: "Geographic data web app", stack: ["PHP", "JavaScript", "Maps"], url: "https://github.com/rakib-imtiaz/GAZETTEER" },
];

export const APPROACH = [
  { n: "01", h: "Understand & map", p: "Break a design, prototype or brief into a real architecture — components, sections, data and routes." },
  { n: "02", h: "Build typed & modular", p: "Clean, reusable code — editable Shopify schemas, data-driven content files, sensible abstractions." },
  { n: "03", h: "Verify visually", p: "Automated Playwright screenshots & visual diffs against the design across desktop & mobile." },
  { n: "04", h: "Ship safely", p: "Pull-first, snapshot, log & deploy only what changed — with a full audit trail to revert." },
];
