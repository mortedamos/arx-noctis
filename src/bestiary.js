// The BESTIARY: a page of the pause menu that fills in as you meet the castle's creatures.  Seeing one writes its name, where it lives and a line about it; the first kill adds its health and the
// harm it does; every kill is counted.  (Save: S.bestiary[type] = { seen, kills, zones: [zone ids] }.)  The pictures are the creatures themselves, drawn by their own draw() in a little window.
import { W, H, clamp } from './util.js';
import { drawText, wrapText } from './font.js';
import { Input } from './input.js';
import { Audio_ as A } from './audio.js';
import { ENEMY_TYPES } from './enemies.js';
import { BEAST_TYPES } from './beasts.js';
import { BOSS_TYPES } from './bosses.js';
import { ZONES } from './rooms.js';
import { drawSheet } from './assets.js';
import { ICON } from './procart.js';

const GOLD = '#e8b84a', PALE = '#e8dcc0', DIM = '#8a7d9a';

// type id -> [name, what is known of it]
export const BEST = {
  bat: ['CAVE BAT', 'Flocks nest in every ceiling of the keep. They hang still until you pass beneath, then drop.'],
  zombie: ['GRAVE WALKER', 'The dead of the graveyard have forgotten they were buried. They climb out of the ground ahead of you, slowly, patiently.'],
  skeleton: ['BONE SOLDIER', 'The keep\'s old garrison never stood down. It throws its own bones, and does not seem to miss them.'],
  ghost: ['LOST SOUL', 'A guest who never left. It drifts through walls and cannot be shaken, only struck.'],
  wraith: ['GRIEF WRAITH', 'Older and colder than a ghost. It remembers who it loved, and hates you for still being warm.'],
  fireskull: ['EMBER SKULL', 'A head the fire would not finish. It burns, it screams, and it follows.'],
  hound: ['HELLHOUND', 'Bred to run down intruders on the hill road. Its master is long gone; the hunt is not.'],
  ghoul: ['GHOUL', 'It haunts the chapel, feeding where the faithful were first taken.'],
  wizard: ['HOLLOW WIZARD', 'A scholar who spoke to the dark once too often. It still casts, though nothing answers.'],
  wyrm: ['WYRM', 'A small winged serpent of the keep\'s upper halls. Hungry, bold, and not as small as it looks.'],
  frostwyrm: ['FROST WYRM', 'Its breath stills water. Wherever it nests, the walls grow rime.'],
  emberwyrm: ['EMBER WYRM', 'Born in the foundry flues, it breathes whatever the furnace swallowed.'],
  tome: ['HAUNTED TOME', 'A book that learned to fly when the Lord stopped reading. It drifts among the shelves, and dives at anything that opens one.'],
  grimoire: ['GRIMOIRE', 'The great books of the archive, bound in something that was alive. It hangs in the air and throws its own pages.'],
  shade: ['RIME SHADE', 'A shadow the cold pressed flat against the ice. It lies still as a puddle until you are close, then climbs out to take you with it.'],
  portrait: ['HAUNTED PORTRAIT', 'The faces of those who came before, hung in the halls. Some of them still watch. A few still strike.'],
  swampspider: ['MIRE SPIDER', 'It spins between the boardwalk posts and waits for the planks to creak.'],
  swampthing: ['MIRE THING', 'The mire took what the grave refused. It walks heavily, and it does not stop.'],
  acolyte: ['ACOLYTE', 'A faithful servant of the chapel, still at its devotions, which have turned.'],
  archmage: ['ARCHMAGE', 'The last master of the bell gallery. It guards its silence with lightning.'],
  sorcerer: ['BRASS SORCERER', 'The engineer\'s pupils, rebuilt in brass and loyal to a machine.'],
  zealot: ['ZEALOT', 'It fights in the Lord\'s name, whatever the Lord has become.'],
  boss_beast: ['BAELPHEGAZ', 'A demon in the service of the Shadow Lord, come up from below to harvest the misery of mankind. He keeps the gate of the graveyard and the road beyond it.'],
  boss_golem: ['THE BOILER GOLEM', 'It was built to keep the fires. No one told it that the fires have gone out.'],
  boss_cinder: ['THE CINDER WARDEN', 'He called it mercy, to burn what he could not protect.'],
  boss_bramble: ['THE MIRE MOTHER', 'The swamp\'s heart and hunger, rooted deep beneath the boardwalks.'],
  boss_nightmare: ['THE PHANTOM STEED', 'A horse that died in its stall, and still gallops through the stable at night.'],
  boss_angel: ['THE SERAPH', 'Once the chapel\'s guardian. It looks on the faithful and the faithless alike, and judges both.'],
  boss_drowned: ['THE DROWNED WARDEN', 'It keeps the flooded gate that the water was made to hold.'],
  boss_vampire: ['THE CRIMSON COUNT', 'Master of the crypts. He wakes his household one by one.'],
  boss_colossus: ['THE BRAZEN HIEROPHANT', 'The engineer\'s great work: a brass priest of the machine that holds the sun below the hills.'],
  boss_mirror: ['THE REFLECTION', 'It steps out of the glass wearing your face, and carries whatever you carry.'],
  boss_librarian: ['THE LIBRARIAN', 'He was asked only to keep the keys. He keeps everything, and nothing may be borrowed.'],
  boss_rimewyrm: ['THE RIMEWYRM', 'The cold that came up from the foundations learned to move. It guards the key the Library asks for, and wears the ice like a second skin.'],
  boss_shadow: ['THE SHADOW LORD', 'The one who took the sun. He waits above, and he has been waiting a very long time.'],
};
export const ORDER = Object.keys(BEST);
const ALL = { ...ENEMY_TYPES, ...BEAST_TYPES, ...BOSS_TYPES };
const KEY_OF = new Map(Object.entries(ALL).map(([k, C]) => [C, k]));
export const typeKey = e => KEY_OF.get(e.constructor) || null;
const entry = (S, k) => (S.bestiary ||= {})[k] ||= { seen: 0, kills: 0, zones: [] };

