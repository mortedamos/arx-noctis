// THE BACKGROUND LOADER.  The game's pictures are small (about 2 MB for everything, loaded before the title screen); what is heavy is SOUND: 21 music tracks of about 3 MB each, and the recorded
// sound effects (3 MB).  So from the moment the title screen is first touched (a tap, a click, a key), the loader tries to have EVERYTHING ready before it is needed - never waiting until the moment
// a track or an effect is asked for, which makes a stall when you walk into a new area - and it fetches in the order the player is going to need it:
//
//   1. the zone the hero is in now: its music and the effects that belong to it (the cry of its boss, the gears of the Clockwork Dungeon ...);
//   2. what every zone needs sooner or later: the sting of the death screen, the sanctuary's music, the boss fight's, the Keeper's stalls;
//   3. the zones the doors and the edges of this room lead to (they are fetched the moment you enter the room, before you choose which way to go);
//   4. the rest of the castle in the order it is met, then - last of all - the parts behind the hero, which he may go back to.
// Nothing is held back by a budget: every track stays in memory once fetched (about 65 MB in all), unless the browser's data saver is on, the connection is 2g, or the device says it has 2 GB of memory
// or less; then it is only the next few tracks (3, or 12), as it used to be, so a phone on a poor plan never downloads far more than it will play.
// Three tracks come down at once (one on a slow connection), at a low priority so the music that is playing is never starved, while the recorded effects - small, and a good many of them - are fetched and
// decoded by a lane of their own beside them.  Walking into another room simply changes what is "next": the workers look at the order again each time they take a new job.
// Anything not loaded yet is simply not there when it is needed: a track streams from the network as before, an effect plays its built-in synthesized stand-in.  Nothing ever waits for the loader.
import { Audio_ as A } from './audio.js';

// the castle in the order it is met (the order a player is expected to take: see the difficulty tables in game.js).  zone: the zones this stage belongs to (walking into one brings it forward); music: track ids (see music/TRACKLIST.txt); sfx: the effects that belong to it ('core' = every
// recorded effect that no stage claims below: the hero's own sounds, the menus, the common enemies; 'rest' = whatever is left)
export const STAGES = [
  { id: 'hill', zone: [6], music: ['intro', 'zone6'], sfx: 'core' },
  { id: 'prague', zone: [6], music: [], sfx: ['boss_cinder', 'boss_cinder_die'] },
  { id: 'graveyard', zone: [1], music: ['zone1'], sfx: ['boss_beast', 'boss_beast_die'] },
  { id: 'mire', zone: [7], music: ['zone7'], sfx: ['boss_bramble', 'boss_bramble_die'] },
  { id: 'hall', zone: [2], music: ['zone2'], sfx: ['boss_nightmare', 'boss_nightmare_die', 'boss_mirror_die'] },
  { id: 'cistern', zone: [9], music: ['zone9'], sfx: ['boss_drowned', 'boss_drowned_die'] },
  { id: 'chapel', zone: [3], music: ['zone3'], sfx: ['boss_angel', 'boss_angel_die'] },
  { id: 'crypts', zone: [4], music: ['zone4'], sfx: ['boss_vampire', 'boss_vampire_die'] },
  { id: 'ice', zone: [11], music: ['zone11'], sfx: ['shatter', 'boss_rimewyrm', 'boss_rimewyrm_die'] },
  { id: 'clockwork', zone: [8], music: ['zone8'], sfx: ['gear', 'steam', 'boss_colossus', 'boss_colossus_die'] },
  { id: 'library', zone: [10], music: ['zone10'], sfx: ['page', 'ink', 'boss_librarian', 'boss_librarian_die'] },
  { id: 'throne', zone: [5], music: ['zone5', 'boss_final', 'ending'], sfx: ['boss_shadow', 'boss_shadow_die'] },
  { id: 'rest', zone: [], music: ['disco', 'title'], sfx: 'rest' },          // ('title' last: it is already streaming when the game opens, and it is only heard again on QUIT TO TITLE)
];
// what every zone needs, wherever the hero is: right after the zone's own music.  (A track whose file has not been made yet is represented by the stand-ins that play for it: see Audio_.urlsFor.)
const COMMON = { id: 'common', zone: [], music: ['sting_gameover', 'save', 'boss', 'shop'], sfx: [] };

export const Loader = { started: false, music: 0, sfx: false, focusZone: null, near: [], blobs: new Map(), failed: new Set(), sfxDone: new Set(), bytes: 0, lean: false, log: [] };
const L = Loader, inflight = new Set();
A.deferFx = true;          // (audio.js does not load every recorded effect on the first touch any more: this loader does it, a stage at a time)
A.urlHook = url => L.blobs.get(url) || url;          // (a track that has been fetched plays from memory, at once)

