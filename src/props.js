// World objects: pickups, breakable candles, save altar, lore tablets, chests, upgrades, ability relics.
import { KEYS } from './itemdata.js';
import { STORY } from './story.js';
import { text as dtext } from './dialogue.js';
import { Entity, moveX, moveY } from './entity.js';
import { drawSheet, drawKey, IMG, SHEET } from './assets.js';
import { ICON } from './procart.js';
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { T, rand, dist, overlap, TAU, choice } from './util.js';
import { ENCH, ENCH_TYPES, ENCH_BIAS, TUNE } from './enchant.js';
import { ITEMS, addItem, randomItemId } from './itemdata.js';
import { letterTitle, markPage } from './letters.js';

export const ABILITIES = {
  djump: { name: 'AETHER FEATHER', desc: 'PRESS JUMP AGAIN IN MIDAIR TO DOUBLE JUMP.', icon: 'feather', color: [0.6, 0.85, 1] },
  dash: { name: 'QUICKSILVER STEP', desc: 'PRESS SHIFT TO DASH. YOU CANNOT BE HURT WHILE YOU MOVE LIKE QUICKSILVER.', icon: 'boot', color: [0.75, 0.5, 1] },
  ember: { name: 'SULPHUR RUNE', desc: 'PRESS C TO HURL FIRE. IT BURNS WOODEN BARRICADES. Q / V CHANGE WHAT C USES.', icon: 'ember', color: [1, 0.55, 0.2] },
  thunder: { name: 'VITRIOL RUNE', desc: 'PRESS C TO CALL LIGHTNING DOWN ON YOUR FOES. THE CORROSIVE BOLT SHATTERS CRYSTAL.', icon: 'thunder', color: [0.9, 0.95, 1] },
  dawn: { name: 'AZOTH', desc: 'THE LIGHT THAT WAKES THE SUN.', icon: 'orb', color: [1, 0.9, 0.5] },
};
export const UPGRADES = {
  silberzahn: { name: 'SILBERZAHN', desc: 'THE SILVER TOOTH. YOUR SWORD.', icon: 'atkup', color: [0.82, 0.9, 1] },          // (its id is the flag 'got_silberzahn': the Player reads it)
  hpup: { name: 'ELIXIR VITAE', desc: 'MAX HP UP', icon: 'hpup', color: [1, 0.3, 0.35] },
  mpup: { name: 'QUINTESSENCE', desc: 'MAX MP UP', icon: 'mpup', color: [0.4, 0.7, 1] },
  atkup: { name: 'SAL MARTIS', desc: 'SWORD POWER UP', icon: 'atkup', color: [1, 0.85, 0.4] },
  mantle: { name: 'SALAMANDER MANTLE', desc: 'FIRE HURTS HALF AS MUCH, AND SOOT NEVER STAINS YOUR CLOAK', icon: 'mantle', color: [1, 0.55, 0.25] },
  lantern: { name: 'IGNIS VAPOUR LANTERN', desc: 'A PALE BLUE WISP, WARM AS A VOICE YOU KNEW. IT FOLLOWS YOU, LIGHTS THE DARK, CLEARS THE FOG AND DRAWS LOOT TO YOU', icon: 'lantern', color: [0.5, 0.72, 1] },
  shard: { name: 'LACUNA SHARD', desc: 'YOUR SWORD KNOCKS ARROWS, BONES AND ORBS ASIDE, HARMLESSLY', icon: 'shard', color: [0.8, 0.88, 1] },
  spring: { name: 'PERPETUUM', desc: 'A SPRING THAT NEVER RUNS DOWN: YOUR DASH RECHARGES TWICE AS FAST', icon: 'spring', color: [1, 0.8, 0.4] },
  tide: { name: 'AQUA REGIA', desc: 'A DASH CUTS WHATEVER IT PASSES THROUGH', icon: 'e_ice', color: [0.4, 0.8, 1] },
  astrolabe: { name: 'ASTROLABE', desc: "THE ORLOJ'S LITTLE SISTER. YOUR MAP NOW MARKS WHAT YOU HAVE LEFT BEHIND: TREASURE NOT TAKEN, AND THE ROOMS BESIDE THE ONES YOU KNOW.", icon: 'astrolabe', color: [1, 0.85, 0.45] },          // (its id is the flag 'got_astrolabe': the map reads it)
  goldkey: { name: 'KEY OF GOLD', desc: 'THE LAST KEY: IT OPENS THE DOOR OF THE SHADOW THRONE.', icon: 'key', color: KEYS.find(k => k.id === 'key_gold').rgb.map(v => v / 255) },          // (the Librarian's: its id is the flag 'has_key_gold'; the colour is its lock's)
  frostkey: { name: 'KEY OF ANTIMONY', desc: 'IT OPENS THE LIBRARY OF AGES, DEEP IN ARX NOCTIS.', icon: 'key', color: KEYS.find(k => k.id === 'key_frost').rgb.map(v => v / 255) },          // (the Rimewyrm's: its id is the flag 'has_key_frost')
  crampons: { name: 'RIME CRAMPONS', desc: 'STEEL SPIKES FOR YOUR BOOTS: YOU NO LONGER SLIP ON ICE.', icon: 'crampons', color: [0.7, 0.9, 1] },          // (its id is the flag 'got_crampons': the Player reads it)
  hoard: { name: 'A HOARD', desc: 'SOMEONE HID THIS AWAY LONG AGO: GOLD, A GREAT DEAL OF IT.', icon: 'coin', color: [1, 0.85, 0.3] },
  letter: { name: "THE LADY'S LETTER", desc: '', icon: 'scroll', color: [0.95, 0.9, 0.75] },          // (its words come from LETTERS, chosen by its id)
  shoes: { name: 'SHOES OF HERMES', desc: 'MOVE 10% FASTER', icon: 'shoes', color: [1, 0.45, 0.95] },          // (its id is the flag 'got_shoes': the Player reads it)
};
export const iconFrame = name => ICON.indexOf(name);
// the Lady's letters: hidden in the castle for him to find, one by one (she knew him: she never calls him a stranger)
export const LETTERS = [
  'MY DEAREST. IF YOU READ THIS I AM ALREADY LIGHT AND DUST. DO NOT GRIEVE. THE DAWN WILL BE WORTH THE WAITING.',
  'HE WAS KIND ONCE, THE LORD. HE ONLY WANTED THE NIGHT TO STOP HURTING. HE DID NOT KNOW IT WOULD NEVER END.',
  'I HID THESE WHERE ONLY A PATIENT HAND WOULD FIND THEM. I HOPED THAT HAND WOULD BE YOURS.',
  'THE LIBRARIAN WAS ASKED TO KEEP THE KEYS. HE KEEPS EVERYTHING NOW. BE GENTLE WITH HIM, IF YOU CAN.',
  'THE COLD CAME UP FROM THE FOUNDATIONS THE DAY THE SUN WAS TAKEN. IT IS ONLY LONELY. IT WANTS A WARM HAND.',
  'THE ENGINEER BUILT A MACHINE TO HOLD THE SUN. HE NEVER ASKED IF THE SUN WISHED TO BE HELD.',
  'WHEN IT IS OVER, GO UP TO THE HILL ABOVE PRAGUE. I WILL BE THERE. I HAVE ALWAYS BEEN THERE.',
];
const pageUpgrade = n => ({ name: 'A PAGE: ' + letterTitle(n), desc: 'A LETTER, FOLDED SMALL. IT IS KEPT IN THE LETTERS ON THE TITLE SCREEN.', icon: 'scroll', color: [0.95, 0.9, 0.75] });
function letterUpgrade(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return { ...UPGRADES.letter, desc: LETTERS[h % LETTERS.length] }; }
// a key picked up from a chest, a ledge or the top of a tower (its id, with or without the chest's '_u', names it - see KEYS)
const keyBase = id => String(id).replace(/_u$/, '');
function keyUpgrade(id) { const K = KEYS.find(k => k.id === keyBase(id)); return { name: K ? K.name : 'IRON KEY', desc: 'OPENS A LOCKED DOOR', icon: 'key', color: K ? K.rgb.map(v => v / 255) : [1, 0.85, 0.4] }; }

