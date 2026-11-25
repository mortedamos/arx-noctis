// THE PIXEL ART OF THE GLACIAL LATTICE (the beam-and-lens puzzle room, puzzleprops.js): drawn once, in code, with procart's pixel painter - no anti-aliasing, shaded and outlined like the other sprites.
import { Px } from './procart.js';

const hex = (h, a = 255) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]; };
const OUT = hex('#0a0810');
const sprite = (w, h, fn) => { const p = new Px(w, h); fn(p); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(p.d, w, h), 0, 0); return c; };
const rnd = seed => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const oval = (p, cx, cy, rx, ry, col) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) p.set(x, y, typeof col === 'function' ? col(x, y) : col); };

// ---- the brazier the beam comes from: a brass-lipped iron bowl cut with glowing runes, on a twisted stem and three clawed feet
function brazier(p) {
  const IRON = hex('#2b2c40'), MID = hex('#474a6c'), LIT = hex('#9096c0'), BRASS = hex('#a8783a'), BRASS2 = hex('#e8c068'), EMB = hex('#ff7a22'), EMB2 = hex('#ffd860');
  p.line(16, 55, 5, 67, IRON, 2); p.line(18, 55, 29, 67, IRON, 2); p.line(17, 55, 17, 68, IRON, 3); p.line(16, 56, 7, 65, MID, 1);
  for (const x of [5, 29]) { p.rect(x - 3, 67, 7, 2, MID); for (const k of [-3, 0, 3]) p.set(x + k, 69, LIT); }
  p.rect(14, 68, 7, 2, MID); for (const k of [14, 17, 20]) p.set(k, 70, LIT);
  p.disc(17, 54, 4, MID); p.disc(16, 53, 1.5, LIT);
  p.rect(15, 20, 5, 33, IRON); for (let y = 21; y < 52; y += 4) { p.line(15, y + 3, 19, y, MID, 1); p.set(19, y, LIT); }
  p.disc(17, 36, 3.5, BRASS); p.disc(16, 35, 1.3, BRASS2); p.disc(17, 19, 4.5, MID); p.disc(16, 18, 1.5, LIT);
  p.line(15, 23, 8, 15, IRON, 2); p.line(19, 23, 26, 15, IRON, 2); p.disc(8, 15, 2, BRASS); p.disc(26, 15, 2, BRASS); p.set(8, 14, BRASS2); p.set(26, 14, BRASS2);
  p.poly([[1, 4], [34, 4], [29, 12], [23, 17], [12, 17], [6, 12]], IRON);
  p.poly([[3, 5], [13, 5], [13, 15], [8, 11]], MID);
  p.rect(0, 2, 35, 3, BRASS); p.rect(0, 2, 35, 1, BRASS2); for (let x = 3; x < 33; x += 5) p.set(x, 3, hex('#5a3d18'));
  for (let x = 9; x < 27; x += 5) { p.line(x, 8, x + 2, 11, EMB, 1); p.line(x + 2, 8, x, 11, EMB, 1); p.set(x + 1, 9, EMB2); }
  for (let x = 3; x < 31; x += 2) p.rect(x, x % 6 < 3 ? 0 : 1, 2, 1, x % 4 < 2 ? EMB : EMB2);
  p.shade(1.15, 0.7); p.outline(OUT);
}

