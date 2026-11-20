// THE KEEPER: a hooded figure in a dark little room off a corridor in the later zones.  It sells what the dead no longer need - for the gold the hero has gathered: a blade steeped in fire, frost or sun,
// healing and mana, throwing weapons, and a few things that make the hero lastingly stronger (each of those only once per stall).
// Shopkeeper  - the prop you speak to (UP);  ShopScreen - the menu that opens (game.state 'shop').
import { drawText, wrapText, hasFace } from './font.js';
import { Input } from './input.js';
import { Audio_ as A } from './audio.js';
import { W, H, clamp, rand } from './util.js';
import { ITEMS, ITEM_ORDER, addItem } from './itemdata.js';
import { ENCH } from './enchant.js';
import { drawSheet } from './assets.js';
import { panel } from './ui.js';
import { markPage } from './letters.js';

const GOLD = '#e8b84a', PALE = '#e8dcc0', DIM = '#8a7f9a', VIOLET = '#c8a0ff';
const GREET = ['COME CLOSER. EVERYTHING HERE HAS A PRICE. MOST OF IT IS PAID IN GOLD.', 'THE DEAD HAVE NO USE FOR THESE. YOU, I THINK, DO.', 'I WAS HERE BEFORE THE KEEP. I WILL BE HERE WHEN THE LAST CANDLE GOES OUT.', 'DO NOT LOOK FOR MY FACE. LOOK AT MY WARES.', 'GOLD IS ALL THE CASTLE LEAVES BEHIND. SPEND IT WELL.'];
const THANKS = ['A FAIR TRADE.', 'YES. THAT WILL SERVE YOU... FOR A WHILE.', 'THE GOLD IS COLD. HOW PLEASANT.', 'WE BOTH GO AWAY SATISFIED.'];
import * as D from './dialogue.js';
const kl = (k, d) => D.lines('keeper ' + k) || d, pickOf = a => a[Math.floor(Math.random() * a.length)];          // (the Keeper's words are read from assets/dialogue.txt; the lists here are only what he says if a section is missing)
const POOR = ['YOUR POCKETS ARE AS EMPTY AS THIS CASTLE.', 'COME BACK WITH MORE. I AM PATIENT.', 'I TAKE GOLD. ONLY GOLD. NOT PROMISES.'];
const PRICE_CUT = 0.8;          // every Keeper's prices are this fraction of the list below (a fifth off), taken after the zone's mark-up and rounded to the nearest 5 gold

// THE KEEPER'S POSES (the cloaked vendor of CraftPix's "Free City Trader" set: see CREDITS.md).  He idles; now and then he waves, or folds his arms; when he speaks he opens his cloak on what he sells
// (the 'talk' strip: frames 0-11 open it, 12-15 close it again), and when he has been paid he nods with it open.  A sequence is a list of [sheet, frame], one every POSE_TICKS ticks.
const rng = (sheet, a, b) => Array.from({ length: b - a + 1 }, (_, i) => [sheet, a + i]);
const SEQ_GREET = rng('trader_talk', 0, 15), SEQ_THANKS = [...rng('trader_talk', 0, 11), ...rng('trader_nod', 0, 7), ...rng('trader_talk', 12, 15)], SEQ_IDLE = [rng('trader_wave', 0, 10), rng('trader_arms', 0, 6)];
const POSE_TICKS = 7;
class Pose {
  constructor() { this.seq = null; this.i = 0; this.k = 0; this.t = Math.floor(Math.random() * 72); this.rest = 240 + Math.floor(Math.random() * 240); }
  play(seq) { this.seq = seq; this.i = this.k = 0; }
  update() {
    this.t++;
    if (this.seq) { if (++this.k >= POSE_TICKS) { this.k = 0; if (++this.i >= this.seq.length) this.seq = null; } return; }
    if (--this.rest <= 0) { this.rest = 420 + Math.floor(Math.random() * 420); this.play(SEQ_IDLE[Math.random() < 0.55 ? 0 : 1]); }
  }
  get cell() { return this.seq ? this.seq[this.i] : ['trader_idle', Math.floor(this.t / 12) % 6]; }
}