// ------------------------------------------------------------------------------------------------ pickups
export class Pickup extends Entity {
  constructor(kind, x, y, vx = rand(-1, 1), vy = -2.8) {
    super(x, y, 10, 10); this.kind = kind; this.vx = vx; this.vy = vy; this.life = kind.startsWith('e_') ? 1500 : 720; this.magnet = false;      // enchant gems linger 25s
    this.ench = kind.startsWith('e_') ? ENCH[kind.slice(2)] : null;
    this.item = kind.startsWith('it_') ? kind.slice(3) : null; this.qty = this.item ? ITEMS[this.item].pack : 0; this.flagId = null; this.fullT = 0;      // carried-item pickups (dagger, torch, ...)
  }
  update(g) {
    this.t++; const p = g.player, room = g.room;
    const pc = { x: p.x, y: p.y - 16 }, d = dist(this.x, this.y - 5, pc.x, pc.y);
    const reach = g.save && g.save.flags.got_lantern ? 96 : 44;          // (the Marshlight Lantern's wisp draws loot from much further)
    const lamp = !!(g.save && g.save.flags.got_lantern);
    if (this.blocked && d > 64) { this.blocked = false; this.touched = false; }          // (a pickup you are already full of is left alone until you walk away from it and come back)
    if (this.t > 24 && !p.dead && !this.blocked && (lamp ? (this.touched || d < 20) : d < reach)) this.magnet = true;          // (with the lantern, the wisp must first fly out and TOUCH the loot - see Player.stepLantern; then it comes)
    if (this.touchT > 0) { this.touchT--; g.fx.glow(this.x, this.y - 6, 18 + this.touchT, [0.55, 0.78, 1], 0.5 * this.touchT / 14); }
    if (this.magnet) { const a = Math.atan2(pc.y - (this.y - 5), pc.x - this.x), sp = Math.min(4.5, 2 + this.t * 0.01 + (reach - Math.min(d, reach)) * 0.05); this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp; this.x += this.vx; this.y += this.vy; }
    else { this.vy = Math.min(this.vy + 0.14, 4); this.vx *= 0.97; moveX(this, room); const vy0 = this.vy; moveY(this, room); if (this.onGround && Math.abs(vy0) > 1) { this.vy = -vy0 * 0.35; this.onGround = false; } }
    if (--this.life <= 0) this.dead = true;
    if (d < 11 && !p.dead && !this.blocked) this.collect(g, p);
    const col = this.ench ? this.ench.rgb : (this.item ? [0.85, 0.9, 1] : { heart: [1, 0.3, 0.35], potion: [1, 0.3, 0.35], mana: [0.4, 0.7, 1], coin: [1, 0.85, 0.3], gem: [0.4, 0.95, 1] }[this.kind]);
    if (col) g.fx.glow(this.x, this.y - 6, this.ench ? 22 : 12, col, this.ench ? 0.55 : 0.35);
    if (this.ench) { g.fx.light(this.x, this.y - 6, 46, 0.6); if (this.t % 6 === 0) g.fx.emit({ x: this.x + rand(-6, 6), y: this.y - 6 + rand(-6, 6), vx: 0, vy: -rand(0.2, 0.6), life: 30, s0: 5, s1: 1, c0: col, a0: 1, a1: 0, kind: 6 }); }
  }
  collect(g, p) {
    const S = g.save;
    if (this.item) {         // a carried item: stack it (up to the item's maximum) - if you're full it stays where it is
      const it = ITEMS[this.item], add = addItem(S, this.item, this.qty);
      if (add <= 0) { this.blocked = true; this.magnet = false; this.touched = false; this.vx = 0; g.popup(p.x, p.y - 42, it.short + ' FULL', '#cfc2a0'); A.sfx('back'); return; }          // (said once: it stays where it is and is not pulled again until the hero has moved away)
      this.dead = true; if (this.flagId) S.flags[this.flagId] = true; A.sfx('pickup'); g.popup(p.x, p.y - 40, '+' + add + ' ' + it.short, '#e8dcc0'); g.fx.sparks(this.x, this.y - 6, 6, [[1, 1, 1], [0.7, 0.8, 1]], 1.8);
      if (!p.sel) p.sel = this.item; return;
    }
    this.dead = true;
    if (this.ench) { p.setEnchant(this.kind.slice(2)); return; }
    switch (this.kind) {
      case 'heart': p.heal(10); A.sfx('pickup'); break;
      case 'potion': p.heal(45); A.sfx('heal'); g.fx.ring(p.x, p.y - 16, 22, [0.5, 1, 0.6], 18); break;
      case 'mana': p.gainMp(18); A.sfx('mana'); g.popup(p.x, p.y - 40, '+MP', '#6aa8ff'); break;
      case 'coin': S.gold += 15; A.sfx('coin'); break;
      case 'gem': S.gold += 50; p.gainXp(10); A.sfx('coin'); g.popup(p.x, p.y - 40, '+50', '#7ff'); break;
    }
    g.fx.sparks(this.x, this.y - 6, 5, COLORS.gold, 1.6);
  }
  draw(ctx, cx, cy) {
    if (this.life < 150 && Math.floor(this.life / 5) % 2) return;
    const bob = this.magnet ? 0 : Math.sin(this.t * 0.1) * 1;
    if (this.kind === 'gem') { drawSheet(ctx, 'szadi_gem', Math.floor(this.t / 6) % 5, this.x - cx, this.y - 6 - cy + bob, { ay: 0.5, scale: 1.8 }); return; }       // Szadi's sparkling diamond
    drawSheet(ctx, 'icons', iconFrame(this.item ? ITEMS[this.item].icon : this.ench ? this.kind : { heart: 'heart', potion: 'potion', mana: 'mana', coin: 'coin', gem: 'gem' }[this.kind]), this.x - cx, this.y - 6 - cy + bob, { ay: 0.5, scale: this.ench ? 1.35 : this.item ? 1.15 : 1 });
  }
}