const conn = () => (typeof navigator !== 'undefined' && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;
const slow = () => { const c = conn(); return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };
// how many tracks may be held at once: all of them, unless the connection or the device says to go easy
const budget = () => (L.lean ? 3 : typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory <= 2 ? 12 : Infinity);
const claimed = () => new Set(STAGES.flatMap(s => (Array.isArray(s.sfx) ? s.sfx : [])));
const sfxOf = st => {
  const names = Object.keys(A.fxFiles || {}), taken = claimed();
  if (st.sfx === 'core') return names.filter(n => !taken.has(n));
  if (st.sfx === 'rest') return names.filter(n => !L.sfxDone.has(n));
  return (st.sfx || []).filter(n => names.includes(n));
};
const urlsOf = st => [...new Set((st.music || []).flatMap(id => (A.tracks && A.urlsFor ? A.urlsFor(id) : [])))];
const stageOf = z => STAGES.findIndex(s => s.zone.includes(z));

// every stage in the order it is wanted: the hero's own, what every zone needs, the zones next to this room, the rest of the castle after the hero's stage, and the stages behind him last
function order() {
  const fi = L.focusZone === null ? 0 : Math.max(0, stageOf(L.focusZone));
  const nearI = [...new Set((L.near || []).map(stageOf).filter(i => i >= 0 && i !== fi))].sort((a, b) => a - b), used = new Set([fi, ...nearI]);
  const rest = STAGES.map((_, i) => i).filter(i => !used.has(i)), after = rest.filter(i => i > fi), before = rest.filter(i => i < fi);
  return [STAGES[fi], COMMON, ...nearI.map(i => STAGES[i]), ...after.map(i => STAGES[i]), ...before.map(i => STAGES[i])];
}
const hrefOf = u => { try { return new URL(u, location.href).href; } catch { return u; } };
const streaming = u => [A.cur, ...(A.outgoing || [])].some(o => o && o.el && o.el.src === hrefOf(u));          // (the track that is playing from the network right now)
const isPlaying = blob => [A.cur, ...(A.outgoing || []), A.stingEl && { el: A.stingEl }].some(o => o && o.el && o.el.src === blob);
function drop(url) { const blob = L.blobs.get(url); L.blobs.delete(url); if (blob && !isPlaying(blob)) URL.revokeObjectURL(blob); }

// the tracks to hold, in the order to fetch them (at most budget() of them).  The one playing right now is already coming down by streaming, so its own copy waits at the end of the line.
function wanted() {
  const seen = new Set(), all = [];
  for (const st of order()) for (const u of urlsOf(st)) if (!seen.has(u)) { seen.add(u); all.push(u); }
  return [...all.filter(u => !streaming(u)), ...all.filter(streaming)].slice(0, budget());
}
const nextTrack = () => (A.settings && A.settings.music <= 0 ? null : wanted().find(u => !L.blobs.has(u) && !inflight.has(u) && !L.failed.has(u)) || null);

async function fetchTrack(url) {
  try {
    const r = await fetch(url, { priority: 'low' }); if (!r.ok) { L.failed.add(url); return; }
    const b = await r.blob(); L.bytes += b.size; L.blobs.set(url, URL.createObjectURL(b)); L.log.push(url);
  } catch { L.failed.add(url); /* offline, or no such file: the track simply streams if it is asked for (tried again when the network comes back) */ }
}
async function musicWorker() {
  for (let u; (u = nextTrack());) { inflight.add(u); try { await fetchTrack(u); } finally { inflight.delete(u); } }
}

// the recorded effects, a handful at a time (a hundred at once would hold up the tracks and the game's own frames), in the order of the stages; they need the audio context, which the first touch makes
const nextSfx = () => { for (const st of order().slice(0, L.lean ? 4 : 99)) { const names = sfxOf(st).filter(n => !L.sfxDone.has(n)); if (names.length) return names.slice(0, 12); } return null; };
const pause = ms => new Promise(r => setTimeout(r, ms));
async function sfxWorker() {
  for (let names; (names = nextSfx());) {
    for (let n = 0; !A.ctx && n < 40; n++) await pause(150);          // (the audio context is made by the same first touch: give it a moment)
    if (!A.ctx) return;
    names.forEach(x => L.sfxDone.add(x)); await A.loadFx(names); await pause(0);
  }
}

// start whatever workers are idle (they look at the order afresh for every job, so a new room needs nothing more than this)
function run() {
  L.lean = slow(); const lanes = L.lean ? 1 : 3;
  while (L.music < lanes && nextTrack()) { L.music++; musicWorker().finally(() => { L.music--; }); }
  if (!L.sfx && nextSfx()) { L.sfx = true; sfxWorker().finally(() => { L.sfx = false; }); }
}
// the tracks no longer wanted (a slow connection's budget: the ones behind the hero) are let go
function trim() { const keep = new Set(wanted()); for (const u of [...L.blobs.keys()]) if (!keep.has(u)) drop(u); }

// the zone the hero is in now, and the zones the doors and edges of this room lead to (the game calls this whenever a room is entered)
export function focus(zone, near = []) {
  L.focusZone = zone; L.near = near;
  try { localStorage.setItem('shadowkeep.zone', String(zone)); } catch {}
  if (L.started) { trim(); run(); }
}
// the first touch or key press: begin at once
function begin() {
  if (L.started) return; L.started = true;
  if (L.focusZone === null) { try { const z = parseInt(localStorage.getItem('shadowkeep.zone'), 10); if (z) L.focusZone = z; } catch {} }          // (a game that continues deep in the castle loads that part first)
  run();
}
// what is still to come, in order (for tests and curiosity: window.__loader.plan())
Loader.plan = () => ({ music: wanted().filter(u => !L.blobs.has(u)), sfx: order().flatMap(st => sfxOf(st)).filter(n => !L.sfxDone.has(n)), stages: order().map(s => s.id) });
if (typeof addEventListener === 'function') {
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, begin, { once: true, passive: true });
  addEventListener('online', () => { L.failed.clear(); if (L.started) run(); });          // (a fetch that failed for want of a network is tried again)
}
if (typeof window !== 'undefined') window.__loader = L;
