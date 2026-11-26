// Bosses.  Each fight: dormant -> (player approaches) intro/seal doors/music -> pattern loop -> dying sequence -> relic reward.
//
// TELEGRAPHING - every attack announces itself three ways so it can be read and dodged:
//   1. an ICON + NAME floats over the boss during the last ~50 frames of its rest period (toggle: Options > Boss Hints)
//   2. a coloured aura, a warning sound and (for most attacks) a DANGER ZONE painted on the floor/air during the windup
//   3. a windup that always lasts at least ~0.75s before anything can hurt you; after an attack the boss is open for a beat
// Passive body contact only does a fraction of damage; the full amount is reserved for the moment the attack is live.
import { Enemy } from './enemies.js';
import { drawSheet } from './assets.js';
import { ICON } from './procart.js';
import * as D from './dialogue.js';
import { isHer, voice } from './story.js';
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { Projectile, Shockwave, FirePatch, RollingGear, HomingWisp } from './projectiles.js';
import { dropItem, rollEnchantDrop } from './props.js';
import { drawText } from './font.js';
import { PW as HPW, PH as HPH } from './physics.js';
import { heroFrame, JUMP_CY, JATK_CY, TwinDagger, TwinTorch, TwinSalt, TwinArrow } from './mirror.js';
import { clamp, rand, approach, overlap } from './util.js';
import { Icicle } from './icicles.js';

// name shown over the boss + colour + pictogram for each attack
const ATTACKS = {
  charge: { label: 'CHARGE', rgb: [255, 90, 70], glyph: 'chevrons' },
  gallop: { label: 'GALLOP', rgb: [255, 90, 70], glyph: 'chevrons' },
  breath: { label: 'FIRE BREATH', rgb: [255, 150, 60], icon: 'ember' },
  leap: { label: 'LEAP SLAM', rgb: [255, 208, 74], glyph: 'down' },
  stomp: { label: 'STOMP', rgb: [255, 208, 74], glyph: 'down' },
  slam: { label: 'SLAM', rgb: [255, 208, 74], glyph: 'down' },
  pillars: { label: 'FLAME PILLARS', rgb: [255, 120, 60], glyph: 'bars' },
  vents: { label: 'STEAM VENTS', rgb: [210, 222, 238], glyph: 'bars' },
  strikes: { label: 'LIGHTNING', rgb: [150, 200, 255], icon: 'thunder' },
  feathers: { label: 'FEATHERS', rgb: [200, 220, 255], icon: 'feather' },
  skulls: { label: 'SKULL VOLLEY', rgb: [100, 220, 255], icon: 'skull' },
  gears: { label: 'GEAR TOSS', rgb: [230, 180, 80], sheet: 'gear' },
  gearslam: { label: 'GEAR SLAM', rgb: [230, 180, 80], sheet: 'gear' },          // (the Boiler Golem: it slams the floor and gears fall from the ceiling and roll away)
  summon: { label: 'SUMMONS', rgb: [180, 110, 255], icon: 'skull' },
  dive: { label: 'DIVE', rgb: [255, 255, 255], glyph: 'diag' },
  embers: { label: 'EMBER VOLLEY', rgb: [255, 130, 50], icon: 'ember' },
  punch: { label: 'IRON FIST', rgb: [255, 208, 74], glyph: 'chevrons' },          // (the Boiler Golem: a blow at chest height - duck under it)
  scoop: { label: 'UPPERCUT', rgb: [255, 150, 70], glyph: 'diag' },          // (a low scooping blow - jump it)
  fireball: { label: 'FIREBALL', rgb: [255, 130, 50], icon: 'ember' },
  tentacles: { label: 'TENTACLES', rgb: [150, 110, 220], glyph: 'bars' },
  spores: { label: 'SPORE BURST', rgb: [140, 255, 120], icon: 'orb' },
  lunge: { label: 'BLOOD LUNGE', rgb: [255, 70, 90], glyph: 'chevrons' },
  bolts: { label: 'BLOOD BOLTS', rgb: [255, 60, 90], icon: 'orb' },
  mist: { label: 'MIST STEP', rgb: [190, 110, 255], glyph: 'diag' },
  slash: { label: 'SWORD', rgb: [214, 214, 255], glyph: 'chevrons' },
  dash: { label: 'SHADOW DASH', rgb: [170, 110, 255], glyph: 'chevrons' },
  dagger: { label: 'DAGGERS', rgb: [200, 205, 240], icon: 'dagger' },
  torch: { label: 'TORCH', rgb: [255, 140, 60], icon: 'torchi' },
  marrow: { label: 'MAGIC ARROW', rgb: [200, 190, 255], icon: 'marrow' },
  salt: { label: 'SAL TERRAE', rgb: [238, 234, 222], icon: 'salt' },
  tideorbs: { label: 'WATER ORBS', rgb: [120, 200, 255], icon: 'orb' },
  geysers: { label: 'GEYSERS', rgb: [140, 205, 255], glyph: 'bars' },
  submerge: { label: 'SUBMERGE', rgb: [150, 210, 255], glyph: 'diag' },
  tide: { label: 'TIDE SURGE', rgb: [110, 195, 255], glyph: 'chevrons' },          // (the Drowned Warden heaves the flood one way: the lane shows which)
  bandage: { label: 'PANACEA', rgb: [180, 255, 190], icon: 'bandage' },
  pages: { label: 'TORN PAGES', rgb: [255, 232, 170], icon: 'scroll' },
  shelves: { label: 'FALLING SHELVES', rgb: [255, 200, 110], glyph: 'bars' },
  tomes: { label: 'HAUNTED TOMES', rgb: [240, 200, 120], icon: 'scroll' },
  ink: { label: 'INK BURST', rgb: [240, 190, 90], icon: 'orb' },
  swoop: { label: 'FROST DIVE', rgb: [150, 215, 255], glyph: 'diag' },
  spikes: { label: 'ICE SPIKES', rgb: [150, 215, 255], glyph: 'bars' },
  icefall: { label: 'ICICLE FALL', rgb: [190, 232, 255], glyph: 'down' },
  encase: { label: 'ICE SHELL: USE FIRE!', rgb: [255, 190, 110], icon: 'ember' },
  blizzard: { label: 'BLIZZARD', rgb: [210, 230, 255], glyph: 'chevrons' },
  frostbreath: { label: 'FROST BREATH', rgb: [175, 230, 255], icon: 'orb' },          // (the Rimewyrm: a cone of cold that sweeps the floor and slows you if it catches you)
  pyre: { label: 'SOULFIRE', rgb: [190, 120, 255], icon: 'orb' },          // (Baelphegaz risen)
  blink: { label: 'BLINK', rgb: [190, 110, 255], glyph: 'diag' },
  souls: { label: 'SOUL FLAMES', rgb: [200, 130, 255], icon: 'skull' },
  wake: { label: 'BURNING WAKE', rgb: [170, 90, 255], glyph: 'bars' },
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function drawGlyph(ctx, kind, x, y, dir, col, t) {
  ctx.fillStyle = col;
  if (kind === 'chevrons') { const hot = Math.floor(t / 4) % 3; for (let i = 0; i < 3; i++) { ctx.globalAlpha = i === hot ? 1 : 0.5; const cx = x + dir * (i * 5 - 5); for (let r = -4; r <= 4; r++) ctx.fillRect(cx + dir * (4 - Math.abs(r)) - (dir < 0 ? 1 : 0), y + r, 2, 1); } }
  else if (kind === 'down') { ctx.fillRect(x - 1, y - 8, 3, 8); for (let r = 0; r < 5; r++) ctx.fillRect(x - (4 - r), y + r, 2 * (4 - r) + 1, 1); ctx.fillRect(x - 8, y + 7, 17, 2); ctx.globalAlpha = 0.6; ctx.fillRect(x - 10, y + 5, 2, 1); ctx.fillRect(x + 9, y + 5, 2, 1); }
  else if (kind === 'bars') { for (const [i, h] of [[-1, 8], [0, 13], [1, 8]]) ctx.fillRect(x - 1 + i * 6 - 1, y + 7 - h, 3, h); ctx.fillRect(x - 9, y + 7, 19, 1); }
  else if (kind === 'diag') { for (let i = 0; i < 9; i++) ctx.fillRect(x - 6 + i, y - 6 + i, 3, 2); ctx.fillRect(x + 1, y + 3, 7, 2); ctx.fillRect(x + 6, y - 2, 2, 7); }
  ctx.globalAlpha = 1;
}

// -------------------------------------------------------------------------------------------- a stack of books falling from the ceiling
// The Librarian's SHELVES attack.  A mark appears on the floor and pages sift from the roof; then a stack of books comes down on it (it hurts if it lands on you), and where it lands it
// STAYS, as a wall of books (breakable blocks: cut your way through with the sword).  It waits until nobody is standing in it before it sets.
const BOOK_COLS = ['#7a2424', '#24456e', '#2f6a3a', '#6a3a7a', '#8a6a1e', '#4a4a56', '#9a4a2a', '#2a5a62'];
export class BookFall {
  constructor(g, x, o = {}) {
    const r = g.room; this.room = r; this.tx = Math.max(1, Math.min(r.w - 3, Math.floor(x / 16) - 1)); this.x = (this.tx + 1) * 16; this.warn = o.warn || 60; this.dmg = o.dmg || 14;
    let fr = 2; for (; fr < r.h - 1; fr++) { const a = r.get(this.tx, fr), b = r.get(this.tx + 1, fr); if (a || b) break; }          // the first surface below the ceiling
    this.floorY = fr * 16; this.rows = Math.min(5, fr - 2); this.h = this.rows * 16; this.y = 16 - this.h; this.vy = 0; this.t = 0; this.state = 'warn'; this.dead = false; this.owner = 'enemy'; this.vx = 0; this.seed = Math.floor(Math.random() * 99);
    if (this.rows < 2) this.dead = true;
  }
  get box() { return this.state === 'fall' ? { x: this.x - 16, y: this.y, w: 32, h: this.h } : { x: -999, y: -999, w: 0, h: 0 }; }
  update(g) {
    if (this.dead) return; this.t++; const p = g.player;
    if (this.state === 'warn') {
      const k = this.t / this.warn; g.fx.glow(this.x, this.floorY - 2, 14 + k * 14, [0.95, 0.75, 0.4], 0.3 + k * 0.5);
      if (this.t % 4 === 0) g.fx.emit({ x: this.x + rand(-14, 14), y: 18, vx: rand(-0.2, 0.2), vy: rand(0.4, 1.2), life: 26, s0: 4, s1: 2, c0: [0.95, 0.9, 0.7], a0: 0.9, a1: 0, kind: 1 });          // pages sift down from the roof
      if (this.t >= this.warn) { this.state = 'fall'; A.sfx('roar'); }
    } else if (this.state === 'fall') {
      this.vy = Math.min(9, this.vy + 0.55); this.y += this.vy;
      if (this.t % 2 === 0) g.fx.emit({ x: this.x + rand(-14, 14), y: this.y + rand(0, this.h), vx: rand(-0.3, 0.3), vy: -rand(0.2, 0.8), life: 18, s0: 4, s1: 1, c0: [0.95, 0.9, 0.7], a0: 0.8, a1: 0, kind: 1 });
      if (overlap(this.box, p.hurtbox)) p.hurt(this.dmg, this.x);
      if (this.y + this.h >= this.floorY) { this.y = this.floorY - this.h; this.state = 'rest'; this.rt = 0; A.sfx('boom'); g.shake(4, 12); g.fx.burst(this.x, this.floorY - 2, 18, [[0.95, 0.85, 0.6], [0.5, 0.3, 0.12]], { speed: 2.6, s0: 10, up: 1.2 }); g.fx.ring(this.x, this.floorY - 2, 40, [1, 0.8, 0.4], 16, 0.2); g.fx.sparks(this.x, this.floorY - 8, 10, [[1, 0.9, 0.6], [1, 0.7, 0.3]], 3, { gy: 0.1 }); }
    } else if (this.state === 'rest') {          // a heap, until the way is clear - then it sets as a wall
      this.rt++; const gone = !overlap({ x: this.x - 16, y: this.y, w: 32, h: this.h }, p.hurtbox);
      if (gone || this.rt > 240) { this.build(g); this.dead = true; }
    }
  }
  build(g) {
    const r = this.room; r.bookWall = r.bookWall || new Map();          // (block -> hits left: each takes a few blows of the sword)
    for (let c = 0; c < 2; c++) for (let k = 0; k < this.rows; k++) { const tx = this.tx + c, ty = Math.round(this.floorY / 16) - 1 - k; if (r.get(tx, ty) === 0) { r.set(tx, ty, 4); r.bookWall.set(tx + ',' + ty, { hp: 3, hit: 0 }); } }
    g.fx.burst(this.x, this.floorY - this.h / 2, 8, [[0.95, 0.85, 0.6], [0.5, 0.3, 0.12]], { speed: 1.4, s0: 8 });
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), fy = Math.round(this.floorY - cy);
    if (this.state === 'warn') {          // the mark on the floor, filling as the books near
      const k = this.t / this.warn; ctx.fillStyle = rgba([240, 190, 100], 0.15 + 0.35 * k); ctx.fillRect(x - 16, fy - 3, 32, 3); ctx.fillStyle = rgba([240, 190, 100], 0.5 + 0.5 * k); ctx.fillRect(x - 16, fy - 1, Math.round(32 * k), 1); return;
    }
    ctx.save(); ctx.beginPath(); ctx.rect(x - 24, Math.round(16 - cy), 48, 4000); ctx.clip();          // (it comes out from under the ceiling)
    const top = Math.round(this.y - cy); for (let k = 0; k < this.rows * 2; k++) {
      const h = hash(this.seed + k), off = (h * 3) | 0, by = top + this.h - (k + 1) * 8, c = BOOK_COLS[(this.seed + k * 3) % BOOK_COLS.length];
      ctx.fillStyle = '#12090a'; ctx.fillRect(x - 16, by, 32, 8); ctx.fillStyle = c; ctx.fillRect(x - 16 + off, by + 1, 31 - off, 6); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x - 16 + off, by + 1, 31 - off, 1);
      ctx.fillStyle = '#e8dcb8'; ctx.fillRect(x - 14 + off, by + 6, 27 - off, 1); ctx.fillStyle = 'rgba(240,210,120,0.7)'; ctx.fillRect(x - 10 + ((h * 8) | 0), by + 3, 7, 1);
    }
    ctx.restore();
  }
}
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// -------------------------------------------------------------------------------------------- telegraphed hazard column
// kind: fire (flame pillar), bolt (lightning), steam (vent), shadow (dark flame)
export class Column {
  constructor(x, y, kind, o = {}) {
    this.x = x; this.y = y; this.kind = kind; this.warn = o.warn || 45; this.active = o.active || 30; this.dmg = o.dmg || 16; this.w = o.w || 26; this.h = o.h || 150; this.t = 0; this.dead = false; this.owner = 'enemy'; this.vx = 0; this.vy = 0; this.fired = false;
  }
  get box() { return this.t >= this.warn && this.t < this.warn + this.active ? { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h } : { x: -999, y: -999, w: 0, h: 0 }; }
  update(g) {
    this.t++; const col = { fire: [1, 0.5, 0.15], bolt: [0.7, 0.85, 1], steam: [0.8, 0.85, 0.95], shadow: [0.6, 0.2, 1], tentacle: [0.55, 0.4, 0.9], books: [0.95, 0.75, 0.4], rime: [0.6, 0.85, 1] }[this.kind];
    if (this.t < this.warn) {                      // telegraph: pulsing marker on the floor + a faint beam that brightens until it fires
      const k = this.t / this.warn; if (this.t === 1) this.q = g.fx.quad({ kind: 'beam', x: this.x, y: this.y - this.h / 2, w: this.w * 1.1, h: this.h, color: col, life: this.warn, a0: 0.05, a1: 0.7 });
      g.fx.glow(this.x, this.y - 2, 14 + k * 14, col, 0.3 + k * 0.5); if (this.t % 6 === 0) g.fx.ring(this.x, this.y - 2, 16 + k * 10, col, 12, 0.3, 3);
      if (this.kind === 'steam' && this.t % 3 === 0) g.fx.smoke(this.x, this.y - 2, 1, { s0: 5, s1: 12, c0: [0.8, 0.85, 0.9], c1: [0.5, 0.55, 0.6], a: 0.3 });
    } else if (this.t < this.warn + this.active) {
      if (!this.fired) {
        this.fired = true;
        if (this.kind === 'bolt') { g.fx.bolt(this.x + rand(-6, 6), g.camera.y - 20, this.x, this.y - 2, { width: 22, life: 24, segs: 20 }); g.fx.flash([0.7, 0.8, 1], 0.4); A.sfx('crack'); g.shake(3, 10); }
        else if (this.kind === 'fire' || this.kind === 'shadow') { A.sfx('fire'); g.shake(2, 14); g.fx.ring(this.x, this.y - 2, 40, col, 18, 0.2); }
        else if (this.kind === 'books') { A.sfx('boom'); g.shake(3, 10); g.fx.burst(this.x, this.y - 2, 16, [[0.95, 0.85, 0.6], [0.5, 0.3, 0.12]], { speed: 2.4, s0: 10, up: 1.2 }); g.fx.ring(this.x, this.y - 2, 36, [1, 0.8, 0.4], 16, 0.2); }
        else if (this.kind === 'rime') { A.sfx('shatter'); g.shake(2, 8); g.fx.burst(this.x, this.y - 2, 10, COLORS.ice, { speed: 2, s0: 10, up: 1.6 }); g.fx.sparks(this.x, this.y - 6, 8, COLORS.white, 3, { gy: 0.15 }); g.fx.ring(this.x, this.y - 2, 30, col, 14, 0.2); }
        else if (this.kind === 'tentacle') { A.sfx('hit'); g.shake(2, 8); g.fx.burst(this.x, this.y - 2, 8, [[0.5, 0.3, 0.8], [0.15, 0.1, 0.3]], { speed: 1.8, s0: 10, up: 1 }); }
        else A.sfx('steam');
      }
      if (this.kind === 'fire' || this.kind === 'shadow') { g.fx.fire(this.x, this.y, { scale: 1.6, n: 4, color: this.kind === 'fire' ? 'fire' : 'purple' }); g.fx.glow(this.x, this.y - 60, 70, col, 0.35); }
      if (this.kind === 'fire') this.pillar(g);
      else if (this.kind === 'steam') g.fx.jet(this.x, this.y, -Math.PI / 2, [[0.95, 0.97, 1], [0.5, 0.55, 0.65]], { n: 3, speed: 5, spread: 0.1, size: 20 });
      else g.fx.glow(this.x, this.y - 40, 60, col, 0.5);
      g.fx.light(this.x, this.y - 40, 90, 1);
      const p = g.player; if (overlap(this.box, p.hurtbox)) p.hurt(this.dmg, this.x);
    } else this.dead = true;
  }
  // The pillar of fire: a tall column of burning light (two beams, a wide orange one around a hot yellow core) with flames streaming up its whole height, a roaring base and sparks.
  // It shoots up over a few steps, and dies down over the last ten.  All of it is drawn by the three.js effects layer.
  pillar(g) {
    const act = this.t - this.warn, grow = Math.min(1, (act + 1) / 5), fade = Math.min(1, (this.active - act) / 10), H = this.h * grow;
    if (!this.beams) {
      this.beams = [g.fx.quad({ kind: 'beam', x: this.x, y: this.y - this.h / 2, w: this.w * 3.4, h: this.h, color: [1, 0.42, 0.08], life: this.active, a0: 0.85, a1: 0.15 }),
        g.fx.quad({ kind: 'beam', x: this.x, y: this.y - this.h / 2, w: this.w * 1.5, h: this.h, color: [1, 0.9, 0.55], life: this.active, a0: 0.95, a1: 0.2 })];
    }
    for (const q of this.beams) { q.h = q.h1 = this.h * grow; q.y = this.y - q.h / 2; }
    for (let i = 0; i < 6; i++) {                                                                   // soft fiery puffs fill the column, big tongues of flame lick up through it
      const f = Math.random(), y = this.y - f * H, half = this.w * 0.5 * (1 - f * 0.4);
      g.fx.emit({ x: this.x + rand(-half, half), y, vx: rand(-0.3, 0.3), vy: -rand(1, 2.4), drag: 0.97, life: rand(10, 20), s0: rand(22, 34) * (1 - f * 0.3), s1: 8, c0: [1, 0.55, 0.14], c1: [0.8, 0.14, 0.04], a0: 0.45 * fade, a1: 0, kind: 0 });
      if (i < 3) g.fx.emit({ x: this.x + rand(-half, half), y, vx: rand(-0.4, 0.4), vy: -rand(1.6, 3.4), drag: 0.97, life: rand(12, 24), s0: rand(20, 32) * (1 - f * 0.35), s1: 4, c0: [1, 0.85, 0.35], c1: [0.9, 0.2, 0.05], a0: 0.9 * fade, a1: 0, kind: 2 });
    }
    if (this.t % 2 === 0) g.fx.emit({ x: this.x + rand(-this.w / 2, this.w / 2), y: this.y - rand(0, H), vx: rand(-0.6, 0.6), vy: -rand(1, 2.4), life: rand(24, 50), s0: 3, s1: 0.8, c0: [1, 0.85, 0.4], c1: [1, 0.3, 0.1], a0: 1, a1: 0, kind: 1 });
    g.fx.fire(this.x, this.y + 2, { scale: 2.1, n: 3 });
  }
  draw(ctx, cx, cy) {
    if (this.kind === 'tentacle') {            // a hole opens in the ground (the warning), then a tentacle heaves out of it and sways
      const act = this.t - this.warn, k = this.t / this.warn;
      if (act < 0) drawSheet(ctx, 'ars_tentacles_r0', Math.min(4, Math.floor(k * 5)), this.x - cx, this.y - cy + 2, { alpha: 0.5 + 0.5 * k });
      else if (act < 16) drawSheet(ctx, 'ars_tentacles_r1', Math.min(7, Math.floor(act / 2)), this.x - cx, this.y - cy + 2, {});
      else drawSheet(ctx, 'ars_tentacles_r2', Math.floor(this.t / 3) % 8, this.x - cx, this.y - cy + 2, { alpha: Math.min(1, (this.warn + this.active - this.t) / 8) });
    } else if (this.kind === 'books' && this.t >= this.warn) {          // a whole shelf's worth of books comes down in a stack, then lies in a heap and fades
      const act = this.t - this.warn, fall = Math.min(1, (act + 1) / 5), cols = ['#7a2424', '#24456e', '#2f6a3a', '#6a3a7a', '#8a6a1e', '#4a4a56'], fade = Math.min(1, (this.active - act) / 6);
      ctx.save(); ctx.globalAlpha = fade; for (let k = 0; k < Math.floor(this.h / 9); k++) { const bx = Math.round(this.x - cx - this.w / 2 + (k % 3) * 2 + ((k * 7) % 5)), by = Math.round(this.y - cy - 9 - k * 9 - (1 - fall) * this.h); ctx.fillStyle = '#12090a'; ctx.fillRect(bx - 1, by - 1, this.w - ((k * 7) % 5) + 2, 10); ctx.fillStyle = cols[k % cols.length]; ctx.fillRect(bx, by, this.w - ((k * 7) % 5), 8); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(bx, by, this.w - ((k * 7) % 5), 1); ctx.fillStyle = 'rgba(240,210,120,0.6)'; ctx.fillRect(bx + 3, by + 3, 6, 1); } ctx.restore();
    } else if (this.kind === 'rime' && this.t >= this.warn) {          // a spike of ice thrusts up out of the floor, holds, and drops away
      const act = this.t - this.warn, grow = Math.min(1, (act + 1) / 4), fade = Math.min(1, (this.active - act) / 8), hh = Math.round(this.h * grow), x = Math.round(this.x - cx), y = Math.round(this.y - cy), w = this.w * 0.5;
      ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = '#7cb8dc'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x + 2, y - hh); ctx.lineTo(x - 2, y - hh + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e4f6ff'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - 2, y); ctx.lineTo(x - 2, y - hh + 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a86ae'; ctx.beginPath(); ctx.moveTo(x + w * 0.4, y); ctx.lineTo(x + w, y); ctx.lineTo(x + 2, y - hh); ctx.closePath(); ctx.fill(); ctx.restore();
    } else if (this.kind === 'fire' && this.t >= this.warn) { /* the pillar of fire is light and flame in the effects layer (see pillar()), not a sprite */ }
    else if (this.t < this.warn) { // floor marker that fills as the attack nears
      const k = this.t / this.warn, c = { fire: [255, 120, 50], bolt: [150, 200, 255], steam: [210, 222, 238], shadow: [170, 80, 255], tentacle: [150, 110, 220], books: [240, 190, 100], rime: [150, 215, 255] }[this.kind];
      ctx.fillStyle = rgba(c, 0.15 + 0.35 * k); ctx.fillRect(Math.round(this.x - cx - this.w / 2), Math.round(this.y - cy - 3), this.w, 3);
      ctx.fillStyle = rgba(c, 0.5 + 0.5 * k); ctx.fillRect(Math.round(this.x - cx - this.w / 2), Math.round(this.y - cy - 1), Math.round(this.w * k), 1);
    }
  }
}