// Sometimes an enemy leaves a sword-enchantment gem.  Elite enemies drop more often; a "pity" bonus grows with every kill
// that drops nothing, so gems arrive about every 13 kills on average.  Bosses always drop one.
export function rollEnchantDrop(g, e, guaranteed = false) {
  g.enchPity = (g.enchPity || 0) + 1;
  const base = (e.xp || 0) >= 14 ? TUNE.dropElite : TUNE.dropBase, chance = guaranteed ? 1 : base + Math.min(TUNE.dropPityMax, g.enchPity * TUNE.dropPity);
  if (Math.random() >= chance) return false;
  g.enchPity = 0; const bias = ENCH_BIAS[e.name], type = bias && Math.random() < 0.55 ? bias : choice(ENCH_TYPES);
  g.pickups.push(new Pickup('e_' + type, e.x, e.cy - 8, rand(-0.6, 0.6), -3.4)); return true;
}

export function dropItem(g, kind, x, y) {
  if (!kind) return;
  if (kind === 'coin') { for (let i = 0; i < 2; i++) g.pickups.push(new Pickup('coin', x, y, rand(-1.4, 1.4), -rand(2, 3.4))); return; }
  g.pickups.push(new Pickup(kind, x, y));
}
export function randomDrop(g, x, y, bonus = 0) {
  const r = Math.random();
  // about three kills in ten leave something (it used to be six in ten), and a coin drop is two coins worth 15 each (it was three worth 10)
  if (r < 0.08 + bonus) dropItem(g, 'heart', x, y); else if (r < 0.14 + bonus) dropItem(g, 'mana', x, y); else if (r < 0.26 + bonus) dropItem(g, 'coin', x, y); else if (r < 0.275 + bonus) dropItem(g, 'gem', x, y);
  else if (r < 0.30 + bonus) dropItem(g, 'it_' + randomItemId(), x, y);      // now and then a thrown weapon / bandage
}

