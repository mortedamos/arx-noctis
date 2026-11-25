// Art for the Library of Ages and the Frozen Caverns, drawn in code like the Cistern and the Clockwork Dungeon: tile themes (ground and thin platforms), the ice barrier tile, and the parallax
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
  // a thin platform is a shelf: a plain plank of dark wood
  plat(g, tx, ty) {
    const x = tx * T, y = ty * T; g.fillStyle = '#6e4626'; g.fillRect(x, y, T, 4); g.fillStyle = '#b07a42'; g.fillRect(x, y, T, 1); g.fillStyle = '#35210f'; g.fillRect(x, y + 4, T, 1);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + 5, T, 1);
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

// A CRACKED FLOOR BLOCK (TILE.FLOOR): a flagstone split right through, a thread of alchemical green in the split.  Only the Alembic Strike breaks it.
export function drawFloorBlock(g, tx, ty) {
  const x = tx * T, y = ty * T, h = k => hash1(tx * 7.7 + ty * 13.1 + k * 3.9);
  g.fillStyle = '#15121c'; g.fillRect(x, y, T, T); g.fillStyle = '#625b72'; g.fillRect(x + 1, y + 1, T - 2, T - 2);
  g.fillStyle = '#9c94ae'; g.fillRect(x + 1, y + 1, T - 2, 1); g.fillStyle = '#7a728c'; g.fillRect(x + 2, y + 2, 5, 3); g.fillStyle = '#413b4e'; g.fillRect(x + 1, y + T - 3, T - 2, 2);
  let cx = 5 + ((h(1) * 6) | 0);          // the split: a jagged line from the top face to the foot
  for (let j = 1; j < T - 1; j++) { cx = Math.max(3, Math.min(T - 4, cx + (((h(j + 2) * 3) | 0) - 1))); g.fillStyle = '#17131f'; g.fillRect(x + cx, y + j, 2, 1);
    if (j % 3 === 1) { g.fillStyle = h(j + 30) > 0.5 ? '#9cffc8' : '#4fcf90'; g.fillRect(x + cx, y + j, 1, 1); }
    if (j === 6) { g.fillStyle = '#17131f'; for (let k = 1; k < 5; k++) g.fillRect(x + cx + (h(40) > 0.5 ? k + 1 : -k), y + j + (k >> 1), 1, 1); } }
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
// ---- THE FROZEN CAVERNS: a cave of ice and rock, in three depths.  Each strip is built once, pixel by pixel, from noise that wraps (so it tiles both ways): the far wall of the cavern with its deeper
// hollows; nearer masses of rock with ice lying on their tops and icicles hanging under them, stalagmites, frozen falls and clusters of crystals; and, close by, a few dark teeth of rock and great icicles.
const IW = 384, IH = 288;
function wrapNoise(seed, cell) {          // value noise on a grid of `cell` px that repeats every IW x IH
  const gx = Math.max(1, Math.round(IW / cell)), gy = Math.max(1, Math.round(IH / cell)), V = (i, j) => hash1(((i % gx) + gx) % gx * 12.9898 + (((j % gy) + gy) % gy) * 78.233 + seed * 3.17);
  return (x, y) => { const fx = x / IW * gx, fy = y / IH * gy, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
    return (V(i, j) * (1 - a) + V(i + 1, j) * a) * (1 - b) + (V(i, j + 1) * (1 - a) + V(i + 1, j + 1) * a) * b; };
}
const rockField = (seed, big, mid, small) => { const A = wrapNoise(seed, big), B = wrapNoise(seed + 7, mid), C = wrapNoise(seed + 19, small); return (x, y) => A(x, y) * 0.6 + B(x, y) * 0.3 + C(x, y) * 0.1; };
const paintPixels = (w, h, fn) => { const c = canvasOf(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const px = fn(x, y); if (!px) continue; const k = (y * w + x) * 4; d[k] = px[0]; d[k + 1] = px[1]; d[k + 2] = px[2]; d[k + 3] = px[3] === undefined ? 255 : px[3]; } g.putImageData(img, 0, 0); return c; };
const wrapY = y => ((y % IH) + IH) % IH, wrapX = x => ((x % IW) + IW) % IW;
function iceStrips() {
  if (ICE) return ICE;
  // the far wall: rough rock in dim blues, with hollows going back into black and a cold light in some
  const F = rockField(3, 96, 40, 12), Fd = rockField(41, 72, 28, 9), grain = wrapNoise(5, 4);
  const far = paintPixels(IW, IH, (x, y) => {
    const strata = F(x, y * 1.7), hole = Fd(x, y), g = grain(x, y);
    if (hole < 0.36) return hole < 0.3 ? [4, 11, 20] : [7, 18, 32];          // a way going back into the dark
    const t = strata + (g - 0.5) * 0.18 + (F(x, wrapY(y - 3)) < strata - 0.012 ? 0.07 : 0);          // (a pale edge on the upper side of each fold)
    return t > 0.66 ? [26, 57, 84] : t > 0.54 ? [19, 44, 68] : t > 0.44 ? [14, 33, 53] : [10, 25, 42];
  });
  // the nearer rock: irregular masses with air between
  const M = rockField(11, 112, 40, 12), tex = rockField(23, 36, 14, 6), solid = (x, y) => M(wrapX(x), wrapY(y)) > 0.54;
  const mid = paintPixels(IW, IH, (x, y) => {
    if (!solid(x, y)) return null;
    let up = 0; while (up < 6 && solid(x, y - 1 - up)) up++;
    let down = 0; while (down < 4 && solid(x, y + 1 + down)) down++;
    if (up < 2) return [168, 214, 236];          // ice lying on the top
    if (up < 4) return [92, 150, 184];
    if (up < 6 && grain(x, y) > 0.55) return [60, 108, 144];
    if (down < 2) return [6, 14, 24];          // the shadowed underside
    const t = tex(x, y) + (grain(x, y) - 0.5) * 0.2 + (!solid(x - 4, y) ? 0.12 : 0) - (!solid(x + 4, y) ? 0.1 : 0);          // (lit from the left)
    return t > 0.64 ? [38, 72, 102] : t > 0.5 ? [28, 54, 80] : t > 0.38 ? [20, 40, 62] : [14, 29, 47];
  });
  const m = mid.getContext('2d'), put = (x, y, col, w = 1, h = 1) => { m.fillStyle = col; for (const ox of [0, -IW, IW]) for (const oy of [0, -IH, IH]) m.fillRect(Math.round(x) + ox, Math.round(y) + oy, w, h); };
  // where rock meets air: icicles under it, stalagmites on it, frozen falls from it, crystals in its corners
  let k = 0;
  for (let x = 3; x < IW; x += 3) for (let y = 0; y < IH; y++) {
    const h = hash1(x * 7.31 + y * 1.93);
    if (solid(x, y) && !solid(x, y + 1)) {          // an underside
      if (h < 0.34) { const len = 4 + ((hash1(x * 3.7 + y) * 20) | 0), wd = len > 14 ? 3 : len > 8 ? 2 : 1; for (let j = 0; j < len; j++) { const w = Math.max(1, Math.round(wd * (1 - j / len))); put(x, y + 1 + j, j < len * 0.6 ? '#4f87ac' : '#79b4d2', w, 1); put(x, y + 1 + j, '#b6e2f2', 1, 1); } }
      else if (h > 0.955 && k < 5) { k++; const w = 7 + ((h * 997) % 7 | 0); let len = 0; while (len < 120 && !solid(x + (w >> 1), y + 3 + len)) len++; if (len > 18) for (let i = 0; i < w; i++) { const sag = (hash1(i * 5.1 + x) * 6) | 0; for (let j = 0; j < len - sag; j++) put(x + i, y + 1 + j, ['rgba(96,160,196,0.75)', 'rgba(150,206,230,0.8)', 'rgba(66,122,162,0.7)', 'rgba(205,240,252,0.8)'][(i + ((hash1(i * 2.3 + (j >> 3)) * 2) | 0)) % 4]); } }          // a frozen fall
    } else if (solid(x, y) && !solid(x, y - 1)) {          // a top
      if (h < 0.12) { const len = 5 + ((hash1(x + y * 5.9) * 16) | 0), wd = 2 + (len > 12 ? 2 : 0); for (let j = 0; j < len; j++) { const w = Math.max(1, Math.round(wd * (1 - j / len) * 2)); put(x - (w >> 1), y - 1 - j, '#1d3b5a', w, 1); put(x - (w >> 1), y - 1 - j, '#6aa6c8', 1, 1); } }
      else if (h > 0.965) for (let c = 0; c < 4; c++) { const lean = (c - 1.5) * 0.45, len = 6 + ((hash1(x * 1.7 + c * 9) * 10) | 0); for (let j = 0; j < len; j++) { put(x + lean * j + c, y - j, j > len - 3 ? '#e6fbff' : '#63c4dc', j < len - 2 ? 2 : 1, 1); } put(x + c, y - 1, '#2a7fa0', 1, 1); }          // crystals
    }
  }
  // close by: a few dark shoulders of rock, as ragged as the rest (noise, not drawn shapes), a pale cold rim on their lit side and thin icicles hanging from them
  const N = rockField(61, 104, 34, 9), lump = (x, y) => N(wrapX(x), wrapY(y)) > 0.668;
  const near = paintPixels(IW, IH, (x, y) => { if (!lump(x, y)) return null; if (!lump(x - 2, y - 1)) return [88, 150, 188, 190]; return grain(x * 2, y * 2) > 0.62 ? [10, 24, 40, 235] : [5, 13, 24, 238]; });
  const n = near.getContext('2d');
  for (let x = 2; x < IW; x += 5) for (let y = 0; y < IH; y++) if (lump(x, y) && !lump(x, y + 1) && hash1(x * 2.7 + y * 5.1) < 0.2) { const len = 5 + ((hash1(x + y * 3.3) * 26) | 0); for (let j = 0; j < len; j++) { n.fillStyle = j < len * 0.55 ? 'rgba(40,86,118,0.92)' : 'rgba(110,176,208,0.8)'; n.fillRect(x, (y + 1 + j) % IH, j < len * 0.4 ? 2 : 1, 1); } }
  return ICE = { far: softened(far, 0.5), mid, near };
}
const tiled = (g, img, par, camX, camY, alpha, dy = 0) => {
  const ox = -(((camX * par) % img.width) + img.width) % img.width, oy = -(((camY * par) % img.height) + img.height) % img.height + dy; g.save(); g.globalAlpha = alpha;
  for (let y = oy - img.height; y < H; y += img.height) for (let x = ox - img.width; x < W; x += img.width) g.drawImage(img, Math.round(x), Math.round(y));
  g.restore();
};
function paintLibrary(g, room, camX, camY, t) {
  const S = libraryStrips(), bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0e0906'); bg.addColorStop(1, '#1a110a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  tiled(g, S.far, 0.16, camX, camY, 0.9); tiled(g, S.mid, 0.38, camX, camY, 0.82);          // (the far wall is soft, as if out of focus)
  g.save(); g.globalCompositeOperation = 'lighter';                          // a few slow shafts of lamplight, and lazily drifting pages
  for (let i = 0; i < 4; i++) { const x = ((hash1(i * 9.3 + room.w) * 700 - camX * 0.3) % 520 + 520) % 520 - 60; g.fillStyle = 'rgba(255,200,120,' + (0.025 + 0.012 * Math.sin(t * 0.018 + i * 2)).toFixed(3) + ')'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 26, 0); g.lineTo(x + 80, H); g.lineTo(x + 30, H); g.fill(); }
  g.restore();
  for (let i = 0; i < 7; i++) { const px = (((hash1(i * 4.3) * 800 + t * (0.12 + (i % 3) * 0.05) - camX * 0.55) % 560) + 560) % 560 - 40, py = (((hash1(i * 7.9) * 600 - t * 0.2 - camY * 0.55) % 300) + 300) % 300 - 30 + Math.sin(t * 0.04 + i) * 6, a = t * 0.05 + i;
    g.fillStyle = 'rgba(235,225,190,0.5)'; g.fillRect(px | 0, py | 0, 4, Math.max(1, Math.round(3 + Math.sin(a) * 2))); }
  g.fillStyle = 'rgba(8,5,2,0.28)'; g.fillRect(0, 0, W, H);
}
function paintIceCave(g, room, camX, camY, t) {
  const S = iceStrips(), bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05101e'); bg.addColorStop(1, '#0b2236'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  tiled(g, S.far, 0.12, camX, camY, 1);
  g.save(); g.globalCompositeOperation = 'lighter';                          // cold light welling out of the depths of the cave, slowly breathing
  for (let i = 0; i < 4; i++) { const x = (((hash1(i * 9.3 + 2) * 900 - camX * 0.18) % 560) + 560) % 560 - 90, y = (((hash1(i * 4.7) * 700 - camY * 0.18) % 330) + 330) % 330 - 50, rad = 54 + i * 9, a = 0.1 + 0.035 * Math.sin(t * 0.017 + i * 2.1), gr = g.createRadialGradient(x, y, 2, x, y, rad); gr.addColorStop(0, 'rgba(70,180,210,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(40,90,160,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  g.restore();
  tiled(g, S.mid, 0.32, camX, camY, 0.92);
  g.fillStyle = 'rgba(8,28,46,0.34)'; g.fillRect(0, 0, W, H);          // (the cold air between: the near rock stands out against it)
  tiled(g, S.near, 0.52, camX, camY, 0.85);
  g.save(); g.globalCompositeOperation = 'lighter';                          // glints in the ice
  for (let i = 0; i < 26; i++) { const x = (((hash1(i * 6.1) * 1000 - camX * 0.32) % 440) + 440) % 440 - 28, y = (((hash1(i * 3.3 + 40) * 900 - camY * 0.32) % 260) + 260) % 260 - 22, tw = Math.pow(Math.abs(Math.sin(t * 0.022 + i * 2.3)), 6); if (tw < 0.05) continue; g.fillStyle = 'rgba(210,245,255,' + (0.55 * tw).toFixed(3) + ')'; g.fillRect(x | 0, y | 0, 1, 1); if (tw > 0.6) { g.fillRect((x | 0) - 1, y | 0, 3, 1); g.fillRect(x | 0, (y | 0) - 1, 1, 3); } }
  g.restore();
  g.fillStyle = 'rgba(2,8,18,0.2)'; g.fillRect(0, 0, W, H);
}

// These two backgrounds are built from several full-picture layers (a gradient, an aurora, two scrolling strips, a dark veil).  Done straight onto the game canvas, which is several times larger than the picture
// (it is scaled up for sharpness), every layer costs a full-screen blend; so they are painted onto a picture-sized buffer instead and that is stamped on once - the same look, a fraction of the work.
let BG = null;
function viaBuffer(g, paint, room, camX, camY, t) {
  if (!BG) BG = canvasOf(W, H); const b = BG.getContext('2d'); b.clearRect(0, 0, W, H); paint(b, room, camX, camY, t);
  const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(BG, 0, 0, W, H); g.imageSmoothingEnabled = sm;
}
export const drawLibrary = (g, room, camX, camY, t) => viaBuffer(g, paintLibrary, room, camX, camY, t);
export const drawIceCave = (g, room, camX, camY, t) => viaBuffer(g, paintIceCave, room, camX, camY, t);

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

// a block of the wall the Librarian's falling books make: two flat books, one on the other (it breaks with the sword)
export function bookTile(g, tx, ty) {
  const x = tx * T, y = ty * T; g.fillStyle = '#12090a'; g.fillRect(x, y, T, T);
  for (let r = 0; r < 2; r++) {
    const k = hash1(tx * 7.3 + ty * 3.1 + r * 5.7), off = (k * 3) | 0, by = y + r * 8, c = SPINES[((hash1(tx * 2.9 + ty * 6.1 + r * 1.3) * SPINES.length) | 0) % SPINES.length];
    g.fillStyle = c; g.fillRect(x + off, by + 1, T - off - 1, 6); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + off, by + 1, T - off - 1, 1);
    g.fillStyle = '#e8dcb8'; g.fillRect(x + off + 2, by + 6, T - off - 5, 1);                       // the page edge
    g.fillStyle = 'rgba(240,210,120,0.7)'; g.fillRect(x + off + 3 + ((k * 4) | 0), by + 3, 5, 1);   // a gilt title
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + T - 2, by + 1, 1, 6);
  }
}
