// HUD, menus and overlay screens (all drawn with the pixel font on the 384x216 canvas).
import { W, H, clamp, lerp, fmtTime, easeOut, sentenceCase } from './util.js';
import { drawText, textWidth, wrapText, handText, hasFace } from './font.js';
import { Input } from './input.js';
import { Touch } from './touch.js';
import { Audio_ as A } from './audio.js';
import { SHEET, IMG, drawSheet, drawKey } from './assets.js';
import { ICON } from './procart.js';
import { ZONES } from './rooms.js';
import { SPELLS } from './player.js';
import { ENCH, TUNE } from './enchant.js';
import { ITEMS, KEYS } from './itemdata.js';
import { STORY } from './story.js';
import { lines as dlines } from './dialogue.js';
import { BUILD } from './build.js';
import { secretStats } from './secrets.js';
import { BestiaryScreen } from './bestiary.js';
import { LetterBook, foundPages, PAGE_COUNT } from './letters.js';

const GOLD = '#e8b84a', PALE = '#e8dcc0', DIM = '#8a7d9a', RED = '#c23b2a';
const icon = (ctx, name, x, y, sc = 1, a) => drawSheet(ctx, 'icons', ICON.indexOf(name), x, y, { ay: 0.5, scale: sc, alpha: a });

export function panel(ctx, x, y, w, h, alpha = 0.9) {
  ctx.fillStyle = `rgba(8,5,16,${alpha})`; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#6b5a2e'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = '#b8913f'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
}
function bar(ctx, x, y, w, h, frac, c1, c2, lag) {
  ctx.fillStyle = '#05030a'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = '#2a2236'; ctx.fillRect(x, y, w, h);
  if (lag !== undefined && lag > frac) { ctx.fillStyle = '#e8d8a8'; ctx.fillRect(x, y, Math.round(w * lag), h); }
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), 1);
  ctx.fillStyle = '#b8913f'; ctx.fillRect(x - 2, y - 2, w + 4, 1); ctx.fillRect(x - 2, y + h + 1, w + 4, 1); ctx.fillRect(x - 2, y - 2, 1, h + 4); ctx.fillRect(x + w + 1, y - 2, 1, h + 4);
}

