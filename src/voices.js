// THEIR SPEAKING VOICES: while a speaker's words fill a dialogue box, soft little hummed syllables play - five of them to each voice, chosen by THE WORDS (letters heavy in consonants sound low, heavy in vowels
// high, and the mouth takes the first vowel's shape), never the same one twice running.  Only someone who SPEAKS
// has a voice: a box with no name over it (a signpost, a locked door, a question, a stone that only narrates) is silent.  The sounds are made here and go out with the sound effects (so SFX volume and MUTE hold).
//
// Each syllable is a little SUNG VOWEL, not a bare oscillator: the harmonics of its pitch are weighted by the resonances of a mouth saying "ah", "oh", "oo", "eh" or "mm" (a PeriodicWave per note), the pitch
// slides into place and sags a little, it trembles faintly, it starts and ends softly, a breath goes with it, and a small stone room answers.
import { Audio_ as A } from './audio.js';
import { isHer } from './story.js';

const VOWELS = { a: [730, 1090, 2440], o: [570, 840, 2410], u: [350, 870, 2240], e: [500, 1700, 2450], m: [270, 900, 2150] };          // the three resonances of each (Hz, a man's mouth)
const WIDTH = [80, 100, 160], PEAK = [1, 0.55, 0.2];          // how broad each resonance is, and how strong