// ------------------------------------------------------------------------------------------------ statue (breakable: 2-3 hits, but pays out 2-3 times what a candle does - and turns up about 2.5x less often)
const STATUE_SC = 0.72;
// a statue's glow: its own silhouette filled with the glow colour (made once per colour), drawn a little larger behind it so it reads as a glowing rim
const HALO = {};
function haloOf(im, rgb) { const k = rgb.join(','); if (!HALO[k]) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(' + k + ')'; g.fillRect(0, 0, c.width, c.height); HALO[k] = c; } return HALO[k]; }

export class Statue {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.drop = o.drop; this.id = o.id; this.dead = false; this.maxHp = this.hp = Math.random() < 0.5 ? 2 : 3; this.shake = 0; this.lastAtk = -1; this.t = 0; }
  get box() { const im = IMG.cemetery_statue, w = Math.round(im.width * STATUE_SC * 0.6), h = Math.round(im.height * STATUE_SC); return { x: this.x - w / 2, y: this.y - h, w, h }; }
  hit(g, dmg, from) {
    if (this.dead || this.lastAtk === g.player.atkId) return false; this.lastAtk = g.player.atkId;     // one chip per swing
    const b = this.box, cx = this.x, cy = b.y + b.h * 0.55, stone = [[0.78, 0.78, 0.86], [0.42, 0.42, 0.52]]; this.hp--; this.shake = 8;
    if (this.hp > 0) { A.sfx('block'); g.fx.sparks(cx, cy, 8, stone, 2.4, { gy: 0.15 }); g.fx.burst(cx, cy, 5, stone, { speed: 1.2, s0: 8 }); g.shake(1.5, 4); return true; }
    this.dead = true; A.sfx('break'); g.shake(3, 10); g.fx.burst(cx, cy, 16, stone, { speed: 2.2, s0: 14 }); g.fx.sparks(cx, cy, 14, stone, 3, { gy: 0.2 }); g.fx.souls(cx, cy, 4, COLORS.warm);
    dropItem(g, this.drop || 'coin', cx, cy);                                                           // the assigned treasure, then 1-2 more things from inside
    for (let i = 0, extra = this.maxHp === 3 ? 1 : (Math.random() < 0.4 ? 1 : 0); i < extra; i++) dropItem(g, Math.random() < 0.12 ? 'gem' : Math.random() < 0.3 ? 'it_' + randomItemId() : choice(['coin', 'coin', 'heart', 'mana', 'potion']), cx + rand(-9, 9), cy);
    return true;
  }
  // A statue has treasure inside, so it glows a little: a soft aura that slowly breathes (gold - or rose / blue when it holds a heart / mana), and now and then a twinkle drifts up off it.
  glowColor() { const d = this.drop || ''; return d === 'heart' ? [255, 130, 150] : d === 'mana' ? [130, 170, 255] : [255, 214, 120]; }
  update(g) {
    this.t++; if (this.shake > 0) this.shake--;
    breakSparkle(g, this.t, this.box, this.glowColor()); breakSparkle(g, this.t + 3, this.box, this.glowColor());          // (a statue holds treasure: twice the sparks)
  }
  draw(ctx, cx, cy) {
    const im = IMG.cemetery_statue, w = Math.round(im.width * STATUE_SC), h = Math.round(im.height * STATUE_SC), sx = this.shake ? Math.round(Math.sin(this.t * 2.4) * 1.5) : 0;
    ctx.drawImage(im, Math.round(this.x - cx - w / 2 + sx), Math.round(this.y - cy - h), w, h);
    if (this.hp < this.maxHp) {       // cracks, one more per hit taken
      ctx.save(); ctx.strokeStyle = 'rgba(12,8,22,0.85)'; ctx.lineWidth = 1; const x0 = Math.round(this.x - cx + sx), y0 = Math.round(this.y - cy - h);
      const lines = [[[-4, 0.30], [-1, 0.38], [-5, 0.5], [-2, 0.6]], [[5, 0.25], [2, 0.36], [6, 0.47], [3, 0.58]]];
      for (let k = 0; k < this.maxHp - this.hp; k++) { ctx.beginPath(); lines[k % 2].forEach(([dx, fy], i) => { const X = x0 + dx, Y = y0 + h * fy; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); }
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------------------------------------------ barrel / crate (Gothicvania Town art): one hit, one small treat
// Anything breakable gives off little drifting sparks in the colour of what is inside (real particles in the effects layer - no painted glow): big enough to be seen, and a few every second
function breakSparkle(g, t, b, rgb) {
  if (!g || t % 7 || Math.random() > 0.34 || b.x + b.w < g.camera.x - 20 || b.x > g.camera.x + 400) return;
  const k = rgb.map(v => v / 255);
  g.fx.emit({ x: b.x + rand(0, b.w), y: b.y + rand(b.h * 0.1, b.h * 0.95), vx: rand(-0.1, 0.1), vy: -rand(0.15, 0.42), life: rand(60, 110), s0: rand(7, 10.5), s1: 2, c0: k, c1: [1, 1, 0.92], a0: 1, a1: 0, kind: 6 });
  if (Math.random() < 0.5) g.fx.emit({ x: b.x + rand(0, b.w), y: b.y + rand(b.h * 0.3, b.h), vx: rand(-0.06, 0.06), vy: -rand(0.08, 0.25), life: rand(40, 80), s0: rand(4, 6), s1: 1.5, c0: [1, 1, 0.95], c1: k, a0: 1, a1: 0, kind: 6 });
}
export class Barrel {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.drop = o.drop; this.dead = false; this.t = 0; this.crate = Math.abs(Math.floor(x / 16)) % 3 === 0; this.broken = 0; }
  get box() { return this.crate ? { x: this.x - 11, y: this.y - 20, w: 22, h: 20 } : { x: this.x - 9, y: this.y - 24, w: 18, h: 24 }; }
  hit(g) {
    if (this.dead || this.broken) return false; this.broken = 1; const wood = [[0.62, 0.42, 0.22], [0.3, 0.18, 0.08]]; A.sfx('break'); g.shake(1, 4);
    g.fx.burst(this.x, this.y - 11, 10, wood, { speed: 1.7, s0: 8 }); g.fx.sparks(this.x, this.y - 11, 9, wood, 2.6, { gy: 0.22 }); if (Math.random() < 0.7) dropItem(g, this.drop || choice(['coin', 'coin', 'heart', 'mana', 'coin']), this.x, this.y - 12); return true;       // (three in ten are empty)
  }
  update(g) { this.t++; if (this.broken && ++this.broken > 80) this.dead = true; if (!this.broken) { const d = this.drop || ''; breakSparkle(g, this.t, this.box, d === 'heart' ? [255, 130, 150] : d === 'mana' ? [130, 170, 255] : [255, 214, 120]); } }
  draw(ctx, cx, cy) {
    const im = IMG[this.crate ? 'town_crate' : 'town_barrel'], sc = this.crate ? 0.6 : 0.82, w = Math.round(im.width * sc), h = Math.round(im.height * sc), X = Math.round(this.x - cx - w / 2), Y = Math.round(this.y - cy - h);
    if (!this.broken) { ctx.drawImage(im, X, Y, w, h); return; }
    ctx.save(); ctx.globalAlpha = this.broken > 50 ? Math.max(0, 1 - (this.broken - 50) / 30) : 1;                   // what is left: the bottom third of it, splintered
    const keep = Math.round(im.height * 0.34), kh = Math.round(h * 0.34); ctx.drawImage(im, 0, im.height - keep, im.width, keep, X, Y + h - kh, w, kh); ctx.restore();
  }
}

// ------------------------------------------------------------------------------------------------ SKULLS (a secret: six of them are hidden about the castle)
// A little skull - the head of the skeleton sprite - tucked into an out-of-the-way corner.  The sword breaks it, and nothing at all seems to happen... until the sixth: then a door that was shut opens somewhere (flag skulls_done).
export const SKULL_COUNT = 6;
export class Skull {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.id = o.id; this.dead = false; this.t = 0; this.broken = 0; }
  get box() { return { x: this.x - 8, y: this.y - 14, w: 16, h: 14 }; }
  hit(g) {
    if (this.dead || this.broken) return false; this.broken = 1; const bone = [[0.92, 0.88, 0.78], [0.5, 0.45, 0.4]]; A.sfx('bone'); g.shake(1, 3);
    g.fx.burst(this.x, this.y - 6, 8, bone, { speed: 1.4, s0: 6 }); g.fx.sparks(this.x, this.y - 6, 7, bone, 2.2, { gy: 0.22 });
    g.save.flags[this.id] = true; if (g.skullsBroken() >= SKULL_COUNT) g.skullsDone(); return true;
  }
  update(g) { this.t++; if (this.broken) { if (++this.broken > 50) this.dead = true; } else breakSparkle(g, this.t, this.box, [190, 215, 255]); }
  draw(ctx, cx, cy) {
    const s = SHEET.skeleton_walk; if (!s || !s.img) return; const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.save(); if (this.broken) ctx.globalAlpha = Math.max(0, 1 - this.broken / 40);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y - 1, 6, 2, 0, 0, Math.PI * 2); ctx.fill();          // its shadow on the floor
    ctx.drawImage(s.img, 2 * s.w + 13, 6, 12, 13, x - 6, y - 14 + (this.broken ? this.broken * 0.2 : 0), 12, 13); ctx.restore();          // (just the head: frame 3 of the walking skeleton)
  }
}

// ------------------------------------------------------------------------------------------------ THE THREE CANDLES (a secret: light them in the order a tablet gives)
// Three candles of different heights stand together.  Light them in the right order and a portcullis somewhere in the room rises (it works exactly like a lever's); light them wrongly and all three gutter out.
export class LitCandle {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.id = o.id; this.i = o.i; this.order = o.order || [0, 1, 2]; this.hh = [14, 22, 30][o.h || 0]; this.open = !!o.open; this.lit = !!o.open; this.dead = false; this.t = 0; }
  get box() { return { x: this.x - 8, y: this.y - this.hh - 10, w: 16, h: this.hh + 10 }; }
  interact(g) {
    if (this.lit) return false; const r = g.room, seq = r.candleSeq || (r.candleSeq = []), all = g.props.filter(p => p instanceof LitCandle && p.id === this.id);
    this.lit = true; seq.push(this.i); A.sfx('fire'); g.fx.ring(this.x, this.y - this.hh, 22, [1, 0.8, 0.45], 16, 0.2);
    if (seq[seq.length - 1] !== this.order[seq.length - 1]) { A.sfx('back'); for (const c of all) { c.lit = false; g.fx.smoke(c.x, c.y - c.hh - 4, 3); } r.candleSeq = []; g.popup(this.x, this.y - this.hh - 22, 'THE FLAMES GUTTER OUT', '#cfc2a0'); return true; }
    if (seq.length >= 3) { for (const c of all) c.open = true; r.candleSeq = []; g.pullLever({ id: this.id, x: this.x, y: this.y - this.hh }); }
    return true;
  }
  update(g) {
    this.t++; if (this.lit) { g.fx.fire(this.x, this.y - this.hh - 3, { scale: 0.45, n: 1, sparks: false }); g.fx.light(this.x, this.y - this.hh, 46, 0.55); }
    else if (this.t % 9 === 0) g.fx.emit({ x: this.x + rand(-6, 6), y: this.y - this.hh - rand(0, 10), vx: 0, vy: -rand(0.1, 0.4), life: 44, s0: 4.5, s1: 1, c0: [1, 0.86, 0.5], c1: [1, 1, 0.92], a0: 0.9, a1: 0, kind: 6 });
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), h = this.hh;
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 6, y - 3, 12, 3); ctx.fillStyle = '#6b5030'; ctx.fillRect(x - 5, y - 4, 10, 1);          // the dish it stands in
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 3, y - 4 - h, 6, h); ctx.fillStyle = '#b8a888'; ctx.fillRect(x + 1, y - 4 - h, 2, h); ctx.fillStyle = '#f6efd8'; ctx.fillRect(x - 3, y - 4 - h, 6, 1);          // the wax
    ctx.fillStyle = '#1a1208'; ctx.fillRect(x, y - 7 - h, 1, 3);          // its wick
  }
}