// ---------------------------------------------------------------------------------------------- HUD
export const HUD = {
  lagHp: 1, lagBoss: 1,
  draw(ctx, g) {
    const S = g.save, p = g.player; if (!S) return;
    const hpW = clamp(50 + S.maxHp * 0.45, 70, 150), mpW = clamp(36 + S.maxMp * 0.8, 50, 110);
    const hf = S.hp / S.maxHp; this.lagHp += (hf - this.lagHp) * (hf < this.lagHp ? 0.04 : 1);
    drawText(ctx, 'HP', 7, 6.5, { color: '#ff8a8a', outline: '#000', scale: 1.15 }); bar(ctx, 24, 7, hpW, 6, hf, '#ff4a4a', '#9a1a2a', this.lagHp);
    drawText(ctx, 'MP', 7, 16.5, { color: '#8ab4ff', outline: '#000', scale: 1.15 }); bar(ctx, 24, 17, mpW, 5, S.mp / S.maxMp, '#5a9aff', '#2a4ab0');
    drawText(ctx, 'LV ' + S.level, 7, 25.5, { color: GOLD, outline: '#000', scale: 1.15 });
    const xf = p.xpNext ? S.xp / p.xpNext() : 0; ctx.fillStyle = '#000'; ctx.fillRect(34, 28, 40, 3); ctx.fillStyle = '#6a5a1a'; ctx.fillRect(35, 29, 38, 1); ctx.fillStyle = GOLD; ctx.fillRect(35, 29, Math.round(38 * clamp(xf, 0, 1)), 1);
    // active sword enchantment: icon, name, time left
    const E = p.ench;
    if (E) {
      const def = ENCH[E.type], css = `rgb(${def.rgb.map(v => Math.round(v * 255)).join(',')})`, secs = Math.ceil(E.t / 60), low = E.t < 600 && Math.floor(E.t / 12) % 2;
      icon(ctx, def.icon, 15, 44, 1.1, low ? 0.4 : 1); drawText(ctx, `${def.name} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 26, 36, { color: low ? '#8a7d9a' : css, outline: '#000' });
      ctx.fillStyle = '#000'; ctx.fillRect(25, 46, 52, 4); ctx.fillStyle = css; ctx.fillRect(26, 47, Math.round(50 * clamp(E.t / TUNE.time, 0, 1)), 2);
    }
    // hotbar: unlocked spells + carried items.  Q / V move the box, C / I uses what is selected.
    const slots = p.hotbar();
    if (slots.length) {
      const sw = 21, gap = 2, tot = slots.length * (sw + gap) - gap, x0 = W - 6 - tot, y = 5;
      slots.forEach((e, i) => {
        const sel = e.id === p.sel, sx = x0 + i * (sw + gap); panel(ctx, sx, y, sw, sw, sel ? 0.96 : 0.68);
        if (sel) { ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 1; ctx.strokeRect(sx - 0.5, y - 0.5, sw + 1, sw + 1); ctx.strokeStyle = 'rgba(255,233,160,0.4)'; ctx.strokeRect(sx - 1.5, y - 1.5, sw + 3, sw + 3); }
        if (e.kind === 'spell') { const sp = SPELLS[e.id], ok = S.mp >= sp.cost; icon(ctx, sp.icon, sx + sw / 2, y + sw / 2 - 1, 1.15, ok ? 1 : 0.4); drawText(ctx, String(sp.cost), sx + sw - 2, y + sw - 8.5, { align: 'right', color: ok ? '#8ab4ff' : '#666', outline: '#000' }); }
        else { const it = ITEMS[e.id], n = S.items[e.id]; icon(ctx, it.icon, sx + sw / 2, y + sw / 2 - 1, 1.15); drawText(ctx, String(n), sx + sw - 2, y + sw - 8.5, { align: 'right', color: n >= it.max ? GOLD : PALE, outline: '#000' }); }
      });
      const cur = slots.find(e => e.id === p.sel);
      if (cur) drawText(ctx, cur.kind === 'spell' ? SPELLS[cur.id].name : ITEMS[cur.id].short, W - 6, y + sw + 3, { align: 'right', color: PALE, outline: '#000' });
      if (slots.length > 1) drawText(ctx, 'Q', x0 - 9, y + 5, { color: DIM, outline: '#000' });
    }
    // gold
    icon(ctx, 'coin', W - 24, 43, 1); drawText(ctx, S.gold, W - 8, 40, { align: 'right', color: PALE, outline: '#000' });
    // boss bar
    const b = g.boss; if (b && b.active && !b.dead) {
      const w = 220, x = (W - w) / 2, y = H - 22, f = Math.max(0, b.hp / b.maxHp); this.lagBoss += (f - this.lagBoss) * (f < this.lagBoss ? 0.03 : 1);
      drawText(ctx, b.bossName, W / 2, y - 12, { align: 'center', color: '#ffd08a', outline: '#200' }); bar(ctx, x, y, w, 7, f, '#e04a3a', '#7a1010', this.lagBoss);
    } else this.lagBoss = 1;
  },
};

// ---------------------------------------------------------------------------------------------- banners, popups, prompts
export function drawBanner(ctx, b) {
  if (!b) return; const t = b.t, a = t < 20 ? t / 20 : t > b.dur - 30 ? Math.max(0, (b.dur - t) / 30) : 1;
  ctx.globalAlpha = a; const y = b.y || 56;
  const lines = b.sub ? wrapText(b.sub, W - 60, 1.1, 'body') : []; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, y - 8, W, lines.length ? 26 + lines.length * 10 : 28);
  drawText(ctx, b.title, W / 2, y, { align: 'center', scale: 2, color: b.color || GOLD, outline: '#200' });
  if (b.sub) { lines.forEach((l, i) => drawText(ctx, l, W / 2, y + 20 + i * 10, { align: 'center', color: PALE, outline: '#000', scale: 1.1, font: 'body' })); }
  ctx.globalAlpha = 1;
}
export function drawPopups(ctx, list, cx, cy) {
  for (const p of list) { const a = Math.min(1, p.life / 20); drawText(ctx, p.text, p.x - cx, p.y - cy - (60 - p.life) * 0.35, { align: 'center', color: p.color, outline: '#000', alpha: a }); }
}
// a small UP arrow on a plate that bobs over anything the player can use with UP (doors, altars, tablets, chests, waystones, people); a word under it for the ones worth naming
function arrowPlate(ctx, X, Y) {
  ctx.fillStyle = '#05030a'; ctx.fillRect(X - 6, Y - 6, 13, 13);                          // dark rim
  ctx.fillStyle = '#d8b25a'; ctx.fillRect(X - 5, Y - 5, 11, 11);                           // gold border
  ctx.fillStyle = '#2a2236'; ctx.fillRect(X - 4, Y - 4, 9, 9);                             // plate
}
export function drawPrompt(ctx, x, y, t, text) {
  const X = Math.round(x), Y = Math.round(y + 4 + Math.sin(t * 0.12) * 1.5), pulse = 0.75 + 0.25 * Math.sin(t * 0.2);
  arrowPlate(ctx, X, Y); ctx.globalAlpha = pulse; ctx.fillStyle = '#fff3c8';
  ctx.fillRect(X, Y - 3, 1, 1); ctx.fillRect(X - 1, Y - 2, 3, 1); ctx.fillRect(X - 2, Y - 1, 5, 1); ctx.fillRect(X - 1, Y, 3, 3);     // the arrow: head, then stem
  ctx.globalAlpha = 1;
  if (text && text !== 'UP') drawText(ctx, text, X, Y + 9, { align: 'center', color: PALE, outline: '#000', scale: 0.8 });
}
// the same plate with a sideways arrow, on the edge of the screen where a room opens into the next one (dir -1 = left, +1 = right); it nudges toward the exit
export function drawExitArrow(ctx, x, y, t, dir) {
  const X = Math.round(x + dir * (1 + Math.sin(t * 0.14) * 1.5)), Y = Math.round(y), pulse = 0.75 + 0.25 * Math.sin(t * 0.2);
  arrowPlate(ctx, X, Y); ctx.globalAlpha = pulse; ctx.fillStyle = '#fff3c8';
  const px = (dx, dy, w, h) => ctx.fillRect(dir > 0 ? X + dx : X - dx - w + 1, Y + dy, w, h);     // dx counts from the centre toward the arrow's tip
  px(3, 0, 1, 1); px(2, -1, 1, 3); px(1, -2, 1, 5); px(-3, -1, 4, 3);                              // the tip, the head widening, then the stem
  ctx.globalAlpha = 1;
}

export class Dialog {
  constructor(text, o = {}) { this.font = o.font || (o.name && /^the stranger$/i.test(o.name) && hasFace('stranger') ? 'stranger' : o.name ? (hasFace('npc') ? 'npc' : 'mixed') : undefined); if (this.font === 'hand') text = handText(text); else if (this.font === 'mixed' || this.font === 'stranger' || this.font === 'npc') text = sentenceCase(text);          // (the Stranger speaks in his own bookhand)          // (a named speaker - an NPC, a boss - talks in sentence case; the gravestones in their own face)
    this.lines = wrapText(text, 300, 1, this.font); this.full = this.lines.join('\n'); this.t = 0; this.done = false; this.closed = false; this.name = o.name || null; this.onClose = o.onClose || null; this.choices = o.choices || null; this.sel = 0; this.choice = -1; this.footer = o.footer || null; }
  update() {
    this.t += 1.2; const skip = Input.pressed.confirm || Input.pressed.back || Input.pressed.attack || Input.pressed.jump;
    if (this.choices && this.t >= this.full.length) {                                       // a question: LEFT / RIGHT (or UP / DOWN) choose, ENTER / SPACE answers, ESC says no
      this.done = true; const n = this.choices.length;
      if (Input.pressed.left || Input.pressed.up) { this.sel = (this.sel + n - 1) % n; A.sfx('click'); } if (Input.pressed.right || Input.pressed.down) { this.sel = (this.sel + 1) % n; A.sfx('click'); }
      for (const t of Input.taps) { const i = Math.floor((t.x - 40) / 52); if (t.y > H - 60 && i >= 0 && i < n) { this.sel = i; this.choice = i; this.closed = true; } }          // (a tap on an answer)
      if (this.closed) return;
      if (Input.pressed.confirm || Input.pressed.jump) { this.choice = this.sel; this.closed = true; } else if (Input.pressed.back) { this.choice = n - 1; this.closed = true; }
      return;
    }
    if (skip) { if (this.t < this.full.length) this.t = this.full.length; else this.closed = true; } if (this.t > this.full.length) this.done = true;
  }
  draw(ctx) {
    const bottom = this.choices || this.footer, h = this.lines.length * 11 + 16 + (bottom ? 13 : 0), y = H - h - 14; panel(ctx, 30, y, W - 60, h);
    if (this.name) { const nw = textWidth(this.name, 1, { outline: true }) + 14; panel(ctx, 34, y - 12, nw, 14); drawText(ctx, this.name, 41, y - 9, { color: GOLD, outline: '#000' }); }       // who is speaking
    let n = Math.floor(this.t), yy = y + 8;
    for (const l of this.lines) { const s = l.slice(0, Math.max(0, Math.min(l.length, n))); drawText(ctx, s, 40, yy, { color: PALE, font: this.font }); n -= l.length + 1; yy += 11; }
    if (this.footer) drawText(ctx, this.footer, W - 42, y + h - 12, { align: 'right', color: '#b5a47a' });
    if (this.choices && this.done) this.choices.forEach((c, i) => { const sel = i === this.sel, x = 44 + i * 52; drawText(ctx, (sel ? '> ' : '  ') + c, x, y + h - 12, { color: sel ? GOLD : PALE, outline: '#000' }); });
    else if (this.done && !this.footer && Math.floor(performance.now() / 350) % 2) drawText(ctx, '>', W - 44, y + h - 11, { color: GOLD });
  }
}

// ---------------------------------------------------------------------------------------------- logo
let LOGO = null;
function logo() {
  if (LOGO) return LOGO; const sc = 6.5, text = 'Arx Noctis', w = Math.ceil(textWidth(text, sc, 'title')) + 20, h = 7 * sc + 24, K = (window.game && window.game.K) || 3;
  const mk = () => { const c = document.createElement('canvas'); c.width = w * K; c.height = h * K; c.lw = w; c.lh = h; const g = c.getContext('2d'); g.setTransform(K, 0, 0, K, 0, 0); return [c, g]; };
  const [c, g] = mk(), [t, tg] = mk(), [o, og] = mk();
  drawText(tg, text, w / 2, 10, { align: 'center', scale: sc, color: '#fff', font: 'title' });                  // letter shapes
  tg.globalCompositeOperation = 'source-in'; const gr = tg.createLinearGradient(0, 8, 0, 8 + 7 * sc + 6); gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.45, '#f0b43a'); gr.addColorStop(1, '#9a2a14'); tg.fillStyle = gr; tg.fillRect(0, 0, w, h);
  drawText(og, text, w / 2, 10, { align: 'center', scale: sc, color: '#2a0a0e', font: 'title' });               // dark outline source
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2], [3, 3], [4, 4]]) g.drawImage(o, dx, dy, w, h);   // outline + drop shadow
  g.drawImage(t, 0, 0, w, h); LOGO = c; return c;
}

// ---------------------------------------------------------------------------------------------- menus
class Menu {
  constructor(items) { this.items = items; this.i = 0; this.hit = []; }
  update(g) {
    for (const t of Input.taps) for (let k = 0; k < this.hit.length; k++) {                  // a finger on an item (the rows are measured when the menu is drawn)
      const r = this.hit[k]; if (!r || t.x < r.x0 || t.x > r.x1 || t.y < r.y0 || t.y > r.y1) continue;
      this.i = k; const it = this.items[k]; if (it.adjust) { it.adjust(t.x < (r.x0 + r.x1) / 2 ? -1 : 1); A.sfx('click'); } else if (it.action && !it.disabled) { A.sfx('select'); it.action(); } return;
    }
    const n = this.items.length; if (Input.pressed.up) { this.i = (this.i + n - 1) % n; A.sfx('click'); } if (Input.pressed.down) { this.i = (this.i + 1) % n; A.sfx('click'); }
    const it = this.items[this.i];
    if (Input.pressed.left && it.adjust) { it.adjust(-1); A.sfx('click'); } if (Input.pressed.right && it.adjust) { it.adjust(1); A.sfx('click'); }
    if ((Input.pressed.confirm) && it.action && !it.disabled) { A.sfx('select'); it.action(); }
  }
  draw(ctx, x, y, gap = 14, align = 'center') {
    this.hit = [];
    this.items.forEach((it, i) => {
      const sel = i === this.i, label = typeof it.label === 'function' ? it.label() : it.label, yy = y + i * gap, col = it.disabled ? '#4a4258' : sel ? GOLD : PALE;
      const sc = 1.25, w = textWidth(label, sc, { outline: true }), lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, o = { color: col, outline: '#000', scale: sc };
      drawText(ctx, label, lx, yy, o);
      this.hit[i] = align === 'center' ? { x0: x - Math.max(w / 2 + 14, 56), x1: x + Math.max(w / 2 + 14, 56), y0: yy - 2, y1: yy + gap - 3 } : { x0: lx - 14, x1: lx + Math.max(w + 14, 150), y0: yy - 2, y1: yy + gap - 3 };
      if (it.bar) { const v = clamp(it.bar(), 0, 1), bx = lx + 84; for (let k = 0; k < 10; k++) { ctx.fillStyle = '#05030a'; ctx.fillRect(bx + k * 7 - 1, yy - 0.5, 7, 8); ctx.fillStyle = k < Math.round(v * 10) ? col : '#3a3048'; ctx.fillRect(bx + k * 7, yy + 0.5, 5, 6); } }
      if (it.val) drawText(ctx, it.val(), lx + 84, yy, o);
      if (sel) { drawText(ctx, '>', lx - 11, yy, o); if (!it.bar && !it.val) drawText(ctx, '<', lx + w + 5, yy, o); }
    });
  }
}

// credits.txt -> a list of lines to scroll.   # heading   ## subheading   --- rule   blank = gap   ; comment (not shown)   anything else = text (wrapped)
// a single word wider than the page (a web address) is broken into pieces that fit
function breakLong(l) { const out = []; let cur = ''; if (textWidth(l, 1, 'hand') <= 262) return [l]; for (const ch of l) { if (textWidth(cur + ch, 1, 'hand') > 262) { out.push(cur); cur = ''; } cur += ch; } if (cur) out.push(cur); return out; }
function layoutCredits(text) {
  const items = []; let y = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, ''); if (line.startsWith(';')) continue;
    if (line === '') { y += 7; continue; }
    if (line.startsWith('---')) { items.push({ k: 'rule', y: y + 3 }); y += 11; continue; }
    if (line.startsWith('## ')) { items.push({ k: 'h2', text: handText(line.slice(3)), y }); y += 14; continue; }
    if (line.startsWith('# ')) { y += 4; items.push({ k: 'h1', text: handText(line.slice(2)), y }); y += 20; continue; }
    for (const l0 of wrapText(handText(line), 262, 1, 'hand')) for (const l of breakLong(l0)) { items.push({ k: 'p', text: l, y }); y += 11; }          // (the credits are lettered in Eroded Motta, like the gravestones)
  }
  return { items, height: y };
}

// the lines of the credits, scrolled by c.scroll, inside the band [top, top + view)
function drawCreditLines(ctx, c, top, view) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, view); ctx.clip();
  if (!c.lines) drawText(ctx, 'LOADING...', W / 2, top + 20, { align: 'center', color: DIM });
  else for (const it of c.lines.items) {
    const y = Math.round(top + 4 + it.y - c.scroll); if (y < top - 22 || y > top + view) continue;
    if (it.k === 'rule') { ctx.fillStyle = '#4a3a2a'; ctx.fillRect(W / 2 - 60, y, 120, 1); }
    else if (it.k === 'h1') drawText(ctx, it.text, W / 2, y, { align: 'center', scale: 1.5, color: GOLD, outline: '#000', font: 'hand' });
    else if (it.k === 'h2') drawText(ctx, it.text, W / 2, y, { align: 'center', color: '#e6c27a', outline: '#000', font: 'hand' });
    else drawText(ctx, it.text, W / 2, y, { align: 'center', color: PALE, outline: '#000', font: 'hand' });
  }
  ctx.restore();
}
function loadCredits(cr) {
  fetch('credits.txt', { cache: 'no-cache' }).then(r => r.ok ? r.text() : Promise.reject(new Error(r.status))).then(t => { cr.lines = layoutCredits(t); })
    .catch(() => { cr.lines = layoutCredits('# CREDITS\ncredits.txt could not be loaded.'); });
}

export class TitleScreen {
  constructor(g) {
    this.g = g; this.t = 0; this.mode = 'main'; const has = g.hasSave();
    this.main = new Menu([
      { label: 'NEW GAME', action: () => g.newGame() }, { label: 'CONTINUE', disabled: !has, action: () => g.continueGame() },
      { label: 'CHOOSE SEED', action: () => { this.mode = 'seed'; this.seed = ''; Input.typed.length = 0; } },          // (on a phone, a keypad of numbers is drawn in the game itself: the game never opens a pop-up window)
      { label: 'CONTROLS', action: () => { this.mode = 'controls'; } }, { label: 'OPTIONS', action: () => { this.mode = 'options'; this.opts.i = 0; } }, { label: 'CREDITS', action: () => this.openCredits() },
    ]); if (has) this.main.i = 1;
    this.opts = optionsMenu(() => { this.mode = 'main'; });
  }
  // the credits are read from credits.txt (a plain text file the game's owner can edit) each time they are opened
  openCredits() {
    this.mode = 'credits'; loadCredits(this.cr = { lines: null, scroll: 0, t: 0 });
  }
  // the keypad of the seed screen on a phone (drawn in the game, never a pop-up window): ten numbers in two rows, then DEL, BEGIN and BACK.  Each is { k, label, x, y, w, h } in game pixels
  seedPad() {
    const B = [], num = (i, r, c) => B.push({ k: String(i), x: 90 + c * 42, y: 86 + r * 28, w: 36, h: 23 });
    [1, 2, 3, 4, 5].forEach((n, c) => num(n, 0, c)); [6, 7, 8, 9, 0].forEach((n, c) => num(n, 1, c));
    ['DEL', 'BEGIN', 'BACK'].forEach((k, c) => B.push({ k, x: 91 + c * 70, y: 146, w: 62, h: 23 }));
    return B;
  }
  update() {
    this.t++; const g = this.g;
    if (this.mode === 'main') this.main.update(g);
    else if (this.mode === 'credits') {
      const c = this.cr;
      if (c.lines) { const view = H - 44 - 30, max = Math.max(0, c.lines.height - view); c.t++; if (Input.held.down) c.scroll += 2; else if (Input.held.up) c.scroll -= 2; else if (c.t > 100) c.scroll += 0.2; c.scroll = clamp(c.scroll, 0, max); }
      if (Input.pressed.back || Input.pressed.confirm || Input.taps.length) { this.mode = 'main'; A.sfx('back'); }
    }
    else if (this.mode === 'seed') {
      for (const k of Input.typed.splice(0)) { if (k === '<') this.seed = this.seed.slice(0, -1); else if (this.seed.length < 9) this.seed += k; }
      let go = Input.pressed.confirm;
      if (Input.touchOn) for (const tp of Input.taps) { const b = this.seedPad().find(b => tp.x >= b.x && tp.x < b.x + b.w && tp.y >= b.y && tp.y < b.y + b.h); if (!b) continue; A.sfx('click'); if (b.k === 'DEL') this.seed = this.seed.slice(0, -1); else if (b.k === 'BEGIN') go = true; else if (b.k === 'BACK') { this.mode = 'main'; A.sfx('back'); return; } else if (this.seed.length < 9) this.seed += b.k; }
      if (Input.pressed.esc) { this.mode = 'main'; A.sfx('back'); } else if (go) { const code = g.codeFor(this.seed); if (code) g.newGame(undefined, code); else g.newGame(this.seed === '' ? undefined : +this.seed); }
    } else if (this.mode === 'options') { this.opts.update(g); if (Input.pressed.back) { this.mode = 'main'; A.sfx('back'); } }
    else if (Input.pressed.back || Input.pressed.confirm || Input.taps.length) { this.mode = 'main'; A.sfx('back'); }
  }
  draw(ctx) {
    const t = this.t; ctx.fillStyle = '#0a0a1c'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(IMG.cemetery_sky, 0, 0);
    const mx = -((t * 0.15) % 192); for (let x = mx; x < W; x += 192) ctx.drawImage(IMG.cemetery_mountains, Math.round(x), 52);
    const gx = -((t * 0.4) % 384); for (let x = gx; x < W; x += 384) ctx.drawImage(IMG.cemetery_graveyard, Math.round(x), H - 123 + 20);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
    const lg = logo(); const bob = Math.sin(t * 0.03) * 1.5; ctx.drawImage(lg, Math.round(W / 2 - lg.lw / 2), Math.round(14 + bob), lg.lw, lg.lh);
    if (this.mode === 'main' && this.g.clean) { /* (the trailer's last card: the logo and the weather, no menu) */ }
    else if (this.mode === 'main') { this.main.draw(ctx, W / 2, 110); drawText(ctx, Input.touchOn ? 'TAP AN ITEM' : 'ENTER / Z TO SELECT', W / 2, H - 14, { align: 'center', color: DIM }); }
    else if (this.mode === 'credits') {
      const c = this.cr; ctx.fillStyle = 'rgba(6,4,14,0.95)'; ctx.fillRect(0, 0, W, H); drawText(ctx, 'CREDITS', W / 2, 12, { align: 'center', scale: 1.8, color: GOLD, outline: '#000', font: 'hand' });
      const top = 38, view = H - top - 30; drawCreditLines(ctx, c, top, view); ctx.fillStyle = 'rgba(10,10,28,0.9)'; ctx.fillRect(0, top - 6, W, 6);
      drawText(ctx, Input.touchOn ? 'UP / DOWN SCROLL     TAP TO GO BACK' : 'UP / DOWN SCROLL     ESC BACK', W / 2, H - 14, { align: 'center', color: DIM });
    }
    else if (this.mode === 'options') { panel(ctx, 60, 66, W - 120, 148); drawText(ctx, 'OPTIONS', W / 2, 73, { align: 'center', scale: 1.5, color: GOLD, outline: '#000' }); this.opts.draw(ctx, 84, 92, 14, 'left'); }
    else if (this.mode === 'seed' && Input.touchOn) {
      panel(ctx, 40, 10, W - 80, 168); drawText(ctx, 'CHOOSE A SEED', W / 2, 17, { align: 'center', scale: 1.5, color: GOLD, outline: '#000' });
      const tw = textWidth(this.seed, 2); drawText(ctx, this.seed || 'RANDOM', W / 2 - (this.seed ? 3 : 0), 40, { align: 'center', scale: 2, color: this.seed ? PALE : DIM });
      if (this.seed && Math.floor(t / 24) % 2) { ctx.fillStyle = PALE; ctx.fillRect(Math.round(W / 2 - 3 + tw / 2 + 2), 40, 8, 12); }
      drawText(ctx, 'THE SAME SEED ALWAYS BUILDS THE SAME CASTLE.', W / 2, 62, { align: 'center', color: '#b5a47a' });
      drawText(ctx, 'TAP NUMBERS.   NONE = A RANDOM CASTLE.', W / 2, 73, { align: 'center', color: DIM });
      for (const b of this.seedPad()) { ctx.fillStyle = 'rgba(20,16,36,0.95)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = b.k === 'BEGIN' ? GOLD : '#5d5772'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1); drawText(ctx, b.k, b.x + b.w / 2, b.y + b.h / 2 - 4, { align: 'center', scale: b.k.length > 1 ? 1 : 1.6, color: b.k === 'BEGIN' ? GOLD : PALE }); }
    }
    else if (this.mode === 'seed') {
      panel(ctx, 50, 84, W - 100, 112); drawText(ctx, 'CHOOSE A SEED', W / 2, 91, { align: 'center', scale: 1.5, color: GOLD, outline: '#000' });
      const tw = textWidth(this.seed, 2); drawText(ctx, this.seed || 'RANDOM', W / 2 - (this.seed ? 3 : 0), 112, { align: 'center', scale: 2, color: this.seed ? PALE : DIM });
      if (this.seed && Math.floor(t / 24) % 2) { ctx.fillStyle = PALE; ctx.fillRect(Math.round(W / 2 - 3 + tw / 2 + 2), 112, 8, 12); }
      drawText(ctx, 'THE SAME SEED ALWAYS BUILDS THE SAME CASTLE.', W / 2, 138, { align: 'center', color: '#b5a47a' });
      drawText(ctx, 'TYPE NUMBERS.   NONE = A RANDOM CASTLE.', W / 2, 150, { align: 'center', color: DIM });
      drawText(ctx, 'ENTER = BEGIN     ESC = BACK', W / 2, 176, { align: 'center', color: PALE });
    }
    else controlsScreen(ctx);
    if (!this.g.clean) drawText(ctx, 'BUILD ' + BUILD.n + '  ' + BUILD.when, W - 3, H - 8, { align: 'right', color: '#6a6280', alpha: 0.8, scale: 0.7 });          // (which build this is: small, bottom right)
  }
}

function optionsMenu(onBack) {
  return new Menu([
    { label: 'MUSIC', bar: () => A.settings.music, adjust: d => A.setVolume('music', A.settings.music + d * 0.1) },
    { label: 'SOUND', bar: () => A.settings.sfx, adjust: d => { A.setVolume('sfx', A.settings.sfx + d * 0.1); A.sfx('select'); } },
    { label: 'MUTE', val: () => (A.settings.muted ? 'ON' : 'OFF'), action: () => A.toggleMute() },
    { label: 'BOSS HINTS', val: () => (A.settings.hints ? 'ON' : 'OFF'), action: () => { A.settings.hints = !A.settings.hints; A.save(); } },
    { label: 'WHITE CLOAK', val: () => (A.settings.cloak ? 'ON' : 'OFF'), action: () => { A.settings.cloak = !A.settings.cloak; A.save(); } },
    { label: 'GLOW', val: () => (A.settings.glow !== false ? 'ON' : 'OFF'), action: () => { A.settings.glow = A.settings.glow === false; A.save(); } },          // (bloom, heat shimmer and chromatic flash: see post.js)
    { label: 'TOUCH PAD', val: () => (Touch.on ? 'ON' : 'OFF'), action: () => Touch.show(!Touch.on, true) },
    { label: 'BACK', action: onBack },
  ]);
}
export function controlsScreen(ctx) {
  panel(ctx, 36, 14, W - 72, H - 28, 0.96); drawText(ctx, 'CONTROLS', W / 2, 22, { align: 'center', color: GOLD, scale: 2 });
  const rows = Input.touchOn ? [['MOVE', 'SLIDE A THUMB ROUND THE PAD'], ['JUMP', 'JUMP  (AGAIN IN THE AIR = DOUBLE)'], ['ATTACK', 'HIT  (TAP AGAIN TO CHAIN A COMBO)'], ['DUCK', 'HOLD THE PAD DOWN  (HIT WHILE DUCKING)'], ['DROP DOWN', 'PAD DOWN + JUMP (THIN PLATFORMS)'], ['DASH', 'DASH'], ['USE SELECTED', 'ITEM  (SPELL OR ITEM)'], ['SELECT', 'ARROWS BESIDE ITEM / TOP BOX'], ['USE / DOOR', 'PAD UP'], ['MAP', 'MAP'], ['PAUSE', 'II'], ['FULL SCREEN', 'THE SQUARE AT THE TOP']] : [['MOVE', 'ARROWS / WASD'], ['JUMP', 'SPACE / Z / K (AGAIN = DOUBLE)'], ['ATTACK', 'X / J  (TAP AGAIN TO CHAIN A COMBO)'], ['DUCK', 'HOLD DOWN / S  (ATTACK WHILE DUCKING)'], ['DROP DOWN', 'DOWN / S + JUMP (THIN PLATFORMS)'], ['DASH', 'SHIFT / L'], ['USE SELECTED', 'C / I  (SPELL OR ITEM)'], ['SELECT', 'Q / V  (THE BOX AT THE TOP)'], ['USE / DOOR', 'UP / W / E'], ['MAP', 'M / TAB'], ['PAUSE', 'ESC / P / ENTER'], ['MUTE', 'N']];
  rows.forEach(([a, b], i) => { drawText(ctx, a, 50, 46 + i * 11, { color: PALE }); drawText(ctx, b, 148, 46 + i * 11, { color: '#b5a47a' }); });
  drawText(ctx, Input.touchOn ? 'TAP ANYWHERE TO RETURN' : 'GAMEPAD WORKS TOO.   ANY KEY TO RETURN', W / 2, H - 28, { align: 'center', color: DIM });
}

// what the hero has found, for the pause screen: the four powers (dim and unnamed until found), the Magic Shoes and the Tide Blade once found, and the keys he carries
const POWERS = [['djump', 'feather', 'AETHER FEATHER'], ['dash', 'boot', 'QUICKSILVER'], ['ember', 'ember', 'SULPHUR'], ['thunder', 'thunder', 'VITRIOL']];
// what the pause screen lists as FOUND: the four powers, the relics the bosses leave, and the keys you carry (each with what it is and what it does, for the cursor to read out)
const RELICS = [['got_mantle', 'mantle', 'SALAMANDER', 'mantle'], ['got_lantern', 'lantern', 'IGNIS VAPOUR', 'lantern'], ['got_shard', 'shard', 'LACUNA', 'shard'], ['got_spring', 'spring', 'PERPETUUM', 'spring'], ['got_shoes', 'shoes', 'HERMES SHOES', 'shoes'], ['got_tide', 'e_ice', 'AQUA REGIA', 'tide'], ['got_astrolabe', 'astrolabe', 'ASTROLABE', 'astrolabe'], ['got_crampons', 'crampons', 'CRAMPONS', 'crampons'], ['got_athanor', 'athanor', 'ATHANOR', 'athanor']];
const KEY_USE = { key_grave: "THE GRAVEKEEPER'S VAULT, OFF THE MOURNING FIELDS.", key_hall: "THE STEWARD'S VAULT, OFF THE PORTRAIT GALLERY.", key_chapel: "THE VERGER'S VAULT, OFF THE BELL GALLERY.", key_crypt: 'THE DOOR OF THE ORLOJ TOWER, HIGH ABOVE SMOULDERING LANE IN PRAGUE.', key_mire: "THE FERRYMAN'S VAULT, OFF THE WEEPING HOLLOW.", key_gear: "THE ENGINEER'S VAULT, OFF THE ESCAPEMENT.", key_frost: 'THE DOOR OF THE LIBRARY OF AGES, AT THE CROSSING HALL.', key_gold: 'THE DOOR OF THE SHADOW THRONE, AT THE CROSSING HALL.' };
export function foundItems(g) {
  const S = g.save, F = S.flags, AB = (g.info && g.info.ABILITIES) || {}, UP = (g.info && g.info.UPGRADES) || {}, rows = [];
  for (const [k, ic, name] of POWERS) rows.push({ ic, name: S.abilities[k] ? name : '???', has: !!S.abilities[k], title: S.abilities[k] ? (AB[k] ? AB[k].name : name) : 'NOT YET FOUND', desc: S.abilities[k] && AB[k] ? AB[k].desc : 'A POWER YOU HAVE NOT FOUND YET. THE BOSSES OF THE CASTLE GUARD THEM.' });
  for (const [f, ic, name, up] of RELICS) if (F[f]) rows.push({ ic, name, has: true, title: UP[up] ? UP[up].name : name, desc: UP[up] ? UP[up].desc : '' });
  for (const k of KEYS) if (F['has_' + k.id] && !F['unlocked_' + k.id]) rows.push({ ic: 'key', name: k.name, has: true, key: k, title: k.name, desc: 'IT OPENS ' + (KEY_USE[k.id] || 'ONE LOCKED DOOR.') + ' THE DOOR IS DRAWN WITH ITS PADLOCK IN THE KEY\'S OWN COLOUR.' });
  return rows;
}
// the list: each row's place (the keys sit in a grid under the list)
function foundLayout(rows) {
  const list = rows.filter(r => !r.key), step = list.length > 8 ? 11 : 13, y0 = 59 + list.length * step + 3, pos = [];
  let ki = 0; for (const r of rows) { if (r.key) { pos.push({ x: 22 + (ki % 6) * 18, y: y0 + 14 + Math.floor(ki / 6) * 17, w: 16, h: 16, key: true }); ki++; } else pos.push({ x: 14, y: 59 + pos.length * step - 5, w: 112, h: step, key: false }); }
  return { pos, y0, list };
}
function foundPanel(ctx, g, pm) {
  const rows = foundItems(g), L = foundLayout(rows), sel = pm && pm.foc === 'found' ? pm.sel : -1;
  panel(ctx, 8, 36, 124, 174); drawText(ctx, 'FOUND', 70, 42, { align: 'center', color: GOLD, scale: 1.3 });
  let ki = 0;
  rows.forEach((r, i) => {
    const p = L.pos[i], on = i === sel;
    if (!r.key) { const y = p.y + 5; if (on) { ctx.fillStyle = 'rgba(232,184,74,0.18)'; ctx.fillRect(10, y - 6, 120, p.h); } icon(ctx, r.ic, 21, y, 1, r.has ? 1 : 0.2); drawText(ctx, r.name, 33, y - 4, { color: !r.has ? '#4a4458' : on ? GOLD : PALE }); if (on) drawText(ctx, '>', 12, y - 4, { color: GOLD }); }
    else {
      if (ki === 0) drawText(ctx, 'KEYS', 14, L.y0 - 2, { color: DIM }); ki++;
      if (on) { ctx.fillStyle = 'rgba(232,184,74,0.25)'; ctx.fillRect(p.x - 8, p.y - 9, 17, 19); }
      drawKey(ctx, r.key.rgb, p.x, p.y, 1.1); ctx.fillStyle = 'rgb(' + r.key.rgb.join(',') + ')'; ctx.fillRect(p.x - 5, p.y + 8, 10, 2);
    }
  });
}

export class PauseMenu {
  constructor(g) {
    this.g = g; this.mode = 'main'; this.foc = 'menu'; this.sel = 0; this.opts = optionsMenu(() => { this.mode = 'main'; });
    this.main = new Menu([{ label: 'RESUME', action: () => g.resume() }, { label: 'MAP', action: () => g.openMap() }, { label: 'BESTIARY', action: () => { this.mode = 'bestiary'; this.best = new BestiaryScreen(g, () => { this.mode = 'main'; }); } }, { label: () => 'LETTERS  ' + foundPages().size + '/' + PAGE_COUNT, action: () => { this.mode = 'letters'; this.book = new LetterBook(() => { this.mode = 'main'; }); } }, { label: 'OPTIONS', action: () => { this.mode = 'options'; this.opts.i = 0; } }, { label: 'CONTROLS', action: () => { this.mode = 'controls'; } }, { label: 'QUIT TO TITLE', action: () => g.toTitle() }]);
  }
  // LEFT moves the cursor over to the list of found things: UP / DOWN read each one out (what it is, what it does); RIGHT, BACK or OK returns to the menu.  A tap on a thing reads it out too.
  update() { if (this.mode === 'main') {
      const rows = foundItems(this.g), L = foundLayout(rows);
      for (const t of Input.taps) { const i = L.pos.findIndex(p => t.x >= p.x - 8 && t.x <= p.x + p.w && t.y >= p.y - 8 && t.y <= p.y + p.h); if (i >= 0 && t.x < 132) { this.foc = 'found'; this.sel = i; A.sfx('select'); } }
      if (this.foc === 'found') {
        if (this.sel >= rows.length) this.sel = Math.max(0, rows.length - 1);
        if (Input.pressed.up && rows.length) { this.sel = (this.sel + rows.length - 1) % rows.length; A.sfx('click'); } if (Input.pressed.down && rows.length) { this.sel = (this.sel + 1) % rows.length; A.sfx('click'); }
        if (Input.pressed.right || Input.pressed.back || Input.pressed.confirm) { this.foc = 'menu'; A.sfx('back'); }
      } else {
        this.main.update(this.g); if (Input.pressed.left && rows.length) { this.foc = 'found'; this.sel = Math.min(this.sel, rows.length - 1); A.sfx('select'); }
        if (Input.pressed.pkey || Input.pressed.back) this.g.resume();
      } } else if (this.mode === 'bestiary') this.best.update(); else if (this.mode === 'letters') this.book.update(); else if (this.mode === 'options') { this.opts.update(this.g); if (Input.pressed.back) this.mode = 'main'; } else if (Input.pressed.back || Input.pressed.confirm || Input.taps.length) this.mode = 'main'; }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    if (this.mode === 'main') {
      const g = this.g, S = g.save, cx = 260; foundPanel(ctx, g, this); panel(ctx, 142, 36, 236, 174);
      if (this.foc === 'found') {                                                              // the thing under the cursor: what it is and what it does
        const it = foundItems(g)[this.sel];
        if (it) { icon(ctx, it.ic, 160, 54, 1.6, it.has ? 1 : 0.3); drawText(ctx, it.title, 176, 48, { color: GOLD, scale: 1.2, outline: '#000' });
          wrapText(it.desc, 214, 1, 'mixed').forEach((ln, i) => drawText(ctx, ln, 154, 76 + i * 11, { color: PALE, font: 'mixed' }));
          drawText(ctx, 'UP / DOWN CHOOSE    RIGHT: BACK', cx, 196, { align: 'center', color: DIM }); }
      } else {
      drawText(ctx, 'PAUSED', cx, 46, { align: 'center', scale: 2, color: GOLD });
      this.main.draw(ctx, cx, 64, 11);
      drawText(ctx, `LV ${S.level}   HP ${Math.round(S.hp)}/${Math.round(S.maxHp)}   MP ${Math.round(S.mp)}/${Math.round(S.maxMp)}`, cx, 150, { align: 'center', color: PALE }); drawText(ctx, `POWER ${g.player.atkPower}   GOLD ${S.gold}   TIME ${fmtTime(S.time)}`, cx, 161, { align: 'center', color: '#b5a47a' }); drawText(ctx, 'CASTLE SEED ' + S.seed, cx, 172, { align: 'center', color: DIM });
      if (foundItems(g).length) drawText(ctx, 'LEFT: LOOK AT WHAT YOU HAVE FOUND', cx, 190, { align: 'center', color: '#6a6078' });
      }
    } else if (this.mode === 'options') { panel(ctx, 70, 40, W - 140, 150); drawText(ctx, 'OPTIONS', W / 2, 47, { align: 'center', scale: 1.5, color: GOLD, outline: '#000' }); this.opts.draw(ctx, 94, 68, 14, 'left'); }
    else if (this.mode === 'bestiary') this.best.draw(ctx);
    else if (this.mode === 'letters') this.book.draw(ctx);
    else controlsScreen(ctx);
  }
}

// ---------------------------------------------------------------------------------------------- map
// THE MAP.  It was criticised as confusing, so it was rethought in passes:
//   1. A strip of the castle that only scrolls shows no whole: now there are two views - DETAIL (the rooms as blocks of cells, centred on the room you have selected) and the WHOLE CASTLE (X switches).
//   2. A web of lines between the rooms (channels, doors, one-way routes) was the worst of it, and it is gone.  A room shows its doors as small marks INSIDE it, where they really are.  Only the room you
//      have selected shows where it leads: gold lines to its neighbours, and their names in the panel below.
//   3. Everything was the same blue.  Each zone now has its own colour, and its name is written over it.
//   4. You had to nudge the map about with the arrows.  Now the arrows MOVE A CURSOR from room to room (the map follows), and a panel names what it rests on and what is in it.
//   5. The whole room flashed white to say 'you are here'.  Now a small pulsing pip stands exactly where you stand in your room.
// The rooms keep the castle's layout (each chain of rooms is a row, side rooms hang below), and each takes as many cells as it needs: one per screen of the room.
const ZCOL = { 1: '#4a6a3a', 2: '#8a6a2a', 3: '#6a4a9a', 4: '#4a7a7a', 5: '#9a2a3a', 6: '#a8542a', 7: '#3a7a5a', 8: '#9a7a3a', 9: '#3a6a9a', 10: '#8a5a2a', 11: '#5aa8d0' };
const CELL_W = 10, CELL_H = 8, GAP_X = 6, GAP_Y = 8, CELLS_W = 24, CELLS_H = 14;          // (a cell is 10 x 8 px on the map; a room is one cell per 24 tiles across and per 14 tiles up)
const cellsOf = (n, per, max) => clamp(Math.round(n / per), 1, max);
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const shade = (hex, k) => { const c = rgbOf(hex).map(v => Math.round(v * k)); return `rgb(${c[0]},${c[1]},${c[2]})`; };
function mapLayout(ROOMS) {
  const list = Object.values(ROOMS), nx = Math.max(...list.map(r => r.map.x)) + 1, ny = Math.max(...list.map(r => r.map.y)) + 1, colW = Array(nx).fill(CELL_W), rowH = Array(ny).fill(CELL_H);
  for (const r of list) { colW[r.map.x] = Math.max(colW[r.map.x], cellsOf(r.w, CELLS_W, 7) * CELL_W); rowH[r.map.y] = Math.max(rowH[r.map.y], cellsOf(r.h, CELLS_H, 4) * CELL_H); }
  const colX = [], rowTop = [], rowBot = []; let x = 0, y = 0;
  for (let i = 0; i < nx; i++) { colX[i] = x; x += colW[i] + GAP_X; } for (let j = 0; j < ny; j++) { rowTop[j] = y; rowBot[j] = y + rowH[j]; y += rowH[j] + GAP_Y; }
  return { colX, colW, rowTop, rowBot, w: x, h: y };
}
const VIEW_Y0 = 24, VIEW_Y1 = 130;          // the map's window on the screen (the panel is beneath it)
export class MapScreen {
  // o.teleport = id of the waystone room we are standing in: the map becomes a destination picker for every attuned waystone
  constructor(g, o = {}) {
    this.g = g; this.t = 0; this.here = o.teleport || null; this.tele = !!o.teleport; this.whole = false; this.sc = 1; this.rep = 0; this.left = 0;
    const S = g.save; this.stones = (g.world.stones || []).filter(id => S.flags['tp_' + id]);
    if (this.tele) { const i = this.stones.indexOf(this.here); this.sel = i > 0 ? i - 1 : Math.min(1, this.stones.length - 1); if (this.sel < 0) this.sel = 0; }
    this.lay = mapLayout(g.world.rooms); this.selId = g.world.rooms[g.room.id] ? g.room.id : Object.keys(S.visited)[0];
    const c = this.centre(this.focusRoom()); this.cam = { x: c.x, y: c.y };
  }
  rectOf(r) { const L = this.lay, cw = cellsOf(r.w, CELLS_W, 7), ch = cellsOf(r.h, CELLS_H, 4), w = cw * CELL_W, h = ch * CELL_H; return { x: L.colX[r.map.x], y: L.rowBot[r.map.y] - h, w, h, cw, ch }; }
  centre(r) { const q = this.rectOf(r); return { x: q.x + q.w / 2, y: q.y + q.h / 2 }; }
  focusRoom() { const g = this.g; return this.tele ? g.world.rooms[this.stones[this.sel]] : g.world.rooms[this.selId] || g.world.rooms[g.room.id]; }
  targetScale() { if (!this.whole) return 1; const L = this.lay; return Math.min(1, 0.97 * W / L.w, (VIEW_Y1 - VIEW_Y0 - 4) / L.h); }
  // the visited room nearest to the cursor in a direction (a room straight ahead beats one off to the side)
  hop(dx, dy) {
    const S = this.g.save, R = this.g.world.rooms, cur = this.centre(R[this.selId]); let best = null, bs = 1e9;
    for (const r of Object.values(R)) {
      if (!S.visited[r.id] || r.id === this.selId) continue; const c = this.centre(r), ax = (c.x - cur.x) * dx + (c.y - cur.y) * dy, off = Math.abs((c.x - cur.x) * dy) + Math.abs((c.y - cur.y) * dx);
      if (ax < 3) continue; const s = ax + 2.4 * off; if (s < bs) { bs = s; best = r; }
    }
    if (best) { this.selId = best.id; A.sfx('click'); }
  }
  update() {
    this.t++; const g = this.g;
    if (this.tele) {
      if (Input.pressed.left && this.sel > 0) { this.sel--; A.sfx('select'); } if (Input.pressed.right && this.sel < this.stones.length - 1) { this.sel++; A.sfx('select'); }
      if (Input.pressed.confirm) { const id = this.stones[this.sel]; if (id && id !== this.here) g.teleportTo(id); else A.sfx('back'); return; }
      if (Input.pressed.map || Input.pressed.back || Input.pressed.pkey) g.resume();
    } else {
      const dirs = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]; let any = false;
      for (const [k, dx, dy] of dirs) { if (Input.pressed[k]) { this.hop(dx, dy); this.rep = 0; } else if (Input.held[k]) { any = true; if (++this.rep > 16 && this.rep % 7 === 0) this.hop(dx, dy); } }
      if (!any) this.rep = 0;
      if (Input.pressed.attack || Input.pressed.jump) { this.whole = !this.whole; A.sfx('select'); }
      if (Input.pressed.map || Input.pressed.back || Input.pressed.pause || Input.pressed.confirm) g.resume();
    }
    this.sc += (this.targetScale() - this.sc) * 0.25; const f = this.focusRoom(), fc = this.centre(f), L = this.lay;
    const wantX = this.whole && !this.tele ? L.w / 2 : fc.x, wantY = this.whole && !this.tele ? L.h / 2 : fc.y; this.cam.x += (wantX - this.cam.x) * 0.25; this.cam.y += (wantY - this.cam.y) * 0.25;
  }
  draw(ctx) {
    const g = this.g, S = g.save, ROOMS = g.world.rooms, sc = this.sc, rect = r => this.rectOf(r), flash = Math.floor(this.t / 14) % 2;
    ctx.fillStyle = 'rgba(4,2,10,0.96)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, this.tele ? 'WAYSTONE' : this.whole ? 'THE WHOLE CASTLE' : 'CASTLE MAP', W / 2, 2, { align: 'center', scale: 1.5, color: this.tele ? '#9fe8ff' : GOLD });
    const rooms = Object.values(ROOMS).filter(r => S.visited[r.id]), sel = this.focusRoom(), astro = !!S.flags.got_astrolabe;
    const sx = x => W / 2 + (x - this.cam.x) * sc, sy = y => (VIEW_Y0 + VIEW_Y1) / 2 + (y - this.cam.y) * sc;          // (map coordinates -> screen)
    ctx.save(); ctx.beginPath(); ctx.rect(0, VIEW_Y0, W, VIEW_Y1 - VIEW_Y0); ctx.clip(); ctx.translate(W / 2 - this.cam.x * sc, (VIEW_Y0 + VIEW_Y1) / 2 - this.cam.y * sc); ctx.scale(sc, sc);
    // the rooms beside the ones you know, as faint shapes (the Astrolabe)
    if (astro) { const near = new Set(); for (const r of rooms) for (const id of [...r.exits.map(e => e.room), ...r.doors.map(d => d.room)]) if (id && ROOMS[id] && !S.visited[id]) near.add(id);
      for (const id of near) { const q = rect(ROOMS[id]); ctx.fillStyle = 'rgba(120,110,150,0.22)'; ctx.fillRect(q.x, q.y, q.w, q.h); ctx.strokeStyle = 'rgba(180,170,210,0.35)'; ctx.strokeRect(q.x + 0.5, q.y + 0.5, q.w - 1, q.h - 1); } }
    // the rooms: each filled in its zone's colour, a bright wall with gaps where it opens on a neighbour, and the marks of what it holds
    for (const r of rooms) {
      const q = rect(r), x = q.x, y = q.y, w = q.w, h = q.h, stone = r.spawns.some(sp => sp.type === 'waystone'), shop = r.spawns.some(sp => sp.type === 'shopkeeper'), lit = S.flags['tp_' + r.id], zc = ZCOL[r.zone] || '#555555';
      const base = r.save ? '#5a1010' : stone ? (lit ? '#0c5a5a' : '#0a3a44') : shade(zc, 0.42), grid = r.save ? '#8a2020' : stone ? '#1a8a8a' : shade(zc, 0.7);
      ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
      if (sc > 0.6) { ctx.fillStyle = grid; for (let i = 1; i < q.cw; i++) ctx.fillRect(x + i * CELL_W, y, 1, h); for (let j = 1; j < q.ch; j++) ctx.fillRect(x, y + j * CELL_H, w, 1); }
      const gaps = { L: new Set(), R: new Set() }; for (const e of r.exits) if (gaps[e.side]) gaps[e.side].add(Math.floor(clamp(((e.from + e.to) / 2) / r.h, 0, 0.999) * q.ch));
      ctx.fillStyle = '#d6defa'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
      for (let j = 0; j < q.ch; j++) { if (!gaps.L.has(j)) ctx.fillRect(x, y + j * CELL_H, 1, CELL_H); if (!gaps.R.has(j)) ctx.fillRect(x + w - 1, y + j * CELL_H, 1, CELL_H); }
      for (const d of r.doors) {                                                       // a door: a small mark where it really is in the room (gold; light blue for a one-way door; violet for the Keeper's)
        const tx = Math.round(x + clamp((d.x + 0.5) / r.w, 0.04, 0.96) * w), ty = Math.round(y + clamp(d.gy / r.h, 0.1, 0.96) * h) - 2, one = d.tag === 'out', kp = ROOMS[d.room] && ROOMS[d.room].spawns.some(sp => sp.type === 'shopkeeper');
        ctx.fillStyle = '#05030a'; ctx.fillRect(tx - 1, ty - 1, 4, 5); ctx.fillStyle = kp ? '#c8a0ff' : one ? '#7fd8ff' : '#e8b84a'; ctx.fillRect(tx, ty, 2, 3); }
      if (stone) { const cx = x + w / 2, cy = y + h / 2; ctx.fillStyle = lit ? '#e8ffff' : '#6a9aaa'; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 3, 2, 6); ctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 1, 6, 2); }
      if (shop) { const cx = x + w / 2, cy = y + h / 2; ctx.fillStyle = '#c8a0ff'; ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4); ctx.fillStyle = '#2a1646'; ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2); }
      if (r.boss) { const done = S.flags['boss_' + r.id]; icon(ctx, 'skull', x + w / 2, y + h / 2, 0.6, done ? 0.4 : 1); }
    }
    // where you are: a pulsing pip at your very spot in your room
    const here = ROOMS[g.room.id]; if (here && S.visited[here.id]) { const q = rect(here), px = q.x + clamp(g.player.x / g.room.pw, 0, 1) * q.w, py = q.y + clamp(g.player.y / g.room.ph, 0, 1) * q.h; ctx.fillStyle = '#05030a'; ctx.fillRect(Math.round(px) - 3, Math.round(py) - 3, 6, 6); ctx.fillStyle = flash ? '#ffffff' : '#ffe08a'; ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, 4, 4); }
    // treasure left behind (the Astrolabe)
    let left = 0;
    if (astro) for (const r of rooms) { const q = rect(r);
      for (const sp of r.spawns) { const o = sp.o || {}; if (o.secret) continue; if (!((sp.type === 'upgrade' && !S.flags[o.id]) || (sp.type === 'chest' && !S.flags[o.id + '_u']))) continue; left++;
        const mx = Math.round(q.x + (sp.x + 0.5) / r.w * q.w), my = Math.round(q.y + (sp.y - 0.5) / r.h * q.h), pulse = Math.floor(this.t / 14) % 2;
        ctx.fillStyle = '#05030a'; ctx.fillRect(mx - 3, my - 1, 7, 3); ctx.fillRect(mx - 1, my - 3, 3, 7); ctx.fillStyle = pulse ? '#ffe9a0' : '#e8b84a'; ctx.fillRect(mx - 2, my, 5, 1); ctx.fillRect(mx, my - 2, 1, 5); ctx.fillRect(mx - 1, my - 1, 3, 3); } }
    this.left = left;
    // the selected room: a bright frame, and gold lines to where its doors and openings lead
    const links = [];
    if (sel && !this.tele) {
      const sq = rect(sel), a = (q, rm, row) => q.y + Math.floor(clamp(row / rm.h, 0, 0.999) * q.ch) * CELL_H + (CELL_H >> 1);
      for (const e of sel.exits) { const t = ROOMS[e.room]; if (!t) continue; const tq = rect(t), right = e.side === 'R', seen = !!S.visited[t.id]; links.push({ id: t.id, seen, x0: right ? sq.x + sq.w : sq.x, y0: a(sq, sel, (e.from + e.to) / 2), x1: right ? tq.x : tq.x + tq.w, y1: seen ? tq.y + tq.h / 2 : a(sq, sel, (e.from + e.to) / 2), kind: 'open' }); }
      for (const d of sel.doors) { const t = ROOMS[d.room]; if (!t) continue; const tq = rect(t), seen = !!S.visited[t.id], tx = sq.x + clamp((d.x + 0.5) / sel.w, 0.04, 0.96) * sq.w, ty = sq.y + clamp(d.gy / sel.h, 0.1, 0.96) * sq.h - 1; links.push({ id: t.id, seen, x0: tx, y0: ty, x1: tq.x + tq.w / 2, y1: tq.y + tq.h / 2, kind: d.tag === 'out' ? 'oneway' : 'door' }); }
      for (const l of links) { ctx.strokeStyle = l.kind === 'oneway' ? '#7fd8ff' : '#ffd860'; ctx.lineWidth = 1 / Math.max(sc, 0.5); ctx.setLineDash(l.seen ? [] : [2, 2]); ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x1, l.y1); ctx.stroke(); ctx.setLineDash([]);
        if (l.seen) { const tq = rect(ROOMS[l.id]); ctx.strokeStyle = l.kind === 'oneway' ? '#7fd8ff' : '#ffd860'; ctx.strokeRect(tq.x - 1.5, tq.y - 1.5, tq.w + 3, tq.h + 3); } }
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 0.2); ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`; ctx.lineWidth = 1.5 / Math.max(sc, 0.5); ctx.strokeRect(sq.x - 2, sq.y - 2, sq.w + 4, sq.h + 4);
    }
    if (this.tele) for (let i = 0; i < this.stones.length; i++) {       // brackets round every attuned waystone; the chosen one pulses
      const r = ROOMS[this.stones[i]]; if (!r) continue; const q = rect(r), on = i === this.sel, pad = on ? 3 + (Math.floor(this.t / 8) % 2) : 2;
      ctx.strokeStyle = on ? '#bff4ff' : (r.id === this.here ? '#ffffff' : '#4aa8c8'); ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(q.x - pad + 0.5, q.y - pad + 0.5, q.w + pad * 2 - 1, q.h + pad * 2 - 1);
    }
    ctx.restore();
    // the zones' names, written over their rooms (in screen space, so they stay readable at any zoom)
    ctx.save(); ctx.beginPath(); ctx.rect(0, VIEW_Y0, W, VIEW_Y1 - VIEW_Y0); ctx.clip();
    const zb = {}; for (const r of rooms) { const q = rect(r), z = zb[r.zone] || (zb[r.zone] = { x0: 1e9, y0: 1e9, x1: -1e9 }); z.x0 = Math.min(z.x0, q.x); z.y0 = Math.min(z.y0, q.y); z.x1 = Math.max(z.x1, q.x + q.w); }
    for (const [z, b] of Object.entries(zb)) { const name = ZONES[z] ? ZONES[z].name.toUpperCase() : ''; const x = Math.round(sx((b.x0 + b.x1) / 2)), y = Math.round(sy(b.y0)) - 9; if (x < -80 || x > W + 80 || y < VIEW_Y0 - 8 || y > VIEW_Y1) continue; drawText(ctx, name, x, y, { align: 'center', color: ZCOL[z] ? shade(ZCOL[z], 1.7) : '#aaa', outline: '#000' }); }
    ctx.restore();
    if (this.tele) {
      const id = this.stones[this.sel], r = id && ROOMS[id];
      if (this.stones.length < 2) drawText(ctx, 'NO OTHER WAYSTONE IS ATTUNED YET', W / 2, H - 38, { align: 'center', color: PALE });
      else if (r) { drawText(ctx, (ZONES[r.zone].name + ' - ' + r.name).toUpperCase(), W / 2, H - 40, { align: 'center', color: '#bff4ff', scale: 1.2 }); drawText(ctx, id === this.here ? 'YOU ARE HERE' : (this.sel + 1) + ' / ' + this.stones.length, W / 2, H - 28, { align: 'center', color: DIM }); }
      drawText(ctx, Input.touchOn ? 'PAD LEFT / RIGHT CHOOSE     JUMP = TRAVEL     HIT = CANCEL' : 'LEFT / RIGHT CHOOSE     ENTER TRAVEL     ESC CANCEL', W / 2, H - 12, { align: 'center', color: PALE });
      return;
    }
    // the panel: what the cursor rests on, what it holds, where it leads
    ctx.fillStyle = 'rgba(14,9,28,0.95)'; ctx.fillRect(0, VIEW_Y1 + 2, W, H - VIEW_Y1 - 2); ctx.fillStyle = '#3a2f4a'; ctx.fillRect(0, VIEW_Y1 + 2, W, 1);
    if (sel) {
      const zc = ZCOL[sel.zone] || '#888', onHere = sel.id === g.room.id, tags = [];
      if (sel.boss) tags.push(S.flags['boss_' + sel.id] ? 'BOSS DEFEATED' : 'BOSS'); if (sel.save) tags.push('SAVE'); if (sel.spawns.some(sp => sp.type === 'waystone')) tags.push(S.flags['tp_' + sel.id] ? 'WAYSTONE (ATTUNED)' : 'WAYSTONE'); if (sel.spawns.some(sp => sp.type === 'shopkeeper')) tags.push('THE KEEPER SELLS HERE');
      drawText(ctx, ZONES[sel.zone].name.toUpperCase(), 8, VIEW_Y1 + 5, { color: shade(zc, 1.8) }); drawText(ctx, (sel.name + (onHere ? '   (YOU ARE HERE)' : '')).toUpperCase(), 8, VIEW_Y1 + 15, { color: '#ffffff', scale: 1.15 });
      if (tags.length) drawText(ctx, tags.join('   '), 8, VIEW_Y1 + 28, { color: '#e8c872' });
      const dest = [...new Set(links.filter(l => l.seen).map(l => ROOMS[l.id].name))].slice(0, 4), unk = links.filter(l => !l.seen).length;
      const lead = (dest.length ? 'LEADS TO: ' + dest.join(', ').toUpperCase() : '') + (unk ? (dest.length ? '   +' : '') + unk + ' UNEXPLORED' : ''); if (lead) wrapText(lead, W - 16, 1).slice(0, 2).forEach((ln, i) => drawText(ctx, ln, 8, VIEW_Y1 + 38 + i * 9, { color: '#9fb0e8' }));
    }
    const sec = secretStats(g);
    if (astro) drawText(ctx, left ? `ASTROLABE: ${left} TREASURE${left === 1 ? '' : 'S'} LEFT (GOLD DIAMONDS)` : 'ASTROLABE: NO TREASURE LEFT IN ROOMS YOU HAVE SEEN', W / 2, 15, { align: 'center', color: '#e8c872' });
    drawText(ctx, `ROOMS ${Object.keys(S.visited).length}/${Object.keys(ROOMS).length}   SECRETS ${sec.found}/${sec.total}`, W - 8, VIEW_Y1 + 5, { align: 'right', color: PALE });
    drawText(ctx, 'GOLD DOOR   BLUE ONE-WAY   VIOLET KEEPER   RED SAVE   CYAN WAYSTONE', W / 2, H - 20, { align: 'center', color: '#6a6078' });
    drawText(ctx, Input.touchOn ? 'PAD MOVES THE CURSOR     JUMP: WHOLE CASTLE / DETAIL     MAP CLOSES' : 'ARROWS MOVE THE CURSOR     X: WHOLE CASTLE / DETAIL     M OR ESC CLOSES', W / 2, H - 10, { align: 'center', color: DIM });
  }
}

// ---------------------------------------------------------------------------------------------- story screens
const introText = () => dlines('intro') || INTRO;          // (read from assets/dialogue.txt; the list below is only used if it is missing there)
const INTRO = [
  'FOR A HUNDRED YEARS THE SUN HAS NOT RISEN OVER BOHEMIA.',
  'IT WAS TAKEN BY THE LORD OF ARX NOCTIS, WHO WALLED THE DAWN BEHIND HIS THRONE.',
  'THOSE WHO ENTERED NEVER RETURNED. THEIR PORTRAITS STILL WATCH THE HALLS.',
  'YOU HAVE NO NAME. ONLY A CLOAK, A BLADE, AND A DEBT THE DARKNESS OWES.',
  'TONIGHT THE DEAD WALK THE STREETS OF PRAGUE. THE GATE OF THE KEEP STANDS OPEN.',
  'THE STORM IS WAITING.',
];
export class IntroCrawl {
  constructor(g) { this.g = g; this.t = 0; this.i = 0; this.chars = 0; this.hold = 0; this.done = false; }
  update() {
    this.t++; const line = introText()[this.i];
    if (this.chars < line.length) this.chars += 0.7; else { this.hold++; if (this.hold > 150) this.next(); }
    if (Input.pressed.confirm || Input.pressed.attack) { if (this.chars < line.length) this.chars = line.length; else this.next(); }
    if (Input.pressed.pkey || Input.pressed.esc) this.g.beginPlay();
  }
  next() { this.i++; this.chars = 0; this.hold = 0; if (this.i >= introText().length) this.g.beginPlay(); }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); const l = introText()[Math.min(this.i, introText().length - 1)];
    const SC = 1.3, rows = wrapText(l, 330, SC, 'body'), y0 = H / 2 - rows.length * 8;
    rows.reduce((y, row, k, arr) => { const n = Math.max(0, Math.floor(this.chars) - arr.slice(0, k).join(' ').length - (k ? 1 : 0)); drawText(ctx, row.slice(0, n), W / 2 - textWidth(row, SC, 'body') / 2, y, { color: PALE, outline: '#000', scale: SC, font: 'body' }); return y + 16; }, y0);
    drawText(ctx, Input.touchOn ? 'TAP TO CONTINUE   II TO SKIP' : 'ENTER TO CONTINUE   ESC TO SKIP', W / 2, H - 12, { align: 'center', color: '#5a4a6a' });
  }
}

