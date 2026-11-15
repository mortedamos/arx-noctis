// THE PAGES - six letters between Wenzel (the Stranger, before he left his name behind) and Zora (the Lady), and one from a friend.  They are plain text files in assets/letters/
// (letter1.txt ... letter6.txt: a few header lines - TITLE, FROM, TO, PLACE, DATE - then a blank line, then the letter), so they can be rewritten without touching the code.
// A page found in the castle is kept in the game's own browser storage as well as in the save, so the LETTERS book on the title screen shows every page ever found.
import { W, H, clamp } from './util.js';
import { drawText, wrapText, hasFace, handText } from './font.js';
import { Input } from './input.js';
import { Audio_ as A } from './audio.js';

export const PAGE_COUNT = 6;
export const PAGE_TITLES = ['THE LEVY', 'THE HOUSE ON THE HILL', 'THE ROAD BACK', 'THE NEWLYWEDS', 'HOMECOMING', 'THE NAME I LEFT'];          // (shown when a page is picked up, before the file has loaded)
const STORE = 'shadowkeep.pages.v1';
const GOLD = '#e8b84a', PALE = '#e8dcc0', DIM = '#8a7d9a';

export function foundPages() { try { return new Set(JSON.parse(localStorage.getItem(STORE) || '[]')); } catch { return new Set(); } }
export function markPage(n) { const s = foundPages(); s.add(n); try { localStorage.setItem(STORE, JSON.stringify([...s])); } catch { /* private mode: the save still has it */ } }

const cache = {};
function parse(text) {
  const out = { title: '', from: '', to: '', place: '', date: '', body: '' }, lines = String(text).replace(/\r/g, '').split('\n'); let i = 0;
  for (; i < lines.length && lines[i].trim() !== ''; i++) { const m = lines[i].match(/^(\w+):\s*(.*)$/); if (m && m[1].toLowerCase() in out) out[m[1].toLowerCase()] = m[2].trim(); }
  out.body = lines.slice(i + 1).join('\n').trim(); return out;
}
export function loadLetter(n) {
  if (cache[n]) return Promise.resolve(cache[n]);
  return fetch(`assets/letters/letter${n}.txt`, { cache: 'no-cache' }).then(r => r.ok ? r.text() : Promise.reject(new Error(r.status))).then(t => (cache[n] = parse(t)))
    .catch(() => (cache[n] = { title: PAGE_TITLES[n - 1] || 'A PAGE', from: '', to: '', place: '', date: '', body: 'The ink has run, and the page cannot be read.' }));
}
export const loadLetters = () => Promise.all(Array.from({ length: PAGE_COUNT }, (_, k) => loadLetter(k + 1)));
export const letterTitle = n => (cache[n] && cache[n].title ? cache[n].title : PAGE_TITLES[n - 1] || 'A PAGE').toUpperCase();

// whose voice a letter is in: Zora writes in the Lady's own hand (the gravestone face), Wenzel in the Stranger's bookhand, anyone else in the plain body face
function voice(from) {
  if (/^zora/i.test(from) && hasFace('hand')) return 'hand';
  if (/^wenzel/i.test(from) && hasFace('stranger')) return 'stranger';
  return hasFace('npc') ? 'npc' : 'mixed';
}
function box(ctx, x, y, w, h) {
  ctx.fillStyle = '#080510'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#6b5a2e'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = '#b8913f'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
}