export class Shopkeeper {
  constructor(x, y, o) { this.x = x; this.y = y; this.id = o.id; this.tier = o.tier || 0; this.t = 0; this.dead = false; this.dir = -1; this.pose = new Pose(); this.greeted = false; }
  get box() { return { x: this.x - 26, y: this.y - 50, w: 52, h: 50 }; }
  update(g) {
    this.t++; this.dir = g.player.x >= this.x ? 1 : -1; this.pose.update();
    if (!this.greeted && Math.abs(g.player.x - this.x) < 130) { this.greeted = true; this.pose.play(SEQ_GREET); }          // (as the hero comes near he opens his cloak on his wares, once)
    g.fx.light(this.x, this.y - 30, 100, 0.7, [0.7, 0.4, 1]); g.fx.glow(this.x + this.dir * 4, this.y - 36, 9 + Math.sin(this.t * 0.07) * 2, [1, 0.35, 0.9], 0.5);
    if (this.t % 12 === 0) g.fx.emit({ x: this.x + rand(-14, 14), y: this.y - rand(4, 20), vx: 0, vy: -rand(0.2, 0.6), life: 60, s0: 6, s1: 1, c0: [0.7, 0.45, 1], c1: [0.3, 0.15, 0.6], a0: 0.7, a1: 0, kind: 6 });
  }
  interact(g) { g.openShop(this); return true; }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const [sheet, fr] = this.pose.cell; drawSheet(ctx, sheet, fr, x, y + 1, { ay: 1, dir: this.dir });
    ctx.fillStyle = '#1a0f26'; ctx.fillRect(x - 24, y - 12, 48, 12); ctx.fillStyle = '#3a2250'; ctx.fillRect(x - 24, y - 12, 48, 2); ctx.fillStyle = '#0a0612'; ctx.fillRect(x - 24, y - 1, 48, 1);          // the counter
    for (const [dx, c] of [[-16, '#c8a0ff'], [-6, '#ffd860'], [6, '#7fd8ff'], [16, '#ff8a9a']]) { ctx.fillStyle = '#0a0612'; ctx.fillRect(x + dx - 2, y - 17, 5, 5); ctx.fillStyle = c; ctx.fillRect(x + dx - 1, y - 16, 3, 3); }          // wares on it
  }
}

