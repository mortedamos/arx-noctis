// Art for the Library of Ink and the Frozen Caverns, drawn in code like the Cistern and the Clockwork Dungeon: tile themes (ground and thin platforms), the ice barrier tile, and the parallax
// backgrounds.  The books and the ice are made of rectangles on purpose: it keeps them in step with the rest of the castle's pixel look, and every colour is one place to change.
import { W, H, T, hash1 } from './util.js';

const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------------------------------------------------------------------------------------------- the Library: tile theme
const SPINES = ['#7a2424', '#24456e', '#2f6a3a', '#6a3a7a', '#8a6a1e', '#4a4a56', '#9a4a2a', '#2a5a62'];
export const LIBRARY_THEME = {
  solid(g, tx, ty, nb, depth) {
    const x = tx * T, y = ty * T, h = hash1(tx * 7.1 + ty * 3.7);
    if (depth === 0) {                                                       // polished floorboards, with brass nails and a bright lip
      g.fillStyle = '#4a2e18'; g.fillRect(x, y, T, T); g.fillStyle = '#74492a'; g.fillRect(x, y, T, 5); g.fillStyle = '#b07a42'; g.fillRect(x, y, T, 1); g.fillStyle = '#8a5a32'; g.fillRect(x, y + 1, T, 1);
      g.fillStyle = '#2a180c'; g.fillRect(x + ((tx & 1) ? 5 : 11), y + 1, 1, 4); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + 5, T, 1);
      if (h < 0.3) { g.fillStyle = '#e0bc58'; g.fillRect(x + 3, y + 2, 1, 1); g.fillRect(x + 13, y + 2, 1, 1); }
      g.fillStyle = '#35210f'; g.fillRect(x, y + 6, T, T - 6);
    } else {                                                                 // dark panelled wood and stone beneath
      g.fillStyle = depth === 1 ? '#2e2016' : (h < 0.5 ? '#271a12' : '#22160f'); g.fillRect(x, y, T, T);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + 1, y + 1, T - 2, 1); g.fillRect(x + 1, y + T - 2, T - 2, 1); g.fillRect(x + 1, y + 1, 1, T - 2); g.fillRect(x + T - 2, y + 1, 1, T - 2);
      g.fillStyle = 'rgba(210,150,80,0.09)'; g.fillRect(x + 2, y + 2, T - 4, 1);
    }
  },
  // a thin platform is a shelf: a plank with a row of book spines hanging under its edge
  plat(g, tx, ty) {
    const x = tx * T, y = ty * T; g.fillStyle = '#6e4626'; g.fillRect(x, y, T, 4); g.fillStyle = '#b07a42'; g.fillRect(x, y, T, 1); g.fillStyle = '#35210f'; g.fillRect(x, y + 4, T, 1);
    for (let i = 0, px = 0; px < T; i++) { const w = 2 + ((hash1(tx * 3.1 + i) * 2) | 0), hh = 4 + ((hash1(tx * 5.3 + i * 1.7) * 4) | 0); g.fillStyle = SPINES[((hash1(tx * 1.3 + i * 4.1) * SPINES.length) | 0) % SPINES.length]; g.fillRect(x + px, y + 5, w, hh); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + px, y + 5, 1, hh); px += w + 1; }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y + 11, T, 2);
  },
};