// ---------------------------------------------------------------------------------------------------------------------------------- reading one letter
export class LetterReader {
  constructor(n, onClose) { this.n = n; this.onClose = onClose || null; this.closed = false; this.t = 0; this.scroll = 0; this.L = cache[n] || null; this.lines = null; if (!this.L) loadLetter(n).then(l => { this.L = l; }); }
  layout() {
    const L = this.L, font = voice(L.from), text = font === 'hand' ? handText(L.body) : L.body, lines = [];
    for (const para of text.split(/\n\s*\n/)) { for (const ln of wrapText(para.replace(/\s*\n\s*/g, ' '), W - 80, 1, font)) lines.push(ln); lines.push(''); }
    this.lines = lines; this.font = font; this.max = Math.max(0, lines.length * 12 - 108);
  }
  update() {
    this.t++; if (this.L && !this.lines) this.layout(); if (!this.lines) return;
    if (Input.held.down) this.scroll += 2; else if (Input.held.up) this.scroll -= 2; this.scroll = clamp(this.scroll, 0, this.max);
    for (const tp of Input.taps) { if (tp.y > H - 56 && this.scroll < this.max) this.scroll = clamp(this.scroll + 60, 0, this.max); else if (tp.y < 70 && this.scroll > 0) this.scroll = clamp(this.scroll - 60, 0, this.max); else if (this.t > 20) this.closed = true; }
    if (this.t > 20 && (Input.pressed.back || Input.pressed.confirm || Input.pressed.pause)) { this.closed = true; A.sfx('back'); }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H); box(ctx, 28, 10, W - 56, H - 20);
    const L = this.L; if (!L) { drawText(ctx, 'LOADING...', W / 2, H / 2, { align: 'center', color: DIM }); return; }
    if (!this.lines) this.layout();
    drawText(ctx, L.title.toUpperCase(), W / 2, 18, { align: 'center', scale: 1.4, color: GOLD, outline: '#000' });
    const who = (L.from && L.to) ? L.from.toUpperCase() + '  TO  ' + L.to.toUpperCase() : '', where = [L.place, L.date].filter(Boolean).join('  -  ').toUpperCase();
    if (who) drawText(ctx, who, W / 2, 34, { align: 'center', color: '#c9b98f' }); if (where) drawText(ctx, where, W / 2, 45, { align: 'center', color: DIM });
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(W / 2 - 60, 57, 120, 1);
    ctx.save(); ctx.beginPath(); ctx.rect(36, 62, W - 72, 112); ctx.clip();
    this.lines.forEach((ln, i) => { const y = 66 + i * 12 - this.scroll; if (ln && y > 58 && y < 172) drawText(ctx, ln, 42, y, { color: '#e9dfc6', font: this.font }); });
    ctx.restore();
    if (this.max > 0) { const th = 112 * (108 / (this.max + 108)), ty = 62 + (112 - th) * (this.scroll / this.max); ctx.fillStyle = '#3a3048'; ctx.fillRect(W - 38, 62, 2, 112); ctx.fillStyle = GOLD; ctx.fillRect(W - 38, Math.round(ty), 2, Math.round(th)); }
    drawText(ctx, this.max > 0 ? 'UP / DOWN READ     ENTER CLOSE' : 'ENTER CLOSE', W / 2, H - 28, { align: 'center', color: DIM });
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------- the book on the title screen
export class LetterBook {
  constructor(onBack) { this.onBack = onBack; this.i = 0; this.reader = null; this.t = 0; this.found = foundPages(); loadLetters(); }
  update() {
    this.t++;
    if (this.reader) { this.reader.update(); if (this.reader.closed) this.reader = null; return; }
    if (Input.pressed.back || Input.pressed.esc) { A.sfx('back'); this.onBack(); return; }
    if (Input.pressed.up) { this.i = (this.i + PAGE_COUNT - 1) % PAGE_COUNT; A.sfx('click'); } if (Input.pressed.down) { this.i = (this.i + 1) % PAGE_COUNT; A.sfx('click'); }
    for (const tp of Input.taps) { const k = Math.floor((tp.y - 56) / 22); if (k >= 0 && k < PAGE_COUNT) { this.i = k; if (this.found.has(k + 1)) this.open(); } else if (tp.y > H - 24) { this.onBack(); return; } }
    if (Input.pressed.confirm && this.found.has(this.i + 1)) this.open();
  }
  open() { A.sfx('page'); this.reader = new LetterReader(this.i + 1); }
  draw(ctx) {
    if (this.reader) { this.reader.draw(ctx); return; }
    ctx.fillStyle = 'rgba(6,4,14,0.95)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'LETTERS', W / 2, 12, { align: 'center', scale: 1.8, color: GOLD, outline: '#000' });
    drawText(ctx, this.found.size + ' OF ' + PAGE_COUNT + ' PAGES FOUND', W / 2, 34, { align: 'center', color: DIM });
    for (let k = 0; k < PAGE_COUNT; k++) {
      const y = 56 + k * 22, has = this.found.has(k + 1), sel = k === this.i, col = !has ? '#4a4258' : sel ? GOLD : PALE;
      box(ctx, 70, y - 3, W - 140, 19); if (sel) { ctx.fillStyle = 'rgba(232,184,74,0.12)'; ctx.fillRect(71, y - 2, W - 142, 17); }
      drawText(ctx, String(k + 1), 82, y + 3, { color: col }); drawText(ctx, has ? letterTitle(k + 1) : '? ? ?', 100, y + 3, { color: col, outline: '#000' });
      if (has) { ctx.fillStyle = '#d8c89a'; ctx.fillRect(W - 96, y + 1, 8, 10); ctx.fillStyle = '#6a5a3a'; for (let r = 0; r < 4; r++) ctx.fillRect(W - 95, y + 3 + r * 2, 6, 1); }
    }
    drawText(ctx, Input.touchOn ? 'TAP A PAGE TO READ IT' : 'UP / DOWN CHOOSE     ENTER READ     ESC BACK', W / 2, H - 14, { align: 'center', color: DIM });
  }
}