export class ShopScreen {
  constructor(g, keeper) {
    this.g = g; this.keeper = keeper; this.t = 0; this.sel = 0; this.top = 0; this.hit = []; this.say = pickOf(kl('greet', GREET)); this.sayT = 0;
    this.pose = new Pose(); this.pose.play(SEQ_GREET);          // (he opens his cloak on his wares as he greets you)
    this.stock = this.build();
  }
  flag(key) { return 'shop_' + this.keeper.id + '_' + key; }
  build() {
    const g = this.g, S = g.save, p = g.player, k = 1 + 0.12 * (this.keeper.tier || 0), pr = n => Math.round(n * k * PRICE_CUT / 5) * 5, out = [];
    const ench = (type, price, blurb) => ({ name: ENCH[type].title, tag: 'BLADE', price: pr(price), desc: blurb, can: () => '', buy: () => p.setEnchant(type) });
    out.push(ench('fire', 150, 'YOUR SWORD BURNS: MORE DAMAGE, AND A SMALL FIREBALL WITH EVERY SLASH. LASTS ONE MINUTE; BUY AGAIN TO ADD ANOTHER, UP TO TWO.'));
    out.push(ench('ice', 170, 'HITS CAN FREEZE FOES SOLID, AND FROZEN THINGS TAKE MORE DAMAGE. LASTS ONE MINUTE; BUY AGAIN TO ADD ANOTHER, UP TO TWO.'));
    out.push(ench('sun', 260, 'GREATLY INCREASED DAMAGE, AND HOLY LIGHT. LASTS ONE MINUTE; BUY AGAIN TO ADD ANOTHER, UP TO TWO.'));
    out.push({ name: 'ELIXIR VITAE', tag: 'HEAL', price: pr(90), desc: 'MAKES YOU WHOLE: ALL YOUR LIFE RETURNS.', can: () => (S.hp >= S.maxHp ? 'HP FULL' : ''), buy: () => { S.hp = S.maxHp; g.fx.ring(p.x, p.y - 16, 24, [0.5, 1, 0.6], 18); } });
    out.push({ name: 'QUINTESSENCE', tag: 'MANA', price: pr(70), desc: 'ALL YOUR MANA RETURNS AT ONCE.', can: () => (S.mp >= S.maxMp ? 'MP FULL' : ''), buy: () => { S.mp = S.maxMp; g.fx.ring(p.x, p.y - 16, 24, [0.4, 0.7, 1], 18); } });
    for (const id of ITEM_ORDER) { const it = ITEMS[id]; out.push({ name: it.name + (it.pack > 1 ? ' x' + it.pack : ''), tag: 'HAVE ' + ((S.items && S.items[id]) || 0) + '/' + it.max, price: pr(it.price), desc: it.desc, can: () => (((S.items && S.items[id]) || 0) >= it.max ? 'FULL' : ''), buy: () => addItem(S, id, it.pack) }); }
    const once = (key, name, price, desc, fn) => out.push({ name, tag: 'ONCE', price: pr(price), desc, can: () => (S.flags[this.flag(key)] ? 'SOLD' : ''), buy: () => { S.flags[this.flag(key)] = true; fn(); g.fx.flash([0.8, 0.6, 1], 0.25); g.fx.ring(p.x, p.y - 16, 40, [0.8, 0.6, 1], 24); } });
    once('hp', 'VITA: +20 MAX LIFE', 1400, 'YOUR LIFE GROWS BY TWENTY, AND IS MADE WHOLE. THIS STALL OFFERS IT ONLY ONCE.', () => { S.maxHp += 20; S.hp = S.maxHp; });
    once('mp', 'VIS: +10 MAX MANA', 1100, 'YOUR MANA GROWS BY TEN, AND IS MADE WHOLE. THIS STALL OFFERS IT ONLY ONCE.', () => { S.maxMp += 10; S.mp = S.maxMp; });
    once('atk', 'WHETSTONE: +2 SWORD POWER', 1600, 'YOUR SWORD HITS A LITTLE HARDER, FOR GOOD. THIS STALL OFFERS IT ONLY ONCE.', () => { S.atk += 2; });
    if (!S.flags.page1) out.push({ name: 'A FOLDED PAGE', tag: 'LETTER', price: pr(350), desc: 'I DO NOT READ THE LETTERS OF OTHERS. THIS ONE WAS LEFT WITH ME BY A MAN WHO NEVER CAME BACK FOR THE CHANGE. IT IS YOURS, FOR A PRICE. THIS STALL OFFERS IT ONLY ONCE.', can: () => '', buy: () => { S.flags.page1 = true; markPage(1); g.fx.flash([0.9, 0.85, 0.6], 0.2); } });          // the first letter of the story: sold by the Keeper (not opened and not announced: it is read from LETTERS in the pause menu)
    return out;
  }
  close() { this.g.state = 'play'; A.sfx('back'); }
  buy() {
    const g = this.g, S = g.save, e = this.stock[this.sel], why = e.can();
    if (why) { A.sfx('back'); this.speak(why === 'SOLD' ? 'THAT, I HAVE ALREADY SOLD YOU.' : 'YOU HAVE ALL YOU CAN CARRY OF THAT.'); return; }
    if (S.gold < e.price) { A.sfx('back'); this.speak(pickOf(kl('poor', POOR))); return; }
    S.gold -= e.price; e.buy(); A.sfx('coin'); A.sfx('item'); this.speak(pickOf(kl('thanks', THANKS))); this.pose.play(SEQ_THANKS); this.stock = this.build();
    this.sel = Math.min(this.sel, this.stock.length - 1);          // (a ware that is gone once bought - the folded page - leaves the list a row shorter: the cursor must not be left below its end, or the next frame draws a ware that is not there and the screen freezes)
  }
  speak(s) { this.say = s; this.sayT = 0; }
  update() {
    this.t++; this.sayT++; this.pose.update(); const n = this.stock.length;
    for (const tp of Input.taps || []) {
      if (tp.x < 112 || tp.x > W - 6 || tp.y < 8 || tp.y > H - 6) { this.close(); return; }
      for (let k = 0; k < this.hit.length; k++) { const r = this.hit[k]; if (r && tp.x >= r.x0 && tp.x <= r.x1 && tp.y >= r.y0 && tp.y <= r.y1) { if (this.sel === r.i) this.buy(); else { this.sel = r.i; A.sfx('click'); } return; } }
    }
    if (Input.pressed.up) { this.sel = (this.sel + n - 1) % n; A.sfx('click'); } if (Input.pressed.down) { this.sel = (this.sel + 1) % n; A.sfx('click'); }
    if (Input.pressed.confirm) this.buy();
    if (Input.pressed.back || Input.pressed.esc || Input.pressed.pkey) this.close();
    const rows = 8; this.top = clamp(this.sel - 3, 0, Math.max(0, n - rows));
  }
  draw(ctx) {
    const S = this.g.save, rows = 8, n = this.stock.length;
    ctx.fillStyle = 'rgba(6,2,12,0.9)'; ctx.fillRect(0, 0, W, H);
    // the Keeper, large, at the left, with what it says beneath
    const kx = 54, ky = 142; const gl = ctx.createRadialGradient(kx, ky - 40, 4, kx, ky - 40, 70); gl.addColorStop(0, 'rgba(150,80,220,0.35)'); gl.addColorStop(1, 'rgba(60,20,110,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 40, 112, 130);
    const [ksheet, kfr] = this.pose.cell; drawSheet(ctx, ksheet, kfr, kx, ky, { ay: 1, scale: 2, dir: 1 });
    const words = this.say.slice(0, Math.floor(this.sayT / 1.2)), sf = hasFace('npc') ? 'npc' : 'mixed'; wrapText(words, 100, 1, sf).forEach((ln, i) => drawText(ctx, ln, 8, 148 + i * 10, { color: VIOLET, font: sf }));
    drawText(ctx, 'THE KEEPER', 8, 12, { color: VIOLET, scale: 1.3, outline: '#000' });
    // the wares
    panel(ctx, 112, 8, W - 118, H - 16, 0.92); drawText(ctx, 'WARES', 122, 14, { color: GOLD, scale: 1.2 }); drawText(ctx, 'GOLD ' + S.gold, W - 12, 14, { align: 'right', color: GOLD, scale: 1.2 });
    this.hit = [];
    for (let i = 0; i < rows; i++) {
      const j = this.top + i; if (j >= n) break; const e = this.stock[j], y = 32 + i * 13, on = j === this.sel, why = e.can(), poor = S.gold < e.price;
      if (on) { ctx.fillStyle = 'rgba(200,150,255,0.2)'; ctx.fillRect(118, y - 2, W - 130, 13); drawText(ctx, '>', 120, y, { color: GOLD }); }
      drawText(ctx, e.name, 130, y, { color: why ? '#5a5068' : on ? GOLD : PALE });
      drawText(ctx, why || String(e.price), W - 14, y, { align: 'right', color: why ? '#6a6078' : poor ? '#b05050' : GOLD });
      this.hit[i] = { x0: 116, x1: W - 8, y0: y - 2, y1: y + 11, i: j };
    }
    if (this.top > 0) drawText(ctx, '^', W / 2 + 40, 26, { align: 'center', color: DIM }); if (this.top + rows < n) drawText(ctx, 'v', W / 2 + 40, 32 + rows * 13, { align: 'center', color: DIM });
    const e = this.stock[this.sel]; ctx.fillStyle = 'rgba(30,18,44,0.9)'; ctx.fillRect(118, 140, W - 130, 52); ctx.strokeStyle = '#4a3a64'; ctx.strokeRect(118.5, 140.5, W - 131, 51);
    drawText(ctx, e.name + '   ' + e.tag, 124, 144, { color: GOLD }); wrapText(e.desc, W - 144, 1, 'mixed').slice(0, 4).forEach((ln, i) => drawText(ctx, ln, 124, 156 + i * 9, { color: PALE, font: 'mixed' }));
    drawText(ctx, Input.touchOn ? 'TAP A WARE TO SELECT, TAP AGAIN TO BUY   TAP OUTSIDE TO LEAVE' : 'UP / DOWN CHOOSE     ENTER BUY     ESC LEAVE', W / 2 + 56, H - 14, { align: 'center', color: DIM });
  }
}