// -------------------------------------------------------------------------------------------- Boss base
// how bosses read the player (see Boss.choose): which of their attacks are for when you are close, far off, or in the air
const CLOSE_ATK = new Set(['punch', 'scoop', 'gearslam', 'slam', 'stomp', 'lunge', 'strikes', 'tentacles', 'leap', 'dive', 'vents', 'shelves', 'spikes']);
const FAR_ATK = new Set(['fireball', 'embers', 'breath', 'bolts', 'tideorbs', 'spores', 'skulls', 'feathers', 'gears', 'geysers', 'pillars', 'mist', 'summon', 'charge', 'gallop', 'pages', 'tomes', 'ink', 'frostbreath', 'souls', 'wake', 'blink']);
const AIR_ATK = new Set(['fireball', 'feathers', 'bolts', 'skulls', 'pillars', 'spores', 'embers', 'breath', 'tideorbs', 'pages', 'ink', 'frostbreath', 'souls']);
const combo_min = w => Math.max(58, Math.round(w * 0.5));
export class Boss extends Enemy {
  constructor(g, x, y, w, h, o) {
    super(g, x, y, w, h, o); this.isBoss = true; this.active = false; this.invuln = true; this.harmless = true; this.state = 'dormant'; this.st = 0; this.dying = 0; this.reward = o.reward; this.bossName = 'BOSS'; this.phase = 1; this.cool = 60; this.triggerDist = 200; this.kbRes = 1; this.noKb = true; this.heavy = true; this.sub = '';
    this.plan = null; this.lastAtk = null; this.intent = null; this.warns = null; this.tellP = 0; this._tellKind = null;
  }
  cry(die) { A.sfx('boss_' + (this.voice || 'beast') + (die ? '_die' : '')); }          // (each boss has its own voice and its own death cry: see assets/sfx/SFX-LIST.txt)
  start() { this.active = true; this.state = 'intro'; this.st = 0; this.g.startBoss(this); }
  hurt(dmg, dir, opts = {}) { opts.noKb = true; return super.hurt(dmg, dir, opts); }
  onHurt() { if (this.phase === 1 && this.hp < this.maxHp * 0.5) { this.phase = 2; this.onPhase2(); } }
  onPhase2() {
    const g = this.g; for (const j of g.jets || []) j.quicken(); g.fx.flash([1, 0.4, 0.3], 0.5); g.shake(5, 24); this.cry(); g.fx.ring(this.x, this.cy, 90, [1, 0.4, 0.3], 34, 0.14);
    dropItem(g, 'heart', this.x - 36, this.cy - 20); dropItem(g, 'heart', this.x + 36, this.cy - 20); dropItem(g, 'mana', this.x, this.cy - 30);     // a breather when the fight escalates
    this.state = this.state === 'dormant' ? this.state : 'idle'; this.st = -40; this.plan = null;
  }
  die() {
    if (this.dying) return; this.dying = 1; this.invuln = true; this.harmless = true; this.hp = 0; this.g.bossDying(this); this.cry(true);
  }
  dyingSeq() {
    const g = this.g; this.dying++; this.vx = 0; this.flashT = this.dying % 6 < 3 ? 4 : 0;
    if (this.dying % 5 === 0) { const px = this.x + rand(-this.w, this.w), py = this.cy + rand(-this.h / 2, this.h / 2); g.fx.burst(px, py, 10, COLORS.fire, { speed: 3, s0: 18 }); g.fx.sparks(px, py, 8, COLORS.gold, 4); g.fx.ring(px, py, 24, [1, 0.8, 0.4], 14); A.sfx('boom'); g.shake(4, 8); }
    if (this.dying === 150) { g.fx.flash([1, 1, 1], 1.0); g.fx.ring(this.x, this.cy, 160, [1, 0.9, 0.7], 44, 0.1); g.fx.burst(this.x, this.cy, 60, COLORS.gold, { speed: 5, s0: 22 }); g.fx.souls(this.x, this.cy, 30, COLORS.blue); A.sfx('thunder'); this.dead = true; g.player.gainXp(this.xp); if (!this.noDrop) rollEnchantDrop(g, this, true); g.bossDefeated(this); }
  }
  update() {
    if (this.freezeT > 0 && this.active && !this.dying) { this.freezeTick(); return; }     // frozen mid-move: everything pauses, then resumes
    if (this.freezeImmune > 0) this.freezeImmune--;
    this.t++; const g = this.g, p = g.player; if (this.active && !this.dying) this.tickStatus();
    if (!this.active) { if (!g.save.flags['boss_' + g.room.id] && Math.abs(p.x - this.x) < this.triggerDist && p.onGround) this.start(); this.physics(); return; }
    if (this.dying) { this.dyingSeq(); this.physics(); return; }
    this.st++; if (this.state === 'intro') { this.intro(g); if (this.st > 100) { this.state = 'idle'; this.st = -20; this.invuln = false; this.harmless = false; } this.physics(); return; }
    this.warns = null; this.intent = null;
    this.ai(g); if (!this.intent) this._tellKind = null;
    this.physics(); this.touch();
  }
  intro() {}
  // Is the boss "live" right now?  (only then does touching it hurt for full damage)
  dangerous() { return false; }
  touch() {
    const p = this.g.player; if (this.harmless || this.dead || this.dying) return;
    if (overlap(this.hurtbox, p.hurtbox)) p.hurt(this.dangerous() ? this.dmg : Math.max(3, Math.round(this.dmg * 0.4)), this.x);
  }
  faceP() { this.dir = this.g.player.x >= this.x ? 1 : -1; }

  // ---- attack selection with a visible lead-in
  // So that no two fights go the same way, each boss CHOOSES what to do next from a few things (and a different few every fight):
  //   * a MOOD, rolled once per fight: every attack gets a favour (some are loved this time, some almost forgotten);
  //   * it never repeats its last attack, and rarely the one before that;
  //   * it reads YOU: close in, it favours its close attacks; far away, the ranged ones; up in the air, whatever reaches the air;
  //   * the rhythm changes: usually a breath of a pause, sometimes a long one (an opening), and now and then a COMBO - the next attack comes hard on the heels of the last (more often in the second phase);
  //   * below a quarter of its life it grows impatient and pauses less.
  choose(list) {
    const p = this.g.player, dx = Math.abs(p.x - this.x), air = p.y < this.y - 70; this.mood ||= {}; this.hist ||= [];
    const uniq = [...new Set(list)], base = uniq;
    const wts = base.map(k => {
      if (this.mood[k] === undefined) this.mood[k] = 0.4 + 1.5 * Math.random();
      let w = this.mood[k] * (1 + 0.25 * (list.filter(q => q === k).length - 1));          // (a boss that lists an attack twice likes it more)
      if (uniq.length > 1) w *= k === this.lastAtk ? (uniq.length > 3 ? 0 : 0.08) : this.hist.includes(k) ? 0.6 : 1;          // (the last attack again: never, or just now and then for a boss with only three; the one before it is a little less likely)
      if (dx < 100 && CLOSE_ATK.has(k)) w *= 1.8; if (dx > 220 && FAR_ATK.has(k)) w *= 1.8; if (air && AIR_ATK.has(k)) w *= 1.6; return w;
    });
    if (!(wts.reduce((x, y) => x + y, 0) > 0)) return base[Math.floor(Math.random() * base.length)];
    let r = Math.random() * wts.reduce((x, y) => x + y, 0); for (let i = 0; i < base.length; i++) { r -= wts[i]; if (r <= 0) return base[i]; } return base[base.length - 1];
  }
  // call every idle step.  Picks the next attack right away, shows its icon for the last ~54 frames of the wait, then enters it.
  planNext(list, wait) {
    if (!this.plan) {
      this.plan = this.choose(list);
      const hurt = this.hp / this.maxHp < 0.25, combo = !this.comboRun && !!this.lastAtk && Math.random() < (this.phase === 2 ? 0.36 : 0.15);
      this.comboRun = combo ? 1 : 0;
      this.waitK = combo ? 0.5 : (Math.random() < 0.14 ? 1.45 : 0.8 + 0.4 * Math.random()); if (hurt) this.waitK *= 0.8;
    }
    const W = Math.max(combo_min(wait), Math.round(wait * (this.waitK || 1))), lead = Math.min(54, Math.max(30, W - 6));
    if (this.st > W - lead) this.tell(this.plan, clamp((this.st - (W - lead)) / lead, 0, 1));
    if (this.st >= W) { const k = this.plan; this.plan = null; this.lastAtk = k; (this.hist ||= []).push(k); if (this.hist.length > 2) this.hist.shift(); this.state = k; this.st = 0; return true; }
    return false;
  }
  // announce an attack: icon, aura, warning sound, optional danger zones.  `p` = windup progress 0..1
  tell(kind, p, warns) {
    const info = ATTACKS[kind] || ATTACKS.charge, g = this.g, c = info.rgb.map(v => v / 255);
    this.intent = kind; this.tellP = p; if (warns) this.warns = warns;
    if (this._tellKind !== kind) { this._tellKind = kind; A.sfx('tell'); g.fx.ring(this.x, this.cy, 34, c, 22, 0.2, 6); this.flashT = 4; }
    g.fx.glow(this.x, this.cy, 34 + this.w * 0.5 + p * 22, c, 0.16 + 0.34 * p);
    if (this.t % 3 === 0) g.fx.emit({ x: this.x + rand(-this.w / 2, this.w / 2), y: this.y - rand(0, this.h), vx: 0, vy: -rand(0.5, 1.3), life: 24, s0: 5, s1: 1, c0: c, a0: 0.9, a1: 0, kind: 1 });
  }
  drawWarn(ctx, cx, cy) {
    if (!this.warns || !this.warns.length) return; const t = this.t, p = this.tellP, c = (ATTACKS[this.intent] || ATTACKS[this.lastAtk] || ATTACKS.charge).rgb, a =0.1 + 0.2 * p + 0.05 * Math.sin(t * 0.5);
    for (const w of this.warns) {
      ctx.save();
      if (w.type === 'lane') { // charge path along the floor
        const x0 = Math.min(w.x0, w.x1) - cx, len = Math.abs(w.x1 - w.x0), dir = Math.sign(w.x1 - w.x0) || 1; ctx.fillStyle = rgba(c, a); ctx.fillRect(Math.round(x0), Math.round(w.y - cy - 22), Math.round(len), 22);
        ctx.fillStyle = rgba(c, 0.55 + 0.4 * p); ctx.fillRect(Math.round(x0), Math.round(w.y - cy - 1), Math.round(len), 1); ctx.fillRect(Math.round(x0), Math.round(w.y - cy - 22), Math.round(len), 1);
        for (let i = 0; i < Math.ceil(len / 28); i++) { const px = (w.x0 - cx) + dir * (((t * 3 + i * 28) % Math.max(28, len))); ctx.fillStyle = rgba(c, 0.35 + 0.4 * p); for (let r = -5; r <= 5; r++) ctx.fillRect(Math.round(px + dir * (5 - Math.abs(r))), Math.round(w.y - cy - 11 + r), 2, 1); }
      } else if (w.type === 'rect') { ctx.fillStyle = rgba(c, a); ctx.fillRect(Math.round(w.x - cx), Math.round(w.y - cy), w.w, w.h); ctx.strokeStyle = rgba(c, 0.5 + 0.4 * p); ctx.lineWidth = 1; ctx.strokeRect(Math.round(w.x - cx) + 0.5, Math.round(w.y - cy) + 0.5, w.w - 1, w.h - 1); }
      else if (w.type === 'ring') { const x = w.x - cx, y = w.y - cy; ctx.fillStyle = rgba(c, a * 0.8); ctx.beginPath(); ctx.ellipse(x, y - 1, w.r, w.r * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = rgba(c, 0.6 + 0.4 * Math.sin(t * 0.6) * 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y - 1, w.r * (1 - 0.25 * (p % 1)), w.r * 0.28 * (1 - 0.25 * (p % 1)), 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (w.type === 'line') { ctx.strokeStyle = rgba(c, 0.5 + 0.4 * p); ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 0.8; ctx.beginPath(); ctx.moveTo(w.x0 - cx, w.y0 - cy); ctx.lineTo(w.x1 - cx, w.y1 - cy); ctx.stroke(); }
      else if (w.type === 'poly') { ctx.fillStyle = rgba(c, a); ctx.beginPath(); w.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - cx, y - cy) : ctx.moveTo(x - cx, y - cy))); ctx.closePath(); ctx.fill(); ctx.strokeStyle = rgba(c, 0.4 + 0.4 * p); ctx.lineWidth = 1; ctx.stroke(); }
      ctx.restore();
    }
  }
  drawIntent(ctx, cx, cy) {
    if (!this.intent || !A.settings.hints || this.dying) return; const info = ATTACKS[this.intent]; if (!info) return;
    const x = Math.round(this.x - cx), y = Math.round(Math.max(40, this.y - this.h - 22 - cy)), t = this.t, col = rgba(info.rgb, 1), pulse = 0.55 + 0.45 * Math.sin(t * 0.35);
    ctx.fillStyle = 'rgba(8,4,14,0.82)'; ctx.fillRect(x - 13, y - 13, 26, 26); ctx.strokeStyle = rgba(info.rgb, 0.45 + 0.55 * pulse); ctx.lineWidth = 1; ctx.strokeRect(x - 12.5, y - 12.5, 25, 25);
    if (info.icon) drawSheet(ctx, 'icons', ICON.indexOf(info.icon), x, y, { ay: 0.5, scale: 1.4 }); else if (info.sheet) drawSheet(ctx, info.sheet, Math.floor(t / 6) % 4, x, y, { ay: 0.5, scale: 1.4 });
    else drawGlyph(ctx, info.glyph, x, y, this.dir, col, t);
    drawText(ctx, info.label, x, y - 24, { align: 'center', color: '#ffe9c0', outline: '#000' });
    ctx.fillStyle = rgba(info.rgb, 0.9); ctx.fillRect(x - 12, y + 15, Math.round(24 * clamp(this.tellP, 0, 1)), 2);      // fills as the attack gets closer
  }
}


// FIRE BREATH is a plain ARC: a band of flame that leaves his head, rises, curves over the top and comes down on the floor.  The centre line of the band ([forward distance from the boss's centre, height above the
// floor]) starts at his mouth, crowns about 105px up and lands ~170px away; the band is a fairly even 8-26px thick (a thin tongue at the mouth, widest where it strikes the ground).  So:
//   * under the arch (f ~40-145) there is room to stand: the fire is overhead, well above a standing hero's 36px,  * where the arch comes down (f ~150-185) the band reaches the floor, and that is the part that burns you,
//   * past ~185 it cannot reach you.  The flame travels along the arc from the mouth to the floor, and the whole arc is painted as the warning before it fires.
// (Baelphegaz is drawn at 85% of his first size, BEAST_K; the arc was drawn for the smaller creature.)
const BEAST_K = 0.85;
const ARC = [[32, 64], [48, 84], [74, 101], [104, 105], [132, 92], [153, 64], [166, 32], [172, 0]], ARC_W = [8, 13, 19, 22, 23, 25, 26, 26];
const resample = (P, n) => {        // Catmull-Rom through the control points -> n evenly-spaced-in-parameter points
  const out = [];
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(u)), t = u - i, p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const cr = j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t * t * t);
    out.push([cr(0), Math.max(0, cr(1))]);
  }
  return out;
};
// the band: 40 points along the centre line, and at each one the outer and inner edge (the centre line moved half the band's width along its normal, up / outward and down / inward)
function arcBand(P, W, n = 40) {
  const C = resample(P, n), T = resample(W.map((w, i) => [i, w]), n).map(p => p[1]), out = [], inn = [];
  for (let i = 0; i < n; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, h = T[i] / 2;
    out.push([C[i][0] + nx * h, Math.max(0, C[i][1] + ny * h)]); inn.push([C[i][0] - nx * h, Math.max(0, C[i][1] - ny * h)]);
  }
  return { out, inn };
}
export const BREATH = arcBand(ARC, ARC_W);
// world-space corners of the slice of the arc between samples i and i+1 (a quad: outer i, outer i+1, inner i+1, inner i)
const breathQuad = (i, x, y, D) => [BREATH.out[i], BREATH.out[i + 1], BREATH.inn[i + 1], BREATH.inn[i]].map(([f, h]) => [x + D * f, y - h]);
function breathOutline(x, y, D) { return BREATH.out.map(([f, h]) => [x + D * f, y - h]).concat(BREATH.inn.slice().reverse().map(([f, h]) => [x + D * f, y - h])); }
const inTri = (px, py, a, b, c) => { const d1 = (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1]), d2 = (px - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (py - c[1]), d3 = (px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
const inQuad = (px, py, q) => inTri(px, py, q[0], q[1], q[2]) || inTri(px, py, q[0], q[2], q[3]);
// does the fire between samples i0..i1 touch this rectangle?  (15 sample points across the box)
function breathHits(i0, i1, x, y, D, r) {
  for (let i = i0; i < i1; i++) {
    const q = breathQuad(i, x, y, D);
    for (let cx = 0; cx < 3; cx++) for (let cy = 0; cy < 5; cy++) if (inQuad(r.x + 1 + (r.w - 2) * cx / 2, r.y + 1 + (r.h - 2) * cy / 4, q)) return true;
  }
  return false;
}
// ============================================================================================== 1. BAELPHEGAZ (hell beast - a demon in the Shadow Lord's service)
// Plenty of warning, generous openings:  CHARGE (stuns itself on the wall), FIRE BREATH (an arch of flame from his head to the floor - stand under it or clear of where it lands),
// LEAP SLAM (landing spot is marked), and in phase 2 FLAME PILLARS.
export class BossBeast extends Boss {
  constructor(g, x, y, o) { super(g, x, y, Math.round(46 * BEAST_K), Math.round(84 * BEAST_K), o); this.hp = this.maxHp = 210; this.dmg = 12; this.xp = 120; this.bossName = 'BAELPHEGAZ'; this.voice = 'beast'; this.sub = 'HARVESTER OF MISERY'; this.scale = 2 * BEAST_K; this.dir = -1; this.deathFx = COLORS.fire; this.stunDur = 100; this.tx = x; this.ice = { w: Math.round(94 * BEAST_K), h: Math.round(124 * BEAST_K) }; }          // (85% of his old size: picture, hit box, frozen block and the spots his fire comes from)
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  tele(k) { return Math.round({ charge: 60, breath: 48, leap: 50 }[k] / this.spd); }
  dangerous() { return (this.state === 'charge' && this.st >= this.tele('charge')) || (this.state === 'leap' && this.st >= this.tele('leap')); }
  intro(g) { if (this.st === 8) { this.cry(); g.shake(4, 40); g.fx.flash([1, 0.5, 0.2], 0.3); g.fx.ring(this.x, this.cy, 120, [1, 0.5, 0.2], 40, 0.1); } if (this.st % 4 === 0) g.fx.fire(this.x + rand(-17, 17), this.y - 17, { scale: 1.0, n: 1 }); this.faceP(); }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx());
    switch (this.state) {
      case 'idle':
        this.faceP(); this.vx = approach(this.vx, d > 120 ? this.dir * 0.65 : 0, 0.06);
        this.planNext(this.phase === 2 ? ['charge', 'breath', 'leap', 'pillars'] : ['charge', 'breath', 'leap'], Math.round(92 / spd)); break;
      case 'charge': {
        const T0 = this.tele('charge');
        if (this.st < T0) {
          this.vx = 0; if (this.st < T0 - 24) this.faceP();                                  // direction locks 24 frames before it runs
          const x1 = this.dir > 0 ? g.room.pw - 24 : 24; this.tell('charge', this.st / T0, [{ type: 'lane', x0: this.x, x1, y: this.y }]);
          if (this.st === 2) this.cry(); if (this.st % 5 === 0) { g.fx.fire(this.x + this.dir * 15, this.y - 60, { scale: 0.6, n: 1 }); g.fx.burst(this.x - this.dir * 17, this.y - 2, 2, [[0.6, 0.55, 0.5], [0.2, 0.2, 0.25]], { speed: 1, s0: 8, up: 0.5 }); }
        } else {
          this.vx = this.dir * 3.1 * spd; if (this.st % 3 === 0) g.fx.fire(this.x - this.dir * 17, this.y - 4, { scale: 0.95, n: 1 }); if (this.st % 12 === 0) A.sfx('step');
          if (this.hitX) { this.vx = 0; this.state = 'stun'; this.st = 0; this.stunDur = 110; g.shake(5, 20); A.sfx('boom'); g.fx.burst(this.x + this.dir * 20, this.y - 34, 16, [[0.7, 0.65, 0.6], [0.3, 0.3, 0.35]], { speed: 3, s0: 14, up: 1 }); g.fx.ring(this.x + this.dir * 20, this.y - 34, 50, [1, 0.8, 0.5], 18); }
          else if (this.st > T0 + 110) { this.vx = 0; this.state = 'stun'; this.st = 0; this.stunDur = 50; }
        } break; }
      case 'stun':      // OPEN: free hits while it's dizzy
        this.vx = 0; if (this.st % 8 === 0) g.fx.sparks(this.x + rand(-12, 12), this.y - this.h - 4, 2, COLORS.gold, 1.2, { kind: 6, size: 6 });
        if (this.st > this.stunDur) { this.state = 'idle'; this.st = -10; } break;
      case 'breath': {      // an arch of fire from his head: it rises, curves over and comes down on the floor - stand under it, or clear of where it lands
        const T0 = this.tele('breath'), SW = 86, D = this.dir; this.vx = 0;
        if (this.st < T0) {
          if (this.st < T0 - 24) this.faceP();
          this.tell('breath', this.st / T0, [{ type: 'poly', pts: breathOutline(this.x, this.y, D) }]);          // the warning paints the crescent itself; the hollow beneath it stays clear
        } else if (this.st < T0 + SW) {
          const t = this.st - T0, last = BREATH.out.length - 1, i1 = Math.floor(clamp(t / 28, 0, 1) * last), i0 = Math.floor(clamp((t - (SW - 30)) / 30, 0, 1) * last);   // the flame grows out along the arc, then its tail burns away
          if (i0 < i1) {
            for (let n = 0; n < 10; n++) {      // flames scattered through the moon between the two curves
              const i = i0 + Math.floor(Math.random() * (i1 - i0)), k = Math.random(), po = BREATH.out[i], pi = BREATH.inn[i], f = pi[0] + (po[0] - pi[0]) * k, h = pi[1] + (po[1] - pi[1]) * k;
              g.fx.fire(this.x + D * f + rand(-3, 3), this.y - h + 6, { scale: 0.7 + 0.5 * Math.random(), n: 1 });
            }
            const lead = BREATH.out[i1], mid = BREATH.out[Math.floor((i0 + i1) / 2)]; g.fx.glow(this.x + D * lead[0], this.y - lead[1] * 0.7, 22, [1, 0.5, 0.15], 0.5); g.fx.light(this.x + D * mid[0], this.y - mid[1] * 0.7, 140, 1);
            if (t === 0) A.sfx('fire'); if (t % 20 === 0) A.sfx('fire');
            if (this.st % 3 === 0 && breathHits(i0, i1, this.x, this.y, D, p.hurtbox)) p.hurt(Math.round(9 * (this.dmgK || 1)), this.x, { kb: 1.2 });
          }
        } else if (this.st > T0 + SW + 18) { this.state = 'idle'; this.st = -24; } break; }
      case 'leap': {
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 70, g.room.pw - 70); this.cry(); }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]); }
        else if (this.st === T0) { this.vy = -6.6; this.vx = clamp((this.tx - this.x) / 62.9, -3.8, 3.8); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) {
          this.vx = 0; g.shake(6, 20); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 90, [1, 0.6, 0.2], 26, 0.15);
          g.addProjectile(new Shockwave(this.x - 17, this.y, -1, { dmg: 9, speed: 2.0, life: 70, big: true })); g.addProjectile(new Shockwave(this.x + 17, this.y, 1, { dmg: 9, speed: 2.0, life: 70, big: true }));
          this.state = 'idle'; this.st = -24;
        } else this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]; break; }
      case 'pillars':
        this.vx = 0; this.faceP(); if (this.st < 30) this.tell('pillars', this.st / 30);
        if (this.st === 30) { this.cry(); const base = p.x; for (let i = -1; i <= 1; i++) { const x = clamp(base + i * 70 + (i ? rand(-6, 6) : 0), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.y, 'fire', { warn: 60, active: 28, dmg: 14, w: 34 })); } }
        if (this.st > 130) { this.state = 'idle'; this.st = -16; } break;
    }
  }
  draw(ctx, cx, cy) {
    let id = 'beast_idle', f = Math.floor(this.t / 8) % 6, ox = 0; const st = this.state;
    if (st === 'breath') { id = 'beast_breath'; f = this.st < this.tele('breath') * 0.6 ? 0 : this.st < this.tele('breath') ? 1 : this.st < this.tele('breath') + 86 ? 2 : 3; }
    else if (st === 'charge' && this.st < this.tele('charge')) { id = 'beast_breath'; f = 0; ox = Math.sin(this.t * 2.5) * 1.5 * (this.st / this.tele('charge')); }
    else if (st === 'charge') f = Math.floor(this.t / 3) % 6;
    else if (st === 'leap') { id = 'beast_breath'; f = this.st < this.tele('leap') ? 0 : 2; }
    else if (st === 'stun') { id = 'beast_breath'; f = 3; }
    if (this.dying) { id = 'beast_burn'; f = 1 + Math.min(2, Math.floor(this.dying / 25)); }
    this.spr(ctx, id, f, cx + ox, cy, { flash: this.flashT > 0 });
    if (this.phase === 2 && !this.dying) this.g.fx.glow(this.x + this.dir * -5, this.y - 60, 14, [1, 0.2, 0.1], 0.5);
    this.g.fx.light(this.x, this.y - 43, 70, 0.6);
  }
}