// ---- a lens: a thick brass ring, toothed and riveted like a piece of an instrument, with its glass either CLEAR or grown over with frost
function lens(p, frosted) {
  const cx = 12, cy = 23, BR = hex('#9a6f2c'), BR1 = hex('#c99a45'), BR2 = hex('#f4d98c'), BRD = hex('#5a3f16');
  for (let i = 0; i < 14; i++) { const a = i * Math.PI / 7; p.rect(Math.round(cx + Math.cos(a) * 10 - 1), Math.round(cy + Math.sin(a) * 21 - 1), 3, 3, BR); }          // (the teeth)
  oval(p, cx, cy, 10, 21, (x, y) => (x + y * 0.45 < cx + cy * 0.45 - 6 ? BR1 : x + y * 0.45 > cx + cy * 0.45 + 7 ? BRD : BR));
  oval(p, cx, cy, 8, 19, BRD);
  const R = rnd(97), inside = (x, y) => ((x - cx) / 7) ** 2 + ((y - cy) / 18) ** 2 <= 1, glass = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (inside(x, y)) p.set(x, y, c); };
  if (!frosted) {
    oval(p, cx, cy, 7, 18, (x, y) => (((x - cx) / 7) ** 2 + ((y - cy) / 18) ** 2 > 0.7 ? hex('#c4ecff', 120) : hex('#74b8e8', y < cy ? 54 : 80)));
    for (let k = 0; k < 12; k++) glass(cx - 4 + k * 0.45, cy - 5 - k * 0.9, hex('#ffffff', 215));          // (two long glints: you can see straight through it)
    for (let k = 0; k < 7; k++) glass(cx - 1 + k * 0.5, cy - 4 - k, hex('#ffffff', 150));
    for (let k = 0; k < 6; k++) glass(cx + 2 + k * 0.3, cy + 12 - k, hex('#ffffff', 130));
  } else {
    oval(p, cx, cy, 7, 18, (x, y) => (y < cy - 5 ? hex('#87a9c8', 250) : y < cy + 7 ? hex('#6e92b4', 250) : hex('#577a9e', 250)));
    const fern = (x, y, a, len, depth) => {          // frost: a stem with side shoots, growing in from the rim
      for (let k = 0; k < len; k++) { const px = x + Math.cos(a) * k, py = y + Math.sin(a) * k; glass(px, py, depth > 1 ? hex('#bcd8ee') : depth ? hex('#e2f2ff') : hex('#ffffff')); if (depth < 2 && k > 1 && k % 3 === 0) { fern(px, py, a - 1.0, Math.max(2, len / 2 - k / 4), depth + 1); fern(px, py, a + 1.0, Math.max(2, len / 2 - k / 4), depth + 1); } }
    };
    for (const [x, y, a, n] of [[6, 10, 0.9, 11], [18, 17, 2.7, 10], [6, 31, -0.5, 12], [17, 37, -2.2, 11], [12, 41, -1.5, 12], [12, 6, 1.7, 9]]) fern(x, y, a, n, 0);
    for (let k = 0; k < 40; k++) glass(cx - 7 + R() * 14, cy - 18 + R() * 36, R() < 0.5 ? hex('#ffffff') : hex('#4a6a8c'));
  }
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; const x = Math.round(cx + Math.cos(a) * 8.8), y = Math.round(cy + Math.sin(a) * 19.8); p.set(x, y, BR2); p.set(x + 1, y + 1, BRD); }          // (rivets)
  for (const y of [0, 43]) { p.rect(cx - 2, y, 5, 3, BR1); p.rect(cx - 1, y, 3, 1, BR2); }          // (finials, top and bottom)
  for (const x of [0, 21]) { p.rect(x, cy - 1, 3, 3, BR1); p.set(x + 1, cy - 1, BR2); }          // (the side pins it swings on)
  p.outline(OUT);
}

