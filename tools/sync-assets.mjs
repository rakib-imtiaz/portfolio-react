// Fills public/ from the concepts folder (the place where the captures and the live builds are made).
// It copies only the files the site uses, and writes a public content.json with only the fields the site reads.
//   node tools/sync-assets.mjs [path to the concepts folder]      (default: ../concepts)
// It only adds and replaces files. It never deletes. Nothing here runs in the build: run it by hand when the catalogue changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(process.argv[2] || path.join(here, '..', '..', 'concepts'));
const PUB = path.join(here, '..', 'public');
const src = (p) => path.join(SRC, p);
let bytes = 0, files = 0;
function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to); bytes += fs.statSync(to).size; files++;
}
function copyDir(from, to) { for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name), b = path.join(to, e.name); if (e.isDirectory()) copyDir(a, b); else copy(a, b); } }
// width and height of a JPEG, from its frame header
function jpegSize(file) {
  const b = fs.readFileSync(file); let i = 2;
  while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2); }
  return {};
}

const content = JSON.parse(fs.readFileSync(src('_shared/content.json'), 'utf8'));
// The towns the globe may pin. A site keeps only the names of its towns; the rest of the client note stays private.
const TOWNS = ['Kamloops', 'Coquitlam', 'Nevada City', 'Tahoe City', 'Truckee'];
// The portrait frames of the hall show the phone capture of these sites (see src/journey/plan.js, the "P" pieces of rooms 1 and 2).
const PHONE_HERO = new Set(['sequoia-wildfire', 'underhill', 'sequoia-services']);

const sites = content.sites.map((s) => {
  const dir = `/media/${s.id}/`, m = s.media;
  const put = (p) => { const name = path.basename(p); copy(src(p), path.join(PUB, 'media', s.id, name)); return dir + name; };
  const sized = (v) => { const p = typeof v === 'string' ? v : v.src, url = put(p); const dim = typeof v === 'string' || !v.w ? jpegSize(src(p)) : { w: v.w, h: v.h }; return { src: url, ...dim }; };
  const media = { thumb: put(m.thumb), hero: put(m.hero), full: sized(m.full) };
  if (m.fullMobile) media.fullMobile = sized(m.fullMobile);
  if (m.heroMobile && PHONE_HERO.has(s.id)) media.heroMobile = put(m.heroMobile);
  const out = { id: s.id, name: s.name, cat: s.cat, catLabel: s.catLabel, line: s.line, is3d: !!s.is3d, concept: !!s.concept, status: s.status || null, accent: s.accent,
    url: s.url && s.status !== 'Private staging' ? s.url : null, media };
  const towns = TOWNS.filter((t) => s.client && new RegExp('\\b' + t + '\\b', 'i').test(s.client));
  if (towns.length) out.client = towns.join(', ');
  if (s.liveLocal) { const id = path.basename(path.dirname(s.liveLocal)); copyDir(src(path.dirname(s.liveLocal)), path.join(PUB, 'live', id)); out.liveLocal = `/live/${id}/index.html`; }
  return out;
});
const person = { name: content.person.name, role: content.person.role, email: content.person.email, contact: content.person.contact };
fs.writeFileSync(path.join(PUB, 'content.json'), JSON.stringify({ person, categories: content.categories, sites }));

copy(src('11-journey/data/earth.png'), path.join(PUB, 'data', 'earth.png'));
copy(src('11-journey/data/lightmap.png'), path.join(PUB, 'data', 'lightmap.png'));
copy(src('11-journey/data/lightmap.json'), path.join(PUB, 'data', 'lightmap.json'));
copy(src('_shared/models/drone.glb'), path.join(PUB, 'models', 'drone.glb'));
for (const f of ['MonaSansMono.woff2', 'MonaSans.woff2', 'LICENSE.txt']) copy(src('_shared/fonts/mona-sans/' + f), path.join(PUB, 'fonts', f));

console.log(`public/: ${files} files, ${(bytes / 1048576).toFixed(1)} MB, ${sites.length} sites`);