// ============================================================================================== BAELPHEGAZ, RISEN (the Hall of Sorrow, before the Last Dark: the master has raised him to feast on the Stranger's sorrow)
// Greyish purple, quicker, and SWELLING as he is cut: every wound feeds him, from his old size up to RISEN_TALL pixels of hit box - just over what a double jump rises (104) - so that when he charges, the hero needs more
// than a double jump to get over him on a floor with no platforms: an ALEMBIC STRIKE off him (the bounce carries him over: there is a good sixth of a second to press it in), a dash at the top of the jump, or the Ouroboros.  He has: CHARGE; SOULFIRE (an arch of purple fire, which grows with him);
// LEAP SLAM; BLINK (he goes up in purple flame, comes out behind the hero and lunges at once); SOUL FLAMES (purple wisps that follow; the sword cuts them down); and in the second half a BURNING WAKE (pillars
// of purple fire that march across the floor).
const RISEN_GROW = 1.38, RISEN_TALL = 106;          // (how much bigger he is drawn at his greatest, and how tall his hit box is then)
const RISEN_GO = 34, RISEN_OUT = 64, RISEN_LUNGE = 16;          // (BLINK: gone by GO, stands there until OUT, then lunges)
export class BossRisen extends BossBeast {
  constructor(g, x, y, o) {
    super(g, x, y, o); this.hp = this.maxHp = 280; this.dmg = 13; this.xp = 420; this.bossName = 'BAELPHEGAZ RISEN'; this.sub = 'WHO FEASTS ON SORROW'; this.deathFx = COLORS.purple; this.stainBlood = true;
    this.grow = 1; this.grown = 0; this.base = { w: this.w, h: this.h, scale: this.scale, ice: this.ice }; this.alpha = 1; this.ghosting = false;
  }
  get spd() { return this.phase === 2 ? 1.45 : 1.25; }
  tele(k) { return Math.max(40, Math.round({ charge: 60, pyre: 52, leap: 52 }[k] / this.spd)); }
  dangerous() { return (this.state === 'charge' && this.st >= this.tele('charge')) || (this.state === 'leap' && this.st >= this.tele('leap')) || (this.state === 'blink' && this.st >= RISEN_OUT && this.st < RISEN_OUT + RISEN_LUNGE); }
  hurt(dmg, dir, opts = {}) { return this.ghosting ? false : super.hurt(dmg, dir, opts); }          // (nothing to cut while he is only flame)
  touch() { if (!this.ghosting) super.touch(); }
  intro(g) { if (this.st === 8) { this.cry(); g.shake(4, 40); g.fx.flash([0.7, 0.4, 1], 0.35); g.fx.ring(this.x, this.cy, 120, [0.7, 0.4, 1], 40, 0.1); } if (this.st % 3 === 0) g.fx.fire(this.x + rand(-17, 17), this.y - 17, { scale: 1.0, n: 1, color: 'purple' }); this.faceP(); }
  update() { super.update(); if (!this.dead && !this.dying && !(this.freezeT > 0)) this.swell(); }
  // the more he has bled, the bigger he is: full size from the last quarter of his life
  swell() {
    const g = this.g, want = 1 + (RISEN_GROW - 1) * clamp((1 - this.hp / this.maxHp) / 0.75, 0, 1);
    if (this.grow < want - 1e-6) {
      this.grow = Math.min(want, this.grow + 0.005); const k = (this.grow - 1) / (RISEN_GROW - 1), B = this.base;
      this.w = Math.round(B.w * this.grow); this.h = Math.round(B.h + (RISEN_TALL - B.h) * k); this.scale = B.scale * this.grow; this.ice = { w: Math.round(B.ice.w * this.grow), h: Math.round(B.ice.h * this.grow) };
      if (Math.floor(k * 4) > this.grown) { this.grown = Math.floor(k * 4); this.cry(); g.shake(3, 18); g.fx.ring(this.x, this.cy, 60 + this.h, [0.75, 0.45, 1], 26, 0.14); g.fx.burst(this.x, this.cy, 18, COLORS.purple, { speed: 2.6, s0: 14 }); }          // (a roar at each swelling)
    }
    this.x = clamp(this.x, 20 + this.w / 2, g.room.pw - 20 - this.w / 2);          // (as he widens he stays out of the walls)
  }
  breathAt(k) { return { x: this.x, y: this.y, k, D: this.dir }; }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx()), dk = this.dmgK || 1, pw = g.room.pw;
    if (this.state !== 'blink') { this.alpha = 1; this.ghosting = false; }
    if (this.t % 4 === 0 && !this.ghosting) g.fx.fire(this.x + rand(-this.w / 2, this.w / 2), this.y - rand(4, this.h * 0.7), { scale: 0.45, n: 1, color: 'purple' });
    const idle = st => { this.vx = 0; this.state = 'idle'; this.st = st; };
    switch (this.state) {
      case 'idle':
        this.faceP(); this.vx = approach(this.vx, d > 110 ? this.dir * 0.95 : 0, 0.09);
        this.planNext(this.phase === 2 ? ['charge', 'charge', 'pyre', 'leap', 'blink', 'souls', 'wake', 'wake'] : ['charge', 'charge', 'pyre', 'leap', 'blink', 'souls'], Math.round(88 / spd)); break;
      case 'charge': {
        const T0 = this.tele('charge');
        if (this.st < T0) {
          this.vx = 0; if (this.st < T0 - 20) this.faceP();
          this.tell('charge', this.st / T0, [{ type: 'lane', x0: this.x, x1: this.dir > 0 ? pw - 24 : 24, y: this.y }]);
          if (this.st === 2) this.cry(); if (this.st % 4 === 0) g.fx.fire(this.x + this.dir * this.w * 0.4, this.y - this.h * 0.8, { scale: 0.7, n: 1, color: 'purple' });
        } else {
          this.vx = this.dir * 3.2 * spd; if (this.st % 2 === 0) g.fx.fire(this.x - this.dir * this.w * 0.4, this.y - 4, { scale: 1.0, n: 1, color: 'purple' }); if (this.st % 10 === 0) A.sfx('step');
          if (this.hitX) { this.state = 'stun'; this.st = 0; this.stunDur = 80; this.vx = 0; g.shake(5, 20); A.sfx('boom'); g.fx.ring(this.x + this.dir * this.w / 2, this.y - 34, 50, [0.8, 0.6, 1], 18); g.fx.burst(this.x + this.dir * this.w / 2, this.y - 34, 16, [[0.7, 0.6, 0.8], [0.3, 0.2, 0.4]], { speed: 3, s0: 14, up: 1 }); }
          else if (this.st > T0 + 100) { this.state = 'stun'; this.st = 0; this.stunDur = 36; this.vx = 0; }
        } break; }
      case 'stun':          // OPEN
        this.vx = 0; if (this.st % 8 === 0) g.fx.sparks(this.x + rand(-12, 12), this.y - this.h - 4, 2, COLORS.gold, 1.2, { kind: 6, size: 6 });
        if (this.st > this.stunDur) idle(-10); break;
      case 'pyre': {          // soulfire: the beast's arch, in purple, and as much bigger as he is
        const T0 = this.tele('pyre'), SW = 80, D = this.dir, k = 1 + (this.grow - 1) * 0.6, at = ([f, h]) => [this.x + D * f * k, this.y - h * k]; this.vx = 0;
        if (this.st < T0) {
          if (this.st < T0 - 20) this.faceP();
          this.tell('pyre', this.st / T0, [{ type: 'poly', pts: BREATH.out.map(at).concat(BREATH.inn.slice().reverse().map(at)) }]);
        } else if (this.st < T0 + SW) {
          const t = this.st - T0, last = BREATH.out.length - 1, i1 = Math.floor(clamp(t / 24, 0, 1) * last), i0 = Math.floor(clamp((t - (SW - 28)) / 28, 0, 1) * last);
          if (i0 < i1) {
            for (let n = 0; n < 12; n++) { const i = i0 + Math.floor(Math.random() * (i1 - i0)), m = Math.random(), po = BREATH.out[i], pi = BREATH.inn[i], [fx, fy] = at([pi[0] + (po[0] - pi[0]) * m, pi[1] + (po[1] - pi[1]) * m]); g.fx.fire(fx + rand(-3, 3), fy + 6, { scale: 0.7 + 0.5 * Math.random(), n: 1, color: 'purple' }); }
            const [lx, ly] = at(BREATH.out[i1]); g.fx.glow(lx, ly, 26, [0.7, 0.4, 1], 0.5); g.fx.light(lx, ly, 140, 1, [0.75, 0.55, 1]);
            if (t % 20 === 0) A.sfx('fire');
            if (this.st % 3 === 0) { const r = p.hurtbox, local = { x: this.x + (r.x - this.x) / k - (D < 0 ? 0 : 0), y: this.y - (this.y - r.y) / k, w: r.w / k, h: r.h / k }; if (breathHits(i0, i1, this.x, this.y, D, local)) p.hurt(Math.round(9 * dk), this.x, { kb: 1.2 }); }          // (the hero shrunk into the arch's own size)
          }
        } else if (this.st > T0 + SW + 14) idle(-20); break; }
      case 'leap': {
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 40 + this.w / 2, pw - 40 - this.w / 2); this.cry(); }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 20 + this.w / 2 }]); }
        else if (this.st === T0) { this.vy = -6.4; this.vx = clamp((this.tx - this.x) / 61, -4.4, 4.4); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) {
          g.shake(7, 22); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 100, [0.7, 0.4, 1], 28, 0.15);
          for (const s of [-1, 1]) g.addProjectile(new Shockwave(this.x + s * this.w / 2, this.y, s, { dmg: Math.round(5 * dk), speed: 2.5, life: 80, big: true, color: COLORS.purple, fire: 'purple' }));
          idle(-22);
        } else this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 20 + this.w / 2 }]; break; }
      case 'blink': {
        if (this.st === 1) { A.sfx('ghost'); this.cry(); const side = -(p.dir || 1), off = 56 + this.w / 2, lo = 30 + this.w / 2, hi = pw - 30 - this.w / 2; let x = p.x + side * off; if (x < lo || x > hi) x = p.x - side * off; this.tx = clamp(x, lo, hi); }          // (behind the hero, if there is room there)
        if (this.st < RISEN_GO) {
          this.vx = 0; this.alpha = clamp(1 - this.st / (RISEN_GO - 6), 0.04, 1); this.ghosting = this.alpha < 0.4; this.tell('blink', this.st / RISEN_GO, [{ type: 'ring', x: this.tx, y: this.y, r: 20 + this.w / 2 }]);
          for (let i = 0; i < 2; i++) { g.fx.fire(this.x + rand(-this.w / 2, this.w / 2), this.y - rand(0, this.h), { scale: 0.9, n: 1, color: 'purple' }); g.fx.fire(this.tx + rand(-this.w / 2, this.w / 2), this.y, { scale: 0.7, n: 1, color: 'purple' }); }
        } else if (this.st < RISEN_OUT) {
          this.vx = 0; if (this.st === RISEN_GO) { this.x = this.tx; this.faceP(); g.fx.burst(this.x, this.cy, 24, COLORS.purple, { speed: 3, s0: 14 }); A.sfx('ghost'); }
          this.alpha = clamp((this.st - RISEN_GO) / 18, 0.04, 1); this.ghosting = this.alpha < 0.6; this.warns = [{ type: 'lane', x0: this.x, x1: this.x + this.dir * (RISEN_LUNGE * 5.4 + this.w / 2), y: this.y }]; this.intent = 'blink'; this.tellP = (this.st - RISEN_GO) / (RISEN_OUT - RISEN_GO);
        } else if (this.st < RISEN_OUT + RISEN_LUNGE) { this.alpha = 1; this.ghosting = false; this.vx = this.dir * 5.4; g.fx.fire(this.x - this.dir * this.w * 0.4, this.y - rand(4, this.h * 0.5), { scale: 1.0, n: 1, color: 'purple' }); }
        else { this.vx = 0; if (this.st > RISEN_OUT + RISEN_LUNGE + 24) idle(-18); }
        break; }
      case 'souls': {
        const T0 = 40; this.vx = 0; this.faceP(); if (this.st < T0) this.tell('souls', this.st / T0);
        if (this.st === T0) { A.sfx('cast'); const n = this.phase === 2 ? 4 : 3; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.75; g.addProjectile(new HomingWisp(this.x + this.dir * 8, this.y - this.h - 4, Math.cos(a) * 1.4, Math.sin(a) * 1.4, Math.round(6 * dk), 'purple')); } g.fx.ring(this.x, this.y - this.h, 36, [0.75, 0.45, 1], 18); }
        if (this.st > T0 + 36) idle(-18); break; }
      case 'wake': {          // pillars of purple fire, one after another, marching away from him toward the hero
        const T0 = 36, D = this.dir; this.vx = 0; if (this.st < T0 - 12) this.faceP(); if (this.st < T0) this.tell('wake', this.st / T0, [{ type: 'lane', x0: this.x, x1: this.dir > 0 ? pw - 24 : 24, y: this.y }]);
        if (this.st === T0) { this.cry(); for (let i = 0; i < 12; i++) { const x = this.x + this.dir * (this.w / 2 + 22 + i * 48); if (x < 22 || x > pw - 22) break; g.addProjectile(new Column(x, this.y, 'shadow', { warn: 28 + i * 9, active: 16, dmg: Math.round(7 * dk), w: 26, h: 80 })); } }
        if (this.st > T0 + 110) idle(-16); break; }
    }
  }
  draw(ctx, cx, cy) {
    let id = 'risen_idle', f = Math.floor(this.t / 6) % 6, ox = 0; const st = this.state;
    if (st === 'pyre') { const T0 = this.tele('pyre'); id = 'risen_breath'; f = this.st < T0 * 0.6 ? 0 : this.st < T0 ? 1 : this.st < T0 + 80 ? 2 : 3; }
    else if (st === 'charge' && this.st < this.tele('charge')) { id = 'risen_breath'; f = 0; ox = Math.sin(this.t * 2.5) * 2 * (this.st / this.tele('charge')); }
    else if (st === 'charge' || (st === 'blink' && this.st >= RISEN_OUT && this.st < RISEN_OUT + RISEN_LUNGE)) f = Math.floor(this.t / 2) % 6;
    else if (st === 'leap') { id = 'risen_breath'; f = this.st < this.tele('leap') ? 0 : 2; }
    else if (st === 'souls' || st === 'wake') { id = 'risen_breath'; f = this.st < 30 ? 0 : 1; }
    else if (st === 'stun') { id = 'risen_breath'; f = 3; }
    if (this.dying) { id = 'risen_burn'; f = 1 + Math.min(2, Math.floor(this.dying / 25)); }
    this.spr(ctx, id, f, cx + ox, cy, { flash: this.flashT > 0 });
    if (!this.dying) this.g.fx.glow(this.x, this.cy, 20 + this.h * 0.4, [0.55, 0.25, 0.85], 0.16 * this.alpha);
    this.g.fx.light(this.x, this.cy, 60 + this.h * 0.4, 0.65 * this.alpha, [0.8, 0.65, 1]);
  }
}

// ============================================================================================== 2. THE PHANTOM STEED (nightmare)
export class BossNightmare extends Boss {
  constructor(g, x, y, o) { super(g, x, y, 84, 54, o); this.hp = this.maxHp = 290; this.dmg = 14; this.xp = 160; this.bossName = 'THE PHANTOM STEED'; this.voice = 'nightmare'; this.sub = 'NIGHTMARE OF THE GREAT HALL'; this.dir = -1; this.deathFx = COLORS.blue; this.passes = 0; this.gT = 54; this.tx = x; this.ice = { w: 112, h: 80 }; }
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  dangerous() { return (this.state === 'gallop' && this.st >= this.gT) || (this.state === 'stomp' && this.st >= 50); }
  intro(g) { if (this.st === 8) { this.cry(); g.shake(4, 40); g.fx.flash([0.4, 0.7, 1], 0.3); g.fx.ring(this.x, this.cy, 120, [0.4, 0.8, 1], 40, 0.1); } this.faceP(); g.fx.fire(this.x + rand(-30, 30), this.y - 40, { scale: 1.1, n: 1, color: 'blue' }); }
  ai(g) {
    const p = g.player, spd = this.spd;
    g.fx.fire(this.x - this.dir * 36, this.y - 46, { scale: 0.9, n: 1, color: 'blue' }); g.fx.light(this.x, this.y - 40, 100, 0.6);
    switch (this.state) {
      case 'idle': this.faceP(); this.vx = approach(this.vx, 0, 0.1); this.planNext(this.phase === 2 ? ['gallop', 'gallop', 'summon', 'stomp'] : ['gallop', 'summon', 'stomp'], Math.round(92 / spd)); break;
      case 'gallop': {
        if (this.st === 1) { this.passes = 0; this.faceP(); this.gT = Math.round(56 / spd); }
        if (this.st < this.gT) {   // windup (the second/third pass gets a shorter, still-marked windup)
          this.vx = 0; if (this.passes === 0 && this.st < this.gT - 24) this.faceP();
          this.tell('gallop', this.st / this.gT, [{ type: 'lane', x0: this.x, x1: this.dir > 0 ? g.room.pw - 20 : 20, y: this.y }]);
          if (this.st === 3) this.cry(); if (this.st % 5 === 0) g.fx.burst(this.x, this.y - 4, 3, [[0.5, 0.8, 1], [0.1, 0.3, 0.8]], { speed: 1.3, s0: 10, up: 0.6 });
        } else {
          this.vx = this.dir * 4.0 * spd; if (this.st % 6 === 0) A.sfx('step'); if (this.st % 10 === 0) g.addProjectile(new FirePatch(this.x - this.dir * 34, this.y, this.phase === 2 ? 130 : 90, { dmg: 7, color: 'blue', w: 24 }));
          if (this.hitX) {
            this.vx = 0; this.passes++; g.shake(4, 14); A.sfx('boom');
            if (this.passes < (this.phase === 2 ? 3 : 2)) { this.dir *= -1; this.st = this.gT - 40; }
            else { this.state = 'idle'; this.st = -44; }       // winded: open for a counter-attack
          }
        } break; }
      case 'summon':
        this.vx = 0; this.faceP(); if (this.st < 44) this.tell('summon', this.st / 44); if (this.st === 6) this.cry();
        if (this.st === 44) { const n = this.phase === 2 ? 4 : 3; let cnt = g.enemies.filter(e => e.name === 'fireskull' && !e.dead).length; for (let i = 0; i < n && cnt < 5; i++, cnt++) g.spawnEnemy('fireskull', (g.room.pw / (n + 1)) * (i + 1) / 16, 5, {}); g.fx.flash([0.4, 0.7, 1], 0.2); A.sfx('cast'); }
        if (this.st > 100) { this.state = 'idle'; this.st = -20; } break;
      case 'stomp':
        if (this.st === 1) { this.tx = clamp(p.x, 70, g.room.pw - 70); this.cry(); }
        if (this.st < 50) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('stomp', this.st / 50, [{ type: 'ring', x: this.tx, y: this.y, r: 44 }]); break; }
        if (this.st === 50) { this.vy = -7; this.onGround = false; this.vx = clamp((this.tx - this.x) / 66.7, -3.4, 3.4); A.sfx('jump'); }
        if (this.st > 56 && this.onGround) { this.vx = 0; g.shake(7, 22); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 100, [0.4, 0.8, 1], 28, 0.15); for (const s of [-1, 1]) g.addProjectile(new Shockwave(this.x + s * 30, this.y, s, { dmg: 10, speed: 2.2, life: 80, big: true, color: COLORS.blue })); this.state = 'idle'; this.st = -30; }
        else this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 44 }]; break;
    }
  }
  draw(ctx, cx, cy) {
    const moving = (this.state === 'gallop' && this.st >= this.gT) || (this.state === 'stomp' && this.st >= 50);
    const id = moving ? 'nightmare_gallop' : 'nightmare_idle', f = Math.floor(this.t / (moving ? 4 : 9)) % 4;
    const dy = this.state === 'gallop' && this.st < this.gT ? -Math.abs(Math.sin(this.st * 0.2)) * 3 : 0;
    this.spr(ctx, id, f, cx, cy + dy, { flash: this.flashT > 0 });
  }
}

// ============================================================================================== 3. THE SERAPH OF ASH (angel)
export class BossAngel extends Boss {
  constructor(g, x, y, o) { super(g, x, y + 36, 34, 72, o); this.hp = this.maxHp = 340; this.dmg = 14; this.xp = 200; this.bossName = 'THE SERAPH OF ASH'; this.voice = 'angel'; this.sub = 'FALLEN GUARDIAN OF THE CHAPEL'; this.gravity = false; this.deathFx = COLORS.ice; this.dive = null; this.ice = { w: 84, h: 88 }; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  dangerous() { return this.state === 'dive' && this.st >= 44 && this.st < 92; }
  intro(g) { if (this.st === 8) { this.cry(); g.shake(3, 40); g.fx.flash([1, 1, 1], 0.5); g.fx.ring(this.x, this.cy, 130, [0.9, 0.95, 1], 40, 0.1); } g.fx.glow(this.x, this.cy, 70, [0.8, 0.9, 1], 0.5); this.faceP(); }
  physics() { this.x += this.vx; this.y += this.vy; const r = this.g.room; this.x = clamp(this.x, 34, r.pw - 34); this.y = clamp(this.y, 70, r.ph - 40); if (this.flashT > 0) this.flashT--; }
  moveTo(tx, ty, k = 0.04, max = 2.2) { this.vx = clamp((tx - this.x) * k, -max, max); this.vy = clamp((ty - this.cy) * k, -max, max); }
  groundY() { return this.g.room.ph - 32; }
  ai(g) {
    const p = g.player, spd = this.spd;
    g.fx.glow(this.x, this.cy, 56 + Math.sin(this.t * 0.1) * 6, [0.85, 0.92, 1], 0.28); g.fx.light(this.x, this.cy, 110, 0.9);
    if (this.t % 7 === 0) g.fx.emit({ x: this.x + rand(-34, 34), y: this.cy + rand(-30, 20), vx: rand(-0.2, 0.2), vy: rand(0.1, 0.4), life: 50, s0: 6, s1: 1, c0: [1, 1, 1], c1: [0.7, 0.8, 1], a0: 1, a1: 0, kind: 6 });
    switch (this.state) {
      case 'idle': this.faceP(); this.moveTo(clamp(p.x + Math.sin(this.t * 0.02) * 80, 60, g.room.pw - 60), 80 + Math.sin(this.t * 0.05) * 12, 0.03);
        this.planNext(this.phase === 2 ? ['feathers', 'strikes', 'dive', 'strikes'] : ['feathers', 'strikes', 'dive'], Math.round(96 / spd)); break;
      case 'feathers': {
        this.faceP(); this.moveTo(this.x, 80, 0.05); const times = this.phase === 2 ? [38, 68, 98] : [38, 72];
        if (this.st < 38) this.tell('feathers', this.st / 38, [{ type: 'line', x0: this.x, y0: this.cy, x1: p.x, y1: p.y - 20 }]);
        if (times.includes(this.st)) { A.sfx('cast'); const base = Math.atan2(p.y - 24 - this.cy, p.x - this.x), n = this.phase === 2 ? 7 : 5; for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.22; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a) * 2.0, Math.sin(a) * 2.0, 'feather', { dmg: 9, life: 260 })); } g.fx.ring(this.x, this.cy, 40, [0.9, 0.95, 1], 16); }
        if (this.st > times[times.length - 1] + 40) { this.state = 'idle'; this.st = -20; } break; }
      case 'strikes':
        this.moveTo(g.room.pw / 2, 78, 0.04); if (this.st < 18) this.tell('strikes', this.st / 18);
        if (this.st === 18) { this.cry(); const waves = this.phase === 2 ? 2 : 1; for (let w = 0; w < waves; w++) for (let i = 0; i < 3; i++) { const x = clamp(w === 0 ? p.x + (i - 1) * 64 + rand(-8, 8) : rand(50, g.room.pw - 50), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.groundY(), 'bolt', { warn: 62 + w * 44, active: 14, dmg: 14, w: 28, h: 220 })); } }
        if (this.st > (this.phase === 2 ? 190 : 130)) { this.state = 'idle'; this.st = -20; } break;
      case 'dive': {
        if (this.st < 20) { this.moveTo(clamp(p.x, 80, g.room.pw - 80) + (p.x < g.room.pw / 2 ? 90 : -90), 66, 0.05); this.faceP(); this.tell('dive', this.st / 44); if (this.st === 2) this.cry(); }
        else if (this.st < 44) { this.vx *= 0.8; this.vy *= 0.8; if (this.st === 20) this.dive = { x: p.x, y: p.y - 18 };    // target locks here - you have ~0.4s to move out of the line
          this.tell('dive', this.st / 44, [{ type: 'line', x0: this.x, y0: this.cy, x1: this.dive.x + (this.dive.x - this.x) * 0.6, y1: this.dive.y + (this.dive.y - this.cy) * 0.6 }]); g.fx.ring(this.x, this.cy, 20 + (this.st - 20) * 1.5, [1, 0.9, 0.6], 10, 0.3, 4); }
        else if (this.st === 44) { const a = Math.atan2(this.dive.y - this.cy, this.dive.x - this.x); this.vx = Math.cos(a) * 4.2 * spd; this.vy = Math.sin(a) * 4.2 * spd; A.sfx('slash'); }
        else if (this.st < 92) { g.fx.burst(this.x, this.cy, 2, [[1, 1, 1], [0.6, 0.7, 1]], { speed: 0.5, s0: 20, s1: 4, l0: 12, l1: 22 }); const r = g.room; if (this.cy > r.ph - 70 || this.x < 50 || this.x > r.pw - 50) this.st = 92; }
        else { this.moveTo(this.x, 84, 0.04); this.vx *= 0.9; if (this.st > 120) { this.state = 'idle'; this.st = -30; } } break; }
    }
  }
  draw(ctx, cx, cy) {
    let id = 'angel_idle', f = Math.floor(this.t / 7) % 8; if (this.state === 'feathers' || this.state === 'strikes' || (this.state === 'dive' && this.st < 44)) { id = 'angel_attack'; f = Math.floor(this.t / 6) % 3; }
    drawSheet(ctx, id, f, this.x - cx, this.cy - cy + Math.sin(this.t * 0.08) * 2, { flash: this.flashT > 0, ay: 0.6, scale: 1, dir: this.dir });
  }
}