export class GameOver {
  constructor(g) { this.g = g; this.t = 0; this.menu = new Menu([{ label: 'CONTINUE FROM LAST SAVE', action: () => g.respawn() }, { label: 'QUIT TO TITLE', action: () => g.toTitle() }]); }
  update() { this.t++; if (this.t > 80) this.menu.update(this.g); }
  draw(ctx) {
    const a = clamp(this.t / 70, 0, 1); ctx.fillStyle = `rgba(10,0,4,${a * 0.9})`; ctx.fillRect(0, 0, W, H);
    if (this.t > 30) drawText(ctx, 'YOU DIED', W / 2, 62, { align: 'center', scale: 4, color: '#b01a2a', outline: '#000', alpha: clamp((this.t - 30) / 50, 0, 1) });
    if (this.t > 80) { this.menu.draw(ctx, W / 2, 120, 16); }
  }
}

export class Ending {
  constructor(g) { this.g = g; this.t = 0; this.menu = null; this.cr = null; }
  // after the ending, CONTINUE rolls the credits (credits.txt) over the dawn; the ending music goes on playing underneath.  UP / DOWN speed it up, ESC leaves.  At the end: back to the title.
  startCredits() { this.menu = null; loadCredits(this.cr = { lines: null, scroll: -(H - 24 - 14), t: 0, done: false }); A.sfx('select'); }
  update() {
    this.t++;
    if (this.cr) {
      const c = this.cr; c.t++;
      if (c.lines && !c.done) { c.scroll += Input.held.down ? 1.6 : Input.held.up ? -0.6 : 0.32; c.scroll = Math.max(-(H - 38), c.scroll); if (c.scroll > c.lines.height + 24) { c.done = true; this.menu = new Menu([{ label: 'RETURN TO TITLE', action: () => this.g.toTitle() }]); } }
      if (Input.pressed.esc || (!c.done && Input.taps.length)) { this.g.toTitle(); return; } if (this.menu) this.menu.update(this.g); return;
    }
    if (this.t > 780 && !this.menu) this.menu = new Menu([{ label: 'CONTINUE', action: () => this.startCredits() }]); if (this.menu) this.menu.update(this.g);
  }
  draw(ctx) {
    const t = this.t, g = this.g, S = g.save; const a = clamp(t / 240, 0, 1);
    // THE HILL ABOVE PRAGUE AT DAWN: the sky warms from violet to gold, the sun climbs from behind the mountains and the city, and the light spreads over the hill
    const lerp3 = (A, B, C, k) => { const p = k < 0.5 ? [A, B, k * 2] : [B, C, (k - 0.5) * 2]; return p[0].map((v, i) => Math.round(v + (p[1][i] - v) * p[2])); };
    const k = easeOut(clamp((t - 40) / 520, 0, 1)), top = lerp3([22, 14, 44], [120, 72, 120], [255, 214, 150], k), bot = lerp3([54, 28, 66], [236, 122, 78], [255, 236, 180], k), hz = 158;
    const grd = ctx.createLinearGradient(0, 0, 0, hz); grd.addColorStop(0, `rgb(${top})`); grd.addColorStop(1, `rgb(${bot})`); ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    const sx = Math.round(W * 0.84), sy = hz + 30 - k * 128;                                              // (it rises behind the mountains and the city)
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 150); halo.addColorStop(0, `rgba(255,236,170,${0.75 * k})`); halo.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgb(255,${Math.round(236 + 14 * k)},${Math.round(170 + 70 * k)})`; ctx.beginPath(); ctx.arc(sx, sy, 20 + k * 8, 0, Math.PI * 2); ctx.fill();
    const strip = (img, y, sc = 1) => { if (img) for (let x = 0; x < W; x += img.width * sc) ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(img.width * sc), Math.round(img.height * sc)); };
    strip(IMG.dusk_far, hz - (IMG.dusk_far ? IMG.dusk_far.height : 0) + 36); strip(IMG.dusk_mountains, hz - (IMG.dusk_mountains ? IMG.dusk_mountains.height : 0) + 40); strip(IMG.town_mid, hz - (IMG.town_mid ? IMG.town_mid.height * 0.5 : 0) + 6, 0.5);          // (the city, far off and small, so the sun can climb above its roofs)
    ctx.fillStyle = `rgba(255,170,90,${0.3 * k})`; ctx.fillRect(0, 0, W, H); const gl = ctx.createLinearGradient(0, hz - 50, 0, hz + 10); gl.addColorStop(0, 'rgba(255,200,120,0)'); gl.addColorStop(1, `rgba(255,210,130,${0.45 * k})`); ctx.fillStyle = gl; ctx.fillRect(0, hz - 50, W, 60);          // (morning light on the roofs)
    const hill = `rgb(${Math.round(10 + 70 * k)},${Math.round(6 + 56 * k)},${Math.round(18 + 22 * k)})`; ctx.fillStyle = hill; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, 150); ctx.quadraticCurveTo(70, 140, 150, 160); ctx.quadraticCurveTo(250, 182, W, 172); ctx.lineTo(W, H); ctx.fill();          // the hill, lit from the sun's side as the day comes
    ctx.strokeStyle = `rgba(255,226,150,${0.7 * k})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 150.5); ctx.quadraticCurveTo(70, 140.5, 150, 160.5); ctx.quadraticCurveTo(250, 182.5, W, 172.5); ctx.stroke();
    if (t > 200) { const k = clamp((t - 200) / 60, 0, 1); drawText(ctx, STORY.ending.title, W / 2, 30, { align: 'center', scale: 2, color: '#fff0b0', outline: '#3a1008', alpha: k }); }
    STORY.ending.lines.map((txt, i) => [txt, 50 + i * 12, 330 + i * 40]).forEach(([txt, yy, t0]) => { if (t > t0) drawText(ctx, txt, W / 2, yy, { align: 'center', scale: 1.15, color: '#3a1008', alpha: clamp((t - t0) / 60, 0, 1) }); });
    if (t > 560) { const k = clamp((t - 560) / 60, 0, 1), sec = secretStats(g); panel(ctx, 96, 104, W - 192, 70, 0.8 * k); ctx.globalAlpha = k; drawText(ctx, `TIME ${fmtTime(S.time)}    LEVEL ${S.level}`, W / 2, 109, { align: 'center', color: PALE }); drawText(ctx, `FOES SLAIN ${g.kills + (S.kills || 0)}    ITEMS ${g.itemPercent()}%`, W / 2, 121, { align: 'center', color: PALE }); drawText(ctx, `SECRETS FOUND ${sec.found} / ${sec.total}`, W / 2, 133, { align: 'center', color: sec.found === sec.total && sec.total ? GOLD : PALE }); drawText(ctx, 'THANK YOU FOR PLAYING', W / 2, 155, { align: 'center', color: GOLD }); ctx.globalAlpha = 1; }
    if (t > 300) {                                                                    // the hill above Prague, in the sunlight: the Stranger kneels at her grave - and she is beside him, seen at last without any blue light
      const hk = SHEET.hero_crouch_cw ? 'hero_crouch_cw' : 'hero_crouch', fa = clamp((t - 300) / 60, 0, 1), ga = clamp((t - 480) / 120, 0, 1);
      ctx.fillStyle = '#0a0612'; ctx.beginPath(); ctx.moveTo(34, 169); ctx.lineTo(34, 150); ctx.quadraticCurveTo(41, 141, 48, 150); ctx.lineTo(48, 169); ctx.fill();
      drawSheet(ctx, hk, 0, 68, 169, { dir: -1, alpha: fa });
      drawSheet(ctx, 'ghost_lady', Math.floor(t / 10) % 7, 94, 169, { dir: -1, alpha: ga * 0.92 });
    }
    if (this.cr) {
      const c = this.cr, top = 24, view = H - top - 14; ctx.fillStyle = 'rgba(6,4,14,0.97)'; ctx.fillRect(0, 0, W, H);
      if (!c.done) { drawCreditLines(ctx, c, top, view); const f1 = ctx.createLinearGradient(0, top, 0, top + 18); f1.addColorStop(0, 'rgba(6,4,14,1)'); f1.addColorStop(1, 'rgba(6,4,14,0)'); ctx.fillStyle = f1; ctx.fillRect(0, top, W, 18); const f2 = ctx.createLinearGradient(0, H - 30, 0, H - 14); f2.addColorStop(0, 'rgba(6,4,14,0)'); f2.addColorStop(1, 'rgba(6,4,14,1)'); ctx.fillStyle = f2; ctx.fillRect(0, H - 30, W, 16); }
      else { const k = clamp((c.t - 0) / 60, 0, 1); drawText(ctx, 'THANK YOU FOR PLAYING', W / 2, H / 2 - 22, { align: 'center', scale: 1.6, color: GOLD, outline: '#000', font: 'hand' }); }
      if (!c.done) drawText(ctx, Input.touchOn ? 'TAP TO LEAVE' : 'DOWN SPEEDS UP     ESC LEAVES', W / 2, H - 12, { align: 'center', color: DIM });
    }
    if (this.menu) this.menu.draw(ctx, W / 2, this.cr ? H / 2 + 4 : H - 38, 14);
  }
}
