// THE SWORD SWIPE, drawn in three.js.  The Gothic Hero's pictures had it painted on as a flat cream crescent; assets.js (liftSwipes) cuts that out and remembers its pixels per frame, and this draws it back,
// in exactly the same place and shape, as a moving thing: it sweeps round the blade's pivot from tail to head, burns bright at the leading edge with thin motion lines along the arc and a soft glow, and then
// thins away from the tail while it fades.  It takes the colour of the sword's enchantment.  Everything is in WORLD pixels (the FX camera), and it follows whoever swung.
import * as THREE from 'three';
import { SHEET } from './assets.js';

const LIFE = 15, MARGIN = 6;          // frames (60ths of a second) a swipe lives, and the px of room round the cell for the glow
const rgb = a => new THREE.Vector3(a[0] / 255, a[1] / 255, a[2] / 255);
const STEEL = { bright: [236, 232, 228], mid: [196, 170, 158], dark: [112, 100, 128] };          // (the art's creams, held down: the bloom pass brightens them, and at full strength the swipe is a flat white shape)

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
precision highp float; varying vec2 vUv;
uniform sampler2D uMask; uniform vec2 uSize, uPivot; uniform float uA0, uA1, uT, uSeed; uniform vec3 uBright, uMid, uDark;
void main(){
  vec4 m = texture2D(uMask, vUv);                       // r: the crescent, g: its darker strokes, b: the same blurred (the glow), a: how far across the crescent (0 inner edge .. 1 outer)
  vec2 q = vUv * uSize - uPivot;                        // cell pixels from the pivot (y runs down, as in the art)
  float s = clamp((uA1 - atan(q.y, q.x)) / max(0.001, uA1 - uA0), 0.0, 1.0), v = m.a;                // s: 0 at the tail of the swing, 1 at its head
  float front = min(1.0, uT / 0.2) * 1.18;                                   // it sweeps in over the first fifth of its life...
  float shown = 1.0 - smoothstep(front - 0.18, front, s);
  float cut = smoothstep(0.28, 1.0, uT) * 1.1;                               // ...and then goes from the tail, as it fades
  float tail = smoothstep(cut - 0.3, cut + 0.08, s);
  float k = shown * tail * (1.0 - smoothstep(0.6, 1.0, uT));
  float line = smoothstep(0.35, 0.95, 0.5 + 0.5 * sin(v * 17.0 + 1.3 * sin(s * 3.1 + uSeed)));        // thin motion lines running along the arc
  float rim = smoothstep(0.62, 0.96, v), edge = smoothstep(0.82, 1.0, s);                             // the outer edge (the path of the blade's tip) and the leading end
  vec3 col = mix(uDark, uMid, smoothstep(0.0, 0.5, s)); col = mix(col, uBright, smoothstep(0.55, 0.95, s));
  col = mix(col, uDark, m.g * 0.45);
  col = mix(col, uBright, clamp(line * 0.35 * s + rim * 0.75 + edge * 0.35, 0.0, 1.0));
  // sheer inside, solid at the rim and at the leading end, so the streaks read and the room shows through
  float a = clamp(m.r * k * (0.06 + 0.22 * v + 0.26 * line * smoothstep(0.0, 0.45, s) + 0.46 * rim * smoothstep(0.05, 0.6, s) + 0.16 * edge), 0.0, 0.88);
  float glow = m.b * k * s * 0.12;
  gl_FragColor = vec4(col * a + uMid * glow, a);                    // premultiplied: the body covers, the glow only adds
}`;

// where the picture of a hero sheet lies, in world pixels, when drawSheet would draw frame f with its anchor at (x, y) facing dir (the same sums as drawSheet)
export function swipeBox(sheet, f, x, y, dir, ay) {
  const s = SHEET[sheet], flip = dir !== s.face, X0 = Math.round(-s.w * s.ax) + s.dx * (flip ? -1 : 1), Y0 = Math.round(-s.h * (ay === undefined ? s.ay : ay)) + s.dy + (s.fdy ? s.fdy[f] : 0);
  return { cx: Math.round(x) + (flip ? -1 : 1) * (X0 + s.w / 2), cy: Math.round(y) + Y0 + s.h / 2, flip };
}

// how far ACROSS the crescent a point lies (0 its inner edge, 1 its outer): for every direction from the pivot, the nearest and farthest of its pixels, smoothed.  The motion lines are drawn at constant "across", so they run along the curve.
function acrossOf(info, px, py) {
  const N = 24, lo = new Array(N).fill(Infinity), hi = new Array(N).fill(-Infinity), span = Math.max(0.001, info.a1 - info.a0);
  const bin = a => Math.max(0, Math.min(N - 1, (a - info.a0) / span * (N - 1)));
  for (const [x, y] of info.px) { const dx = x + MARGIN + 0.5 - px, dy = y + MARGIN + 0.5 - py, r = Math.hypot(dx, dy), b = Math.round(bin(Math.atan2(dy, dx))); lo[b] = Math.min(lo[b], r - 0.5); hi[b] = Math.max(hi[b], r + 0.5); }
  for (const list of [lo, hi]) {
    for (let i = 0; i < N; i++) if (!isFinite(list[i])) { let a = i - 1, b = i + 1; while (a >= 0 && !isFinite(list[a])) a--; while (b < N && !isFinite(list[b])) b++; list[i] = a < 0 ? list[b] : b >= N ? list[a] : list[a] + (list[b] - list[a]) * (i - a) / (b - a); }
    for (let pass = 0; pass < 2; pass++) { const c = list.slice(); for (let i = 0; i < N; i++) list[i] = (c[Math.max(0, i - 1)] + c[i] * 2 + c[Math.min(N - 1, i + 1)]) / 4; }
  }
  return (x, y) => { const dx = x - px, dy = y - py, b = bin(Math.atan2(dy, dx)), i = Math.floor(b), j = Math.min(N - 1, i + 1), t = b - i, a = lo[i] + (lo[j] - lo[i]) * t, z = hi[i] + (hi[j] - hi[i]) * t; return Math.max(0, Math.min(1, (Math.hypot(dx, dy) - a) / Math.max(1, z - a))); };
}

export class Slashes {
  constructor(scene) { this.scene = scene; this.live = []; this.pool = []; this.tex = new Map(); }
  // the lifted pixels of one frame as a texture: crescent / strokes / blurred crescent, with a margin round the cell
  texture(sheet, f) {
    const key = sheet + ':' + f; let t = this.tex.get(key); if (t) return t;
    const s = SHEET[sheet], info = s.swipe[f], w = s.w + MARGIN * 2, h = s.h + MARGIN * 2, data = new Uint8Array(w * h * 4);
    const body = new Float32Array(w * h), shade = new Uint8Array(w * h);
    for (const [x, y, dark] of info.px) { const i = (y + MARGIN) * w + x + MARGIN; body[i] = 1; shade[i] = dark; }
    let glow = body;
    for (let pass = 0; pass < 2; pass++) {          // (two box blurs make a soft halo)
      const out = new Float32Array(w * h), R = 2;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let sum = 0; for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { const nx = x + i, ny = y + j; if (nx >= 0 && ny >= 0 && nx < w && ny < h) sum += glow[ny * w + nx]; } out[y * w + x] = sum / ((2 * R + 1) ** 2); }
      glow = out;
    }
    const px = info.pivot[0] + MARGIN, py = info.pivot[1] + MARGIN, across = acrossOf(info, px, py);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; data[i * 4] = body[i] * 255; data[i * 4 + 1] = shade[i] * 255; data[i * 4 + 2] = Math.min(255, glow[i] * 255); data[i * 4 + 3] = Math.round(across(x + 0.5, y + 0.5) * 255); }
    const map = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType); map.magFilter = map.minFilter = THREE.LinearFilter; map.needsUpdate = true;          // (data row 0 is the picture's top row: the FX camera runs y downward)
    t = { map, w, h, pivot: [info.pivot[0] + MARGIN, info.pivot[1] + MARGIN], a0: info.a0, a1: info.a1 }; this.tex.set(key, t); return t;
  }
  // o: { sheet, f, dir, ay (anchor, as drawSheet's), follow: () => ({x, y}) the anchor now, pal: {bright, mid, dark} 0-255 or null for plain steel, scale }
  add(o) {
    const s = SHEET[o.sheet]; if (!s || !s.swipe || !s.swipe[o.f]) return null;
    const t = this.texture(o.sheet, o.f);
    let m = this.pool.pop();
    if (!m) {
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        uniforms: { uMask: { value: null }, uSize: { value: new THREE.Vector2() }, uPivot: { value: new THREE.Vector2() }, uA0: { value: 0 }, uA1: { value: 1 }, uT: { value: 0 }, uSeed: { value: 0 }, uBright: { value: new THREE.Vector3() }, uMid: { value: new THREE.Vector3() }, uDark: { value: new THREE.Vector3() } } });
      m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.frustumCulled = false; m.renderOrder = 1.5; this.scene.add(m);          // (above the darkness, under the sparks)
    }
    const u = m.material.uniforms, pal = o.pal || STEEL;
    u.uMask.value = t.map; u.uSize.value.set(t.w, t.h); u.uPivot.value.set(t.pivot[0], t.pivot[1]); u.uA0.value = t.a0; u.uA1.value = t.a1; u.uT.value = 0.07; u.uSeed.value = Math.random() * 6.28;
    u.uBright.value.copy(rgb(pal.bright)); u.uMid.value.copy(rgb(pal.mid)); u.uDark.value.copy(rgb(pal.dark));
    m.visible = true;
    const q = { m, o, t, age: 1 }; this.place(q); this.live.push(q); return q;
  }
  place(q) {
    const o = q.o, p = o.follow(), sc = o.scale || 1;
    if (o.under) {          // turned a quarter so the arc sweeps BENEATH: follow() gives the point it turns about (the painted swipe's own pivot is put there)
      const flip = o.dir < 0, rot = flip ? -Math.PI / 2 : Math.PI / 2, vx = (flip ? -1 : 1) * (q.t.w / 2 - q.t.pivot[0]), vy = q.t.h / 2 - q.t.pivot[1], c = Math.cos(rot), s = Math.sin(rot);
      q.m.position.set(p.x + (vx * c - vy * s) * sc, p.y + (vx * s + vy * c) * sc, 0); q.m.rotation.z = rot; q.m.scale.set((flip ? -1 : 1) * q.t.w * sc, q.t.h * sc, 1); return;
    }
    q.m.rotation.z = 0;
    const b = swipeBox(o.sheet, o.f, p.x, p.y, o.dir, o.ay);
    q.m.position.set(p.x + (b.cx - p.x) * sc, p.y + (b.cy - p.y) * sc, 0); q.m.scale.set((b.flip ? -1 : 1) * q.t.w * sc, q.t.h * sc, 1);
  }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const q = this.live[i]; q.age += dt;
      if (q.age >= LIFE) { q.m.visible = false; this.pool.push(q.m); this.live.splice(i, 1); continue; }
      q.m.material.uniforms.uT.value = q.age / LIFE; this.place(q);
    }
  }
  reset() { for (const q of this.live) { q.m.visible = false; this.pool.push(q.m); } this.live.length = 0; }
}