// ============================================================================================== 4. THE BRAZEN HIEROPHANT  (code id: colossus)
// The master of the Underworks: a giant of the bronze-robed, silver-masked mage (Ars Notoria mage 1, drawn at 1.15).  He hovers a little above the floor; the quake attack lifts him high (the tell), then drops him.
// ------------------------------------------------------------------------------------------------ THE LIBRARIAN
// A robed keeper of the Lord's archive, hanging in the air among the shelves.  He tears pages from his own books and flings them, brings whole shelves down on you (look for the markers on the floor),
// calls haunted tomes out of the stacks, and - angrier, in his second phase - bursts into rings of ink.  He guards the KEY OF GOLD, the key to the Shadow Throne.
export class BossLibrarian extends Boss {
  constructor(g, x, y, o) { super(g, x, y + 40, 40, 80, o); this.hp = this.maxHp = 520; this.dmg = 15; this.xp = 320; this.bossName = 'THE LIBRARIAN'; this.voice = 'librarian'; this.sub = 'KEEPER OF THE KEY OF GOLD'; this.gravity = false; this.deathFx = [[1, 0.85, 0.5], [0.5, 0.3, 0.1]]; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  intro(g) { if (this.st === 8) { this.cry(); g.shake(3, 40); g.fx.flash([1, 0.9, 0.6], 0.4); g.fx.ring(this.x, this.cy, 120, [1, 0.85, 0.5], 40, 0.1); } g.fx.glow(this.x, this.cy, 70, [1, 0.8, 0.4], 0.5); this.faceP(); }
  physics() { this.x += this.vx; this.y += this.vy; const r = this.g.room; this.x = clamp(this.x, 40, r.pw - 40); this.y = clamp(this.y, 70, r.ph - 40); if (this.flashT > 0) this.flashT--; }
  moveTo(tx, ty, k = 0.04, max = 2) { this.vx = clamp((tx - this.x) * k, -max, max); this.vy = clamp((ty - this.cy) * k, -max, max); }
  groundY() { return this.g.room.ph - 32; }
  die() { const r = this.g.room; if (!this.dying && r.bookWall) { for (const k of [...r.bookWall.keys()]) { const [tx, ty] = k.split(',').map(Number); if (r.get(tx, ty) === 4) this.g.breakTile(tx, ty); } r.bookWall.clear(); } super.die(); }          // (when he falls, the walls of books he made fall with him)
  ai(g) {
    const p = g.player, spd = this.spd;
    g.fx.glow(this.x, this.cy, 54 + Math.sin(this.t * 0.1) * 6, [1, 0.82, 0.45], 0.26); g.fx.light(this.x, this.cy, 120, 0.85, [1, 0.8, 0.45]);
    if (this.t % 6 === 0) g.fx.emit({ x: this.x + rand(-30, 30), y: this.cy + rand(-34, 24), vx: rand(-0.3, 0.3), vy: rand(0.1, 0.5), life: 60, s0: 4, s1: 2, c0: [0.95, 0.9, 0.7], c1: [0.7, 0.6, 0.4], a0: 0.9, a1: 0, kind: 1 });          // loose pages drifting about him
    switch (this.state) {
      case 'idle': this.faceP(); this.moveTo(clamp(p.x + Math.sin(this.t * 0.02) * 90, 70, g.room.pw - 70), 92 + Math.sin(this.t * 0.05) * 12, 0.03);
        this.planNext(this.phase === 2 ? ['pages', 'shelves', 'tomes', 'ink', 'pages', 'shelves'] : ['pages', 'shelves', 'tomes'], Math.round(96 / spd)); break;
      case 'pages': {
        this.faceP(); this.moveTo(this.x, 92, 0.05); const times = this.phase === 2 ? [38, 66, 94] : [38, 72];
        if (this.st < 38) this.tell('pages', this.st / 38, [{ type: 'line', x0: this.x, y0: this.cy, x1: p.x, y1: p.y - 20 }]);
        if (times.includes(this.st)) { A.sfx('page'); const base = Math.atan2(p.y - 24 - this.cy, p.x - this.x), n = this.phase === 2 ? 7 : 5; for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.2; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a) * 2.0, Math.sin(a) * 2.0, 'page', { dmg: 9, life: 260 })); } g.fx.ring(this.x, this.cy, 40, [1, 0.9, 0.6], 16); }
        if (this.st > times[times.length - 1] + 40) { this.state = 'idle'; this.st = -20; } break; }
      case 'ink': {
        this.moveTo(g.room.pw / 2, 88, 0.04); if (this.st < 30) this.tell('ink', this.st / 30);
        for (const [k, at] of [[0, 30], [1, 46], [2, 62]]) if (this.st === at) { A.sfx('ink'); g.fx.ring(this.x, this.cy, 46, [1, 0.8, 0.3], 18); for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9 + k * 0.35; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 'ink', { dmg: 9, life: 280 })); } }
        if (this.st > 110) { this.state = 'idle'; this.st = -20; } break; }
      case 'shelves': {
        this.moveTo(g.room.pw / 2, 84, 0.04); if (this.st < 20) this.tell('shelves', this.st / 20);
        if (this.st === 20) { this.cry(); const waves = this.phase === 2 ? 2 : 1; let room_ = 6 - g.projectiles.filter(q => q instanceof BookFall && !q.dead).length - Math.floor((g.room.bookWall ? g.room.bookWall.size : 0) / 10); for (let w = 0; w < waves; w++) for (let i = 0; i < 3 && room_ > 0; i++, room_--) { const x = clamp(w === 0 ? p.x + (i - 1) * 70 + rand(-8, 8) : rand(50, g.room.pw - 50), 30, g.room.pw - 30); g.addProjectile(new BookFall(g, x, { warn: 62 + w * 44, dmg: 14 })); } }
        if (this.st > (this.phase === 2 ? 190 : 130)) { this.state = 'idle'; this.st = -20; } break; }
      case 'tomes': {
        this.moveTo(this.x, 90, 0.05); if (this.st < 24) this.tell('tomes', this.st / 24);
        if (this.st === 24) { this.cry(); const alive = g.enemies.filter(e => e.name === 'tome' && !e.dead).length; for (let i = 0, n = Math.min(this.phase === 2 ? 3 : 2, 5 - alive); i < n; i++) { const bx = this.x + (i - (n - 1) / 2) * 40; g.fx.burst(bx, this.cy, 12, [[0.95, 0.9, 0.7], [0.5, 0.35, 0.2]], { speed: 2, s0: 12 }); g.spawnEnemy('tome', Math.floor(bx / 16), Math.floor(this.cy / 16), {}); } }
        if (this.st > 84) { this.state = 'idle'; this.st = -20; } break; }
    }
  }
  draw(ctx, cx, cy) {
    let id = 'libr_r0', f = Math.floor(this.t / 8) % 4; if (this.state === 'pages' || this.state === 'ink' || this.state === 'shelves' || this.state === 'tomes') { id = 'libr_r1'; f = Math.floor(this.t / 6) % 4; }
    drawSheet(ctx, id, f, this.x - cx, this.cy - cy + Math.sin(this.t * 0.08) * 2 + 8, { flash: this.flashT > 0, ay: 0.6, scale: 0.85, dir: this.dir });
  }
}

// ------------------------------------------------------------------------------------------------ THE RIMEWYRM
// The cold that came up from the foundations, grown into a serpent: a great frost wyrm that keeps the KEY OF ANTIMONY at the heart of the Frozen Caverns.  It flies a lazy figure over the arena,
// then DIVES at where you stand, thrusts ICE SPIKES up through the floor, and shakes ICICLES from the roof.  Now and then it coils up and freezes itself in a SHELL of ice: no blade can touch it
// while it is in there, and it rains icicles to keep you moving - but a flame (the Ember spell, a thrown torch) cracks the shell, and the wyrm drops to the floor, stunned and brittle, for a few seconds.
// Leave the shell alone and it thaws on its own, healing and flinging shards.  In its second half the lights of the cavern go out and a BLIZZARD leans on you.
const RW = { scale: 1.2, segs: 17, gap: 23, hit: 21, touch: 19 };          // (half the size it was, and half as many segments again: each of the 17 segments falls away as it is hurt - and each one lost makes the rest quicker.  gap, hit and touch are the segment spacing and the sizes of the boxes a blade / the hero's body meets, all halved with the sprites)
const rot16 = a => ((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16;
const angDiff = (a, b) => ((b - a + 3 * Math.PI) % (Math.PI * 2)) - Math.PI;
export class BossRimewyrm extends Boss {
  constructor(g, x, y, o) {
    super(g, x, y + 14, 35, 29, o); this.hp = this.maxHp = 560; this.dmg = 16; this.xp = 380; this.bossName = 'THE RIMEWYRM'; this.voice = 'rimewyrm'; this.sub = 'WARDEN OF THE KEY OF ANTIMONY'; this.gravity = false; this.deathFx = COLORS.ice; this.triggerDist = 260; this.noDrop = true; this.alive = RW.segs; this.chunks = []; this.rage = 1; this.rageT = 1;
    this.ang = Math.PI; this.dir = -1; this.trail = []; this.parts = Array.from({ length: RW.segs + 1 }, () => ({ x, y })); this.rime = 0; this.rimeT = 0; this.bodyHit = false; this.lock = { x, y }; this.wind = 0; this.nIcicle = 0;
  }
  get spd() { return (this.phase === 2 ? 1.22 : 1) * this.rage; }
  intro(g) { if (this.st === 8) { this.cry(); g.shake(4, 40); g.fx.flash([0.7, 0.9, 1], 0.4); g.fx.ring(this.x, this.cy, 120, [0.6, 0.85, 1], 40, 0.1); } g.fx.glow(this.x, this.cy, 70, [0.5, 0.8, 1], 0.5); this.steerSoft(g.room.pw / 2, 104, 1.2); }
  // THE BODY FALLS AWAY: it has 17 segments, and loses one each time its life drops by a seventeenth.  A lost segment tumbles off and shatters on the floor; every one lost makes the wyrm quicker (up to 75% quicker when only the head is left).
  onHurt(dmg, dir, opts) { super.onHurt(dmg, dir, opts); this.syncSegs(); }
  syncSegs() { const want = Math.max(0, Math.ceil(RW.segs * Math.max(0, this.hp) / this.maxHp)); while (this.alive > want) this.dropSeg(); this.rageT = 1 + 0.75 * (RW.segs - this.alive) / RW.segs; }
  dropSeg() {
    const g = this.g, q = this.parts[this.alive - 1]; this.alive--; this.chunks.push({ x: q.x, y: q.y, vx: rand(-1.4, 1.4), vy: -rand(1, 2.4), rot: rand(0, 6), vr: rand(-0.2, 0.2), life: 200 });
    g.fx.burst(q.x, q.y, 10, COLORS.ice, { speed: 2.4, s0: 12 }); g.fx.sparks(q.x, q.y, 8, COLORS.white, 3, { gy: 0.2 }); A.sfx('shatter'); g.shake(3, 10); g.popup(q.x, q.y - 30, 'SEGMENT LOST', '#bfe4ff');
  }
  groundY() { return this.g.room.ph - 32; }
  steerSoft(tx, ty, max = 1.7, k = 0.05) { this.vx += (clamp((tx - this.x) * k, -max, max) - this.vx) * 0.09; this.vy += (clamp((ty - this.cy) * k, -max, max) - this.vy) * 0.09; }
  physics() {                      // it has no weight: it flies where it is steered, the body following the head's path
    const r = this.g.room; this.x += this.vx; this.y += this.vy; this.x = clamp(this.x, 50, r.pw - 50); this.y = clamp(this.y, 90 + 14, r.ph - 60 + 14); if (this.flashT > 0) this.flashT--;
    for (const c of this.chunks) { c.vy += 0.25; c.x += c.vx; c.y += c.vy; c.rot += c.vr; if (--c.life <= 0 || c.y > r.ph - 30) { if (c.life > 0) { this.g.fx.burst(c.x, r.ph - 34, 10, COLORS.ice, { speed: 2.2, s0: 11 }); this.g.fx.sparks(c.x, r.ph - 34, 6, COLORS.white, 2.8, { gy: 0.2 }); A.sfx('shatter'); } c.life = 0; } }
    this.chunks = this.chunks.filter(c => c.life > 0);
    const sp = Math.hypot(this.vx, this.vy); if (sp > 0.25) this.ang += clamp(angDiff(this.ang, Math.atan2(this.vy, this.vx)), -0.12, 0.12); this.dir = Math.cos(this.ang) >= 0 ? 1 : -1;
    const last = this.trail[0]; if (!last || (this.x - last.x) ** 2 + (this.cy - last.y) ** 2 > 1) { this.trail.unshift({ x: this.x, y: this.cy }); if (this.trail.length > RW.segs * RW.gap + 30) this.trail.length = RW.segs * RW.gap + 30; }
    const P = this.parts; let k = 0, acc = 0, ax = this.x, ay = this.cy;
    for (const q of this.trail) { const seg = Math.hypot(q.x - ax, q.y - ay); while (k < P.length && acc + seg >= RW.gap * (k + 1)) { const f = (RW.gap * (k + 1) - acc) / (seg || 1); P[k].x = ax + (q.x - ax) * f; P[k].y = ay + (q.y - ay) * f; k++; } acc += seg; ax = q.x; ay = q.y; if (k >= P.length) break; }
    for (; k < P.length; k++) { P[k].x = ax; P[k].y = ay; }
  }
  hitBy(box) { if (overlap(box, this.hurtbox)) { this.bodyHit = false; return true; } for (let i = 0; i <= this.alive; i++) { const q = this.parts[i]; if (overlap(box, { x: q.x - RW.hit / 2, y: q.y - RW.hit / 2, w: RW.hit, h: RW.hit })) { this.bodyHit = true; return true; } } return false; }
  modifyDamage(d) { const b = this.bodyHit; this.bodyHit = false; return Math.max(1, Math.round(b ? d * 0.65 : d)); }
  touch() {
    const p = this.g.player; if (this.harmless || this.dead || this.dying) return;
    if (overlap(this.hurtbox, p.hurtbox)) { p.hurt(this.dangerous() ? this.dmg : Math.max(3, Math.round(this.dmg * 0.4)), this.x); return; }
    for (let i = 0; i <= this.alive; i++) { const q = this.parts[i]; if (overlap({ x: q.x - RW.touch / 2, y: q.y - RW.touch / 2, w: RW.touch, h: RW.touch }, p.hurtbox)) { p.hurt(Math.max(4, Math.round(this.dmg * 0.4)), q.x); return; } }
  }
  dangerous() { return this.state === 'swoop' && this.st >= Math.round(46 / this.spd) && this.st < Math.round(46 / this.spd) + 40; }
  // while it is in its shell, a blade does nothing; fire cracks the shell; and when it is stunned every blow lands harder
  hurt(dmg, dir, opts = {}) {
    const g = this.g;
    if (this.rime > 0 && this.active && !this.dying) {
      if (opts.fire) { this.melt(g); return true; }
      if (!this.blockT || this.t - this.blockT > 14) { this.blockT = this.t; A.sfx('block'); g.popup(this.x, this.y - 54, 'ICE', '#cfe8ff'); g.fx.sparks(this.x, this.cy, 5, COLORS.white, 2.4); }
      return false;
    }
    if (this.state === 'stunned') dmg = Math.round(dmg * 1.6);
    return super.hurt(dmg, dir, opts);
  }
  melt(g) {                        // the shell cracks and falls away: the wyrm drops, stunned
    this.rime = 0; this.state = 'stunned'; this.st = 0; this.plan = null; this.harmless = true;
    A.sfx('shatter'); A.sfx('boom'); g.shake(6, 22); g.fx.flash([1, 0.85, 0.6], 0.3); g.fx.ring(this.x, this.cy, 80, [1, 0.8, 0.5], 24, 0.14);
    for (const q of [{ x: this.x, y: this.cy }, ...this.parts]) { g.fx.burst(q.x, q.y, 9, COLORS.ice, { speed: 2.6, s0: 12 }); g.fx.sparks(q.x, q.y, 6, COLORS.white, 3.4, { gy: 0.2 }); g.fx.smoke(q.x, q.y, 1, { c0: [0.9, 0.95, 1], c1: [0.6, 0.7, 0.85], s0: 6, s1: 22, l: 0.6 }); }
    g.popup(this.x, this.y - 54, 'MELTED!', '#ffd49a');
  }
  thaw(g) {                        // the shell thaws by itself: the wyrm heals a little and flings shards all round
    this.rime = 0; this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.08)); this.cry(); A.sfx('shatter'); g.shake(4, 16); g.fx.ring(this.x, this.cy, 90, [0.6, 0.85, 1], 28, 0.14);
    const n = this.phase === 2 ? 12 : 9; for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a) * 1.7, Math.sin(a) * 1.7, 'tide', { dmg: 8, life: 220 })); }
    g.popup(this.x, this.y - 54, 'THAWED', '#bfe4ff'); this.state = 'idle'; this.st = -30; this.plan = null;
  }
  onPhase2() {                     // the lights go out
    const g = this.g; g.fx.flash([0.7, 0.9, 1], 0.5); g.shake(5, 24); this.cry(); g.fx.ring(this.x, this.cy, 100, [0.6, 0.85, 1], 34, 0.14);
    dropItem(g, 'heart', this.x - 36, this.cy - 10); dropItem(g, 'mana', this.x + 36, this.cy - 10); dropItem(g, 'mana', this.x, this.cy - 20);
    this.rime = 0; this.harmless = false; this.state = 'idle'; this.st = -40; this.plan = null; g.fx.wisps.set(0); g.fx.setDark(0.85); g.popup(this.x, this.y - 54, 'THE LIGHTS GO OUT', '#bfe4ff');
  }
  die() { const g = this.g, r = g.room; if (!this.dying) { g.fx.setAmbient(r.ambient, r.tint, r.vig); g.fx.setWisps(r.wisps || 0); for (const ic of g.icicles || []) ic.dead = true; } super.die(); }
  mouth() { return { x: this.x + this.dir * 26, y: this.cy + 2 }; }          // (where the breath comes from)
  fallIcicle(x, delay = 0, len = 30) { const ic = new Icicle({ x, y: 32, len: len + rand(0, 8), w: 9 }); ic.dmg = Math.round(9 * (this.dmgK || 1)); ic.state = 1; ic.t = -delay; this.g.icicles.push(ic); }
  ai(g) {
    const p = g.player, spd = this.spd, r = g.room, pw = r.pw, cold = [0.55, 0.82, 1], T0 = Math.round(46 / spd);
    g.fx.light(this.x, this.cy, this.phase === 2 ? 160 : 110, this.phase === 2 ? 0.85 : 0.55, cold); g.fx.glow(this.x, this.cy, 46 + Math.sin(this.t * 0.1) * 5, cold, 0.2);
    if (this.t % 4 === 0) g.fx.emit({ x: this.x + rand(-26, 26), y: this.cy + rand(-20, 20), vx: rand(-0.2, 0.2), vy: rand(0.1, 0.5), life: 50, s0: 4, s1: 1, c0: [0.85, 0.95, 1], c1: [0.5, 0.75, 1], a0: 0.9, a1: 0, kind: 1 });
    switch (this.state) {
      case 'idle':
        this.rage += (this.rageT - this.rage) * 0.05;
        this.steerSoft(clamp(p.x + Math.sin(this.t * 0.021) * 170, 80, pw - 80), 92 + Math.sin(this.t * 0.037) * 26, 1.5 * spd);
        this.planNext(this.phase === 2 ? ['swoop', 'spikes', 'icefall', 'encase', 'blizzard', 'swoop', 'frostbreath', 'frostbreath'] : ['swoop', 'spikes', 'icefall', 'encase', 'swoop', 'frostbreath'], Math.round(88 / spd)); break;
      case 'swoop': {
        if (this.st < T0) {                                                       // it rears back, the line to you showing where it will dive (the line stops following you in the last moments)
          if (this.st < T0 - 12) this.lock = { x: p.x, y: p.y - 18 };
          this.steerSoft(this.x - Math.sign(this.lock.x - this.x) * 40, 74, 0.9); this.tell('swoop', this.st / T0, [{ type: 'line', x0: this.x, y0: this.cy, x1: this.lock.x, y1: this.lock.y }]);
        } else if (this.st === T0) { this.cry(); g.shake(3, 12); const dx = this.lock.x - this.x, dy = this.lock.y - this.cy, d = Math.hypot(dx, dy) || 1, sp = 5.4 * spd; this.vx = dx / d * sp; this.vy = dy / d * sp; }
        else if (this.st < T0 + 38) { if (this.cy > r.ph - 52 && this.vy > 0) { this.vy = -Math.abs(this.vy) * 0.25; this.vx *= 0.9; g.shake(2, 6); } g.fx.sparks(this.x, this.cy, 2, COLORS.white, 2, { gy: 0.05 }); }
        else if (this.st < T0 + 86) { this.steerSoft(clamp(this.x, 80, pw - 80), 88, 2.2); }
        else { this.state = 'idle'; this.st = -20; } break; }
      case 'spikes': {
        this.steerSoft(clamp(p.x, 90, pw - 90), 98, 1.8 * spd); if (this.st < 26) this.tell('spikes', this.st / 26);
        if (this.st === 26) { this.cry(); const n = this.phase === 2 ? 7 : 5; for (let i = 0; i < n; i++) { const off = i - (n - 1) / 2, x = clamp(p.x + off * 54 + rand(-6, 6), 26, pw - 26); g.addProjectile(new Column(x, this.groundY(), 'rime', { warn: 54 + Math.abs(off) * 9, active: 38, dmg: 13, w: 30, h: 84 })); } }
        if (this.st > 126) { this.state = 'idle'; this.st = -20; } break; }
      case 'icefall': {
        this.steerSoft(clamp(pw - p.x, 100, pw - 100), 76, 1.4); if (this.st < 30) this.tell('icefall', this.st / 30);
        if (this.st === 30) { this.cry(); g.shake(3, 30); const n = this.phase === 2 ? 9 : 6; for (let i = 0; i < n; i++) this.fallIcicle(clamp(i < 6 ? p.x + (i - 2.5) * 52 + rand(-10, 10) : rand(40, pw - 40), 30, pw - 30), i * 6); }
        if (this.st > 150) { this.state = 'idle'; this.st = -20; } break; }
      case 'encase': {
        const E0 = 50;
        if (this.st < E0) { this.steerSoft(pw / 2, 104, 1.6); this.tell('encase', this.st / E0); if (this.st === 2) A.sfx('freeze'); if (this.st % 5 === 0) g.fx.sparks(this.x + rand(-30, 30), this.cy + rand(-20, 20), 3, COLORS.white, 2, { gy: 0.05 }); }
        else if (this.st === E0) { this.rime = 1; this.rimeT = this.phase === 2 ? 330 : 420; this.vx = this.vy = 0; A.sfx('seal'); g.shake(4, 14); g.fx.flash([0.7, 0.9, 1], 0.3); dropItem(g, 'mana', p.x - 40, p.y - 40); dropItem(g, 'mana', p.x + 40, p.y - 40); g.popup(this.x, this.y - 54, 'USE FIRE!', '#ffd49a'); }
        else {                                                                    // in its shell: it drifts, shaking icicles from the roof to keep you moving
          this.steerSoft(pw / 2 + Math.sin(this.t * 0.02) * 60, 108, 0.5); this.rimeT--; if (this.t % 3 === 0) g.fx.emit({ x: this.x + rand(-30, 30), y: this.cy + rand(-26, 26), vx: rand(-0.3, 0.3), vy: rand(0.1, 0.6), life: 40, s0: 5, s1: 1, c0: [0.9, 0.97, 1], c1: [0.55, 0.8, 1], a0: 0.8, a1: 0, kind: 6 });
          if (this.rimeT % (this.phase === 2 ? 40 : 52) === 0) this.fallIcicle(clamp(p.x + rand(-40, 40), 30, pw - 30));
          if (this.rimeT <= 0) this.thaw(g);
        } break; }
      case 'stunned': {                                                           // dropped to the floor: brittle, and open to every blow
        this.steerSoft(this.x, r.ph - 64, 1.6); if (this.t % 6 === 0) g.fx.smoke(this.x, this.cy - 6, 1, { c0: [0.9, 0.95, 1], c1: [0.6, 0.7, 0.85], s0: 5, s1: 16, l: 0.5 });
        if (this.st > 190) { this.harmless = false; this.state = 'idle'; this.st = -30; this.plan = null; } break; }
      case 'frostbreath': {                                                       // it hangs back and rears up, the whole sweep of the breath shown on the ground; then a cone of killing cold sweeps across it.  A hit CHILLS you: a few seconds at half speed.  (A dash goes through it.)
        const W0 = Math.round(52 / spd), W = W0 + 120, N = this.phase === 2 ? 72 : 58, L = this.phase === 2 ? 250 : 220, SW = 0.45;          // (the rear-up before the breath: +120 frames = a flat 2 seconds longer, however fast it is.  It still follows you for the first W0 - 14 frames, then the aim LOCKS and the wyrm hangs still, so the cone on the floor shows where the breath will land for the whole of the extra time)
        if (this.st === 1) { this.fbSide = p.x < pw / 2 ? 1 : -1; this.fbSweep = Math.random() < 0.5 ? -1 : 1; }
        if (this.st < W) {
          if (this.st < W0 - 14) { this.steerSoft(clamp(p.x + this.fbSide * 210, 90, pw - 90), 108, 1.8 * spd); this.dir = p.x >= this.x ? 1 : -1; this.ang = this.dir > 0 ? 0 : Math.PI; this.lock = { x: p.x, y: p.y - 16 }; }
          else { this.vx *= 0.7; this.vy *= 0.7; }          // (locked: it brakes and hangs where it is, so the cone does not slide about)
          const m = this.mouth(), a0 = Math.atan2(this.lock.y - m.y, this.lock.x - m.x), pt = a => [m.x + Math.cos(a) * L, m.y + Math.sin(a) * L];
          this.fbA = a0; this.tell('frostbreath', this.st / W, [{ type: 'poly', pts: [[m.x, m.y], pt(a0 - SW - 0.12), pt(a0 - SW / 2), pt(a0), pt(a0 + SW / 2), pt(a0 + SW + 0.12)] }]);
        } else if (this.st < W + N) {
          this.steerSoft(this.x, this.cy, 0.3); this.dir = Math.cos(this.fbA) >= 0 ? 1 : -1; this.ang = this.dir > 0 ? 0 : Math.PI;
          const s = (this.st - W) / N, ang = this.fbA + this.fbSweep * (s - 0.5) * 2 * SW, m = this.mouth(), k = Math.min(1, (this.st - W) / 10, (W + N - this.st) / 12);
          g.fx.frostBreath(m.x, m.y, ang, k); g.fx.light(m.x + Math.cos(ang) * 70, m.y + Math.sin(ang) * 70, 150, 0.9, [0.6, 0.85, 1]);
          if (this.st === W) { this.cry(); A.sfx('freeze'); g.shake(2, 10); } if ((this.st - W) % 18 === 0) A.sfx('steam');
          if (this.st % 3 === 0) for (let j = 1; j <= 9; j++) { const d = j * L / 9, hx = m.x + Math.cos(ang) * d, hy = m.y + Math.sin(ang) * d, hw = 12 + j * 6;
            if (overlap({ x: hx - hw / 2, y: hy - hw / 2, w: hw, h: hw }, p.hurtbox)) { if (p.hurt(Math.round(9 * (this.dmgK || 1)), this.x, { kb: 0.9, stun: 10, inv: 55 })) p.chill(this.phase === 2 ? 300 : 240); break; } }
        } else { this.state = 'idle'; this.st = -24; } break; }
      case 'blizzard': {
        if (this.st === 1) this.wind = Math.random() < 0.5 ? -1 : 1;
        this.steerSoft(pw / 2, 84, 1.2); if (this.st < 40) this.tell('blizzard', this.st / 40, [{ type: 'rect', x: this.wind > 0 ? 0 : pw - 60, y: r.ph - 70, w: 60, h: 38 }]);
        else if (this.st < 200) {                                                 // the wind leans on you (the ice does the rest) and shards fall in it
          if (this.st === 40) A.sfx('ghost'); p.vx += this.wind * (p.onGround ? 0.045 : 0.025);
          for (let i = 0; i < 2; i++) g.fx.emit({ x: this.wind > 0 ? g.camera.x - 10 : g.camera.x + 394, y: g.camera.y + rand(10, 210), vx: this.wind * rand(5, 8), vy: rand(-0.3, 0.6), life: 60, s0: 3, s1: 1, c0: [0.95, 0.98, 1], a0: 0.7, a1: 0, kind: 1 });
          if (this.st % 22 === 0) g.addProjectile(new Projectile(clamp(p.x + rand(-120, 120), 30, pw - 30), 30, this.wind * 0.6, 1.2, 'tide', { dmg: 7, life: 200, grav: 0.02 }));
        } else { this.state = 'idle'; this.st = -20; } break; }
    }
  }
  draw(ctx, cx, cy) {
    const P = this.parts, n = this.alive, sh = Math.floor(this.t / 6) % 5, o = { flash: this.flashT > 0, scale: RW.scale, ay: 0.5 }, id = 'ct_frost';
    for (const c of this.chunks) drawSheet(ctx, id + '_seg', sh * 16 + rot16(c.rot), c.x - cx, c.y - cy, { ...o, alpha: Math.min(1, c.life / 40) });          // (a lost segment, tumbling)
    const tl = P[n], tp = n > 0 ? P[n - 1] : { x: this.x, y: this.cy }; drawSheet(ctx, id + '_tail', sh * 16 + rot16(Math.atan2(tl.y - tp.y, tl.x - tp.x)), tl.x - cx, tl.y - cy, o);
    for (let i = n - 1; i >= 0; i--) { const q = P[i], f = i === 0 ? { x: this.x, y: this.cy } : P[i - 1], dx = f.x - q.x, dy = f.y - q.y; drawSheet(ctx, id + '_seg', sh * 16 + rot16(Math.atan2(dy, -Math.abs(dx)) + Math.PI), q.x - cx, q.y - cy, { ...o, dir: dx > 0 ? -1 : 1 }); }
    const T0 = Math.round(46 / this.spd), pose = this.state === 'swoop' ? (this.st < T0 ? 2 : 1) : this.state === 'stunned' ? 2 : this.state === 'frostbreath' ? 2 : this.intent ? 2 : 0;
    let rot = this.dir > 0 ? this.ang : this.ang - Math.PI; rot = Math.atan2(Math.sin(rot), Math.cos(rot));
    drawSheet(ctx, id + '_head', pose * 5 + sh, this.x - cx, this.cy - cy, { ...o, dir: this.dir, rot: clamp(rot, -1.2, 1.2) * 0.85 });
    const shell = this.rime > 0 ? 1 : this.state === 'encase' ? clamp(this.st / 50, 0, 1) : 0;
    if (shell > 0) {                                                                // the shell of ice: a lump over the head and over every joint of the body
      const pts = [{ x: this.x, y: this.cy, r: 26 }, ...P.slice(0, n + 1).map((q, i) => ({ x: q.x, y: q.y, r: (26 - i * 0.65) * 0.75 }))];
      ctx.save(); for (const q of pts) { const x = Math.round(q.x - cx), y = Math.round(q.y - cy), rr = q.r * shell;
        ctx.fillStyle = 'rgba(120,190,225,' + (0.5 * shell).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(235,250,255,' + (0.85 * shell).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, Math.max(0, rr - 0.5), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * shell).toFixed(2) + ')'; ctx.fillRect(x - rr * 0.5, y - rr * 0.55, rr * 0.5, 2); ctx.fillRect(x - rr * 0.55, y - rr * 0.55, 2, rr * 0.5); }
      ctx.restore();
    }
  }
}