// ---------------------------------------------------------------------------------------------- the Frozen Caverns: tile theme and the ice barrier
export const ICE_THEME = {
  solid(g, tx, ty, nb, depth) {
    const x = tx * T, y = ty * T, h = hash1(tx * 5.9 + ty * 2.9);
    if (depth === 0) {                                                       // a glassy surface: pale top, a shine, snow in the cracks
      g.fillStyle = '#4a82a8'; g.fillRect(x, y, T, T); g.fillStyle = '#a8def0'; g.fillRect(x, y, T, 3); g.fillStyle = '#eefaff'; g.fillRect(x, y, T, 1);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 2 + ((h * 8) | 0), y + 1, 4, 1); g.fillStyle = '#6aa8c8'; g.fillRect(x, y + 3, T, 2);
      g.fillStyle = '#3a6a90'; g.fillRect(x, y + 5, T, T - 5); if (h > 0.6) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + ((h * 9) | 0), y - 1, 4, 1); }
    } else {
      g.fillStyle = depth === 1 ? '#34628a' : (h < 0.5 ? '#2c5478' : '#264c6e'); g.fillRect(x, y, T, T);
      g.fillStyle = 'rgba(190,235,255,0.16)'; const cx = x + 2 + ((h * 9) | 0); g.fillRect(cx, y, 1, 7); g.fillRect(cx + 1, y + 7, 1, 5); g.fillRect(cx - 1, y + 12, 1, 4);
      if (h < 0.2) { g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + 3, y + 4, 8, 2); }
    }
  },
  plat(g, tx, ty) {                                                          // a slab of ice with icicles under it
    const x = tx * T, y = ty * T; g.fillStyle = '#a8def0'; g.fillRect(x, y, T, 4); g.fillStyle = '#eefaff'; g.fillRect(x, y, T, 1); g.fillStyle = '#5a98bc'; g.fillRect(x, y + 4, T, 2);
    for (const k of [2, 7, 12]) { const l = 3 + ((hash1(tx * 4.1 + k) * 4) | 0); g.fillStyle = '#8acae8'; g.fillRect(x + k, y + 6, 2, l); g.fillStyle = '#c8eefc'; g.fillRect(x + k, y + 6, 1, l - 1); }
  },
};
// the ice barrier: a block of clear blue ice, glints on it, a cold white frame
export function drawIceBlock(g, tx, ty) {
  const x = tx * T, y = ty * T, h = hash1(tx * 3.3 + ty * 8.1);
  g.fillStyle = '#2e6a96'; g.fillRect(x, y, T, T); g.fillStyle = '#5ab0d8'; g.fillRect(x + 1, y + 1, T - 2, T - 2); g.fillStyle = '#8ad4ee'; g.fillRect(x + 2, y + 2, T - 6, T - 6);
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x + 3, y + 3, 2, 7); g.fillRect(x + 3, y + 3, 6, 1); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 8 + ((h * 4) | 0), y + 8, 1, 6);
  g.fillStyle = '#d8f4ff'; g.fillRect(x, y, T, 1); g.fillRect(x, y, 1, T); g.fillStyle = '#1e4a6e'; g.fillRect(x + T - 1, y, 1, T); g.fillRect(x, y + T - 1, T, 1);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 11, y + 11, 1, 1); g.fillRect(x + 12, y + 12, 1, 1);
}