// the game calls these: when a creature is on screen, and when one dies
export function noteSeen(g, e) {
  const k = typeKey(e); if (!k || !BEST[k] || e.dead || e.harmless && !e.isBoss && e.state === 'buried') return;
  const b = entry(g.save, k), z = g.world.rooms[g.room.id].zone; if (!b.seen) b.seen = 1; if (!b.zones.includes(z)) b.zones.push(z);
}
export function noteKill(g, e) { const k = typeKey(e); if (!k || !BEST[k]) return; const b = entry(g.save, k); b.seen = Math.max(b.seen, 1); b.kills++; const z = g.world.rooms[g.room.id].zone; if (!b.zones.includes(z)) b.zones.push(z); }
export const bestiaryCount = S => ORDER.filter(k => S.bestiary && S.bestiary[k] && S.bestiary[k].seen).length;

export class BestiaryScreen {
  constructor(g, onBack) { this.g = g; this.onBack = onBack; this.sel = 0; this.top = 0; this.t = 0; this.models = {}; }
  // the creature itself, made once and never added to the world
  model(k) {
    if (k in this.models) return this.models[k];
    if (k === 'boss_mirror') return (this.models[k] = null);          // (the Reflection is drawn from the mirror's glass, not by itself: it gets a skull)
    let e = null; try { e = new ALL[k](this.g, 0, 0, {}); e.x = 0; e.y = 0; e.dead = false; if (e.state === 'buried') e.state = 'walk'; e.harmless = false; if (typeof e.dir === 'number') e.dir = 1; } catch (err) { e = null; }
    return (this.models[k] = e);
  }
  update() {
    this.t++; const n = ORDER.length;
    if (Input.pressed.up) { this.sel = (this.sel + n - 1) % n; A.sfx('click'); } if (Input.pressed.down) { this.sel = (this.sel + 1) % n; A.sfx('click'); }
    if (Input.pressed.left) { this.sel = Math.max(0, this.sel - 8); A.sfx('click'); } if (Input.pressed.right) { this.sel = Math.min(n - 1, this.sel + 8); A.sfx('click'); }
    for (const t of Input.taps) { if (t.x < 150 && t.y >= 44 && t.y < 44 + 12 * 12) { const i = this.top + Math.floor((t.y - 44) / 12); if (i < n) { this.sel = i; A.sfx('click'); } } }
    if (Input.pressed.back || Input.pressed.pkey || Input.pressed.pause) { A.sfx('back'); this.onBack(); }
  }
  draw(ctx) {
    const S = this.g.save, B = S.bestiary || {}, n = ORDER.length, rows = 12;
    this.top = clamp(this.sel - Math.floor(rows / 2), 0, Math.max(0, n - rows));
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,5,14,0.96)'; ctx.fillRect(6, 8, W - 12, H - 16); ctx.strokeStyle = '#3a2f4a'; ctx.strokeRect(6.5, 8.5, W - 13, H - 17);
    drawText(ctx, 'BESTIARY', W / 2, 14, { align: 'center', color: GOLD, scale: 1.6 }); drawText(ctx, `FOUND ${bestiaryCount(S)}/${n}`, W - 14, 16, { align: 'right', color: DIM });
    for (let i = 0; i < rows; i++) {                                                                              // the list
      const j = this.top + i; if (j >= n) break; const k = ORDER[j], b = B[k], seen = b && b.seen, y = 44 + i * 12, on = j === this.sel;
      if (on) { ctx.fillStyle = 'rgba(232,184,74,0.18)'; ctx.fillRect(12, y - 2, 138, 12); drawText(ctx, '>', 14, y, { color: GOLD }); }
      drawText(ctx, seen ? BEST[k][0] : '???', 24, y, { color: !seen ? '#4a4458' : on ? GOLD : k.startsWith('boss_') ? '#e0a0a0' : PALE });
      if (b && b.kills) drawText(ctx, String(b.kills), 146, y, { align: 'right', color: DIM });
    }
    if (this.top > 0) drawText(ctx, '^', 80, 36, { align: 'center', color: DIM }); if (this.top + rows < n) drawText(ctx, 'v', 80, 44 + rows * 12, { align: 'center', color: DIM });
    // the creature
    const k = ORDER[this.sel], b = B[k], seen = b && b.seen, X = 160, boss = k.startsWith('boss_');
    ctx.fillStyle = 'rgba(30,22,40,0.8)'; ctx.fillRect(X, 32, W - X - 12, 66); ctx.strokeStyle = '#3a2f4a'; ctx.strokeRect(X + 0.5, 32.5, W - X - 13, 65);
    const e = seen ? this.model(k) : null;
    if (e) {
      try {
        ctx.save(); ctx.beginPath(); ctx.rect(X + 1, 33, W - X - 14, 64); ctx.clip();
        const sc = boss ? 0.5 : clamp(Math.floor(46 / Math.max(e.h || 30, 16) * 2) / 2, 1, 3), fx = X + (W - X - 12) / 2, fy = boss ? 92 : 90;
        ctx.translate(fx, fy); ctx.scale(sc, sc); e.t = (e.t || 0) + 1; if (e.update && false) e.update(); e.draw(ctx, 0, 0); ctx.restore();
      } catch (err) { ctx.restore(); this.models[k] = null; }
    } else if (seen) drawSheet(ctx, 'icons', ICON.indexOf('skull'), X + (W - X - 12) / 2, 64, { ay: 0.5, scale: 3 });
    else drawText(ctx, '?', X + (W - X - 12) / 2, 56, { align: 'center', color: '#4a4458', scale: 3 });
    if (!seen) { drawText(ctx, 'NOT YET MET', X, 104, { color: '#6a6078', scale: 1.2 }); wrapText('Creatures are written here the first time you see them.', W - X - 14, 1, 'mixed').forEach((ln, i) => drawText(ctx, ln, X, 118 + i * 10, { color: DIM, font: 'mixed' })); }
    else {
      drawText(ctx, BEST[k][0], X, 103, { color: GOLD, scale: 1.2, outline: '#000' });
      let y = 117;                                                                                                // (each block starts where the one above it ends, so a long description can never run over the next line)
      for (const ln of wrapText(BEST[k][1], W - X - 14, 1, 'mixed')) { drawText(ctx, ln, X, y, { color: PALE, font: 'mixed' }); y += 10; }
      y += 3; const zones = (b.zones || []).map(z => ZONES[z] && ZONES[z].name).filter(Boolean).join(', ').toUpperCase();
      if (zones) for (const ln of wrapText('SEEN IN: ' + zones, W - X - 14, 1).slice(0, 3)) { drawText(ctx, ln, X, y, { color: '#b5a47a' }); y += 9; }
      drawText(ctx, b.kills ? `HP ${(e && e.maxHp) || '?'}    HARM ${(e && e.dmg) || '?'}    DEFEATED ${b.kills}` : 'DEFEAT ONE TO LEARN ITS STRENGTH', X, Math.min(y + 3, H - 30), { color: b.kills ? PALE : '#6a6078' });
    }
    drawText(ctx, 'UP / DOWN CHOOSE     ESC BACK', W / 2, H - 14, { align: 'center', color: DIM });
  }
}