export class BossColossus extends Boss {
  constructor(g, x, y, o) { super(g, x, y, 46, 100, o); this.hp = this.maxHp = 420; this.dmg = 16; this.xp = 260; this.bossName = 'THE BRAZEN HIEROPHANT'; this.voice = 'colossus'; this.sub = 'MASTER OF THE UNDERWORKS'; this.scale = 1.15; this.dir = -1; this.deathFx = COLORS.gold; this.ice = { w: 84, h: 116 }; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  intro(g) { if (this.st === 8) { A.sfx('boom'); g.shake(5, 50); g.fx.flash([1, 0.6, 0.3], 0.3); A.sfx('steam'); } if (this.st % 8 === 0) g.fx.smoke(this.x + rand(-20, 20), this.y - 96, 1, { s0: 10, s1: 26, c0: [0.8, 0.82, 0.88], c1: [0.4, 0.42, 0.5], a: 0.4 }); this.faceP(); }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx());
    if (this.t % 4 === 0) g.fx.glow(this.x, this.y - 84, 14, [1, 0.62, 0.2], 0.55); g.fx.light(this.x, this.y - 60, 90, 0.6);
    switch (this.state) {
      case 'idle': this.faceP(); this.vx = approach(this.vx, d > 70 ? this.dir * 0.4 * spd : 0, 0.05); if (this.t % 28 === 0 && Math.abs(this.vx) > 0.2) { A.sfx('boom'); g.shake(1, 6); }
        this.planNext(d < 120 ? ['slam', 'slam', 'vents', 'gears'] : ['vents', 'gears', 'slam'], Math.round(92 / spd)); break;
      case 'slam': {
        const T0 = Math.round(54 / spd); this.vx = 0; if (this.st === 1) { this.faceP(); A.sfx('steam'); }
        const hb = { x: this.dir > 0 ? this.x : this.x - 110, y: this.y - 100, w: 110, h: 100 };
        if (this.st < T0) { this.tell('slam', this.st / T0, [{ type: 'rect', ...hb }]); if (this.st % 6 === 0) g.fx.smoke(this.x - this.dir * 10, this.y - 90, 1, { s0: 8, s1: 18, c0: [0.8, 0.85, 0.9], c1: [0.4, 0.45, 0.5], a: 0.35 }); }
        else if (this.st === T0) { A.sfx('boom'); g.shake(8, 22); g.fx.ring(this.x + this.dir * 54, this.y - 4, 70, [1, 0.85, 0.5], 22, 0.15); g.fx.sparks(this.x + this.dir * 54, this.y - 10, 24, COLORS.gold, 5, { gy: 0.2 });
          if (overlap(hb, p.hurtbox)) p.hurt(this.dmg, this.x); for (const s of [-1, 1]) g.addProjectile(new Shockwave(this.x + s * 40, this.y, s, { dmg: 9, speed: 2.0, life: 60, color: COLORS.gold })); }
        else if (this.st > T0 + 50) { this.state = 'idle'; this.st = -10; } break; }     // 50 frames stuck in the floor = your opening
      case 'vents':
        this.vx = 0; if (this.st < 22) this.tell('vents', this.st / 22);
        if (this.st === 22) { A.sfx('steam'); const n = this.phase === 2 ? 4 : 3; for (let i = 0; i < n; i++) { const x = clamp(i === 0 ? p.x : p.x + rand(-130, 130), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.y, 'steam', { warn: 62 + i * 14, active: 44, dmg: 12, w: 30, h: 150 })); } }
        if (this.st > 170) { this.state = 'idle'; this.st = -10; } break;
      case 'gears': {
        this.vx = 0; this.faceP(); const times = this.phase === 2 ? [38, 62, 86] : [38, 66];
        if (this.st < 38) this.tell('gears', this.st / 38);
        if (times.includes(this.st)) { A.sfx('gear'); const vx = clamp((p.x - this.x) / 75, -2.8, 2.8); g.addProjectile(Object.assign(new Projectile(this.x + this.dir * 40, this.y - 80, vx, -3.4, 'gear', { dmg: 12, life: 400, scale: 1.8 }), { w: 18, h: 18 })); g.fx.sparks(this.x + this.dir * 40, this.y - 80, 8, COLORS.gold, 3); }
        if (this.st > times[times.length - 1] + 40) { this.state = 'idle'; this.st = -10; } break; }
    }
  }
  draw(ctx, cx, cy) {
    const T0 = Math.round(54 / this.spd); let id = 'ars_mage1_r0', f = Math.floor(this.t / 9) % 4, lift = 6 + Math.sin(this.t * 0.07) * 3;          // hovers a little above the floor
    if (this.state === 'slam') { id = 'ars_mage1_r1'; f = Math.floor(this.t / 6) % 4; lift = this.st < T0 ? 6 + Math.sin(Math.min(1, this.st / T0) * Math.PI / 2) * 40 : Math.max(0, 6 - (this.st - T0) * 3); }      // rises (the tell), then crashes down on the beat
    else if (this.state === 'gears') { id = 'ars_mage1_r1'; f = Math.floor(this.t / 6) % 4; lift += this.st < 38 ? Math.min(14, this.st * 0.6) : 4; }
    else if (this.state === 'vents') { id = 'ars_mage1_r1'; f = Math.floor(this.t / 8) % 4; }
    this.spr(ctx, id, f, cx, cy + lift, { flash: this.flashT > 0 });
  }
}

// ============================================================================================== 5. THE SHADOW LORD (final)
export class BossShadow extends Boss {
  constructor(g, x, y, o) { super(g, x, y + 44, 50, 88, o); this.hp = this.maxHp = 680; this.dmg = 16; this.xp = 600; this.bossName = 'THE SHADOW LORD'; this.voice = 'shadow'; this.sub = 'WHO TOOK THE SUN'; this.gravity = false; this.dir = -1; this.deathFx = COLORS.purple; this.triggerDist = 260; this.zapT = 0; this.alphaT = 1; this.summonCd = 0; this.ice = { w: 96, h: 100 }; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  dangerous() { return this.state === 'slam' && this.st >= 60 && this.st < 80; }
  // THE SECOND LIFE.  The first time he falls the fight is not over: the screen holds, then goes black; he laughs in the dark (he is the lord of darkness; he stole the light); the Lady's wisp comes in and lights
  // the hero, and she says she will be his light.  Then the Shadow Lord rises with all his life back - a quarter faster in everything he does (he simply gets an extra turn every fourth step), and a quarter
  // harder - in a chamber as dark as the dark rooms of the castle.  Only the second fall is the end.
  update() { super.update(); if (this.revived && !this.dying && this.t % 4 === 0) super.update(); }
  die() { if (this.revived) { this.g.blackout = null; return super.die(); } if (!this.reviving) this.beginRevive(); }
  beginRevive() {
    const g = this.g, p = g.player; this.reviving = true; this.hp = 1; this.invuln = true; this.harmless = true; this.state = 'revive'; this.st = 0; this.plan = null; this.vx = this.vy = 0;
    for (const pr of g.projectiles) pr.dead = true; for (const e of g.enemies) if (e !== this && !e.dead) e.dead = true; for (const ic of g.icicles || []) ic.dead = true;
    g.playerFrozen = true; p.vx = 0; p.invT = 99999; g.hitstop = 80; g.shake(8, 60); g.fx.flash([1, 1, 1], 0.9); A.sfx('thunder'); A.duckTarget = 0.12;          // (the screen holds for a moment)
    g.after(90, () => { g.blackout = { a: 0, aT: 1, r: 0, rT: 0 }; });                                                                                 // ...and goes to black
    g.after(165, () => {
      g.fx.wisps.set(0); g.fx.setDark(1.05); g.fx.setStorm(false); this.cry(); A.sfx('ghost');
      const rv = D.convo('shadowlord revive') || [['THE SHADOW LORD', 'HA HA HA HA HA... DID YOU THINK THE LIGHT WOULD COME SO EASILY, LITTLE SPARK? I AM THE LORD OF DARKNESS.'], ['THE SHADOW LORD', 'I STOLE THE LIGHT FROM THE WORLD, AND I WILL TAKE IT FROM YOU AS WELL. THERE IS ONLY THE DARK NOW. THERE HAS ONLY EVER BEEN THE DARK.']], hv = rv.find(([w]) => isHer(w));          // (his words and hers are read from assets/dialogue.txt)
      g.talk(rv.filter(([w]) => !isHer(w)), () => {
        g.blackout.wisp = true; g.blackout.rT = 96; g.blackout.aT = 0.78; A.sfx('cast'); A.sfx('heal');                                                // the wisp's light comes in, round the hero
        g.after(100, () => g.showDialog(hv ? hv[1] : 'I AM HERE. I NEVER LEFT YOU. LET HIM KEEP HIS DARKNESS - I WILL BE THE LIGHT TO GUIDE OUR WAY.', { name: hv ? voice(hv[0]).name : 'HER VOICE', font: 'hand', onClose: () => this.rise() }));
      });
    });
  }
  rise() {
    const g = this.g, p = g.player; this.revived = true; this.reviving = false; this.hp = this.maxHp; this.invuln = false; this.harmless = false; this.dying = 0; this.phase = 2; this.state = 'idle'; this.st = -50; this.plan = null; this.zapT = 150;
    this.dmg = Math.round(this.dmg * 1.25); this.dmgK = (this.dmgK || 1) * 1.25; g.playerFrozen = false; p.invT = 90; A.duckTarget = 1; this.cry(); g.shake(6, 30); g.fx.flash([0.5, 0.3, 1], 0.4);
    g.blackout.aT = 0; g.blackout.rT = 120; g.after(60, () => { g.blackout = null; }); g.banner('THE LORD OF DARKNESS', 'HE RISES AGAIN', 200, { y: 60, color: '#c8a0ff' });
  }
  intro(g) { if (this.st === 6) { this.cry(); g.shake(6, 70); g.fx.flash([0.6, 0.3, 1], 0.5); g.fx.ring(this.x, this.cy, 160, [0.6, 0.3, 1], 50, 0.1); g.fx.strike(this.x, g.room.ph - 32, { flash: 0.4 }); } this.faceP(); g.fx.glow(this.x, this.cy, 80, [0.5, 0.2, 1], 0.4); }
  physics() { this.x += this.vx; this.y += this.vy; const r = this.g.room; this.x = clamp(this.x, 50, r.pw - 50); this.y = clamp(this.y, 90, r.ph - 32); if (this.flashT > 0) this.flashT--; }
  moveTo(tx, ty, k = 0.04, max = 2) { this.vx = clamp((tx - this.x) * k, -max, max); this.vy = clamp((ty - this.cy) * k, -max, max); }
  onPhase2() { super.onPhase2(); const g = this.g; g.fx.setAmbient(0.8, [0.03, 0, 0.06], 0.9); g.banner('THE ECLIPSE', 'DARKNESS FALLS'); g.fx.setStorm(true, 0); }
  ai(g) {
    const p = g.player, spd = this.spd, gy = g.room.ph - 34;
    if (this.state === 'revive') { this.vx = this.vy = 0; return; }
    if (this.revived) g.fx.light(p.x, p.y - 22, 84, 0.9, [0.55, 0.78, 1]);          // (the Lady's wisp lights the hero in the dark chamber)
    g.fx.glow(this.x, this.cy, 64 + Math.sin(this.t * 0.07) * 6, [0.45, 0.2, 0.9], 0.25); g.fx.light(this.x, this.cy, this.phase === 2 ? 70 : 120, 0.8);
    if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-26, 26), y: this.cy + rand(0, 40), vx: rand(-0.2, 0.2), vy: -rand(0.2, 0.8), life: 60, s0: 8, s1: 2, c0: [0.5, 0.25, 1], c1: [0.1, 0.0, 0.3], a0: 0.8, a1: 0, kind: 2 });
    if (this.phase === 2 && --this.zapT <= 0) { this.zapT = 150 + rand(60); g.addProjectile(new Column(clamp(p.x + rand(-80, 80), 30, g.room.pw - 30), g.room.ph - 32, 'bolt', { warn: 46, active: 12, dmg: 14, w: 26, h: 240 })); }   // eclipse: random sky bolts (marked on the floor first)
    if (this.summonCd > 0) this.summonCd--;
    switch (this.state) {
      case 'idle': this.faceP(); this.alphaT = 1; this.moveTo(clamp(p.x + Math.sin(this.t * 0.02) * 110, 70, g.room.pw - 70), 96 + Math.sin(this.t * 0.04) * 14, 0.025);
        { const opts = ['breath', 'slam']; if (this.summonCd === 0) opts.push('summon'); if (this.phase === 2) opts.push('skulls', 'skulls', 'slam'); this.planNext(opts, Math.round(90 / spd)); } break;          // (the SKULL VOLLEY is kept for the second phase)
      case 'skulls': {
        this.faceP(); this.moveTo(this.x, 100, 0.05); const T0 = this.phase === 2 ? [40, 68, 96] : [40, 74];
        if (this.st < 40) this.tell('skulls', this.st / 40, [{ type: 'line', x0: this.x, y0: this.cy, x1: p.x, y1: p.y - 20 }]);
        if (T0.includes(this.st)) { A.sfx('cast'); const base = Math.atan2(p.y - 24 - this.cy, p.x - this.x), n = this.phase === 2 ? 5 : 4; for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.26, sp = 1.4 + (i % 2) * 0.35; g.addProjectile(new Projectile(this.x + this.dir * 20, this.cy - 10, Math.cos(a) * sp, Math.sin(a) * sp, 'skull', { dmg: 12, life: 300 })); } g.fx.ring(this.x + this.dir * 20, this.cy - 10, 36, [0.4, 0.9, 1], 16); }
        if (this.st > T0[T0.length - 1] + 40) { this.state = 'idle'; this.st = -20; } break; }
      case 'breath': {
        const side = this.side === undefined || this.st === 1 ? (p.x < g.room.pw / 2 ? 1 : -1) : this.side; this.side = side;
        if (this.st < 30) { this.moveTo(side > 0 ? 80 : g.room.pw - 80, 130, 0.06); this.faceP(); }
        else if (this.st < 62) {                       // windup: sweep zone shown, boss holds still
          this.vx = this.vy = 0; this.faceP(); const mx = this.x + this.dir * 44, my = this.cy - 4, L = 190, a0 = 0.55, a1 = -0.05, pt = a => [mx + Math.cos(a) * this.dir * L, my + Math.sin(a) * L];
          this.tell('breath', (this.st - 30) / 32, [{ type: 'poly', pts: [[mx, my], pt(a0), pt(a1)] }]);
        } else if (this.st < 142) {
          this.vx = this.vy = 0; this.faceP(); const s = (this.st - 62) / 80, a = 0.55 - 0.6 * s, mx = this.x + this.dir * 44, my = this.cy - 4, ang = this.dir > 0 ? a : Math.PI - a;
          g.fx.blueBreath(mx, my, ang, Math.min(1, (this.st - 62) / 10, (142 - this.st) / 14)); g.fx.light(mx + Math.cos(ang) * 60, my + Math.sin(ang) * 60, 130, 1, [0.4, 0.7, 1]); if (this.st === 62 || this.st % 20 === 0) A.sfx('fire');
          if (this.st % 4 === 0) for (let k = 1; k <= 6; k++) { const hx = mx + Math.cos(ang) * k * 24, hy = my + Math.sin(ang) * k * 24; if (overlap({ x: hx - 13, y: hy - 13, w: 26, h: 26 }, p.hurtbox)) { p.hurt(Math.round(12 * (this.dmgK || 1)), this.x, { kb: 1.4 }); break; } }
        } else { this.state = 'idle'; this.st = -30; this.side = undefined; } break; }
      case 'slam':
        if (this.st < 28) { this.alphaT = Math.max(0.1, 1 - this.st / 20); this.moveTo(this.x, this.y - this.h / 2 - 20, 0.02); this.tell('slam', this.st / 60); if (this.st === 2) A.sfx('ghost'); }
        else if (this.st === 28) { this.x = clamp(p.x, 70, g.room.pw - 70); this.y = 110 + 44; this.vx = this.vy = 0; }
        else if (this.st < 60) { this.alphaT = Math.min(1, (this.st - 28) / 14); if (this.st < 52) this.x += (p.x - this.x) * 0.03;      // tracks you, then commits for the last 8 frames
          this.tell('slam', this.st / 60, [{ type: 'ring', x: this.x, y: gy + 2, r: 44 }]); if (this.st % 4 === 0) g.fx.ring(this.x, gy, 8 + (60 - this.st), [0.7, 0.4, 1], 10, 0.3, 4); }
        else if (this.st < 78) { this.vy = 7; this.vx = 0; this.warns = [{ type: 'ring', x: this.x, y: gy + 2, r: 44 }]; if (this.y >= g.room.ph - 32 - 3) { this.vy = 0; this.st = 78; } }
        else if (this.st === 78) { A.sfx('boom'); g.shake(8, 24); g.fx.ring(this.x, gy, 110, [0.7, 0.4, 1], 28, 0.15); for (const s of [-1, 1]) { g.addProjectile(new Shockwave(this.x + s * 20, g.room.ph - 32, s, { dmg: 11, speed: 2.4, life: 90, big: true, color: COLORS.purple })); g.addProjectile(new Column(this.x + s * 80, g.room.ph - 32, 'shadow', { warn: 30, active: 26, dmg: 12, w: 28, h: 100 })); } }
        else if (this.st > 126) { this.state = 'idle'; this.st = -20; } this.alphaT = this.st > 60 ? 1 : this.alphaT; break;
      case 'summon':
        this.moveTo(g.room.pw / 2, 100, 0.04); this.faceP(); if (this.st < 40) this.tell('summon', this.st / 40);
        if (this.st === 40) { this.cry(); g.fx.flash([0.5, 0.2, 1], 0.3); const cnt = g.enemies.filter(e => !e.isBoss && !e.dead).length; if (cnt < 4) { g.spawnEnemy('wraith', 5, 7); g.spawnEnemy('wraith', g.room.w - 6, 7); if (this.phase === 2) g.spawnEnemy('bat', g.room.w / 2, 5); } this.summonCd = 600; }
        if (this.st > 100) { this.state = 'idle'; this.st = -20; } break;
    }
  }
  draw(ctx, cx, cy) {
    let id = 'demon_idle', f = Math.floor(this.t / 9) % 6;
    if (this.state === 'breath' && this.st >= 30) { id = 'demon_attack_nb'; f = this.st < 62 ? clamp(Math.floor((this.st - 30) / 32 * 6), 0, 5) : 6 + Math.floor(this.t / 7) % 2; }          // (the 'no breath' sheet: the fire itself is the three.js jet in ai(), not painted in the sprite)
    // the body sits ~18px above the bottom of the idle cell, ~27px above the bottom of the attack cell and ~11px above the bottom of the (shorter) no-breath cell
    drawSheet(ctx, id, f, this.x - cx, this.y - cy + Math.sin(this.t * 0.06) * 3, { dir: this.dir, flash: this.flashT > 0, ay: 1, dy: id === 'demon_attack_nb' ? 11 : id === 'demon_attack' ? 27 : 18, alpha: this.alphaT < 1 ? this.alphaT : undefined });
  }
}