// notes: five [pitch Hz, vowel].  size: the mouth (bigger voices below 1, women and children above).  tilt: how fast the upper harmonics fade (more = rounder).  vol, att (s), dur (s).  lp: nothing above this (Hz).
// vib: [Hz, cents] the tremble.  glide: [starts at, ends at] as fractions of the pitch.  twin: [times the pitch, loudness, cents out] a second voice.  ring: [times, loudness] a faint pure overtone.
// breath: [loudness, Hz].  room: how much the stone answers.
const note = (...a) => a;
export const VOICES = {
  // ---- the two the story is about
  lady: { notes: [note(293.66, 'o'), note(329.63, 'a'), note(349.23, 'u'), note(392, 'e'), note(440, 'o')], size: 1.17, tilt: 1.35, vol: 0.07, att: 0.035, dur: 0.15, breath: [0.005, 2800], room: 0.35 },
  stranger: { notes: [note(110, 'o'), note(123.47, 'u'), note(130.81, 'a'), note(146.83, 'm'), note(164.81, 'o')], size: 0.95, tilt: 1.0, vol: 0.11, att: 0.03, dur: 0.13, lp: 2000, breath: [0.004, 1100] },
  // ---- the people of the city (the villagers' four kinds)
  woman: { notes: [note(220, 'a'), note(246.94, 'e'), note(261.63, 'o'), note(293.66, 'a'), note(329.63, 'e')], size: 1.15, vol: 0.07, att: 0.028, dur: 0.11 },
  bearded: { notes: [note(98, 'o'), note(110, 'a'), note(116.54, 'u'), note(130.81, 'o'), note(146.83, 'a')], size: 0.9, tilt: 1.0, vol: 0.11, att: 0.028, dur: 0.12, lp: 1800, breath: [0.007, 900] },
  hatman: { notes: [note(146.83, 'a'), note(164.81, 'e'), note(174.61, 'o'), note(196, 'a'), note(220, 'e')], vol: 0.09, att: 0.022, dur: 0.1 },
  oldman: { notes: [note(130.81, 'e'), note(138.59, 'a'), note(146.83, 'o'), note(155.56, 'e'), note(174.61, 'a')], vol: 0.085, att: 0.035, dur: 0.15, vib: [6.5, 40], breath: [0.012, 1500] },
  keeper: { notes: [note(87.31, 'u'), note(92.5, 'o'), note(98, 'm'), note(103.83, 'u'), note(116.54, 'o')], size: 0.82, vol: 0.1, att: 0.06, dur: 0.2, twin: [1.5, 0.22, 6], lp: 1400, breath: [0.01, 600], room: 0.7 },
  // ---- the masters of the castle
  warden: { bass: true, notes: [note(55, 'o'), note(61.74, 'a'), note(65.41, 'o'), note(73.42, 'u'), note(82.41, 'a')], size: 0.76, vol: 0.079, att: 0.025, dur: 0.15, twin: [1.006, 0.6, 16], lp: 1500, breath: [0.022, 1600], room: 0.4 },          // The Cinder Warden: a beast man, deep and rough
  baelphegaz: { bass: true, notes: [note(65.41, 'o'), note(73.42, 'a'), note(82.41, 'u'), note(87.31, 'o'), note(98, 'a')], size: 0.78, vol: 0.078, att: 0.03, dur: 0.17, vib: [27, 38], twin: [1.498, 0.28, -8], lp: 1400, room: 0.5 },          // a growl
  mire: { bass: true, notes: [note(196, 'u'), note(220, 'o'), note(246.94, 'a'), note(261.63, 'u'), note(293.66, 'o')], size: 1.12, vol: 0.08, att: 0.045, dur: 0.19, glide: [1.02, 0.9], vib: [8, 30], room: 0.5 },          // The Mire Mother: wet, sliding
  drowned: { bass: true, notes: [note(98, 'u'), note(110, 'o'), note(116.54, 'u'), note(130.81, 'm'), note(146.83, 'o')], size: 0.9, vol: 0.095, att: 0.045, dur: 0.2, glide: [1, 0.86], vib: [7, 42], lp: 650, room: 0.6 },          // from under water
  steed: { bass: true, notes: [note(164.81, 'o'), note(196, 'a'), note(220, 'u'), note(233.08, 'o'), note(261.63, 'a')], vol: 0.062, att: 0.06, dur: 0.17, breath: [0.035, 900], room: 0.6 },          // The Phantom Steed: mostly breath
  reflection: { bass: true, notes: [note(110, 'o'), note(123.47, 'u'), note(130.81, 'a'), note(146.83, 'm'), note(164.81, 'o')], size: 0.95, vol: 0.065, att: 0.012, dur: 0.15, twin: [2.004, 0.5, 12], room: 0.75 },          // the Stranger's own, doubled and hollow
  seraph: { bass: true, notes: [note(392, 'a'), note(440, 'o'), note(523.25, 'a'), note(587.33, 'u'), note(659.25, 'o')], size: 1.15, tilt: 1.5, vol: 0.054, att: 0.065, dur: 0.22, twin: [1.003, 0.85, 9], room: 0.9 },          // two voices in a vault
  count: { bass: true, notes: [note(116.54, 'o'), note(130.81, 'a'), note(138.59, 'u'), note(155.56, 'o'), note(174.61, 'a')], size: 0.95, tilt: 1.3, vol: 0.11, att: 0.045, dur: 0.16, vib: [5, 18] },          // smooth
  librarian: { bass: true, notes: [note(220, 'e'), note(246.94, 'm'), note(277.18, 'e'), note(293.66, 'u'), note(329.63, 'e')], vol: 0.055, att: 0.012, dur: 0.07, breath: [0.02, 3800] },          // dry as paper
  rimewyrm: { bass: true, notes: [note(73.42, 'u'), note(82.41, 'o'), note(92.5, 'u'), note(98, 'm'), note(110, 'o')], size: 0.8, vol: 0.12, att: 0.04, dur: 0.2, ring: [8, 0.018], lp: 3000, room: 0.65 },          // deep, with a glint of ice
  hierophant: { bass: true, notes: [note(130.81, 'e'), note(146.83, 'a'), note(164.81, 'o'), note(174.61, 'e'), note(196, 'a')], vol: 0.064, att: 0.025, dur: 0.13, vib: [6, 22], ring: [5.4, 0.012] },          // an old man in a brass room
  shadow: { bass: true, notes: [note(55, 'o'), note(61.74, 'u'), note(65.41, 'a'), note(73.42, 'o'), note(82.41, 'u')], size: 0.75, tilt: 0.95, vol: 0.082, att: 0.055, dur: 0.22, vib: [23, 26], twin: [2, 0.4, 7], lp: 1100, room: 0.65 },          // the deepest
};
// who speaks with which (the names over the boxes, in capitals)
const NAMED = {
  'THE STRANGER': 'stranger', 'THE CINDER WARDEN': 'warden', 'BAELPHEGAZ': 'baelphegaz', 'THE MIRE MOTHER': 'mire', 'THE DROWNED WARDEN': 'drowned', 'THE PHANTOM STEED': 'steed', 'THE REFLECTION': 'reflection',
  'THE SERAPH OF ASH': 'seraph', 'THE CRIMSON COUNT': 'count', 'THE LIBRARIAN': 'librarian', 'THE RIMEWYRM': 'rimewyrm', 'THE BRAZEN HIEROPHANT': 'hierophant', 'THE SHADOW LORD': 'shadow',
};
// the voice of whoever's name is over the box (null: nobody speaks).  A person not listed - a name changed in dialogue.txt - speaks with a townsman's.
export function voiceOf(name) {
  const n = String(name || '').trim().toUpperCase(); if (!n) return null;
  return isHer(n) ? 'lady' : NAMED[n] || 'hatman';
}