// ---------------------------------------------------------------------------------------------- backgrounds (cached strips, scrolled at their own depth in both directions)
let LIB = null, ICE = null;
// a repeating background strip, softened once when it is built (blurring the whole picture every frame is far too slow).  It is tiled 3 x 3 before the blur so the seams between repeats stay invisible.
function softened(img, px) {
  const w = img.width, h = img.height, big = canvasOf(w * 3, h * 3), b = big.getContext('2d');
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) b.drawImage(img, i * w, j * h);
  const blur = canvasOf(w * 3, h * 3), q = blur.getContext('2d'); q.filter = 'blur(' + px + 'px)'; q.drawImage(big, 0, 0); q.filter = 'none';
  const out = canvasOf(w, h); out.getContext('2d').drawImage(blur, -w, -h); return out;
}
function libraryStrips() {
  if (LIB) return LIB;
  // far: a wall of tall gothic windows with cold moonlight, between stone piers
  const far = canvasOf(240, 192), f = far.getContext('2d');
  f.fillStyle = '#0e0a08'; f.fillRect(0, 0, 240, 192);
  for (let i = 0; i < 2; i++) {
    const x = 20 + i * 120; f.fillStyle = '#1a130e'; f.fillRect(x - 4, 0, 88, 192); f.fillStyle = '#0a0806'; f.beginPath(); f.moveTo(x + 8, 192); f.lineTo(x + 8, 70); f.quadraticCurveTo(x + 8, 28, x + 40, 18); f.quadraticCurveTo(x + 72, 28, x + 72, 70); f.lineTo(x + 72, 192); f.fill();
    const gl = f.createLinearGradient(0, 20, 0, 190); gl.addColorStop(0, 'rgba(120,150,210,0.45)'); gl.addColorStop(1, 'rgba(70,90,150,0.18)'); f.fillStyle = gl; f.beginPath(); f.moveTo(x + 12, 190); f.lineTo(x + 12, 72); f.quadraticCurveTo(x + 12, 34, x + 40, 24); f.quadraticCurveTo(x + 68, 34, x + 68, 72); f.lineTo(x + 68, 190); f.fill();
    f.fillStyle = '#0a0806'; f.fillRect(x + 38, 24, 4, 168); for (const yy of [70, 110, 150]) f.fillRect(x + 12, yy, 56, 3);
  }
  // mid: the shelves - five rows of spines in a dark oak frame, a pointed arch of wood over each bay
  const mid = canvasOf(320, 192), m = mid.getContext('2d');
  m.fillStyle = '#160f0a'; m.fillRect(0, 0, 320, 192);
  for (let bay = 0; bay < 2; bay++) {
    const bx = bay * 160 + 6, bw = 148; m.fillStyle = '#2a1a0e'; m.fillRect(bx, 0, bw, 192); m.fillStyle = '#3a2614'; m.fillRect(bx, 0, 4, 192); m.fillRect(bx + bw - 4, 0, 4, 192);
    for (let row = 0; row < 5; row++) {
      const ry = 8 + row * 36; m.fillStyle = '#0e0905'; m.fillRect(bx + 4, ry, bw - 8, 30);
      for (let px = bx + 6, i = 0; px < bx + bw - 8; i++) { const w = 3 + ((hash1(bay * 9 + row * 3.1 + i) * 4) | 0), hh = 18 + ((hash1(row * 7.7 + i * 1.3 + bay) * 11) | 0), lean = hash1(i * 2.9 + row) > 0.93;
        if (hash1(i * 6.1 + row * 2.3 + bay * 5) > 0.9) { px += 5; continue; }
        m.fillStyle = SPINES[((hash1(bay * 4 + row * 5.3 + i * 1.9) * SPINES.length) | 0) % SPINES.length]; m.fillRect(px, ry + 30 - hh, w, hh); m.fillStyle = 'rgba(255,255,255,0.14)'; m.fillRect(px, ry + 30 - hh, 1, hh); m.fillStyle = 'rgba(0,0,0,0.35)'; m.fillRect(px + w - 1, ry + 30 - hh, 1, hh);
        if (lean) { m.fillStyle = '#0e0905'; m.fillRect(px + w, ry + 30 - hh, 2, 4); } m.fillStyle = 'rgba(230,200,120,0.5)'; m.fillRect(px, ry + 30 - hh + 4, w, 1); px += w + (lean ? 2 : 0); }
      m.fillStyle = '#4a3018'; m.fillRect(bx + 2, ry + 30, bw - 4, 4); m.fillStyle = '#6a4626'; m.fillRect(bx + 2, ry + 30, bw - 4, 1);
    }
  }
  return LIB = { far: softened(far, 0.55), mid: softened(mid, 0.25) };
}
function iceStrips() {
  if (ICE) return ICE;
  const far = canvasOf(256, 192), f = far.getContext('2d');       // stalactites and a pale glow of ice far away
  const sg = f.createLinearGradient(0, 0, 0, 192); sg.addColorStop(0, '#0c2238'); sg.addColorStop(1, '#16405e'); f.fillStyle = sg; f.fillRect(0, 0, 256, 192);
  for (let i = 0; i < 9; i++) { const x = i * 28 + hash1(i * 3.1) * 12, l = 40 + hash1(i * 7.7) * 90; f.fillStyle = 'rgba(120,190,230,' + (0.1 + hash1(i) * 0.1).toFixed(2) + ')'; f.beginPath(); f.moveTo(x - 9, 0); f.lineTo(x + 9, 0); f.lineTo(x, l); f.fill(); }
  for (let i = 0; i < 6; i++) { const x = i * 44 + hash1(i * 5.3) * 20, l = 30 + hash1(i * 2.1) * 70; f.fillStyle = 'rgba(90,160,205,0.14)'; f.beginPath(); f.moveTo(x - 14, 192); f.lineTo(x + 14, 192); f.lineTo(x, 192 - l); f.fill(); }
  const mid = canvasOf(256, 192), m = mid.getContext('2d');       // great crystals leaning out of the walls, and frozen falls
  for (let i = 0; i < 4; i++) { const x = i * 64 + 12 + hash1(i * 4.7) * 20, l = 50 + hash1(i * 9.1) * 70, top = i % 2 === 0;
    m.fillStyle = 'rgba(70,140,190,0.35)'; m.beginPath(); if (top) { m.moveTo(x - 10, 0); m.lineTo(x + 10, 0); m.lineTo(x + 3, l); } else { m.moveTo(x - 12, 192); m.lineTo(x + 12, 192); m.lineTo(x - 2, 192 - l); } m.fill();
    m.fillStyle = 'rgba(190,235,255,0.25)'; m.beginPath(); if (top) { m.moveTo(x - 10, 0); m.lineTo(x - 2, 0); m.lineTo(x + 2, l * 0.8); } else { m.moveTo(x - 12, 192); m.lineTo(x - 3, 192); m.lineTo(x - 3, 192 - l * 0.8); } m.fill(); }
  return ICE = { far: softened(far, 0.55), mid: softened(mid, 0.25) };
}
const tiled = (g, img, par, camX, camY, alpha, dy = 0) => {
  const ox = -(((camX * par) % img.width) + img.width) % img.width, oy = -(((camY * par) % img.height) + img.height) % img.height + dy; g.save(); g.globalAlpha = alpha;
  for (let y = oy - img.height; y < H; y += img.height) for (let x = ox - img.width; x < W; x += img.width) g.drawImage(img, Math.round(x), Math.round(y));
  g.restore();
};
export function drawLibrary(g, room, camX, camY, t) {
  const S = libraryStrips(), bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0e0906'); bg.addColorStop(1, '#1a110a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  tiled(g, S.far, 0.16, camX, camY, 0.9); tiled(g, S.mid, 0.38, camX, camY, 0.82);          // (the far wall is soft, as if out of focus)
  g.save(); g.globalCompositeOperation = 'lighter';                          // a few slow shafts of lamplight, and lazily drifting pages
  for (let i = 0; i < 4; i++) { const x = ((hash1(i * 9.3 + room.w) * 700 - camX * 0.3) % 520 + 520) % 520 - 60; g.fillStyle = 'rgba(255,200,120,' + (0.025 + 0.012 * Math.sin(t * 0.018 + i * 2)).toFixed(3) + ')'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 26, 0); g.lineTo(x + 80, H); g.lineTo(x + 30, H); g.fill(); }
  g.restore();
  for (let i = 0; i < 7; i++) { const px = (((hash1(i * 4.3) * 800 + t * (0.12 + (i % 3) * 0.05) - camX * 0.55) % 560) + 560) % 560 - 40, py = (((hash1(i * 7.9) * 600 - t * 0.2 - camY * 0.55) % 300) + 300) % 300 - 30 + Math.sin(t * 0.04 + i) * 6, a = t * 0.05 + i;
    g.fillStyle = 'rgba(235,225,190,0.5)'; g.fillRect(px | 0, py | 0, 4, Math.max(1, Math.round(3 + Math.sin(a) * 2))); }
  g.fillStyle = 'rgba(8,5,2,0.28)'; g.fillRect(0, 0, W, H);
}
export function drawIceCave(g, room, camX, camY, t) {
  const S = iceStrips(), bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#071626'); bg.addColorStop(1, '#0f2f48'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'lighter';                          // a slow pale aurora seeping through the ice far above
  for (let i = 0; i < 3; i++) { const y = 30 + i * 36 + Math.sin(t * 0.01 + i * 2) * 8 - camY * 0.05, gr = g.createLinearGradient(0, y - 16, 0, y + 16); gr.addColorStop(0, 'rgba(60,200,180,0)'); gr.addColorStop(0.5, 'rgba(80,210,200,' + (0.06 + 0.03 * Math.sin(t * 0.02 + i)).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(60,120,220,0)'); g.fillStyle = gr; g.fillRect(0, y - 16, W, 32); }
  g.restore();
  tiled(g, S.far, 0.14, camX, camY, 0.95); tiled(g, S.mid, 0.34, camX, camY, 0.9);
  g.fillStyle = 'rgba(2,10,20,0.22)'; g.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------------------------- a foreground pass: out-of-focus shapes close to the lens, sliding past faster than the ground, drawn over the hero
// (kept to the edges of the picture so that nothing you need to see is ever behind them)
export function drawForeground(g, room, camX, camY, t) {
  const th = room.theme; if (th !== 'library' && th !== 'ice') return;
  g.save();
  if (th === 'ice') {                                                          // icicles close to the lens, hanging from the top edge
    const span = 120, par = 1.7, off = -(((camX * par) % span) + span) % span;
    for (let x = off - span; x < W + span; x += span) { const k = Math.round((x + camX * par) / span), len = 12 + hash1(k * 3.7) * 26, ox = x + hash1(k * 1.9) * 60, w = 6 + hash1(k * 5.3) * 6; g.fillStyle = 'rgba(110,170,210,0.16)'; g.beginPath(); g.moveTo(ox - w * 1.7, -2); g.lineTo(ox + w * 1.7, -2); g.lineTo(ox, len + 4); g.fill(); g.fillStyle = 'rgba(110,170,210,0.34)'; g.beginPath(); g.moveTo(ox - w, -2); g.lineTo(ox + w, -2); g.lineTo(ox, len); g.fill(); }
    g.fillStyle = 'rgba(6,20,38,0.35)'; g.fillRect(0, H - 5, W, 5);
  } else {                                                                      // the dark edge of a bookcase and its lamp-chain, drifting past at the sides
    const span = 600, par = 1.45, off = -(((camX * par) % span) + span) % span;
    for (let x = off - span; x < W + span; x += span) { const k = Math.round((x + camX * par) / span), ox = x + 30 + hash1(k * 2.3) * 400; g.fillStyle = 'rgba(14,8,4,0.18)'; g.fillRect(ox - 3, -2, 20, H + 4); g.fillStyle = 'rgba(14,8,4,0.4)'; g.fillRect(ox, -2, 14, H + 4); g.fillStyle = 'rgba(80,50,24,0.35)'; g.fillRect(ox + 1, -2, 2, H + 4);
      g.fillStyle = 'rgba(14,8,4,0.45)'; g.fillRect(ox + 60 + hash1(k) * 40, -2, 2, 30 + hash1(k * 9) * 30); }
    g.fillStyle = 'rgba(8,4,2,0.3)'; g.fillRect(0, 0, W, 4);
  }
  g.restore();
}