// ============================================================================================== 6. THE CINDER WARDEN (the burning village)
// The first boss: a horned staff-bearer wreathed in the fires he set.  Easy to read - EMBER VOLLEY (arcing fireballs), STAFF SLAM (a marked box in front of him, then shockwaves),
// LEAP (the landing spot is ringed) and, once he is hurt, FLAME PILLARS.
export class BossCinder extends Boss {
  constructor(g, x, y, o) { super(g, x, y, 40, 84, o); this.hp = this.maxHp = 160; this.dmg = 10; this.xp = 90; this.bossName = 'THE CINDER WARDEN'; this.voice = 'cinder'; this.sub = 'WHO SET THE VILLAGE ALIGHT'; this.scale = 0.95; this.dir = -1; this.deathFx = COLORS.fire; this.tx = x; this.ice = { w: 80, h: 100 }; }
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  tele(k) { return Math.round({ embers: 52, slam: 56, leap: 52 }[k] / this.spd); }
  dangerous() { return (this.state === 'slam' && this.st >= this.tele('slam') && this.st < this.tele('slam') + 12) || (this.state === 'leap' && this.st >= this.tele('leap')); }
  intro(g) { if (this.st === 8) { this.cry(); g.shake(4, 40); g.fx.flash([1, 0.5, 0.2], 0.3); g.fx.ring(this.x, this.cy, 110, [1, 0.5, 0.2], 40, 0.1); } if (this.st % 4 === 0) g.fx.fire(this.x + rand(-18, 18), this.y - 10, { scale: 1.0, n: 1 }); this.faceP(); }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx());
    if (this.t % 5 === 0) g.fx.fire(this.x + rand(-14, 14), this.y - rand(8, 60), { scale: 0.5, n: 1 }); g.fx.light(this.x, this.y - 40, 90, 0.6);
    switch (this.state) {
      case 'idle':
        this.faceP(); this.vx = approach(this.vx, d > 110 ? this.dir * 0.7 : 0, 0.06);
        this.planNext(this.phase === 2 ? ['embers', 'slam', 'leap', 'pillars'] : ['embers', 'slam', 'leap'], Math.round(90 / spd)); break;
      case 'embers': {
        const T0 = this.tele('embers'); this.vx = 0; this.faceP();
        if (this.st < T0) { this.tell('embers', this.st / T0, [{ type: 'line', x0: this.x, y0: this.y - 60, x1: p.x, y1: p.y - 20 }]); g.fx.glow(this.x + this.dir * 16, this.y - 76, 8 + this.st * 0.4, [1, 0.5, 0.15], 0.5); }
        else if (this.st === T0 || (this.phase === 2 && (this.st === T0 + 16 || this.st === T0 + 32))) {
          A.sfx('fire'); const base = Math.atan2(p.y - 24 - (this.y - 70), p.x - this.x), n = 3;
          for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.24 - 0.12, sp = 2.3 + i * 0.25; g.addProjectile(new Projectile(this.x + this.dir * 22, this.y - 70, Math.cos(a) * sp, Math.sin(a) * sp, 'ember', { dmg: 8, scale: 1.5, grav: 0.045, life: 220 })); }
          g.fx.ring(this.x + this.dir * 22, this.y - 70, 30, [1, 0.5, 0.2], 14);
        } else if (this.st > T0 + (this.phase === 2 ? 56 : 34)) { this.state = 'idle'; this.st = -16; } break; }
      case 'slam': {
        const T0 = this.tele('slam'); this.vx = 0; if (this.st === 1) this.faceP();
        const hb = { x: this.dir > 0 ? this.x : this.x - 96, y: this.y - 72, w: 96, h: 72 };
        if (this.st < T0) this.tell('slam', this.st / T0, [{ type: 'rect', ...hb }]);
        else if (this.st === T0) {
          A.sfx('boom'); g.shake(6, 18); g.fx.ring(this.x + this.dir * 56, this.y - 4, 60, [1, 0.6, 0.2], 20, 0.15); g.fx.sparks(this.x + this.dir * 56, this.y - 8, 18, COLORS.fire, 4, { gy: 0.2 });
          if (overlap(hb, p.hurtbox)) p.hurt(this.dmg + 2, this.x); for (const sd of [-1, 1]) g.addProjectile(new Shockwave(this.x + sd * 36, this.y, sd, { dmg: 8, speed: 2.0, life: 50, big: true }));
        } else if (this.st > T0 + 44) { this.state = 'idle'; this.st = -10; } break; }
      case 'leap': {
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 70, g.room.pw - 70); this.cry(); }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]); }
        else if (this.st === T0) { this.vy = -6.4; this.vx = clamp((this.tx - this.x) / 61, -3.8, 3.8); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) { this.vx = 0; g.shake(6, 20); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 90, [1, 0.6, 0.2], 26, 0.15); for (const sd of [-1, 1]) g.addProjectile(new Shockwave(this.x + sd * 20, this.y, sd, { dmg: 8, speed: 2.0, life: 66, big: true })); this.state = 'idle'; this.st = -26; }
        else this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 38 }];
        break; }
      case 'pillars':
        this.vx = 0; this.faceP(); if (this.st < 30) this.tell('pillars', this.st / 30);
        if (this.st === 30) { this.cry(); const base = p.x; for (let i = -1; i <= 1; i++) { const x = clamp(base + i * 70 + (i ? rand(-6, 6) : 0), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.y, 'fire', { warn: 64, active: 26, dmg: 12, w: 34 })); } }
        if (this.st > 130) { this.state = 'idle'; this.st = -16; } break;
    }
  }
  draw(ctx, cx, cy) {
    const T = this.tele(this.state === 'embers' ? 'embers' : this.state === 'slam' ? 'slam' : 'leap'); let id = 'ars_gnu_r0', f = Math.floor(this.t / 12) % 5, dx = 0;
    if (this.dying) { id = 'ars_gnu_r3'; f = this.dying > 50 ? 1 : 0; }
    else if (this.state === 'embers') { id = 'ars_gnu_r2'; f = this.st < T * 0.55 ? 0 : 1; }
    else if (this.state === 'slam') { id = 'ars_gnu_r2'; f = this.st < T * 0.6 ? 0 : this.st < T ? 1 : this.st < T + 6 ? 2 : this.st < T + 26 ? 3 : 4; dx = this.st >= T && this.st < T + 6 ? this.dir * 4 : 0; }
    else if (this.state === 'leap') { id = 'ars_gnu_r2'; f = this.st < T ? 0 : 2; }
    else if (this.state === 'pillars') { id = 'ars_gnu_r2'; f = this.st < 30 ? 0 : 1; }
    else if (Math.abs(this.vx) > 0.15) { id = 'ars_gnu_r1'; f = Math.floor(this.t / 8) % 5; }
    this.spr(ctx, id, f, cx, cy, { dx, flash: this.flashT > 0 });
    this.g.fx.light(this.x, this.y - 44, 70, 0.5);
  }
}

// ============================================================================================== 7. THE MIRE MOTHER (the weeping swamp)
// A floating, many-tentacled head.  TENTACLES erupt from marked holes in the ground (stay out of the circles), SPORE BURST is a slow fan of poison orbs, SUMMONS calls swamp spiders.
export class BossBramble extends Boss {
  constructor(g, x, y, o) { super(g, x, y + 36, 36, 70, o); this.hp = this.maxHp = 260; this.dmg = 12; this.xp = 150; this.bossName = 'THE MIRE MOTHER'; this.voice = 'bramble'; this.sub = 'WHAT THE SWAMP DREAMS'; this.scale = 1.05; this.gravity = false; this.dir = -1; this.deathFx = COLORS.green; this.ice = { w: 76, h: 96 }; }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  intro(g) { if (this.st === 8) { this.cry(); g.shake(3, 40); g.fx.flash([0.4, 1, 0.5], 0.4); g.fx.ring(this.x, this.cy, 120, [0.4, 1, 0.5], 40, 0.1); } g.fx.glow(this.x, this.cy, 70, [0.4, 1, 0.5], 0.4); this.faceP(); }
  physics() { this.x += this.vx; this.y += this.vy; const r = this.g.room; this.x = clamp(this.x, 34, r.pw - 34); this.y = clamp(this.y, 70, r.ph - 40); if (this.flashT > 0) this.flashT--; }
  moveTo(tx, ty, k = 0.04, max = 2) { this.vx = clamp((tx - this.x) * k, -max, max); this.vy = clamp((ty - this.cy) * k, -max, max); }
  groundY() { return this.g.room.ph - 32; }
  ai(g) {
    const p = g.player, spd = this.spd;
    g.fx.glow(this.x, this.cy, 52 + Math.sin(this.t * 0.09) * 6, [0.4, 1, 0.5], 0.2); g.fx.light(this.x, this.cy, 100, 0.7);
    if (this.t % 9 === 0) g.fx.emit({ x: this.x + rand(-26, 26), y: this.cy + rand(-10, 30), vx: rand(-0.15, 0.15), vy: rand(0.1, 0.4), life: 50, s0: 5, s1: 1, c0: [0.5, 1, 0.5], c1: [0.2, 0.5, 0.3], a0: 0.9, a1: 0, kind: 6 });
    switch (this.state) {
      case 'idle': this.faceP(); this.moveTo(clamp(p.x + Math.sin(this.t * 0.02) * 90, 60, g.room.pw - 60), 86 + Math.sin(this.t * 0.05) * 12, 0.03);
        this.planNext(this.phase === 2 ? ['tentacles', 'spores', 'tentacles', 'summon'] : ['tentacles', 'spores', 'summon'], Math.round(94 / spd)); break;
      case 'tentacles': {
        this.moveTo(this.x, 84, 0.05); this.faceP(); if (this.st < 24) this.tell('tentacles', this.st / 24);
        if (this.st === 24) { this.cry(); const n = this.phase === 2 ? 4 : 3; for (let i = 0; i < n; i++) { const x = clamp(i === 0 ? p.x : p.x + rand(-140, 140), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.groundY(), 'tentacle', { warn: 54 + i * 12, active: 40, dmg: 11, w: 22, h: 90 })); } }
        if (this.st > (this.phase === 2 ? 150 : 128)) { this.state = 'idle'; this.st = -16; } break; }
      case 'spores': {
        this.faceP(); this.moveTo(this.x, 90, 0.05); const T0 = this.phase === 2 ? [40, 72] : [40];
        if (this.st < 40) this.tell('spores', this.st / 40, [{ type: 'line', x0: this.x, y0: this.cy, x1: p.x, y1: p.y - 20 }]);
        if (T0.includes(this.st)) { A.sfx('cast'); const base = Math.atan2(p.y - 24 - this.cy, p.x - this.x), n = this.phase === 2 ? 5 : 4; for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.3; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 'spore', { dmg: 9, life: 280 })); } g.fx.ring(this.x, this.cy, 36, [0.4, 1, 0.5], 16); }
        if (this.st > T0[T0.length - 1] + 40) { this.state = 'idle'; this.st = -20; } break; }
      case 'summon':
        this.moveTo(g.room.pw / 2, 90, 0.04); this.faceP(); if (this.st < 40) this.tell('summon', this.st / 40);
        if (this.st === 40) { this.cry(); g.fx.flash([0.4, 1, 0.5], 0.25); const cnt = g.enemies.filter(e => !e.isBoss && !e.dead).length, row = Math.floor(g.room.ph / 16) - 2; if (cnt < 4) { g.spawnEnemy('swampspider', 5, row, {}); g.spawnEnemy('swampspider', g.room.w - 6, row, {}); if (this.phase === 2) g.spawnEnemy('swampspider', Math.round(g.room.w / 2), row, {}); } }
        if (this.st > 104) { this.state = 'idle'; this.st = -20; } break;
    }
  }
  draw(ctx, cx, cy) {
    let id = 'ars_andromalius_r0', f = Math.floor(this.t / 8) % 8; if (this.state === 'tentacles' || this.state === 'spores' || this.state === 'summon') { id = 'ars_andromalius_r2'; f = 4 + Math.floor(this.t / 6) % 4; }
    drawSheet(ctx, id, f, this.x - cx, this.cy - cy + Math.sin(this.t * 0.07) * 2, { flash: this.flashT > 0, ay: 0.55, scale: this.scale, dir: this.dir });
  }
}

// ============================================================================================== 8. THE CRIMSON COUNT (an optional lair behind a door in the Nave)
// A vampire lord in crimson armour (sprites: assets2D's Gothic Vampire Undead Horde, the free download xxg_4_free).  BLOOD LUNGE: he crouches, then dashes through the air where you stand with his blade.  BLOOD BOLTS: a fan of crimson orbs.
// MIST STEP: he dissolves and returns behind you with a slash (the ring on the floor shows where).  In the second half he also LEAPS onto where you stand, and is quicker.
export class BossVampire extends Boss {
  constructor(g, x, y, o) {
    super(g, x, y, 26, 66, o); this.hp = this.maxHp = 200; this.dmg = 12; this.xp = 120; this.bossName = 'THE CRIMSON COUNT'; this.voice = 'vampire'; this.sub = 'WHO DRINKS THE DARK'; this.dir = -1; this.deathFx = COLORS.red; this.ice = { w: 56, h: 84 };
    this.live = false; this.hitDone = false; this.tx = x;
  }
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  tele(k) { return Math.round({ lunge: 52, bolts: 50, mist: 46, leap: 54 }[k] / this.spd); }
  dangerous() { return this.live; }
  intro(g) {
    if (this.st === 8) { this.cry(); g.shake(3, 36); g.fx.flash([0.9, 0.1, 0.2], 0.3); g.fx.ring(this.x, this.cy, 100, [1, 0.2, 0.3], 40, 0.1); g.fx.burst(this.x, this.cy, 24, [[0.8, 0.05, 0.12], [0.15, 0, 0.05]], { speed: 3, s0: 14, up: 0.4 }); }
    this.faceP();
  }
  swordBox(reach = 58) { return { x: this.dir > 0 ? this.x - 4 : this.x - reach + 4, y: this.y - 66, w: reach, h: 58 }; }
  strike(g, extra = 0) { const p = g.player; if (!this.hitDone && overlap(this.swordBox(), p.hurtbox)) { this.hitDone = true; p.hurt(this.dmg + extra, this.x); } }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx()); this.live = false;
    if (this.t % 6 === 0 && this.alpha > 0.5) g.fx.emit({ x: this.x + rand(-12, 12), y: this.y - rand(6, 60), vx: rand(-0.2, 0.2), vy: -rand(0.2, 0.6), life: 30, s0: 6, s1: 1, c0: [0.7, 0.05, 0.12], c1: [0.2, 0, 0.05], a0: 0.7, a1: 0, kind: 6 });     // a faint crimson haze
    g.fx.light(this.x, this.y - 40, 70, 0.4 * this.alpha);
    switch (this.state) {
      case 'idle':
        this.alpha = 1; this.faceP(); if (this.vx * this.dir < 0) this.vx = 0;          // (turning round - you jumped over him - stops him dead: no sliding on backwards)
        this.vx = approach(this.vx, d > 130 ? this.dir * 1.1 : 0, 0.06);          // (he only ever walks TOWARD you: he used to back away when you came close - facing you, so it looked like walking backwards)
        this.planNext(this.phase === 2 ? ['lunge', 'bolts', 'mist', 'leap'] : ['lunge', 'bolts', 'mist'], Math.round(80 / spd)); break;
      case 'lunge': {
        const T0 = this.tele('lunge'), run = 30, sp = this.phase === 2 ? 6.2 : 5.2;
        if (this.st < T0) { this.vx = 0; if (this.st === 1) { this.faceP(); this.hitDone = false; } this.tell('lunge', this.st / T0, [{ type: 'lane', x0: this.x, x1: this.x + this.dir * sp * run, y: this.y }]); }
        else if (this.st < T0 + run) { if (this.st === T0) { A.sfx('dash'); g.fx.ring(this.x, this.cy, 40, [1, 0.2, 0.3], 14, 0.2); } this.vx = this.dir * sp; this.live = true; this.strike(g, 3); g.fx.emit({ x: this.x - this.dir * 10, y: this.y - rand(8, 56), vx: -this.dir * 0.6, vy: rand(-0.2, 0.2), life: 14, s0: 10, s1: 2, c0: [0.9, 0.1, 0.2], c1: [0.3, 0, 0.1], a0: 0.8, a1: 0, kind: 0 }); }
        else { this.vx = approach(this.vx, 0, 0.5); if (this.st > T0 + run + 26) { this.state = 'idle'; this.st = -10; } }
        break; }
      case 'bolts': {
        const T0 = this.tele('bolts'); this.vx = 0; this.faceP();
        if (this.st < T0) { this.tell('bolts', this.st / T0, [{ type: 'line', x0: this.x, y0: this.y - 46, x1: p.x, y1: p.y - 20 }]); g.fx.glow(this.x + this.dir * 20, this.y - 40, 8 + this.st * 0.35, [1, 0.1, 0.2], 0.5); }
        else if (this.st === T0 || (this.phase === 2 && this.st === T0 + 18)) {
          A.sfx('cast'); const n = this.st === T0 ? (this.phase === 2 ? 5 : 3) : 3, base = Math.atan2(p.y - 24 - (this.y - 46), p.x - this.x);
          for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.22, sp = 2.4 + (i % 2) * 0.3; g.addProjectile(new Projectile(this.x + this.dir * 24, this.y - 46, Math.cos(a) * sp, Math.sin(a) * sp, 'blood', { dmg: 8, life: 220 })); }
          g.fx.ring(this.x + this.dir * 24, this.y - 46, 26, [1, 0.15, 0.25], 14);
        } else if (this.st > T0 + (this.phase === 2 ? 40 : 26)) { this.state = 'idle'; this.st = -12; }
        break; }
      case 'mist': {
        const T0 = this.tele('mist'), V = 16;                                   // T0: the warning, then V steps as a cloud, then a slash behind you
        if (this.st === 1) { const side = p.dir > 0 ? -1 : 1; this.tx = clamp(p.x + side * 72, 50, g.room.pw - 50); this.hitDone = false; }
        if (this.st < T0) { this.vx = 0; this.faceP(); this.tell('mist', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 34 }]); }
        else if (this.st < T0 + V) {
          if (this.st === T0) { A.sfx('flap'); g.fx.burst(this.x, this.cy, 22, [[0.55, 0.05, 0.12], [0.12, 0, 0.06]], { speed: 2.4, s0: 16, up: 0.3 }); this.invuln = true; this.harmless = true; }
          this.vx = 0; this.alpha = Math.max(0, 1 - (this.st - T0) / 6);
          if (this.st === T0 + V - 1) { this.x = this.tx; this.dir = p.x >= this.x ? 1 : -1; g.fx.burst(this.x, this.cy, 22, [[0.55, 0.05, 0.12], [0.12, 0, 0.06]], { speed: 2.4, s0: 16, up: 0.3 }); A.sfx('flap'); }
        } else if (this.st < T0 + V + 18) {
          this.invuln = false; this.harmless = false; this.faceP(); this.alpha = Math.min(1, (this.st - T0 - V) / 6);
          if (this.st >= T0 + V + 8) { this.live = true; this.strike(g, 2); if (this.st === T0 + V + 8) { A.sfx('slash'); g.fx.ring(this.x + this.dir * 28, this.y - 36, 30, [1, 0.2, 0.3], 12, 0.2); } }
        } else { this.alpha = 1; if (this.st > T0 + V + 18 + 22) { this.state = 'idle'; this.st = -10; } }
        break; }
      case 'leap': {
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 60, g.room.pw - 60); this.hitDone = false; }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]); }
        else if (this.st === T0) { this.vy = -6.2; this.vx = clamp((this.tx - this.x) / 58, -3.8, 3.8); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) { this.vx = 0; g.shake(5, 16); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 70, [1, 0.2, 0.3], 22, 0.15); g.fx.burst(this.x, this.y - 4, 16, [[0.6, 0.05, 0.12], [0.15, 0, 0.06]], { speed: 2.4, s0: 14, up: 0.6 }); if (Math.abs(g.player.x - this.x) < 42 && Math.abs(g.player.y - this.y) < 30) g.player.hurt(this.dmg + 2, this.x); this.state = 'idle'; this.st = -24; }
        else { this.live = true; this.warns = [{ type: 'ring', x: this.tx, y: this.y, r: 38 }]; }
        break; }
    }
  }
  draw(ctx, cx, cy) {
    const T = this.tele(this.state === 'bolts' ? 'bolts' : this.state === 'mist' ? 'mist' : this.state === 'leap' ? 'leap' : 'lunge'); let id = 'vampire_idle', f = Math.floor(this.t / 9) % 6;
    if (this.dying) { if (this.dying < 54) { id = 'vampire_hurt'; f = Math.min(3, Math.floor(this.dying / 14)); } else { id = 'vampire_dead'; f = Math.min(2, Math.floor((this.dying - 54) / 16)); } }
    else if (this.state === 'lunge') { id = 'vampire_atk'; f = this.st < T * 0.5 ? 0 : this.st < T ? 1 : this.st < T + 14 ? 2 : 3; }
    else if (this.state === 'bolts') { id = 'vampire_atk'; f = this.st < T * 0.55 ? 0 : this.st < T ? 1 : 2; }
    else if (this.state === 'mist') { id = this.st < T + 16 ? 'vampire_idle' : 'vampire_atk'; f = this.st < T + 16 ? 0 : this.st < T + 16 + 8 ? 1 : this.st < T + 16 + 14 ? 2 : 3; }
    else if (this.state === 'leap') { id = 'vampire_jump'; f = this.st < T * 0.6 ? 0 : this.st < T ? 1 : !this.onGround ? (this.vy < -2.5 ? 2 : this.vy < 0 ? 3 : this.vy < 2 ? 4 : 5) : 6; }
    else if (Math.abs(this.vx) > 0.2) { id = 'vampire_run'; f = Math.floor(this.t / 6) % 5; }
    this.spr(ctx, id, f, cx, cy + 1, { dy: 1, flash: this.flashT > 0 });
  }
}