// ------------------------------------------------------------------------------------------------ THE BELL (a secret: the bell of the bell tower, still hanging)
// Ring it and it tolls over the burning city.  The first time, she comes to the sound - and gives him the page she wrote on the road home.
export class Bell {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.id = o.id || 'page5'; this.dead = false; this.t = 0; this.swing = 0; this.sw = 0; }
  get box() { return { x: this.x - 22, y: this.y - 54, w: 44, h: 54 }; }
  interact(g) {
    this.sw = 1; A.sfx('toll'); g.shake(1, 10); g.fx.ring(this.x, this.y - 30, 70, [0.9, 0.8, 0.5], 40, 0.1);
    if (!g.save.flags[this.id]) {
      g.save.flags[this.id] = true; markPage(5); g.after(150, () => {
        if (g.state !== 'play') return; g.ghost.reveal(420); A.sfx('ghost'); g.fx.ring(this.x, this.y - 20, 50, [0.55, 0.78, 1], 30, 0.1);
        g.showDialog(STORY.bell[0], { name: STORY.speaker, font: 'hand', onClose: () => g.showDialog(STORY.bell[1], { name: STORY.speaker, font: 'hand', onClose: () => { A.sfx('item'); A.sting('sting_item'); g.banner('A PAGE: ' + letterTitle(5), 'SHE WROTE IT ON THE ROAD HOME'); g.after(70, () => g.openLetter(5)); } }) });
      });
    }
    return true;
  }
  update(g) { this.t++; this.sw *= 0.985; this.swing = Math.sin(this.t * 0.22) * 0.32 * this.sw; if (!g.save.flags[this.id] && this.t % 12 === 0) g.fx.emit({ x: this.x + rand(-8, 8), y: this.y - rand(20, 44), vx: 0, vy: -rand(0.1, 0.4), life: 50, s0: 5, s1: 1, c0: [1, 0.85, 0.5], a0: 0.8, a1: 0, kind: 6 }); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#2a1c12'; ctx.fillRect(x - 22, y - 56, 4, 56); ctx.fillRect(x + 18, y - 56, 4, 56); ctx.fillStyle = '#3d2a1a'; ctx.fillRect(x - 24, y - 58, 48, 5); ctx.fillStyle = '#1a100a'; ctx.fillRect(x - 24, y - 53, 48, 1);          // the frame
    ctx.save(); ctx.translate(x, y - 53); ctx.rotate(this.swing);
    ctx.fillStyle = '#6b4a1e'; ctx.beginPath(); ctx.moveTo(-5, 1); ctx.lineTo(5, 1); ctx.lineTo(9, 10); ctx.quadraticCurveTo(14, 26, 17, 36); ctx.lineTo(-17, 36); ctx.quadraticCurveTo(-14, 26, -9, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a8742a'; ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(1, 2); ctx.lineTo(3, 11); ctx.quadraticCurveTo(7, 26, 9, 35); ctx.lineTo(-10, 35); ctx.quadraticCurveTo(-8, 26, -5, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a3010'; ctx.fillRect(-17, 34, 34, 3); ctx.fillStyle = '#d8a850'; ctx.fillRect(-14, 20, 28, 1); ctx.fillRect(-12, 25, 24, 1); ctx.fillStyle = '#2a1a08'; ctx.fillRect(-1, 37, 2, 5);          // the bell, its bands and clapper
    ctx.restore();
  }
}

// ------------------------------------------------------------------------------------------------ save altar
export class Altar {
  constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.used = 0; this.dead = false; }
  get box() { return { x: this.x - 24, y: this.y - 40, w: 48, h: 40 }; }
  update(g) {
    this.t++;
    if (this.t === 1) this.circle = g.fx.quad({ kind: 'circle', x: this.x, y: this.y - 1, w: 88, h: 34, color: [0.7, 0.45, 1], life: 1, hold: true, spin: 0.01, p: [0, 12], a0: 0.55, a1: 0.55, pulse: 3, order: 1 });
    for (const [ox, oy, s] of [[-8.5, -23, 0.8], [8.5, -23, 0.8], [-0.5, -26, 1]]) g.fx.flame(this.x + ox, this.y + oy, { scale: s, seed: ox, color: 'purple', sparks: false });
    g.fx.light(this.x, this.y - 20, 80, 0.9, [0.72, 0.5, 1]);
    if (this.t % 6 === 0) g.fx.emit({ x: this.x + rand(-14, 14), y: this.y - 4, vx: 0, vy: -rand(0.3, 0.9), life: rand(50, 90), s0: 6, s1: 1, c0: [0.8, 0.6, 1], c1: [0.4, 0.3, 1], a0: 0.9, a1: 0, kind: 6 });
    if (this.used > 0) this.used--;
  }
  interact(g) {
    const p = g.player, S = g.save; S.hp = S.maxHp; S.mp = S.maxMp; this.used = 60; A.sfx('save');
    g.fx.ring(this.x, this.y - 20, 56, [0.8, 0.6, 1], 40, 0.14); g.fx.quad({ kind: 'beam', x: this.x, y: this.y - 80, w: 36, h: 190, color: [0.8, 0.6, 1], life: 50, a0: 1, a1: 0 });
    g.fx.souls(this.x, this.y - 10, 18, COLORS.purple); g.fx.flash([0.7, 0.5, 1], 0.2);
    S.room = g.room.id; S.spawnX = this.x; S.spawnY = this.y; g.saveGame(); g.banner('GAME SAVED', 'HEALTH AND MANA RESTORED'); return true;
  }
  draw(ctx, cx, cy) { drawSheet(ctx, 'altar', 0, this.x - cx, this.y - cy); }
}

