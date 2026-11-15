// THE WORDS OF THE GAME live in one plain text file, assets/dialogue.txt (read when the game starts, so a change needs only a reload - no code).  This module reads it.
//
// The file is made of SECTIONS.  A line in square brackets starts one, and the lines under it (until the next bracket) are its words.  Blank lines and lines starting with ; are ignored.
//     [tablet tab0]                     what a gravestone / tablet says (the id is the one in the level data)
//     [sign hall]                       a signpost, by the door it stands before
//     [boss THE CINDER WARDEN before]   a conversation: one line per speaker, "WHO: what they say".  (after = what is said as the boss dies)
//     [npc ga]                          a person indoors, by room:  TITLE: ...   TEXT: ...   AGAIN: ...
//     [villager woman street]           a list: every line is one alternative, and one is picked at random
// See the notes at the top of assets/dialogue.txt.  A section that is missing falls back on the words built into the game.
import { STORY } from './story.js';

const sections = new Map();          // 'tablet tab0' -> ['line', 'line', ...]
const norm = s => String(s).trim().replace(/\s+/g, ' ');

export function parseDialogue(text) {
  sections.clear(); let cur = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, ''), t = line.trim();
    if (!t || t.startsWith(';')) continue;
    const m = /^\[(.+)\]$/.exec(t); if (m) { cur = []; sections.set(norm(m[1]), cur); continue; }
    if (cur) cur.push(t);
  }
}
export const has = key => sections.has(norm(key));
export const lines = key => sections.get(norm(key)) || null;                       // every line, or null
export const text = key => { const l = lines(key); return l && l.length ? l.join(' ') : null; };          // the lines run together
// "WHO: words" lines -> [[who, words], ...]; a line with no speaker carries on from the one before
export function convo(key) {
  const l = lines(key); if (!l) return null; const out = [];
  for (const t of l) { const m = /^([^:]{1,40}):\s+(.*)$/.exec(t); if (m) out.push([m[1].trim(), m[2]]); else if (out.length) out[out.length - 1][1] += ' ' + t; }
  return out;
}
// "NAME: value" lines -> { NAME: [value, ...] }
export function fields(key) {
  const l = lines(key); if (!l) return null; const out = {};
  for (const t of l) { const m = /^([A-Z][A-Z0-9_ ]{0,20}):\s*(.*)$/.exec(t); if (m) (out[m[1].trim()] ||= []).push(m[2]); }
  return out;
}
export const field = (key, name) => { const f = fields(key); return f && f[name] ? f[name].join(' ') : null; };

// the STORY object (src/story.js) is what the rest of the game reads: fill it from the file
function fillStory() {
  const S = STORY, her = n => (n && n.toUpperCase() === (S.speaker || 'HER VOICE').toUpperCase() ? 'H' : n);
  const op = fields('opening'); if (op) S.opening = { title: (op.TITLE || [''])[0], sun: (op.SUN || [''])[0], fire: (op.FIRE || [''])[0], sword: op.SWORD || ['', ''] };
  const en = fields('ending'); if (en) S.ending = { title: (en.TITLE || [''])[0], lines: en.LINE || [] };
  if (has('chase')) S.chase = text('chase');
  if (has('bell')) S.bell = lines('bell');
  if (has('lantern')) S.lantern = lines('lantern');
  S.tablets = {}; S.convos = {}; S.talk = {};
  for (const [k, v] of sections) {
    let m;
    if ((m = /^tablet (.+)$/.exec(k))) S.tablets[m[1]] = v.join(' ');
    else if ((m = /^convo (.+)$/.exec(k))) S.convos[m[1]] = convo(k).map(([w, t]) => [her(w), t]);
    else if ((m = /^boss (.+) (before|after)$/.exec(k))) (S.talk[m[1]] ||= {})[m[2]] = convo(k);
  }
}

export async function loadDialogue() {
  try {
    const r = await fetch('assets/dialogue.txt', { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status);
    parseDialogue(await r.text()); fillStory();
  } catch (e) { console.warn('assets/dialogue.txt could not be read - the words built into the game are used.', e); }
}