// ============================================================================================== THE BOILER GOLEM
// A hulking brass-and-iron golem with a red boiler on its back (sprites: Old Golem by Eddie's Workshop).  The vapour that the art drew at its mouth and the explosion it died in were taken OUT of the sheets: steam, fire and smoke are all
// three.js effects now (fx.smoke / fx.fire / fx.fireOrb ...).  IRON FIST: a blow at chest height (DUCK under it).  UPPERCUT: a low scooping blow (JUMP it).  FIREBALL: it spits a lobbed fireball.  STEAM VENTS: columns of scalding steam burst
// from the floor where the boiler overflows.  In the second half the boiler runs hot: it moves and strikes quicker, spits three fireballs and the vents burst in greater number.  When it falls the boiler goes up.
export class BossGolem extends Boss {
  constructor(g, x, y, o) {
    super(g, x, y, 44, 84, o); this.hp = this.maxHp = 640; this.dmg = 14; this.xp = 200; this.bossName = 'THE BOILER GOLEM'; this.voice = 'golem'; this.sub = 'WHO STILL KEEPS THE FIRES'; this.dir = -1; this.deathFx = COLORS.fire; this.ice = { w: 70, h: 96 };
    this.hitDone = false; this.heat = 0;
  }
  get spd() { return this.phase === 2 ? 1.2 : 1; }
  tele(k) { return Math.round({ punch: 56, scoop: 60, fireball: 58, vents: 30, gearslam: 62 }[k] / this.spd); }
  dangerous() { return (this.state === 'punch' || this.state === 'scoop' || this.state === 'gearslam') && this.st >= this.tele(this.state) && this.st < this.tele(this.state) + 14; }
  // where things are on the sprite, from its feet (the art faces left; `dir` turns it round)
  vent(i) { return { x: this.x + this.dir * (i ? 1 : 10), y: this.y - 84 }; }          // the two stacks of the boiler
  mouth() { return { x: this.x + this.dir * 20, y: this.y - 52 }; }
  steam(x, y, n = 1, big = 1) { this.g.fx.smoke(x, y, n, { s0: 5 * big, s1: 15 * big, c0: [0.92, 0.94, 0.98], c1: [0.55, 0.58, 0.64], a: 0.34, l: 0.9, drift: -this.dir * 0.05 }); }
  update() {
    super.update(); const g = this.g;
    if (this.dying || this.dead) return;
    const rate = this.state === 'dormant' ? 14 : this.phase === 2 ? 3 : 6;          // the boiler breathes: a thin wisp now and then asleep, steady once awake, a roar in the second half
    if (this.t % rate === 0) for (const i of [0, 1]) { const v = this.vent(i); this.steam(v.x, v.y, 1, this.phase === 2 ? 1.3 : 1); }
    if (this.phase === 2 && this.state !== 'dormant') { const v = this.vent(0); g.fx.glow(v.x, v.y + 12, 26, [1, 0.3, 0.1], 0.18 + 0.06 * Math.sin(this.t * 0.2)); }          // (red hot)
  }
  intro(g) {
    if (this.st === 8) { this.cry(); A.sfx('steam'); g.shake(5, 44); g.fx.flash([1, 0.85, 0.6], 0.3); g.fx.ring(this.x, this.cy, 120, [0.9, 0.95, 1], 40, 0.1); for (const i of [0, 1]) { const v = this.vent(i); this.steam(v.x, v.y, 14, 2.2); } }
    if (this.st % 3 === 0) for (const i of [0, 1]) { const v = this.vent(i); this.steam(v.x, v.y, 1, 1.8); }
    this.faceP();
  }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx());
    g.fx.light(this.x, this.y - 50, 70, 0.35, [1, 0.5, 0.2]);
    switch (this.state) {
      case 'idle':
        this.faceP(); this.vx = approach(this.vx, d > 70 ? this.dir * 0.55 * spd : 0, 0.05);
        this.planNext(this.phase === 2 ? ['punch', 'scoop', 'fireball', 'vents', 'punch', 'scoop', 'gearslam'] : ['punch', 'scoop', 'fireball', 'vents', 'gearslam'], Math.round(88 / spd)); break;
      case 'punch': case 'scoop': {
        const k = this.state, T0 = this.tele(k); this.vx = 0; if (this.st === 1) { this.faceP(); this.hitDone = false; A.sfx('steam'); }
        const hb = k === 'punch' ? { x: this.dir > 0 ? this.x + 4 : this.x - 4 - 84, y: this.y - 56, w: 84, h: 32 } : { x: this.dir > 0 ? this.x + 4 : this.x - 4 - 84, y: this.y - 34, w: 84, h: 34 };
        if (this.st < T0) { this.tell(k, this.st / T0, [{ type: 'rect', ...hb }]); if (this.st % 5 === 0) { const v = this.vent(1); this.steam(v.x, v.y, 2, 1.6); } }          // (the boiler blows off steam as the arm draws back)
        else if (this.st === T0 + 1) {
          A.sfx(k === 'punch' ? 'slash' : 'boom'); g.shake(k === 'punch' ? 4 : 6, 14); g.fx.sparks(this.x + this.dir * 56, this.y - (k === 'punch' ? 40 : 14), 12, COLORS.gold, 4, { gy: 0.15 });
          if (!this.hitDone && overlap(hb, p.hurtbox)) { this.hitDone = true; p.hurt(this.dmg + (k === 'scoop' ? 2 : 0), this.x); }
          if (k === 'scoop' && this.phase === 2) for (const sd of [-1, 1]) g.addProjectile(new Shockwave(this.x + sd * 36, this.y, sd, { dmg: 8, speed: 2.0, life: 56, big: true }));
        } else if (this.st > T0 + 40) { this.state = 'idle'; this.st = -10; } break; }
      case 'fireball': {
        const T0 = this.tele('fireball'), m = this.mouth(); this.vx = 0; this.faceP();
        if (this.st < T0) { this.tell('fireball', this.st / T0, [{ type: 'line', x0: m.x, y0: m.y, x1: p.x, y1: p.y - 20 }]); g.fx.glow(m.x, m.y, 6 + this.st * 0.4, [1, 0.45, 0.12], 0.5); if (this.st % 4 === 0) this.steam(m.x, m.y - 6, 1, 1.2); }
        else if (this.st === T0 || (this.phase === 2 && (this.st === T0 + 16 || this.st === T0 + 32))) {
          A.sfx('fire'); const dx = p.x - m.x, t = clamp(Math.abs(dx) / 2.6, 36, 90), vx = dx / t, vy = (p.y - 20 - m.y) / t - 0.045 * t / 2;          // (lobbed: it lands about where you stand)
          g.addProjectile(new Projectile(m.x, m.y, vx, vy, 'ember', { dmg: 9, scale: 1.7, grav: 0.045, life: 240 })); g.fx.ring(m.x, m.y, 30, [1, 0.5, 0.2], 14); g.fx.burst(m.x, m.y, 8, [[1, 0.7, 0.3], [0.6, 0.1, 0.02]], { speed: 2, s0: 10 });
        } else if (this.st > T0 + (this.phase === 2 ? 56 : 36)) { this.state = 'idle'; this.st = -14; } break; }
      case 'gearslam': {                                                          // GEAR SLAM: it brings both fists down on the floor (a blow in front of it) and the roof shakes loose: gears drop at random along the room (dust and a ring on the floor warn where), land, and ROLL away in random directions, throwing sparks
        const T0 = this.tele('gearslam'); this.vx = 0; if (this.st === 1) { this.faceP(); this.hitDone = false; A.sfx('steam'); }
        const hb = { x: this.dir > 0 ? this.x + 4 : this.x - 4 - 84, y: this.y - 34, w: 84, h: 34 };
        if (this.st < T0) { this.tell('gearslam', this.st / T0, [{ type: 'rect', ...hb }]); if (this.st % 5 === 0) { const v = this.vent(1); this.steam(v.x, v.y, 2, 1.6); } }
        else if (this.st === T0 + 1) {
          A.sfx('boom'); g.shake(9, 30); g.fx.flash([1, 0.85, 0.6], 0.2); g.fx.ring(this.x + this.dir * 56, this.y, 120, [1, 0.8, 0.45], 26, 0.14); g.fx.sparks(this.x + this.dir * 56, this.y - 10, 14, COLORS.gold, 4.4, { gy: 0.15 });
          for (const sd of [-1, 1]) g.fx.burst(this.x + this.dir * 56, this.y - 2, 6, [[0.6, 0.55, 0.5], [0.25, 0.23, 0.25]], { speed: 1.6 * sd, s0: 9, s1: 2, up: 0.5 });
          if (!this.hitDone && overlap(hb, p.hurtbox)) { this.hitDone = true; p.hurt(this.dmg + 2, this.x); }
          const n = this.phase === 2 ? 6 : 4, pw = g.room.pw, xs = []; for (let tries = 0; xs.length < n && tries < 80; tries++) { const x = rand(46, pw - 46); if (xs.every(q => Math.abs(q - x) > 70)) xs.push(x); }
          xs.sort(() => Math.random() - 0.5).forEach((x, i) => { let ty = 3; while (ty * 16 < g.room.ph && !g.room.solid(Math.floor(x / 16), ty)) ty++;          // (the floor below that spot)
            g.addProjectile(new RollingGear(x, 38, { delay: 24 + i * 10 + Math.floor(rand(0, 8)), floorY: ty * 16, dmg: 11, life: 330 })); });
        } else if (this.st > T0 + 56) { this.state = 'idle'; this.st = -12; } break; }
      case 'vents':
        this.vx = 0; this.faceP(); if (this.st < 30) { this.tell('vents', this.st / 30); for (const i of [0, 1]) { const v = this.vent(i); this.steam(v.x, v.y, 1, 2); } }
        if (this.st === 30) { A.sfx('steam'); const n = this.phase === 2 ? 4 : 3; for (let i = 0; i < n; i++) { const x = clamp(i === 0 ? p.x : p.x + rand(-130, 130), 30, g.room.pw - 30); g.addProjectile(new Column(x, this.y, 'steam', { warn: 62 + i * 14, active: 44, dmg: 12, w: 30, h: 150 })); } }
        if (this.st > 170) { this.state = 'idle'; this.st = -10; } break;
    }
  }
  // THE BOILER GOES UP.  It shudders and vents, the core in its chest lights, then it blows: a flash, a fireball, smoke rolling up, and what is left of the golem (the arms and legs) falls and burns.
  dyingSeq() {
    const g = this.g, d = ++this.dying; this.vx = 0; this.flashT = d < 70 && d % 6 < 3 ? 4 : 0;
    const cx = this.x, cy = this.y - 52;
    if (d < 70) {
      for (const i of [0, 1]) { const v = this.vent(i); this.steam(v.x, v.y, d % 2 + 1, 1.5 + d / 40); }          // (more and more steam)
      if (d === 1 || d === 30) A.sfx('steam'); if (d % 9 === 0) g.shake(2, 6);
      if (d >= 40) { const k = (d - 40) / 30; g.fx.glow(cx, cy, 14 + 26 * k, [1, 0.45 + 0.4 * k, 0.15 + 0.5 * k], 0.4 + 0.5 * k); if (d % 3 === 0) g.fx.fire(cx, cy + 6, { scale: 0.5 + k * 0.6, n: 1 }); g.fx.sparks(cx, cy, 2, COLORS.fire, 3); }
    } else if (d === 70) {
      A.sfx('boom'); A.sfx('thunder'); g.shake(11, 46); g.fx.flash([1, 0.9, 0.7], 1.0); g.fx.ring(cx, cy, 170, [1, 0.8, 0.5], 40, 0.12); g.fx.ring(cx, cy, 100, [1, 0.5, 0.2], 28, 0.2);
      g.fx.burst(cx, cy, 46, COLORS.fire, { speed: 5.5, s0: 26, l0: 20, l1: 44 }); g.fx.burst(cx, cy, 24, [[1, 0.95, 0.7], [1, 0.5, 0.15]], { speed: 3, s0: 20 }); g.fx.sparks(cx, cy, 44, COLORS.gold, 7, { gy: 0.12 });
      for (let i = 0; i < 7; i++) g.fx.fire(cx + rand(-26, 26), cy + rand(-20, 24), { scale: 1.7, n: 3 });
      g.fx.smoke(cx, cy, 24, { s0: 16, s1: 52, c0: [0.34, 0.32, 0.33], c1: [0.09, 0.08, 0.09], a: 0.62, l: 1.8 });
    } else if (d > 70) {
      const k = Math.max(0, 1 - (d - 70) / 80);
      g.fx.light(this.x, this.y - 30, 150, 1.4 * k + 0.2, [1, 0.5, 0.15]); g.fx.glow(cx, cy, 50 * k + 10, [1, 0.45, 0.12], 0.45 * k);
      if (d % 3 === 0) g.fx.fire(this.x + rand(-34, 34), this.y - rand(2, 16), { scale: 0.5 + 0.9 * k, n: 1 });          // what is left of it burns
      if (d % 4 === 0) g.fx.smoke(this.x + rand(-30, 30), this.y - rand(8, 40), 1, { s0: 12, s1: 38, c0: [0.3, 0.28, 0.29], c1: [0.08, 0.07, 0.08], a: 0.5, l: 1.5 });
      if (d === 82 || d === 96 || d === 112) { A.sfx('boom'); g.shake(4, 12); g.fx.burst(this.x + rand(-30, 30), this.y - rand(10, 40), 16, COLORS.fire, { speed: 3, s0: 18 }); g.fx.sparks(this.x, this.y - 20, 14, COLORS.gold, 5, { gy: 0.12 }); }
    }
    if (d === 150) { g.fx.flash([1, 0.8, 0.5], 0.4); g.fx.ring(this.x, this.cy, 120, [1, 0.8, 0.5], 36, 0.1); g.fx.smoke(this.x, this.y - 16, 14, { s0: 14, s1: 44, c0: [0.3, 0.28, 0.29], c1: [0.08, 0.07, 0.08], a: 0.5, l: 1.6 }); g.fx.souls(this.x, this.cy, 24, COLORS.blue); A.sfx('thunder'); this.dead = true; g.player.gainXp(this.xp); if (!this.noDrop) rollEnchantDrop(g, this, true); g.bossDefeated(this); }
  }
  draw(ctx, cx, cy) {
    const T = this.tele(this.state === 'punch' || this.state === 'scoop' || this.state === 'gearslam' ? this.state : this.state === 'fireball' ? 'fireball' : 'punch'); let id = 'golem_idle', f = Math.floor(this.t / 9) % 6;
    if (this.dying) { id = 'golem_death'; const d = this.dying; f = d < 40 ? 0 : d < 70 ? 1 : Math.min(9, 2 + Math.floor((d - 70) / 8)); }
    else if (this.state === 'punch' || this.state === 'scoop' || this.state === 'gearslam') { id = this.state === 'punch' ? 'golem_attack' : 'golem_attack2'; f = this.st < T ? Math.min(4, Math.floor(this.st / T * 5)) : Math.min(7, 5 + Math.floor((this.st - T) / 5)); }
    else if (this.state === 'fireball') { id = 'golem_spit'; f = this.st < T * 0.5 ? Math.floor(this.st / (T * 0.5) * 3) : this.st < T ? 3 : Math.min(6, 4 + Math.floor((this.st - T) / 5)); }
    else if (this.state === 'vents') { id = 'golem_hit'; f = this.st < 30 ? 0 : 1; }
    else if (Math.abs(this.vx) > 0.15) { id = 'golem_walk'; f = Math.floor(this.t / 7) % 8; }
    this.spr(ctx, id, f, cx, cy + 1, { flash: this.flashT > 0 });
  }
}