// ------------------------------------------------------------------------------------------------ waystone (teleport)
// Every zone opens with a waystone chamber.  Walking up to the stone attunes it (once); pressing UP then opens the map, where any attuned waystone can be chosen.
export class Waystone {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.id = o.id; this.t = 0; this.dead = false; this.flare = 0; }
  get box() { return { x: this.x - 24, y: this.y - 48, w: 48, h: 48 }; }
  get lit() { return !!this.g.save.flags[this.id]; }
  attune(g) {
    g.save.flags[this.id] = true; this.flare = 90; A.sfx('ability'); g.fx.flash([0.45, 0.85, 1], 0.35); g.fx.ring(this.x, this.y - 24, 70, [0.45, 0.85, 1], 40, 0.12); g.fx.souls(this.x, this.y - 10, 16, COLORS.blue);
    g.fx.quad({ kind: 'beam', x: this.x, y: this.y - 90, w: 30, h: 200, color: [0.45, 0.85, 1], life: 60, a0: 1, a1: 0 }); g.banner('WAYSTONE ATTUNED', 'TRAVEL TO IT FROM ANY OTHER WAYSTONE', 230, { y: 60, color: '#9fe8ff' });
  }
  update(g) {
    this.g = g; this.t++; const p = g.player, lit = this.lit;
    if (this.t === 1) this.circle = g.fx.quad({ kind: 'circle', x: this.x, y: this.y - 1, w: 96, h: 36, color: [0.4, 0.85, 1], life: 1, hold: true, spin: 0.012, p: [0, 12], a0: 0.2, a1: 0.2, pulse: 3, order: 1 });
    if (this.circle) { const a = lit ? 0.6 + (this.flare > 0 ? 0.4 : 0) : 0.16; this.circle.a0 = this.circle.a1 = a; }
    if (this.flare > 0) this.flare--;
    if (lit) { g.fx.glow(this.x, this.y - 30, 34 + Math.sin(this.t * 0.07) * 4, [0.4, 0.85, 1], 0.4); g.fx.light(this.x, this.y - 30, 110, 0.9, [0.4, 0.85, 1]); if (this.t % 7 === 0) g.fx.emit({ x: this.x + rand(-12, 12), y: this.y - 4, vx: 0, vy: -rand(0.4, 1.0), life: rand(40, 80), s0: 5, s1: 1, c0: [0.5, 0.9, 1], c1: [0.2, 0.5, 1], a0: 0.9, a1: 0, kind: 6 }); }
    else if (this.t % 20 === 0) g.fx.emit({ x: this.x + rand(-6, 6), y: this.y - 34, vx: 0, vy: -rand(0.1, 0.3), life: 40, s0: 4, s1: 1, c0: [0.5, 0.7, 1], a0: 0.6, a1: 0, kind: 6 });
    if (!lit && !p.dead && Math.abs(p.x - this.x) < 44 && Math.abs(p.y - this.y) < 30) this.attune(g);
  }
  interact(g) { this.g = g; if (!this.lit) this.attune(g); g.openMap({ teleport: g.room.id }); return true; }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), lit = this.g ? this.lit : false, pulse = 0.55 + 0.45 * Math.sin(this.t * 0.08);
    ctx.fillStyle = '#1c1828'; ctx.fillRect(x - 16, y - 4, 32, 4); ctx.fillStyle = '#2c2840'; ctx.fillRect(x - 12, y - 8, 24, 4); ctx.fillStyle = '#3a3552'; ctx.fillRect(x - 12, y - 8, 24, 1);
    ctx.fillStyle = '#3a3652'; ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x - 6, y - 40); ctx.lineTo(x, y - 48); ctx.lineTo(x + 6, y - 40); ctx.lineTo(x + 8, y - 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#26223a'; ctx.beginPath(); ctx.moveTo(x + 1, y - 8); ctx.lineTo(x + 1, y - 46); ctx.lineTo(x + 6, y - 40); ctx.lineTo(x + 8, y - 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4e4870'; ctx.fillRect(x - 6, y - 40, 1, 31);
    ctx.save(); ctx.globalAlpha = lit ? 0.55 + 0.45 * pulse : 0.28; ctx.fillStyle = lit ? '#8fe8ff' : '#4a6a8a';           // the rune: a diamond over a stem, glowing once attuned
    ctx.fillRect(x - 1, y - 34, 2, 16); ctx.fillRect(x - 3, y - 30, 6, 2); ctx.fillRect(x - 2, y - 38, 4, 2); ctx.fillRect(x - 1, y - 40, 2, 1); ctx.fillRect(x - 4, y - 20, 8, 1); ctx.restore();
  }
}

// ------------------------------------------------------------------------------------------------ lore tablet
export class Tablet {
  constructor(x, y, o) { this.x = x; this.y = y; this.text = (o.sign && dtext('sign ' + o.sign)) || STORY.tablets[o.id] || o.text; this.id = o.id; this.sign = /^sign_/.test(o.id || ''); this.narr = !!o.narr; this.convo = STORY.convos && STORY.convos[o.id] || null; this.t = 0; this.dead = false; }          // (a signpost is a sign; every gravestone and tablet is her: see story.js)
  get box() { return this.narr ? { x: this.x - 20, y: this.y - 30, w: 40, h: 30 } : { x: this.x - 12, y: this.y - 26, w: 24, h: 26 }; }          // (a narr stone is only a place to read: the picture is the grave scenery already there, and the words are the game speaking, not her)
  update(g) { this.t++; if (!this.sign && !this.narr) { const unread = !g.save.flags['read_' + this.id]; g.fx.glow(this.x, this.y - 13, 22 + 2 * Math.sin(this.t * 0.05), [0.6, 0.8, 1], (unread ? 0.3 : 0.14) + 0.04 * Math.sin(this.t * 0.04)); }          // (her stones glow faintly, softly: that is what tells them from the headstones that are only scenery, and from signs)
    if (this.t % 10 === 0 && !g.save.flags['read_' + this.id]) g.fx.emit({ x: this.x + rand(-5, 5), y: this.y - 18, vx: 0, vy: -rand(0.2, 0.5), life: 40, s0: 5, s1: 1, c0: [0.7, 0.85, 1], a0: 0.8, a1: 0, kind: 6 }); }
  interact(g) { g.save.flags['read_' + this.id] = true; if (this.convo) { if (g.save.flags.got_lantern) g.player.lanFlare = 260; else g.ghost.reveal(900); const c = this.convo, run = i => { if (i >= c.length) return; const her = c[i][0] === 'H'; g.showDialog(c[i][1], her ? { name: STORY.speaker, font: 'hand', onClose: () => run(i + 1) } : { name: c[i][0], onClose: () => run(i + 1) }); }; run(0); A.sfx('select'); return true; }          // (a talking gravestone: two voices)
    if (this.narr) { g.showDialog(this.text, { font: 'mixed' }); A.sfx('select'); return true; } if (!this.sign) { if (g.save.flags.got_lantern) g.player.lanFlare = 260; else g.ghost.reveal(280); } g.showDialog(this.text, this.sign ? {} : { name: STORY.speaker, font: 'hand' });          A.sfx('select'); return true; }          // (her words are in her own handwriting)
  draw(ctx, cx, cy) {
    if (this.narr) return;
    const x = this.x - cx, y = this.y - cy;
    if (this.sign && IMG.signpost) { const im = IMG.signpost; ctx.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height + 1)); return; }          // (a signpost is a wooden post and board - FreeGameSprites, CC0 - never a stone; her words are on the headstones below)
    if (this.sign || !IMG.gy_stone) { drawSheet(ctx, 'tablet', 0, x, y); return; }          // (her stones are the Graveyard pack's headstone, with flowers at its foot)
    const st = IMG.gy_stone, fl = ['gy_lily', 'gy_rose', 'gy_daisy', 'gy_posy'], h = [...String(this.id)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const put = (name, dx, up) => { const im = IMG[name]; if (im) ctx.drawImage(im, Math.round(x + dx - im.width / 2), Math.round(y - im.height + up)); };
    put(fl[h % 4], -11 - (h >> 3) % 3, 1); put(fl[(h >> 4) % 4], 11 + (h >> 6) % 3, 1);
    ctx.drawImage(st, Math.round(x - st.width / 2), Math.round(y - st.height + 1));
    put(fl[(h >> 9) % 4], -5 + (h >> 11) % 9, 0);
  }
}