// ---- a cluster of three crystals: cold and blue, or burning with the light that strikes it
function crystal(p, lit) {
  const [D, M, L, H, E] = (lit ? ['#b0621c', '#ee9c34', '#ffd070', '#fffbe0', '#4a2408'] : ['#22406c', '#3d6aa4', '#7ab4e0', '#e4f8ff', '#0e1a30']).map(c => hex(c));
  // the two side shards
  p.poly([[2, 11], [7, 15], [9, 28], [4, 28], [1, 18]], M); p.poly([[2, 11], [4, 17], [4, 28], [1, 18]], D); p.line(2, 11, 4, 17, L, 1); p.line(4, 17, 4, 27, L, 1);
  p.poly([[23, 8], [25, 17], [21, 28], [16, 28], [18, 14]], D); p.poly([[23, 8], [22, 17], [20, 28], [16, 28], [18, 14]], M); p.line(23, 8, 22, 17, H, 1); p.line(22, 17, 20, 27, L, 1);
  // the great one: a six-sided point
  p.poly([[13, 0], [19, 8], [19, 26], [13, 29], [7, 26], [7, 8]], M);
  p.poly([[7, 8], [11, 11], [11, 29], [7, 26]], D); p.poly([[16, 11], [19, 8], [19, 26], [16, 29]], L); p.poly([[13, 0], [19, 8], [16, 11], [11, 11], [7, 8]], L); p.poly([[13, 1], [11, 11], [7, 8]], H);
  p.line(11, 11, 11, 28, L, 1); p.line(16, 11, 16, 28, H, 1); p.line(13, 1, 16, 11, H, 1); p.line(11, 11, 16, 11, H, 1);
  p.line(13, 14, 14, 18, H, 1); p.set(9, 22, L); p.set(14, 23, H); if (lit) { p.line(12, 13, 15, 21, H, 2); p.disc(13, 17, 1.6, H); }
  p.outline(E);
}

// ---- the node that must not be struck: a black stone gripped in an iron claw (red and cracking when the beam finds it)
function node(p, hot) {
  const c = 16, IRON = hex('#34364c'), LIT = hex('#8a8fb4'), TIP = hex('#c99a45');
  oval(p, c, c, 9, 9, (x, y) => { const d = Math.hypot(x - (c - 3), y - (c - 3)); return hot ? (d < 3 ? hex('#fff0b0') : d < 7 ? hex('#ff7a30') : d < 11 ? hex('#d62c1c') : hex('#7a1010')) : (d < 2 ? hex('#9a86b8') : d < 6 ? hex('#3a2a50') : d < 11 ? hex('#20152e') : hex('#100a18')); });
  const crack = hot ? hex('#fff4c0') : hex('#7a2430');
  for (const [a, b, x, y] of [[16, 12, 19, 17], [19, 17, 17, 22], [19, 17, 23, 18], [12, 18, 15, 21], [11, 13, 15, 15]]) p.line(a, b, x, y, crack, 1);
  for (const s of [-1, 1]) {          // the claws, curling round it from below
    const X = v => c + s * v;
    p.line(X(3), 30, X(10), 25, IRON, 3); p.line(X(10), 25, X(12), 17, IRON, 3); p.line(X(12), 17, X(10), 9, IRON, 2); p.line(X(10), 9, X(5), 5, IRON, 2); p.line(X(11), 16, X(9), 9, LIT, 1);
    p.line(X(5), 5, X(3), 8, TIP, 2); p.line(X(12), 19, X(15), 17, TIP, 1); p.line(X(10), 25, X(14), 27, TIP, 1);
  }
  p.rect(c - 5, 29, 11, 3, IRON); p.rect(c - 5, 29, 11, 1, LIT); p.line(c, 0, c, 4, IRON, 2); p.set(c, 0, TIP);
  p.outline(OUT);
}

// ---- the node's pillar: stone bound in ice, with a capital, fluting and cold runes
function pillar(p) {
  const S = hex('#3c4a66'), SL = hex('#6a7ea4'), SD = hex('#232c42'), ICE = hex('#cfeeff'), RUNE = hex('#7fe0ff');
  const h = p.h;
  p.rect(2, 0, 18, 3, SL); p.rect(4, 3, 14, 4, S); p.rect(6, 7, 10, h - 17, S); p.rect(6, 7, 2, h - 17, SL); p.rect(14, 7, 2, h - 17, SD); p.rect(11, 7, 1, h - 17, SD);
  p.rect(4, h - 10, 14, 4, S); p.rect(2, h - 6, 18, 6, S); p.rect(2, h - 6, 18, 1, SL); p.rect(2, h - 2, 18, 2, SD);
  for (const y of [15, 29, 43]) { if (y + 8 > h - 12) break; p.line(9, y, 12, y + 3, RUNE, 1); p.line(12, y + 3, 9, y + 6, RUNE, 1); p.line(12, y, 12, y + 7, RUNE, 1); }          // (chevrons on a stave)
  for (const [x, n] of [[3, 5], [6, 3], [10, 6], [15, 4], [18, 6]]) { for (let k = 0; k < n; k++) p.set(x, 3 + k, k > n - 2 ? hex('#ffffff') : ICE); }
  p.shade(1.12, 0.78); p.outline(OUT);
}