// ============================================================================================== THE REFLECTION (the Mirror Room's optional boss)
// The mirror on the back wall shows you, mirrored across its middle.  Walk in front of it and meet your reflection in the middle: the glass cracks, the reflection turns silver and violet and crashes out to fight you: with a SWORD (a two-blow combo, three in the
// second half), a SHADOW DASH that cuts as it ends, a LEAP (second half), and the very same things you can carry - DAGGERS (flat: duck under them), an AXE and a TORCH and SALT (lobbed at where you
// stand: the landing spot is marked), a homing MAGIC ARROW (cut it down, or outrun it) - and it will bind its wounds with a BANDAGE if it can find a quiet moment (that is your opening).
// While it is still a reflection it IS the boss: its position tracks yours mirrored across the glass (x = 2 * axis - yours) and it draws itself clipped to the glass (see mirror.js).
const TOSS = new Set(['dagger', 'torch', 'marrow', 'salt']), LOB = { torch: [42, 3], salt: [34, 3] };          // LOB: [frames in the air, fastest sideways speed]
const P1 = ['slash', 'slash', 'dash', 'dagger', 'torch', 'marrow', 'salt'], P2 = ['slash', 'slash', 'dash', 'dash', 'dagger', 'torch', 'marrow', 'salt', 'leap'];
export class BossMirror extends Boss {
  constructor(g, x, y, o) {
    super(g, x, y, HPW, HPH, o); this.hp = this.maxHp = 400; this.dmg = 17; this.xp = 220; this.bossName = 'THE REFLECTION'; this.voice = 'mirror'; this.sub = 'WHAT THE GLASS KEPT'; this.dir = -1; this.deathFx = [[0.85, 0.85, 1], [0.3, 0.2, 0.6]]; this.ice = { w: 30, h: 56 };
    this.mv = g.mirrorView; this.axis = this.mv ? this.mv.m.axis : x; this.triggerDist = 26; this.name = 'twin';
    this.reflecting = true; this.evil = 0; this.hold = null; this.live = false; this.hitDone = false; this.blow = 0; this.bt = 0; this.tx = x; this.trail = []; this.heals = 0; this.thrown = 0; this.lastToss = -99; this.hi = false;
  }
  get spd() { return this.phase === 2 ? 1.18 : 1; }
  cry(die) { if (die) super.cry(true); else A.sfx('jump'); }          // (no voice of its own while it lives: it is you, so it makes your sounds - leaping out of the glass is your jump, the sword, dash, items and bandage already use yours.  Only its death is its own: the glass going - boss_mirror_die)
  tele(k) { return Math.round({ slash: 46, dash: 50, dagger: 46, torch: 48, marrow: 46, salt: 48, leap: 54, bandage: 34 }[k] / this.spd); }
  dangerous() { return this.live; }
  physics() { if (this.reflecting) return; super.physics(); }                 // (inside the glass it has no body: nothing pushes it about)
  update() {
    if (!this.active) {
      const g = this.g, p = g.player; this.t++;
      this.x = 2 * this.axis - p.x; this.y = p.y; this.dir = -p.dir; this.vx = this.vy = 0;                  // the reflection: it IS the boss, standing in the glass and doing what you do
      if (!g.save.flags['boss_' + g.room.id] && Math.abs(p.x - this.axis) < this.triggerDist && p.onGround && !p.dead && g.state === 'play' && !g.cutscene) this.start();
      return;
    }
    super.update();
  }
  intro(g) {
    const st = this.st, p = g.player, mv = this.mv, m = mv ? mv.m : null;
    if (st < 26) { this.x = 2 * this.axis - p.x; this.y = p.y; this.dir = -p.dir; } else if (this.reflecting) { this.dir = p.x >= this.x ? 1 : -1; if (st === 26) this.hold = p.frameInfo(); }          // (it stops copying you, and looks at you)
    if (st === 1) { if (mv) mv.startCrack(this.x, this.y - 22); A.sfx('crack'); g.shake(2, 50); g.fx.flash([0.7, 0.8, 1], 0.2); }
    if (st < 56) {
      const k = st / 56; if (mv) mv.cr = k; this.evil = k * k; if (mv) g.fx.light(this.x, this.y - 20, 70, 0.6 * k, [1, 0.2, 0.3]);
      if (st === 18 || st === 34 || st === 46) { A.sfx('crack'); g.shake(2 + st / 18, 12); if (mv) g.fx.sparks(this.x + rand(-14, 14), this.y - rand(8, 34), 6, [[1, 1, 1], [0.7, 0.85, 1]], 2.4, { dir: rand(0, Math.PI * 2), spread: 1.2, gy: 0.15 }); }
      if (this.evil > 0.2) g.fx.glow(this.x + this.dir * 4, this.y - 28, 7, [1, 0.12, 0.2], 0.8 * this.evil);
    }
    if (st === 56 && this.reflecting) {
      this.reflecting = false; if (mv) mv.shatter(g, this.x, this.y - 22);                                                    // it crashes out of the glass and lands beside you, never on top of you
      const side = this.x >= p.x ? 1 : -1, tgt = clamp(p.x + side * Math.max(46, Math.abs(this.x - p.x)), 28, g.room.pw - 28);
      this.y = m ? m.y1 : this.y; this.vx = (tgt - this.x) / 32; this.vy = -3.4; this.onGround = false; this.dir = tgt >= this.x ? 1 : -1; this.evil = 1; this.hold = null;
      g.fx.ring(this.x, this.cy, 60, [0.7, 0.45, 1], 26, 0.12); g.fx.burst(this.x, this.cy, 18, [[0.7, 0.5, 1], [0.15, 0.05, 0.3]], { speed: 2.6, s0: 14 }); this.cry();
    }
    if (st > 56) { this.faceP(); if (this.onGround) this.vx = approach(this.vx, 0, 0.3); g.fx.glow(this.x + this.dir * 4, this.y - 28, 7, [1, 0.12, 0.2], 0.8); }
  }
  swordBox(reach) { return { x: this.dir > 0 ? this.x : this.x - reach, y: this.y - 52, w: reach, h: 48 }; }
  strike(g, reach, extra = 0) { const p = g.player; if (!this.hitDone && overlap(this.swordBox(reach), p.hurtbox)) { this.hitDone = true; p.hurt(this.dmg + extra, this.x); } }
  hand() { return [this.x + this.dir * 12, this.y - 24]; }
  lobVx(k) { const L = LOB[k], hx = this.hand()[0]; return clamp((this.g.player.x - hx) / L[0], -L[1], L[1]); }          // an item lobbed at where you stand (it falls short if you are far: the mark shows where it will really land)
  lobLand(k) { return this.hand()[0] + this.lobVx(k) * LOB[k][0]; }
  // let go of an item (the aim is made when it leaves the hand, as yours is)
  toss(g, k) {
    const p = g.player, [hx, hy] = this.hand(), d = this.dir; A.sfx(k === 'dagger' ? 'slash' : 'cast'); this.lastToss = this.t;
    if (k === 'dagger') { const n = this.phase === 2 ? 3 : 1; for (let i = 0; i < n; i++) g.addProjectile(new TwinDagger(hx, hy, d, (i - (n - 1) / 2) * 0.32)); }
    else if (k === 'torch') g.addProjectile(new TwinTorch(hx, hy - 2, this.lobVx(k)));
    else if (k === 'salt') g.addProjectile(new TwinSalt(g, hx, hy - 2, this.lobVx(k)));
    else if (k === 'marrow') g.addProjectile(new TwinArrow(hx, hy, d));
    if (LOB[k]) { this.landX = this.lobLand(k); this.landT = LOB[k][0] - 6; }                    // (the spot stays marked while it is in the air)
    g.fx.ring(hx, hy, 14, [0.75, 0.6, 1], 12, 0.2);
  }
  ai(g) {
    const p = g.player, spd = this.spd, d = Math.abs(this.dx()), [hx, hy] = this.hand(); this.live = false;
    for (const q of this.trail) q.life--; this.trail = this.trail.filter(q => q.life > 0);
    this.stepSwipe(g);
    if (this.landT > 0) { this.landT--; if (!this.warns) this.warns = [{ type: 'ring', x: this.landX, y: this.y, r: 26 }]; }
    g.fx.light(this.x, this.y - 20, 56, 0.45, [0.65, 0.5, 1]); g.fx.glow(this.x + this.dir * 4, this.y - 28, 7, [1, 0.12, 0.2], 0.75);
    if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-6, 6), y: this.y - rand(4, 34), vx: rand(-0.15, 0.15), vy: -rand(0.2, 0.6), life: 28, s0: 5, s1: 1, c0: [0.65, 0.4, 1], c1: [0.2, 0.05, 0.4], a0: 0.6, a1: 0, kind: 6 });      // a faint violet haze
    switch (this.state) {
      case 'idle': {
        this.faceP(); this.vx = approach(this.vx, d > 110 ? this.dir * 1.5 : d < 42 ? -this.dir * 1.2 : 0, 0.14);
        if (this.hp < this.maxHp * 0.6 && this.heals < (this.phase === 2 ? 2 : 1) && d > 70 && this.st > 20 && Math.random() < 0.025) { this.state = 'bandage'; this.st = 0; this.plan = null; break; }
        this.planNext(this.phase === 2 ? P2 : P1, Math.round(70 / spd)); break; }
      case 'slash': {                                                                                  // a combo: a long wind-up and a cut, then quick follow-ups
        const n = this.phase === 2 ? 3 : 2, T0 = this.tele('slash'); if (this.st === 1) { this.blow = 0; this.bt = 0; this.hitDone = false; this.faceP(); }
        const wind = this.blow === 0 ? T0 : Math.round(24 / spd), reach = this.blow === n - 1 && n === 3 ? 54 : 46, LIVE = 7; this.bt++;
        if (this.bt <= wind) {
          if (this.bt === 1 && this.blow > 0) { this.faceP(); this.hitDone = false; }
          this.vx = d > 30 && this.bt < wind * 0.7 ? this.dir * 1.3 : 0; this.tell('slash', this.bt / wind, [{ type: 'rect', x: this.dir > 0 ? this.x : this.x - reach - 14, y: this.y - 52, w: reach + 14, h: 48 }]);
        } else if (this.bt <= wind + LIVE) {
          if (this.bt === wind + 1) { A.sfx('slash'); g.fx.ring(this.x + this.dir * 30, this.y - 30, 30, [0.75, 0.65, 1], 12, 0.2); g.fx.gust && g.fx.gust(this.x + this.dir * 30, this.y - 30, this.dir * 3, 0, 36, 1, 20); }
          this.vx = this.dir * 1.8; this.live = true; this.strike(g, reach + 8, this.blow === n - 1 ? 3 : 0);
        } else {
          this.vx = approach(this.vx, 0, 0.4);
          if (this.bt > wind + LIVE + (this.blow < n - 1 ? 8 : 26)) { if (this.blow < n - 1) { this.blow++; this.bt = 0; } else { this.state = 'idle'; this.st = -10; } }
        }
        break; }
      case 'dash': {                                                                                   // through where you stand, a cut at the end of it
        const T0 = this.tele('dash'), run = 24, sp = this.phase === 2 ? 6.4 : 5.4;
        if (this.st === 1) { this.faceP(); this.hitDone = false; this.trail.length = 0; }
        if (this.st < T0) { this.vx = 0; this.tell('dash', this.st / T0, [{ type: 'lane', x0: this.x, x1: this.x + this.dir * sp * run, y: this.y }]); }
        else if (this.st < T0 + run) {
          if (this.st === T0) { A.sfx('dash'); g.fx.ring(this.x, this.cy, 36, [0.7, 0.45, 1], 14, 0.2); }
          this.vx = this.dir * sp; this.live = true; if (this.st >= T0 + run - 9) { if (this.st === T0 + run - 9) A.sfx('slash'); this.strike(g, 42, 2); }
          if (this.st % 2 === 0) this.trail.push({ x: this.x, y: this.y, fi: this.pose(), dir: this.dir, life: 14 });
        } else { this.vx = approach(this.vx, 0, 0.6); if (this.st > T0 + run + 22) { this.state = 'idle'; this.st = -10; } }
        break; }
      case 'dagger': case 'torch': case 'marrow': case 'salt': {
        const k = this.state, T0 = this.tele(k), V = k === 'dagger' ? 2 : this.phase === 2 ? 2 : 1, gap = k === 'dagger' ? 16 : 26; this.vx = approach(this.vx, 0, 0.3);
        if (this.st === 1) { this.faceP(); this.thrown = 0; this.tx = clamp(p.x, 30, g.room.pw - 30); }
        if (this.st < T0) this.tell(k, this.st / T0, k === 'dagger' ? [{ type: 'lane', x0: hx, x1: hx + this.dir * 220, y: this.y - 6 }] : k === 'marrow' ? [{ type: 'line', x0: hx, y0: hy, x1: p.x, y1: p.y - 20 }] : [{ type: 'ring', x: this.lobLand(k), y: this.y, r: 28 }]);
        else if (this.thrown < V && this.st >= T0 + gap * this.thrown) { if (this.thrown > 0) this.faceP(); this.toss(g, k); this.thrown++; }
        else if (this.thrown >= V && this.st > T0 + gap * (V - 1) + 26) { this.state = 'idle'; this.st = -12; }
        break; }
      case 'bandage': {                                                                                // it kneels and binds its wounds: a quiet moment - strike now
        const T0 = this.tele('bandage'); this.vx = approach(this.vx, 0, 0.3);
        if (this.st < T0) this.tell('bandage', this.st / T0);
        else if (this.st < T0 + 100) {
          if (this.st === T0) { A.sfx('heal'); this.heals++; g.popup(this.x, this.y - 46, 'PANACEA', '#f2efe6'); g.fx.ring(this.x, this.y - 18, 20, [0.95, 0.95, 0.9], 18, 0.2); }
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.15 / 100);
          if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-7, 7), y: this.y - rand(2, 26), vx: rand(-0.1, 0.1), vy: -rand(0.3, 0.8), life: 30, s0: 5, s1: 1, c0: [0.75, 1, 0.8], c1: [0.3, 0.9, 0.5], a0: 0.9, a1: 0, kind: 6 });
        } else { this.state = 'idle'; this.st = -16; }
        break; }
      case 'leap': {                                                                                   // (second half) it jumps onto where you stand - even up on a platform - and cuts on the way down
        const T0 = this.tele('leap');
        if (this.st === 1) { this.tx = clamp(p.x, 40, g.room.pw - 40); this.hitDone = false; this.hi = p.y < this.y - 20; }
        if (this.st < T0) { this.vx = 0; this.dir = this.tx >= this.x ? 1 : -1; this.tell('leap', this.st / T0, [{ type: 'ring', x: this.tx, y: this.hi ? p.y : this.y, r: 34 }]); }
        else if (this.st === T0) { this.vy = -5.1; this.vx = clamp((this.tx - this.x) / (this.hi ? 36 : 48), -3.6, 3.6); this.onGround = false; A.sfx('jump'); }
        else if (this.st > T0 + 8 && this.onGround) { this.vx = 0; g.shake(3, 10); A.sfx('boom'); g.fx.ring(this.x, this.y - 4, 50, [0.7, 0.45, 1], 18, 0.15); g.fx.burst(this.x, this.y - 4, 8, [[0.6, 0.45, 0.9], [0.15, 0.1, 0.3]], { speed: 1.8, s0: 10, up: 0.5 }); this.state = 'idle'; this.st = -22; }
        else if (this.vy > 0.4) { this.live = true; this.strike(g, 46, 2); }
        break; }
    }
  }
  // which picture of the hero's sheets it is wearing (the same sheets as his, recoloured)
  pose() {
    const s = this.state, st = this.st, t = this.t;
    if (this.dying) return { sheet: 'hero_hurt', f: this.dying < 20 ? 0 : this.dying < 44 ? 1 : 2 };
    if (this.state === 'intro') return { sheet: 'hero_idle', f: Math.floor(t / 11) % 4 };
    if (s === 'slash') { const wind = this.blow === 0 ? this.tele('slash') : Math.round(24 / this.spd), bt = this.bt; return { sheet: 'hero_attack', f: bt <= wind ? (bt < wind * 0.6 ? 0 : 1) : bt <= wind + 4 ? 2 : bt <= wind + 7 ? 3 : bt <= wind + 11 ? 4 : 5 }; }
    if (s === 'dash') { const T0 = this.tele('dash'); return st < T0 ? { sheet: 'hero_crouch', f: 1 } : st < T0 + 15 ? { sheet: 'hero_run', f: 3 } : st < T0 + 24 ? { sheet: 'hero_attack', f: 2 } : { sheet: 'hero_attack', f: 3 }; }
    if (TOSS.has(s)) { const T0 = this.tele(s); return { sheet: 'hero_attack', f: t - this.lastToss < 9 ? 2 : st < T0 * 0.55 ? 0 : 1 }; }
    if (s === 'bandage') return { sheet: 'hero_crouch', f: this.st < this.tele('bandage') ? 1 : 2 };
    if (!this.onGround) {
      if (s === 'leap' && this.vy > 0.4) { const f = this.vy < 2 ? 3 : 4; return { sheet: 'hero_jump_attack', f, cy: JATK_CY[f], ch: 80 }; }
      const f = this.vy < -3 ? 1 : this.vy < -0.6 ? 2 : this.vy < 1.2 ? 3 : 4; return { sheet: 'hero_jump', f, cy: JUMP_CY[f], ch: 77 };
    }
    if (s === 'leap') return { sheet: 'hero_crouch', f: 1 };
    if (Math.abs(this.vx) > 0.3) return { sheet: 'hero_run', f: Math.floor(t / 4) % 12 };
    return { sheet: 'hero_idle', f: Math.floor(t / 11) % 4 };
  }
  dyingSeq() {
    const g = this.g; if (this.dying % 4 === 0) g.fx.sparks(this.x + rand(-9, 9), this.y - rand(6, 34), 6, [[1, 1, 1], [0.7, 0.8, 1], [0.6, 0.4, 1]], 3.4, { gy: 0.15 });
    super.dyingSeq();
  }
  onPhase2() {
    const g = this.g; g.fx.flash([0.7, 0.5, 1], 0.5); g.shake(5, 24); A.sfx('enchant'); g.fx.ring(this.x, this.cy, 90, [0.7, 0.5, 1], 34, 0.14);          // (phase two: the hero's own sword-enchant shing)
    const X = x => clamp(x, 20, g.room.pw - 20); dropItem(g, 'heart', X(this.x - 36), this.cy - 20); dropItem(g, 'heart', X(this.x + 36), this.cy - 20); dropItem(g, 'mana', X(this.x), this.cy - 30);          // (a breather, as every boss gives)
    this.state = 'idle'; this.st = -40; this.plan = null; g.banner('IT LEARNS', 'FROM YOU', 150, { y: 60, color: '#c9c0ff' });
  }
  // its sword swipes, as the hero's own are (see slash.js), in its violet
  stepSwipe(g) {
    const fi = this.pose(), key = fi.sheet + ':' + fi.f; if (key === this.swipeKey) return; this.swipeKey = key;
    if (this.reflecting || this.dying) return; const jump = fi.cy !== undefined;
    g.fx.swipe({ sheet: fi.sheet, f: fi.f, dir: this.dir, ay: jump ? fi.cy / fi.ch : undefined, follow: () => ({ x: this.x, y: jump ? this.y - this.h / 2 + 1 : this.y }), pal: { bright: [236, 226, 255], mid: [170, 130, 255], dark: [84, 44, 150] } });
  }
  // inside the glass: you, mirrored, turning silver and violet as the cracks spread (the glass itself is MirrorView's)
  drawReflection(ctx, cx, cy) {
    const mv = this.mv, p = this.g.player; if (!mv) return;
    const fi = this.hold || p.frameInfo(), x = this.x - cx, y = this.y - cy, k = this.evil;
    mv.clip(ctx, cx, cy);
    if (k < 1) { const o = { alpha: 0.94 * (1 - k) }; heroFrame(ctx, fi.sheet, fi, x, y, this.dir, p.h, o); }
    if (k > 0) heroFrame(ctx, fi.sheet + '_evil', fi, x, y, this.dir, p.h, { alpha: 0.94 * k });
    ctx.restore(); mv.over(ctx, cx, cy);
  }
  draw(ctx, cx, cy) {
    if (this.reflecting) { this.drawReflection(ctx, cx, cy); return; }
    const fi = this.pose(), x = this.x - cx, y = this.y - cy, a = this.dying > 70 ? Math.max(0, 1 - (this.dying - 70) / 80) : 1;
    for (const q of this.trail) heroFrame(ctx, q.fi.sheet + '_evil', q.fi, q.x - cx, q.y - cy, q.dir, this.h, { flash: '#7c5cff', alpha: q.life / 14 * 0.45 });
    if (this.onGround && !this.dying) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(x - 7), Math.round(y - 1), 14, 2); }
    const sc = this.state === 'intro' ? 0.82 + 0.18 * clamp((this.st - 56) / 28, 0, 1) : 1;                // (it comes forward out of the glass: a little smaller, still far back, then full size)
    heroFrame(ctx, fi.sheet + '_evil', fi, x, y, this.dir, this.h, { flash: this.flashT > 0, alpha: a < 1 ? a : undefined, scale: sc });
  }
}

// ============================================================================================== 9. THE DROWNED WARDEN (the cistern)
// A great blue many-armed thing (sprites: the unused 'minion' of the Arsenal pack) that keeps the flooded gate, and hangs in the air over the water.
// TIDAL SLAM: it comes down on the floor and two waves race away along it (jump them).  WATER ORBS: a fan of slow blue orbs.  GEYSERS: columns of water burst up where you stand (the marks on the
// floor warn you).  SUBMERGE: it sinks out of sight - nothing can touch it - and bursts up again somewhere else, and where it rises is a geyser too.  In the second half it is quicker and does more at once.
export class BossDrowned extends Boss {
  constructor(g, x, y, o) {
    super(g, x, y + 39, 40, 78, o); this.hp = this.maxHp = 320; this.dmg = 13; this.xp = 170; this.bossName = 'THE DROWNED WARDEN'; this.voice = 'drowned'; this.sub = 'WHO KEEPS THE FLOODED GATE'; this.scale = 1.75; this.gravity = false; this.dir = -1;
    this.deathFx = COLORS.blue; this.ice = { w: 80, h: 112 }; this.tx = x; this.under = false; this.surge = null;
  }
  get spd() { return this.phase === 2 ? 1.25 : 1; }
  // THE TIDE: the arena's floor is a sheet of shallow water that lies still.  A 'tide' move sets this.surge, and for a few seconds the whole flood runs one way (or the other, at random): the current of the room
  // (room.currents[0], which the hero's body feels - see Player.waterAt and the drift in Player.update - and the water shader shows) swells, holds, and dies away again.
  stepTide(g) {
    const s = this.surge, cur = g.room.currents && g.room.currents[0]; if (!s || !cur) return;
    s.t++; const k = Math.max(0, Math.min(1, s.t / 40, (s.dur - s.t) / 60)), e = k * k * (3 - 2 * k);          // (swells in over 40 steps, dies away over the last 60)
    cur.vx = s.dir * s.peak * e; g.syncFlow();
    if (s.t % 5 === 0) g.fx.burst(s.dir > 0 ? cur.x0 + 6 : cur.x1 - 6, cur.y - 4, 2, [[0.7, 0.9, 1], [0.3, 0.55, 0.9]], { speed: 1.2 + e, s0: 7, up: 0.6 });          // (spray where the water comes in)
    if (s.t >= s.dur) { cur.vx = 0; this.surge = null; g.syncFlow(); this.nextTideAt = this.t + 540 + rand(0, 240); }          // (it is a rare thing: nine to thirteen seconds of still water before the next one can be chosen)
  }
  die() { const cur = this.g.room.currents && this.g.room.currents[0]; this.surge = null; if (cur) { cur.vx = 0; this.g.syncFlow(); } super.die(); }          // (the flood is still again once it has fallen)
  intro(g) { if (this.st === 8) { this.cry(); g.shake(4, 40); g.fx.flash([0.4, 0.8, 1], 0.4); g.fx.ring(this.x, this.cy, 130, [0.4, 0.8, 1], 40, 0.1); } g.fx.glow(this.x, this.cy, 70, [0.4, 0.8, 1], 0.35); this.faceP(); }
  physics() { this.x += this.vx; this.y += this.vy; const r = this.g.room; this.x = clamp(this.x, 40, r.pw - 40); this.y = clamp(this.y, 80, r.ph - 20); if (this.flashT > 0) this.flashT--; }
  moveTo(tx, ty, k = 0.04, max = 2.2) { this.vx = clamp((tx - this.x) * k, -max, max); this.vy = clamp((ty - this.cy) * k, -max, max); }
  groundY() { return this.g.room.ph - 32; }
  ai(g) {
    const p = g.player, spd = this.spd, gy = this.groundY(); this.stepTide(g);
    if (!this.under) { g.fx.glow(this.x, this.cy, 50 + Math.sin(this.t * 0.09) * 6, [0.4, 0.8, 1], 0.2); g.fx.light(this.x, this.cy, 100, 0.7, [0.4, 0.8, 1]); }
    if (this.t % 8 === 0 && !this.under) g.fx.emit({ x: this.x + rand(-26, 26), y: this.cy + rand(10, 40), vx: rand(-0.1, 0.1), vy: rand(0.4, 1.1), gy: 0.04, life: 30, s0: 3, s1: 1, c0: [0.6, 0.85, 1], c1: [0.3, 0.5, 0.9], a0: 0.85, a1: 0, kind: 1 });      // drips
    switch (this.state) {
      case 'idle':
        this.alpha = 1; this.under = false; this.faceP(); this.moveTo(clamp(p.x + Math.sin(this.t * 0.02) * 90, 70, g.room.pw - 70), 92 + Math.sin(this.t * 0.05) * 12, 0.03);
        { const moves = this.phase === 2 ? ['slam', 'tideorbs', 'geysers', 'submerge', 'slam'] : ['slam', 'tideorbs', 'geysers', 'submerge']; this.planNext(this.surge || this.t < (this.nextTideAt ?? 480) ? moves : [...moves, 'tide'], Math.round(92 / spd)); }          // (the tide is only an option while the water is still, a while after the last one, and not in the fight's first eight seconds)
        break;
      case 'slam': {
        const T0 = Math.round(34 / spd);
        if (this.st < T0) { this.moveTo(this.x, 76, 0.06); this.faceP(); this.tell('slam', this.st / T0, [{ type: 'ring', x: this.x, y: gy, r: 46 }]); this.vx *= 0.5; }
        else if (this.cy < gy - 44 && this.st < T0 + 40) { this.vx = 0; this.vy = 7.5; }
        else {
          if (!this.hit0) { this.hit0 = true; this.vy = 0; A.sfx('boom'); g.shake(6, 20); g.fx.ring(this.x, gy - 4, 90, [0.4, 0.8, 1], 24, 0.15); g.fx.burst(this.x, gy - 6, 18, [[0.7, 0.9, 1], [0.3, 0.55, 0.9]], { speed: 3, s0: 14, up: 1 });
            for (const sd of [-1, 1]) g.addProjectile(new Shockwave(this.x + sd * 30, gy, sd, { dmg: 10, speed: 2.1, life: 80, big: true, fire: 'blue' })); if (this.phase === 2) g.addProjectile(new Column(clamp(p.x, 40, g.room.pw - 40), gy, 'steam', { warn: 40, active: 30, dmg: 11, w: 24, h: 100 })); }
          this.moveTo(this.x, 92, 0.05); if (this.st > T0 + 70) { this.hit0 = false; this.state = 'idle'; this.st = -14; }
        }
        break; }
      case 'tideorbs': {
        this.faceP(); this.moveTo(this.x, 92, 0.05); const T0 = this.phase === 2 ? [40, 70] : [40];
        if (this.st < 40) this.tell('tideorbs', this.st / 40, [{ type: 'line', x0: this.x, y0: this.cy, x1: p.x, y1: p.y - 20 }]);
        if (T0.includes(this.st)) { A.sfx('cast'); const base = Math.atan2(p.y - 24 - this.cy, p.x - this.x), n = this.phase === 2 ? 5 : 4; for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.3; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a) * 1.6, Math.sin(a) * 1.6, 'tide', { dmg: 9, life: 280 })); } g.fx.ring(this.x, this.cy, 36, [0.4, 0.8, 1], 16); }
        if (this.st > T0[T0.length - 1] + 40) { this.state = 'idle'; this.st = -20; } break; }
      case 'geysers': {
        this.moveTo(this.x, 84, 0.05); this.faceP(); if (this.st < 24) this.tell('geysers', this.st / 24);
        if (this.st === 24) { A.sfx('steam'); const n = this.phase === 2 ? 4 : 3; for (let i = 0; i < n; i++) { const x = clamp(i === 0 ? p.x : p.x + rand(-150, 150), 30, g.room.pw - 30); g.addProjectile(new Column(x, gy, 'steam', { warn: 54 + i * 12, active: 38, dmg: 12, w: 26, h: 110 })); } }
        if (this.st > (this.phase === 2 ? 150 : 128)) { this.state = 'idle'; this.st = -16; } break; }
      case 'tide': {
        const T0 = Math.round(50 / spd), cur = g.room.currents && g.room.currents[0];
        if (!cur) { this.state = 'idle'; this.st = -10; break; }
        if (this.st === 1) this.tideDir = Math.random() < 0.5 ? -1 : 1;          // (either way)
        const dir = this.tideDir || 1; this.moveTo(this.x, 84, 0.05); this.faceP();
        if (this.st < T0) this.tell('tide', this.st / T0, [{ type: 'lane', x0: dir > 0 ? cur.x0 : cur.x1, x1: dir > 0 ? cur.x1 : cur.x0, y: gy }]);          // (the lane on the water runs the way the flood is about to)
        else if (this.st === T0) {
          A.sfx('boom'); A.sfx('steam'); g.shake(4, 24); g.fx.ring(this.x, gy - 4, 110, [0.4, 0.8, 1], 28, 0.15); g.fx.burst(this.x, gy - 6, 16, [[0.7, 0.9, 1], [0.3, 0.55, 0.9]], { speed: 2.6, s0: 12, up: 1 });
          this.surge = { dir, t: 0, dur: this.phase === 2 ? 330 : 270, peak: this.phase === 2 ? 0.95 : 0.8 };
        }
        if (this.st > T0 + 26) { this.state = 'idle'; this.st = -16; }
        break; }
      case 'submerge': {
        const T0 = 36;
        if (this.st === 1) { this.tx = clamp(p.x + (p.x > g.room.pw / 2 ? -1 : 1) * rand(130, 200), 60, g.room.pw - 60); }
        if (this.st < T0) { this.moveTo(this.x, gy - 10, 0.06, 4); this.tell('submerge', this.st / T0, [{ type: 'ring', x: this.tx, y: gy, r: 34 }]); }
        else if (this.st < T0 + 50) {
          if (this.st === T0) { A.sfx('flap'); g.fx.burst(this.x, gy - 8, 22, [[0.7, 0.9, 1], [0.3, 0.55, 0.9]], { speed: 2.6, s0: 16, up: 1 }); this.invuln = true; this.harmless = true; this.under = true; }
          this.vx = this.vy = 0; this.alpha = Math.max(0, 1 - (this.st - T0) / 8);
          if (this.st === T0 + 49) { this.x = this.tx; this.y = gy + 20; g.addProjectile(new Column(this.tx, gy, 'steam', { warn: 1, active: 30, dmg: 14, w: 34, h: 120 })); A.sfx('boom'); g.shake(4, 14); g.fx.burst(this.x, gy - 6, 26, [[0.7, 0.9, 1], [0.3, 0.55, 0.9]], { speed: 3, s0: 16, up: 1.2 }); }
        } else {
          this.under = false; this.alpha = Math.min(1, this.alpha + 0.12); this.invuln = false; this.harmless = false; this.moveTo(this.x, 92, 0.05, 3.2); this.faceP();
          if (this.st > T0 + 50 + 30) { this.state = 'idle'; this.st = -16; }
        }
        break; }
    }
  }
  draw(ctx, cx, cy) {
    if (this.alpha <= 0.02) return;
    const f = Math.floor(this.t / 9) % 3, id = this.state === 'slam' || this.state === 'geysers' ? 'ars_minion_r1' : 'ars_minion_r0';
    drawSheet(ctx, id, f, this.x - cx, this.cy - cy + Math.sin(this.t * 0.07) * 2 + 8, { flash: this.flashT > 0, ay: 0.55, scale: this.scale, dir: this.dir, alpha: this.alpha < 1 ? this.alpha : undefined });
  }
}

export const BOSS_TYPES = { boss_risen: BossRisen, boss_librarian: BossLibrarian, boss_rimewyrm: BossRimewyrm, boss_drowned: BossDrowned, boss_vampire: BossVampire, boss_beast: BossBeast, boss_nightmare: BossNightmare, boss_angel: BossAngel, boss_colossus: BossColossus, boss_shadow: BossShadow, boss_cinder: BossCinder, boss_bramble: BossBramble, boss_mirror: BossMirror, boss_golem: BossGolem };