// ------------------------------------------------------------------------------------------------ chest
// what comes out of a chest: a floating upgrade, or (when the contents are named e_fire, e_ice, e_sun) a gem of that blade that lies there until it is taken
export function chestGift(g, x, y, contents, id) {
  if (String(contents).startsWith('e_')) { const pk = new Pickup(contents, x, y, 0, -1); pk.life = 1e9; g.pickups.push(pk); g.save.flags[id] = true; } else g.props.push(new Upgrade(x, y, { kind: contents, id }));
}
export class Chest {
  constructor(x, y, o) { this.x = x; this.y = y; this.contents = o.contents; this.id = o.id; this.open = false; this.t = 0; this.dead = false; }
  get box() { return { x: this.x - 11, y: this.y - 16, w: 22, h: 16 }; }
  update(g) { this.t++; if (!this.open && this.t % 14 === 0) g.fx.emit({ x: this.x + rand(-8, 8), y: this.y - 14, vx: 0, vy: -rand(0.2, 0.5), life: 36, s0: 5, s1: 1, c0: [1, 0.9, 0.5], a0: 0.9, a1: 0, kind: 6 }); }
  interact(g) {
    if (this.open) return false; this.open = true; g.save.flags[this.id] = true; A.sfx('door'); g.fx.burst(this.x, this.y - 12, 14, COLORS.gold, { speed: 2 }); g.fx.flash([1, 0.9, 0.5], 0.15);
    chestGift(g, this.x, this.y - 22, this.contents, this.id + '_u'); return true;
  }
  draw(ctx, cx, cy) { drawSheet(ctx, 'chest', this.open ? 1 : 0, this.x - cx, this.y - cy); }
}

// ------------------------------------------------------------------------------------------------ lever
// A great iron lever set in a plate in the floor.  UP throws it over (once, for good: the flag o.id is kept in the save), and the gate it works - a portcullis somewhere else in the room - rises (Game.pullLever).
// Until it is thrown its knob glows red and it sends up a spark now and then, so it is seen; afterwards it stands over, with a dull green knob.
const LEVER_S = 0.7;
export class Lever {
  constructor(x, y, o = {}) { this.x = x; this.y = y; this.id = o.id; this.open = !!o.open; this.k = this.open ? 1 : -1; this.t = 0; this.dead = false; }          // (k: where the handle is, -1 (back) .. 1 (over); `open` is what Game.nearInteractable reads to leave a thrown lever alone)
  get box() { return { x: this.x - 16, y: this.y - 28, w: 32, h: 28 }; }
  update(g) {
    this.t++; const to = this.open ? 1 : -1; this.k += Math.max(-0.09, Math.min(0.09, to - this.k));
    if (!this.open) {          // sparkles drift up from it, like those of the walls that can be broken: this is something to use
      g.fx.glow(this.x, this.y - 12, 16 + Math.sin(this.t * 0.08) * 2, [1, 0.85, 0.6], 0.16 + 0.06 * Math.sin(this.t * 0.06));
      if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-11, 11), y: this.y - rand(2, 20), vx: rand(-0.1, 0.1), vy: -rand(0.12, 0.38), life: rand(55, 100), s0: rand(6.5, 10), s1: 2, c0: [1, 0.86, 0.5], c1: [1, 1, 0.92], a0: 1, a1: 0, kind: 6 });
    }
  }
  interact(g) { if (this.open) return false; this.open = true; g.pullLever(this); return true; }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), ang = this.k * 0.8;          // the handle swings from leaning back (-0.8 rad) to leaning forward (+0.8)
    ctx.save(); ctx.translate(x, y); ctx.scale(LEVER_S, LEVER_S);          // (drawn at its own size, then scaled: LEVER_S)
    ctx.fillStyle = '#17151c'; ctx.fillRect(-15, -3, 30, 3); ctx.fillStyle = '#34323e'; ctx.fillRect(-14, -6, 28, 3); ctx.fillStyle = '#5a5870'; ctx.fillRect(-14, -6, 28, 1);          // the floor plate
    ctx.fillStyle = '#8a8aa0'; for (const bx of [-11, 10]) ctx.fillRect(bx, -5, 2, 2);                                                                                                  // its bolts
    ctx.fillStyle = '#0d0c11'; ctx.fillRect(-8, -11, 16, 6); ctx.fillStyle = '#2a2833'; ctx.fillRect(-7, -10, 14, 4); ctx.fillStyle = '#48465a'; ctx.fillRect(-7, -10, 14, 1);          // the housing the handle comes out of
    ctx.save(); ctx.translate(0, -9); ctx.rotate(ang);
    ctx.fillStyle = '#0d0c11'; ctx.fillRect(-2.5, -21, 5, 22); ctx.fillStyle = '#b4b4c6'; ctx.fillRect(-1.5, -20, 3, 20); ctx.fillStyle = '#e4e4f0'; ctx.fillRect(-1.5, -20, 1, 20); ctx.fillStyle = '#6c6c80'; ctx.fillRect(1, -20, 1, 20);          // the iron shaft
    ctx.fillStyle = '#0d0c11'; ctx.fillRect(-4.5, -25, 9, 5); ctx.fillStyle = '#8a8aa0'; ctx.fillRect(-3.5, -24, 7, 3); ctx.fillStyle = '#d4d4e4'; ctx.fillRect(-3.5, -24, 7, 1);          // a plain iron grip across the end of the shaft
    ctx.restore();
    ctx.fillStyle = this.open ? '#5fae6e' : '#d8463c'; ctx.fillRect(4, -9, 2, 2);          // a tiny lamp on the housing: red until the lever is thrown, then green
    ctx.fillStyle = '#c8a24a'; ctx.beginPath(); ctx.arc(0, -9, 2.4, 0, 6.3); ctx.fill(); ctx.fillStyle = '#6a4e18'; ctx.beginPath(); ctx.arc(0, -9, 1, 0, 6.3); ctx.fill();          // the pivot pin
    ctx.restore();
  }
}