const last = {};
// which of the five comes next, when there are no words to go by: any but the one just played
export function nextNote(key) {
  const n = VOICES[key].notes.length; let i = Math.floor(Math.random() * (n - (last[key] === undefined ? 0 : 1))); if (last[key] !== undefined && i >= last[key]) i++;
  last[key] = i; return i;
}
// THE WORDS CHOOSE: one note to each word (or syllable: see UNITS).  The share of vowels among its letters is a place from 0 (consonant-heavy, "strength": the lowest note) to 4 (a bare vowel, "I": the highest), and its first vowel
// gives the mouth its shape (none: a closed "mm").  null: no letters there at all.
const EDGES = [0.25, 0.34, 0.45, 0.55], SHAPE = { a: 'a', e: 'e', i: 'e', y: 'e', o: 'o', u: 'u' };
export function toneFor(chunk) {
  const letters = String(chunk).toLowerCase().replace(/[^a-z]/g, ''); if (!letters) return null;
  const share = (letters.match(/[aeiouy]/g) || []).length / letters.length, i = EDGES.filter(e => share > e).length, v = /[aeiouy]/.exec(letters);
  return { i, share, vowel: v ? SHAPE[v[0]] : 'm' };
}
// the syllables of a line of English, near enough for a voice: [{ at, text }], at = the letter on which it sounds (its first vowel), text = its letters.  A syllable to every run of vowels, less the silent ones
// ("make", "walked", "comes"); the consonants between two are shared out between them.
export function syllables(line) {
  const out = [], word = /[A-Za-z']+/g; let m;
  while ((m = word.exec(line))) {
    const w = m[0].toLowerCase(), base = m.index, runs = [], vowels = /[aeiouy]+/g; let r;
    while ((r = vowels.exec(w))) runs.push([r.index, r.index + r[0].length]);
    if (runs.length && w[0] === 'y' && runs[0][0] === 0 && runs[0][1] > 1) runs[0][0] = 1;          // ("you": that y is a consonant)
    if (runs.length > 1 && ((w.endsWith('e') && runs[runs.length - 1][0] === w.length - 1 && !/[^aeiouy]le$/.test(w)) || /[^aeiouytd]ed$/.test(w) || /[^aeiouysxzhgc]es$/.test(w))) runs.pop();
    if (!runs.length) { if (/[a-z]/.test(w)) out.push({ at: base, text: w }); continue; }          // ("mm", "hm")
    let from = 0;
    runs.forEach(([a, b], i) => { const next = runs[i + 1], to = next ? b + Math.floor((next[0] - b) / 2) : w.length; out.push({ at: base + a, text: w.slice(from, to) }); from = to; });
  }
  return out;
}
// the note for those letters, in the voice `key`: the one the words ask for, or - if it was just played - its neighbour on the side the letters lean
export function noteFor(key, tone) {
  let { i } = tone; if (i === last[key]) { const middle = [0.1, 0.26, 0.385, 0.51, 0.7][i]; i += i === 0 ? 1 : i === 4 ? -1 : tone.share >= middle ? 1 : -1; }
  last[key] = i; return i;
}

// the shape of one note's sound: harmonic n of pitch f as loud as the mouth makes it (made once per audio context and kept)
const WAVES = new WeakMap(), ROOMS = new WeakMap();
function waveFor(ctx, f, vowel, size, tilt) {
  let m = WAVES.get(ctx); if (!m) WAVES.set(ctx, m = new Map()); const id = f + vowel + size + '/' + tilt; if (m.has(id)) return m.get(id);
  const N = Math.max(2, Math.min(64, Math.floor(5200 / f))), re = new Float32Array(N + 1), im = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) { let r = 0.03; for (let k = 0; k < 3; k++) { const d = (n * f - VOWELS[vowel][k] * size) / (WIDTH[k] * 1.5); r += PEAK[k] / (1 + d * d); } im[n] = (n === 1 ? Math.max(0.55, r) : r) / Math.pow(n, tilt); }          // (the pitch itself is always there: the warmth)
  const w = ctx.createPeriodicWave(re, im); m.set(id, w); return w;
}
// a small stone room: a short, soft tail of noise to convolve with
function roomFor(ctx, out) {
  let c = ROOMS.get(ctx); if (c) return c;
  const len = Math.floor(ctx.sampleRate * 0.5), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); let held = 0;
  for (let i = 0; i < len; i++) { held += 0.35 * (Math.random() * 2 - 1 - held); d[i] = held * Math.pow(1 - i / len, 3) * Math.min(1, i / 400); }          // (softened noise: no hiss in the answer)
  c = ctx.createConvolver(); c.buffer = b; c.connect(out); ROOMS.set(ctx, c); return c;
}
// ---------------------------------------------------------------------------------------------------------------- other sounds to speak with
// Instead of the hummed vowel a voice can speak with a small instrument.  The same five notes, the same choosing by the words, an octave up; the voice's room, tremble and second voice still tell them apart.
// STYLES: what there is, for the listening page (tools/voices.html).  `style` is what the game plays.
export const STYLES = { hum: 'Hummed vowels', marimba: 'Wooden marimba', kalimba: 'Thumb piano', harp: 'Muted harp', piano: 'Felt piano', drop: 'Water drops', flute: 'Breathy flute', glass: 'Glass chimes' };
export let style = 'flute';          // (the user's choice of them)
export function setStyle(s) { if (STYLES[s]) style = s; }
const PITCH = 2 ** (-4 / 12);          // the instruments speak four semitones under an octave above the notes (all voices "a little lower")
const LEVEL = { marimba: 0.85, kalimba: 0.66, harp: 1.7, piano: 0.62, drop: 1.15, flute: 0.95, glass: 0.7 };          // (so that each is about as loud as the others)
const PLUCKS = new WeakMap(), BRISK = 0.6;
// a plucked string (Karplus-Strong): a burst of soft noise running round a delay one wavelength long, losing a little brightness every turn
function pluck(ctx, f) {
  let m = PLUCKS.get(ctx); if (!m) PLUCKS.set(ctx, m = new Map()); if (m.has(f)) return m.get(f);
  const sr = ctx.sampleRate, N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 0.6), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0); let held = 0, top = 0;
  for (let i = 0; i < N; i++) { held += 0.4 * (Math.random() * 2 - 1 - held); d[i] = held; }
  for (let i = N; i < len; i++) d[i] = 0.4975 * (d[i - N] + d[i - N + 1]);
  for (let i = 0; i < len; i++) top = Math.max(top, Math.abs(d[i])); for (let i = 0; i < len; i++) d[i] /= top || 1;
  m.set(f, b); return b;
}
// one note of an instrument into `to`, at pitch f
function strike(kind, ctx, to, f, t, loud, v) {
  const [g0, g1] = v.glide || [1, 1];
  const part = (times, amp, att0, tau0, life0) => {          // one pure partial with its own rise and fall
    const att = Math.max(0.0015, att0 * BRISK), tau = tau0 * BRISK, life = Math.max(0.06, life0 * BRISK);
    const o = ctx.createOscillator(), k = ctx.createGain(); o.frequency.setValueAtTime(f * times * g0, t); if (v.glide) o.frequency.linearRampToValueAtTime(f * times * g1, t + life * 0.6);
    k.gain.setValueAtTime(0, t); k.gain.linearRampToValueAtTime(amp * loud, t + att); k.gain.setTargetAtTime(0, t + att, tau); k.gain.setTargetAtTime(0, t + life - 0.05, 0.012); o.connect(k); k.connect(to); o.start(t); o.stop(t + life); return o;
  };
  const puff = (amp, centre, q, att0, tau0, life0) => { if (!A.noiseBuf) return; const att = Math.max(0.001, att0 * BRISK), tau = tau0 * BRISK, life = Math.max(0.03, life0 * BRISK); const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), k = ctx.createGain(); s.buffer = A.noiseBuf; bp.type = 'bandpass'; bp.frequency.value = centre; bp.Q.value = q; k.gain.setValueAtTime(0, t); k.gain.linearRampToValueAtTime(amp * loud, t + att); k.gain.setTargetAtTime(0, t + att, tau); s.connect(bp); bp.connect(k); k.connect(to); s.start(t, Math.random()); s.stop(t + life); };
  if (kind === 'marimba') { part(1, 1, 0.005, 0.085, 0.45); part(3.93, 0.2, 0.002, 0.018, 0.2); part(9.2, 0.035, 0.001, 0.006, 0.08); }
  else if (kind === 'kalimba') { part(1, 0.85, 0.003, 0.15, 0.6); part(1.003, 0.3, 0.003, 0.12, 0.5); part(5.95, 0.12, 0.001, 0.022, 0.15); puff(0.18, 2600, 1.5, 0.001, 0.004, 0.04); }
  else if (kind === 'piano') { for (let n = 1; n <= 6; n++) { const times = n * Math.sqrt(1 + 0.0005 * n * n); part(times, 0.62 / n ** 1.8, 0.011, 0.2 / Math.sqrt(n), 0.7); part(times * 1.0023, 0.3 / n ** 1.8, 0.011, 0.17 / Math.sqrt(n), 0.7); } }
  else if (kind === 'harp') { const s = ctx.createBufferSource(), k = ctx.createGain(); s.buffer = pluck(ctx, Math.round(f * 100) / 100); s.playbackRate.setValueAtTime(g0, t); if (v.glide) s.playbackRate.linearRampToValueAtTime(g1, t + 0.25); k.gain.setValueAtTime(0, t); k.gain.linearRampToValueAtTime(loud, t + 0.006); k.gain.setTargetAtTime(0, t + 0.05 * BRISK, 0.11 * BRISK); s.connect(k); k.connect(to); s.start(t); s.stop(t + 0.55 * BRISK); }
  else if (kind === 'drop') { const o = part(1, 1, 0.007, 0.032, 0.2); o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(f * 0.72, t); o.frequency.exponentialRampToValueAtTime(f * 1.28, t + 0.055); }
  else if (kind === 'flute') { const low = Math.max(0, Math.min(1, (260 - f) / 150)), a = part(1, 0.8, 0.045, 0.075, 0.4), b = part(2, 0.1 + 0.28 * low, 0.05, 0.06, 0.4), lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = 5.2; depth.gain.value = 12; lfo.connect(depth); depth.connect(a.detune); depth.connect(b.detune); lfo.start(t); lfo.stop(t + 0.4); if (low) part(3, 0.14 * low, 0.05, 0.05, 0.4); puff(0.7, f * 2, 9, 0.04, 0.06, 0.35); }          // (low: a deep voice takes more of its upper partials, or small speakers would lose it)
  else { part(1, 0.8, 0.007, 0.2, 0.8); part(2.76, 0.22, 0.004, 0.1, 0.5); part(5.4, 0.07, 0.002, 0.05, 0.25); }          // glass
}

