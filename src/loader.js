// THE BACKGROUND LOADER.  The game's pictures are small (about 2 MB for everything, loaded before the title screen); what is heavy is SOUND: 18 music tracks of about 3 MB each, and the recorded
// sound effects.  So the music and the effects are not fetched all at once, nor each at the moment it is needed (which makes a stall when you walk into a new area), but in the order the player is
// going to need them:
//
//   * nothing but the title music is fetched until the first touch / key press on the title screen;
//   * then the STAGES below are loaded one after another, in the order the castle is met - the opening hill in Prague first, then the rest of Prague, the Graveyard, the branches ... - and each stage is
//     its music (kept ready to play at once) and the effects that belong to it (the cry of its boss, the gears of the Clockwork Dungeon ...);
//   * walking into a zone moves that zone's stage (and the ones after it) to the front of the queue, so a save that continues deep in the castle loads what it needs first;
//   * only so many tracks are held ready at a time (the next few stages' worth, about 30 MB): as the hero moves on, the ones behind him are let go and the ones ahead are fetched.  On a slow connection,
//     or with the browser's data saver on, it is only the next three tracks, so a phone on mobile data never downloads far more than it will play.
// Anything not loaded yet is simply not there when it is needed: a track streams from the network as before, an effect plays its built-in synthesized stand-in.  Nothing ever waits for the loader.
import { Audio_ as A } from './audio.js';

// the castle in the order it is met.  zone: the zones this stage belongs to (walking into one brings it forward); music: track ids (see music/TRACKLIST.txt); sfx: the effects that belong to it ('core' = every
// recorded effect that no stage claims below: the hero's own sounds, the menus, the common enemies; 'rest' = whatever is left)
export const STAGES = [
  { id: 'hill', zone: [6], music: ['intro', 'zone6'], sfx: 'core' },
  { id: 'prague', zone: [6], music: ['boss', 'save'], sfx: ['boss_cinder', 'boss_cinder_die'] },
  { id: 'graveyard', zone: [1], music: ['zone1'], sfx: ['boss_beast', 'boss_beast_die'] },
  { id: 'mire', zone: [7], music: ['zone7'], sfx: ['boss_bramble', 'boss_bramble_die'] },
  { id: 'hall', zone: [2], music: ['zone2'], sfx: ['boss_nightmare', 'boss_nightmare_die', 'boss_mirror_die'] },
  { id: 'cistern', zone: [9], music: ['zone9'], sfx: ['boss_drowned', 'boss_drowned_die'] },
  { id: 'chapel', zone: [3], music: ['zone3'], sfx: ['boss_angel', 'boss_angel_die'] },
  { id: 'clockwork', zone: [8], music: ['zone8'], sfx: ['gear', 'steam', 'boss_colossus', 'boss_colossus_die'] },
  { id: 'crypts', zone: [4], music: ['general_track_1', 'general_track_2'], sfx: ['boss_vampire', 'boss_vampire_die'] },          // (the Crypts have no track of their own yet: a general one plays)
  { id: 'library', zone: [10], music: ['zone10'], sfx: ['page', 'ink', 'boss_librarian', 'boss_librarian_die'] },
  { id: 'ice', zone: [11], music: ['zone11'], sfx: ['shatter', 'boss_rimewyrm', 'boss_rimewyrm_die'] },
  { id: 'throne', zone: [5], music: ['general_track_3', 'general_track_4', 'ending'], sfx: ['boss_shadow', 'boss_shadow_die'] },
  { id: 'rest', zone: [], music: ['disco'], sfx: 'rest' },
];

export const Loader = { started: false, running: false, again: false, focusZone: null, blobs: new Map(), sfxDone: new Set(), bytes: 0, lean: false, log: [] };
const L = Loader;
A.deferFx = true;          // (audio.js does not load every recorded effect on the first touch any more: this loader does it, a stage at a time)
A.urlHook = url => L.blobs.get(url) || url;          // (a track that has been fetched plays from memory, at once)

const conn = () => (typeof navigator !== 'undefined' && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;
const slow = () => { const c = conn(); return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };
const claimed = () => new Set(STAGES.flatMap(s => (Array.isArray(s.sfx) ? s.sfx : [])));
const sfxOf = st => {
  const names = Object.keys(A.fxFiles || {}), taken = claimed();
  if (st.sfx === 'core') return names.filter(n => !taken.has(n));
  if (st.sfx === 'rest') return names.filter(n => !L.sfxDone.has(n));
  return (st.sfx || []).filter(n => names.includes(n));
};
const urlsOf = st => [...new Set((st.music || []).map(id => (A.tracks && A.tracks[id] ? A.resolve(id) : null)).filter(Boolean))];

// all the stages, starting with the one the hero is in (the ones before it come last: he may go back)
function order() {
  const i = L.focusZone === null ? 0 : Math.max(0, STAGES.findIndex(s => s.zone.includes(L.focusZone)));
  return [...STAGES.slice(i), ...STAGES.slice(0, i)];
}
const isPlaying = blob => [A.cur, ...(A.outgoing || [])].some(o => o && o.el && o.el.src === blob);
function drop(url) { const blob = L.blobs.get(url); L.blobs.delete(url); if (blob && !isPlaying(blob)) URL.revokeObjectURL(blob); }

async function fetchTrack(url) {
  if (L.blobs.has(url)) return;
  try {
    const r = await fetch(url, { priority: 'low' }); if (!r.ok) return; const b = await r.blob(); L.bytes += b.size;
    L.blobs.set(url, URL.createObjectURL(b)); L.log.push(url);
  } catch { /* offline, or no such file: the track simply streams if it is asked for */ }
}

async function pass() {
  L.lean = slow(); const budget = L.lean ? 3 : 9, list = order(), wanted = new Set();
  for (const st of list) for (const u of urlsOf(st)) if (wanted.size < budget) wanted.add(u);          // (the tracks of the next few stages, in order)
  for (const u of [...L.blobs.keys()]) if (!wanted.has(u)) drop(u);                                       // (the ones behind the hero are let go)
  let n = 0;
  for (const st of list) {
    if (L.lean && n++ >= 3) break;
    const names = sfxOf(st); names.forEach(x => L.sfxDone.add(x)); if (A.ctx && names.length) await A.loadFx(names);
    if (A.settings && A.settings.music <= 0) continue;
    for (const u of urlsOf(st)) if (wanted.has(u)) await fetchTrack(u);
    if (L.again) return;          // (the hero has walked into another zone: start again from there)
  }
}
async function run() {
  if (L.running) { L.again = true; return; } L.running = true;
  try { do { L.again = false; await pass(); } while (L.again); } finally { L.running = false; }
}

// the zone the hero is in now (the game calls this whenever a room is entered)
export function focus(zone) {
  if (zone === L.focusZone) return; L.focusZone = zone;
  try { localStorage.setItem('shadowkeep.zone', String(zone)); } catch {}
  if (L.started) run();
}
// the first touch or key press: begin
function begin() {
  if (L.started) return; L.started = true;
  if (L.focusZone === null) { try { const z = parseInt(localStorage.getItem('shadowkeep.zone'), 10); if (z) L.focusZone = z; } catch {} }          // (a game that continues deep in the castle loads that part first)
  const go = (n = 0) => { if (A.ctx || n > 40) run(); else setTimeout(() => go(n + 1), 150); };          // (the audio context is made by the same first touch: give it a moment)
  setTimeout(go, 250);
}
if (typeof addEventListener === 'function') for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, begin, { once: true, passive: true });
if (typeof window !== 'undefined') window.__loader = L;