// ------------------------------------------------------------------------------------------------ permanent upgrade (floating item)
export class Upgrade {
  constructor(x, y, o) { this.x = x; this.y = y; this.kind = o.kind; this.id = o.id; this.n = o.n; this.t = 0; this.dead = false; this.U = o.kind === 'page' ? pageUpgrade(o.n) : o.kind === 'key' ? keyUpgrade(o.id) : o.kind === 'letter' ? letterUpgrade(o.id) : UPGRADES[o.kind]; }
  get box() { return { x: this.x - 8, y: this.y - 16, w: 16, h: 16 }; }
  update(g) {
    this.t++; const bob = Math.sin(this.t * 0.07) * 2, p = g.player; this.by = bob;
    const isKey = this.U.icon === 'key';          // (a key's glow is kept soft so the colour of the key itself - the colour of its lock - still reads)
    g.fx.glow(this.x, this.y - 8 + bob, isKey ? 20 : 26, this.U.color, isKey ? 0.22 : 0.5); g.fx.light(this.x, this.y - 8, 50, isKey ? 0.45 : 0.7);
    if (this.t % 5 === 0) g.fx.emit({ x: this.x + rand(-9, 9), y: this.y - 8 + rand(-6, 6), vx: 0, vy: -rand(0.1, 0.5), life: 36, s0: 5, s1: 1, c0: this.U.color, a0: 0.9, a1: 0, kind: 6 });
    if (this.id && this.id.startsWith('bu_') && this.t > 150 && !p.dead) { const dx = p.x - this.x, dy = p.y - 16 - (this.y - 8), dd = Math.hypot(dx, dy) || 1, sp = Math.min(dd, 1.6); this.x += dx / dd * sp; this.y += dy / dd * sp; }          // (a boss's gift drifts to the hero if left lying: it can never be walked past - the dark rooms ahead need the lantern)
    if (!p.dead && dist(p.x, p.y - 16, this.x, this.y - 8) < 14) this.collect(g);
  }
  collect(g) {
    this.dead = true; const S = g.save, hadLantern = !!S.flags.got_lantern; g.save.flags[this.id] = true;
    if (this.kind === 'hpup') { S.maxHp += 20; S.hp = S.maxHp; } else if (this.kind === 'mpup') { S.maxMp += 10; S.mp = S.maxMp; } else if (this.kind === 'atkup') S.atk += 2; else if (this.kind === 'tide') S.flags.got_tide = true; else if (this.kind === 'mantle') S.flags.got_mantle = true; else if (this.kind === 'lantern') S.flags.got_lantern = true; else if (this.kind === 'shard') S.flags.got_shard = true; else if (this.kind === 'spring') S.flags.got_spring = true; else if (this.kind === 'astrolabe') S.flags.got_astrolabe = true; else if (this.kind === 'goldkey') S.flags.has_key_gold = true; else if (this.kind === 'frostkey') S.flags.has_key_frost = true; else if (this.kind === 'hoard') { S.gold += 400; g.popup(this.x, this.y - 30, '+400 GOLD', '#ffd860'); } else if (this.kind === 'crampons') S.flags.got_crampons = true; else if (this.kind === 'key') S.flags['has_' + keyBase(this.id)] = true;
    A.sfx('item'); A.sting('sting_item'); g.fx.ring(this.x, this.y - 8, 44, this.U.color, 30); g.fx.flash(this.U.color, 0.3); g.fx.sparks(this.x, this.y - 8, 18, [[1, 1, 0.8], this.U.color], 3);
    g.banner(this.U.name, this.kind === 'tide' && !S.abilities.dash ? 'ITS POWER WAKES ONCE YOU CAN DASH' : this.U.desc);
    if (this.kind === 'page') g.foundPage(this.n);
    if (this.kind === 'lantern' && !hadLantern) g.lanternScene();          // (only the first time: a hero given the lantern by a secret code has no scene to see)
  }
  draw(ctx, cx, cy) {
    if (this.kind === 'shoes') drawSheet(ctx, 'pedestal', 0, this.x - cx, this.y + 12 - cy);          // (the shoes stand on a little pedestal of their own)
    if (this.U.icon === 'key') { drawKey(ctx, this.U.color.map(v => Math.round(v * 255)), this.x - cx, this.y - 8 - cy + (this.by || 0), 1.4); return; }          // (a key wears the colour of its lock)
    drawSheet(ctx, 'icons', iconFrame(this.U.icon), this.x - cx, this.y - 8 - cy + (this.by || 0), { ay: 0.5, scale: 1.4 });
  }
}

// ------------------------------------------------------------------------------------------------ ability relic dropped by bosses
export class Relic {
  constructor(x, y, kind) { this.x = x; this.y = y; this.kind = kind; this.A = ABILITIES[kind]; this.t = 0; this.dead = false; this.ray = null; }
  get box() { return { x: this.x - 8, y: this.y - 16, w: 16, h: 16 }; }
  update(g) {
    this.t++; const p = g.player, bob = Math.sin(this.t * 0.06) * 3; this.by = bob; const col = this.A.color;
    if (!this.ray) this.ray = g.fx.quad({ kind: 'rays', x: this.x, y: this.y - 14, w: 120, h: 120, color: col, life: 1, hold: true, spin: 0.01, p: [0, 8], a0: 0.5, a1: 0.5, order: 2 });
    this.ray.x = this.x; this.ray.y = this.y - 14 + bob; g.fx.glow(this.x, this.y - 14 + bob, 40, col, 0.6); g.fx.light(this.x, this.y - 14, 90, 1);
    if (this.t % 4 === 0) g.fx.emit({ x: this.x + rand(-12, 12), y: this.y - 14 + rand(-12, 12), vx: 0, vy: -rand(0.2, 0.7), life: 50, s0: 6, s1: 1, c0: col, a0: 1, a1: 0, kind: 6 });
    if (!p.dead && dist(p.x, p.y - 16, this.x, this.y - 14) < 16) { this.dead = true; if (this.ray) this.ray.kill = true; g.gainAbility(this.kind, this.x, this.y - 14); }
  }
  draw(ctx, cx, cy) { drawSheet(ctx, 'pedestal', 0, this.x - cx, this.y - cy); drawSheet(ctx, 'icons', iconFrame(this.A.icon), this.x - cx, this.y - 24 - cy + (this.by || 0), { ay: 0.5, scale: 1.8 }); }
}