// ---- behind it all: the LATTICE - two frosted iron posts, a girder, diamond bracing, curved braces and icicles
function frame(p) {
  const W = p.w, H = p.h, I = hex('#2e4266'), IL = hex('#5f84b4'), ICE = hex('#a8dcf8'), WH = hex('#eefaff');
  const R = rnd(41);
  for (let x = 6; x < W - 20; x += 24) { p.line(x, 6, x + 24, 28, I, 2); p.line(x + 24, 6, x, 28, I, 2); p.line(x + 1, 6, x + 25, 28, IL, 1); p.disc(x + 12, 17, 2, IL); }          // (the bracing)
  p.rect(0, 28, W, 2, I); p.rect(0, 28, W, 1, IL);
  p.rect(0, 0, W, 6, I); p.rect(0, 0, W, 1, IL); for (let x = 4; x < W; x += 12) { p.set(x, 3, IL); p.set(x + 1, 3, IL); }          // (the girder and its rivets)
  for (const [x, s] of [[0, 1], [W - 7, -1]]) {
    p.rect(x, 0, 7, H, I); p.rect(x, 0, 2, H, IL); for (let y = 34; y < H - 4; y += 14) { p.disc(x + 3, y, 1.5, IL); p.set(x + 3, y - 1, WH); }
    const edge = x + (s > 0 ? 7 : -1); for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI / 2; p.rect(Math.round(edge + s * (34 - Math.cos(a) * 34)), Math.round(30 + 34 - Math.sin(a) * 34), 2, 2, I); }          // (a curved brace into the corner)
    for (let k = 0; k < 90; k++) { const dx = R() * 16, dy = R() * R() * 26; p.set(Math.round(x + 3 + s * dx), Math.round(H - 1 - dy * (1 - dx / 18)), R() < 0.7 ? ICE : WH); }          // (rime at the foot)
  }
  for (let x = 12; x < W - 12; x += 5 + Math.floor(R() * 8)) {          // icicles under the lower rail (none over the hanging crystal)
    if (Math.abs(x - W * 0.55) < 18) continue; const n = 3 + Math.floor(R() * R() * 15);
    for (let k = 0; k < n; k++) { p.set(x, 30 + k, k > n - 3 ? WH : ICE); if (k < n * 0.55) p.set(x + 1, 30 + k, IL); if (k < n * 0.25) p.set(x - 1, 30 + k, ICE); }
  }
}

let art = null;
export function latticeArt() {
  if (art) return art;
  const lensUp = [sprite(24, 46, p => lens(p, true)), sprite(24, 46, p => lens(p, false))];          // [frosted, clear]
  const flat = c => { const f = document.createElement('canvas'); f.width = c.height; f.height = c.width; const g = f.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(f.width, 0); g.rotate(Math.PI / 2); g.drawImage(c, 0, 0); return f; };          // (the third lies flat: the same lens turned a quarter)
  art = { brazier: sprite(35, 71, brazier), lensUp, lensFlat: lensUp.map(flat), crystal: [false, true].map(on => sprite(27, 30, p => crystal(p, on))), node: [false, true].map(hot => sprite(33, 33, p => node(p, hot))),
    pillar: sprite(22, 66, pillar), frame: sprite(246, 160, frame) };
  return art;
}