// THE MASTERS' BASS: under every tone a boss speaks, the same note an octave down, soft and round, so they sound large beside the people they speak to
export let bass = true;
export function setBass(on) { bass = !!on; }
function undertone(ctx, to, f, t, loud) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(loud, t + 0.03); g.gain.setTargetAtTime(0, t + 0.03, 0.07); g.gain.setTargetAtTime(0, t + 0.24, 0.02);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 620; g.connect(lp); lp.connect(to);
  for (const [wave, amp] of [['sine', 0.75], ['triangle', 0.65]]) { const o = ctx.createOscillator(), k = ctx.createGain(); o.type = wave; o.frequency.value = f; k.gain.value = amp; o.connect(k); k.connect(g); o.start(t); o.stop(t + 0.32); }          // (the triangle's overtones: a small speaker cannot sound the note itself)
}

// one syllable in the voice `key`.  (ctx, out: for rendering it elsewhere; as a rule the game's own.  tone: from toneFor(), the words it belongs to.  how: which of STYLES)
export function syllable(key, ctx = A.ctx, out = A.sfxGain, tone = null, how = style) {          // (BRISK shortens every sound: one comes for every syllable)
  const v = VOICES[key]; if (!v || !ctx || (ctx === A.ctx && (ctx.state !== 'running' || A.silent || A.blurred))) return;
  if (how !== 'hum') {
    const [f] = v.notes[tone ? noteFor(key, tone) : nextNote(key)], t = ctx.currentTime + 0.008, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(v.lp || 3600, f * 4); lp.Q.value = 0.5; lp.connect(out);
    const send = ctx.createGain(); send.gain.value = v.room === undefined ? 0.25 : v.room; lp.connect(send); send.connect(roomFor(ctx, out));
    const loud = v.vol * (LEVEL[how] || 1), hz = f * 2 * PITCH; strike(how, ctx, lp, hz, t, loud, v); if (v.twin) strike(how, ctx, lp, hz * v.twin[0] * 2 ** (v.twin[2] / 1200), t, loud * v.twin[1] * 0.7, v);
    if (v.bass && bass) undertone(ctx, out, hz / 2, t, loud * 0.65);          // (past the voice's own low-pass and room: it stays clean)
    return;
  }
  const [f, own] = v.notes[tone ? noteFor(key, tone) : nextNote(key)], vowel = tone ? tone.vowel : own, size = v.size || 1, att = v.att * BRISK, dur = v.dur * BRISK, t = ctx.currentTime + 0.008, top = t + att, end = top + dur, g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v.vol, top); g.gain.setTargetAtTime(0, top + 0.008, dur / 3.2); g.gain.setTargetAtTime(0, end, 0.02);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = v.lp || 3200; lp.Q.value = 0.5; g.connect(lp); lp.connect(out);
  const send = ctx.createGain(); send.gain.value = v.room === undefined ? 0.25 : v.room; lp.connect(send); send.connect(roomFor(ctx, out));
  const [vr, vc] = v.vib || [5.5, 10], lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = vr * (0.9 + 0.2 * Math.random()); depth.gain.value = vc; lfo.connect(depth); lfo.start(t); lfo.stop(end + 0.2);
  const [g0, g1] = v.glide || [0.965, 0.98], wave = waveFor(ctx, f, vowel, size, v.tilt || 1.15), off = (Math.random() - 0.5) * 14;          // (off: never quite the same pitch twice, as no voice is)
  const sing = (times, loud, cents, w) => {
    const o = ctx.createOscillator(), k = ctx.createGain(); if (w) o.setPeriodicWave(w); const p = f * times;
    o.frequency.setValueAtTime(p * g0, t); o.frequency.linearRampToValueAtTime(p, t + Math.min(0.035, dur / 2)); o.frequency.linearRampToValueAtTime(p * g1, end + 0.05); o.detune.value = off + cents; depth.connect(o.detune);
    k.gain.value = loud; o.connect(k); k.connect(g); o.start(t); o.stop(end + 0.2);
  };
  sing(1, 1, 0, wave); if (v.twin) sing(v.twin[0], v.twin[1], v.twin[2], wave); if (v.ring) sing(v.ring[0], v.ring[1], 0, null);
  if (v.breath && A.noiseBuf) { const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), k = ctx.createGain(); s.buffer = A.noiseBuf; bp.type = 'bandpass'; bp.frequency.value = v.breath[1]; bp.Q.value = 1.1; k.gain.setValueAtTime(0, t); k.gain.linearRampToValueAtTime(v.breath[0], top); k.gain.setTargetAtTime(0, top, dur / 3.5); s.connect(bp); bp.connect(k); k.connect(lp); s.start(t, Math.random()); s.stop(end + 0.2); }
}
// THE PACE OF SPEECH: words appear at TEXT_RATE letters a step, and rest after a comma, longer after the end of a sentence (so the voice does too)
export const TEXT_RATE = 0.585;          // about seven words a second, so that each word's note can be heard (it was 1.2, then 0.96, then 0.83)
export const COMMA_REST = 11, STOP_REST = 22;          // steps of rest (a sixtieth of a second each) after , ; and after . ! ?
// how many letters show after one more step.  state: kept for that one box.  A mark counts when a space or a new line follows it (so "..." rests once, at its end), and never at the very end of the box.
export function typeStep(state, text, shown) {
  if (state.rest > 0) { state.rest--; return shown; }
  const next = shown + TEXT_RATE;
  for (let i = Math.floor(shown); i < Math.floor(next) && i < text.length - 1; i++) if (/[,;.!?\u2026]/.test(text[i]) && /\s/.test(text[i + 1])) { state.rest = /[,;]/.test(text[i]) ? COMMA_REST : STOP_REST; return i + 1; }
  return next;
}
// the words of a line: [{ at, text }], at = its first letter
export function words(line) { const out = [], word = /[A-Za-z']+/g; let m; while ((m = word.exec(line))) if (/[A-Za-z]/.test(m[0])) out.push({ at: m.index, text: m[0] }); return out; }
// ONE TONE TO A WHAT: 'word' (what the game plays) or 'syllable'
export const UNITS = { word: words, syllable: syllables };
export let unit = 'word';

// CHATTER: call every frame as a speaker's words appear, with how many characters now show: each word sounds as it begins to appear.  (state: an object kept for that one box; state.mute: hushed)
export function chatter(state, key, text, shown, how = style, per = unit) {
  if (!key || state.mute) return false;
  if (state.text !== text || state.per !== per) { state.text = text; state.per = per; state.list = UNITS[per](text); state.i = 0; }
  const list = state.list; while (state.i < list.length && list[state.i].at < shown - 6) state.i++;          // (the words ran far ahead: what was passed is not spoken after them)
  const s = list[state.i]; if (!s || s.at >= shown) return false;
  state.i++; const tone = toneFor(s.text);
  syllable(key, undefined, undefined, tone, how); return true;
}
