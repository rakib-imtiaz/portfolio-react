// The world sets. A set draws the look of one world: its ground, its type, its light. The engine builds a set one world ahead
// and disposes it when the story is two worlds past.
import { flatSets } from './flat.js';
import { flySet } from './fly.js';
import { indexSet } from './index.js';
import { globeSet } from './globe.js';
import { spiralSet } from './spiral.js';
import { filmSet } from './film.js';
import { dustSet } from './dust.js';
import { hallSet } from './hall.js';

export function makeSets(story, { flat = false } = {}) {
  const f = flatSets(story);
  if (flat) return f;
  const real = { fly: flySet(story), index: indexSet(story), globe: globeSet(story), spiral: spiralSet(story), film: filmSet(story), dust: dustSet(story), hall: hallSet(story) };
  const out = {};
  for (const k of Object.keys(real)) { const fac = real[k] || f[k]; if (fac) out[k] = fac; }
  return out;
}
