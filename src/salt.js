// SAL TERRAE, drawn in three.js.  Salt grows in little cubes, so every grain here is one: a tiny cube that tumbles as it flies, takes the light on its faces from above and flashes now and then.  The grains are
// real things once they strike: they fall, give a small bounce, roll a little way and come to rest - and one that rolls off the end of a floor or a plank drops to whatever is below and rolls on there.  So
// where the salt lies is not decided in advance: lies() says where it has ended up, and that is what harms (items.js SaltBed, mirror.js TwinSaltBed).  Everything is in WORLD pixels (the FX camera, y down).
//   throwSalt(carrier, world, tint)  a handful in the air, streaming after the carrier (world = { solid(x, y), plank(x, y), slabs(), bottom }: what a grain can strike; slabs: the moving platforms, movers.js)
//   burst(cloud, bed, at)            it strikes: at = { x, y, dir, floor (the surface struck, if it came down on one), wall }.  bed = { life, dead } is watched until the salt is gone
//   lies(cloud)                      the stretches of floor with salt on them now: [{ x0, x1, y, n }]
//   kick(cloud, patch, x)            something is standing in it: a few grains jump
import * as THREE from 'three';

const MAX = 2000;                                   // grains on screen at once (about eight throws)
const AIR = 120, SPRAY = 80, DUST = 38;              // grains in a handful, those struck up where it lands, and the flat ones that slide out as powder
const GRAV = 0.16, CLUSTER = 7, ENOUGH = 11;         // (grains further apart than CLUSTER px are not one patch; fewer than ENOUGH of them are only a few stray grains, harmless)
export const SALT = [1, 0.99, 0.96], SHADOW_SALT = [0.8, 0.68, 1.0];          // (the twin's salt is violet, like everything it throws)

const VERT = /* glsl */`
attribute vec4 aColor; attribute float aSeed; uniform float uTime; varying vec4 vCol;
void main(){
  vec3 n = normalize(mat3(instanceMatrix) * normal);
  float d = max(dot(n, normalize(vec3(-0.4, -0.85, 0.34))), 0.0);          // light from above and a little to the left (y runs down)
  float glint = pow(max(0.0, sin(uTime * 2.3 + aSeed)), 60.0) * step(0.25, d);          // now and then a face catches it
  vec3 col = aColor.rgb * (0.66 + 0.34 * d) + glint * 0.7;
  vCol = vec4(min(col, vec3(1.0)), aColor.a);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAG = `precision highp float; varying vec4 vCol; void main(){ gl_FragColor = vec4(vCol.rgb * vCol.a, vCol.a); }`;

const rnd = (a, b) => a + Math.random() * (b - a);
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const settle = q => q.setFromAxisAngle(X, -0.5).multiply(qa.setFromAxisAngle(Y, rnd(0, Math.PI / 2)));          // lying flat, tipped so the top shows
const on = (m, x) => m.active && Math.abs(x - m.x) <= m.w / 2;          // (over a moving platform that is there)
// is there something to lie on right under a grain whose foot is at (x, fy)?  (a plank holds only what is on its top)
const held = (w, x, fy) => w.solid(x, fy + 0.5) || (w.plank(x, fy + 0.5) && Math.abs(fy - Math.round(fy / 16) * 16) < 0.01);

export class SaltGrains {
  constructor(scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.col = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.seed = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aColor', this.col); geo.setAttribute('aSeed', this.seed);
    this.u = { uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u, transparent: true, depthTest: false, depthWrite: false,
      side: THREE.BackSide,          // (the FX camera runs y downward, which turns every face over: these are the ones toward the eye)
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX); this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; this.mesh.visible = false; this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1; scene.add(this.mesh);          // (over the water and the mist, UNDER the darkness: it is lit like everything else in the room)
    this.groups = []; this.m = new THREE.Matrix4(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
  }

  grain(tint, o) {
    const shade = rnd(0.9, 1.04), s = o.s || (Math.random() < 0.1 ? rnd(1.6, 2.1) : rnd(0.8, 1.4));          // (fine grains, and a few fat crystals)
    return { x: 0, fy: 0, vx: 0, vy: 0, sx: s, sy: s, sz: s, q: new THREE.Quaternion().random(), axis: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(), spin: rnd(0.1, 0.4),
      r: Math.min(1, tint[0] * shade), g: Math.min(1, tint[1] * shade), b: Math.min(1, tint[2] * shade), a: 1, seed: rnd(0, 628), die: Math.random(), lift: 0, flat: false, ride: null, state: 'air', ...o };
  }

  throwSalt(src, world, tint = SALT) {
    const grains = [];
    for (let i = 0; i < AIR; i++) grains.push(this.grain(tint, { ox: rnd(-2.5, 2.5), oy: rnd(-2.5, 2.5), dx: rnd(-0.28, 0.28), dy: rnd(-0.32, 0.18), lag: Math.floor(Math.random() ** 2 * 7), x: src.x, fy: src.y }));          // (dx, dy: how it opens out; lag: how far behind the leaders it trails)
    const c = { src, world, tint, grains, hist: [[src.x, src.y]], age: 0, tick: 0, bed: null, loose: false }; this.groups.push(c); return c;
  }

  burst(c, bed, at) {
    if (!c) return;
    const w = c.world, floor = at.floor, dir = at.dir || 1, back = at.wall ? -dir : dir; c.bed = bed;
    const wide = floor !== undefined ? 1 : 0.5;          // (struck in the air, it has further to fall: less is thrown sideways, or it would carpet the ground)
    const vx0 = c.src.vx || 0, vy0 = c.src.vy || 0;
    for (const p of c.grains) {          // what was in the air carries on, losing most of its way
      p.state = 'fall'; p.vx = vx0 * rnd(0.05, 0.35) + p.dx * 0.7 + rnd(-0.25, 0.25) + (at.x - p.x) * 0.045; p.vy = vy0 * rnd(0.15, 0.55) + p.dy;          // (the stragglers follow on to where it struck)
      if (floor !== undefined && p.fy > floor) p.fy = floor;                            // (none of it goes through what it struck)
      if (w.solid(p.x, p.fy - 0.5)) { p.x = at.x; p.fy = floor !== undefined ? floor : at.y; }
    }
    const from = floor !== undefined ? floor : at.y;
    for (let i = 0; i < SPRAY; i++) {          // struck up where it hits, hopping outward
      const p = this.grain(c.tint, { state: 'fall' });
      p.x = at.x + rnd(-3, 3); p.fy = from - rnd(0.2, 3); p.vx = at.wall ? back * rnd(0, 0.9) : (rnd(-0.8, 0.8) + dir * rnd(0, 0.35)) * wide; p.vy = -rnd(0.2, 1.6);
      if (w.solid(p.x, p.fy - 0.5)) p.x = at.x; c.grains.push(p);
    }
    for (let i = 0; i < DUST; i++) {          // the powder: flat flakes that slide out along the floor
      const p = this.grain(c.tint, { s: 1, flat: true, state: 'fall' }); p.sx = rnd(1.8, 3.4); p.sy = rnd(0.8, 1.2); p.sz = 1; p.q.identity();
      p.x = at.x + rnd(-3, 3); p.fy = from - 0.3; p.vx = at.wall ? back * rnd(0, 1) : (rnd(-1.3, 1.3) + dir * 0.2) * wide; p.die *= 0.4;          // (the powder goes last)
      if (w.solid(p.x, p.fy - 0.5)) p.x = at.x; c.grains.push(p);
    }
  }

  scatter(c) { c.loose = true; c.age = 0; for (const p of c.grains) { p.state = 'fall'; p.vx = p.dx + rnd(-0.4, 0.4); p.vy = rnd(-0.4, 0.4); } }

  lies(c) {
    const rows = new Map(), out = [];
    for (const p of c.grains) if (p.state === 'rest' || p.state === 'roll') { const y = Math.round(p.fy); let xs = rows.get(y); if (!xs) rows.set(y, xs = []); xs.push(p.x); }
    for (const [y, xs] of rows) {
      xs.sort((a, b) => a - b);
      for (let i = 1, first = 0; i <= xs.length; i++) if (i === xs.length || xs[i] - xs[i - 1] > CLUSTER) { if (i - first >= ENOUGH) out.push({ y, x0: xs[first] - 1, x1: xs[i - 1] + 1, n: i - first }); first = i; }
    }
    return out;
  }

  kick(c, patch, x) {
    let n = 0;
    for (const p of c.grains) {
      if (p.state !== 'rest' || p.flat || Math.round(p.fy) !== patch.y || Math.abs(p.x - x) > 11 || Math.random() < 0.4) continue;
      p.state = 'fall'; p.vx = rnd(-0.45, 0.45); p.vy = -rnd(0.8, 2.1); p.spin = rnd(0.2, 0.45); p.lift = 0; p.ride = null;
      if (++n >= 12) break;
    }
  }

  // one grain, one step: falling or rolling.  Returns false once it has dropped out of the room.
  move(w, p, dt) {
    if (p.state === 'fall') {
      p.vy = Math.min(5.5, p.vy + GRAV * dt);
      let nx = p.x + p.vx * dt, ny = p.fy + p.vy * dt;
      if (w.solid(nx, p.fy - 0.5)) { p.vx *= -0.3; nx = p.x; }          // off a wall
      if (p.vy > 0) {
        const top = Math.floor(ny / 16) * 16, slab = w.slabs().find(m => on(m, nx) && p.fy <= m.y - m.dy + 1.5 && ny >= m.y);
        if (slab || (p.fy <= top + 0.5 && (w.solid(nx, ny) || w.plank(nx, ny)))) {          // it comes down on something
          ny = slab ? slab.y : top;
          if (p.vy > 1.1 && !p.flat) { p.vy *= -0.24; p.vx = p.vx * 0.75 + rnd(-0.3, 0.3); p.spin *= 0.7; }          // a small bounce...
          else { p.vy = 0; p.state = 'roll'; p.ride = slab || null; }          // ...and then it rolls
        } else if (w.solid(nx, ny)) { nx = p.x; ny = p.fy; p.vx = 0; p.vy = 0; p.state = 'roll'; }          // (it is somehow inside the stone: it stays where it is, out of sight)
      } else if (w.solid(nx, ny - p.sy)) { p.vy = 0; ny = p.fy; }
      p.x = nx; p.fy = ny;
      if (!p.flat) p.q.premultiply(qb.setFromAxisAngle(p.axis, p.spin * dt));
      return p.fy < w.bottom + 24;
    }
    let nx = p.x + p.vx * dt;          // rolling
    if (w.solid(nx, p.fy - 0.5)) { p.vx *= -0.25; nx = p.x; }
    p.x = nx;
    if (p.ride ? !on(p.ride, p.x) : !held(w, p.x, p.fy)) { p.state = 'fall'; p.ride = null; p.vy = 0.15; if (Math.abs(p.vx) < 0.25) p.vx = p.vx < 0 ? -0.25 : 0.25; return true; }          // over the edge it goes
    p.vx *= Math.pow(p.flat ? 0.85 : 0.9, dt);
    if (!p.flat) p.q.premultiply(qb.setFromAxisAngle(Z, p.vx * dt * 0.7));          // (y down: a turn about z is clockwise on screen, which is rolling rightward)
    if (Math.abs(p.vx) < 0.07) { p.state = 'rest'; p.vx = 0; if (!p.flat) { settle(p.q); p.lift = Math.random() ** 2 * 2.4; } }          // (heaped a little: some lie on others)
    return true;
  }

  update(dt) {
    this.u.uTime.value += dt / 60;
    if (dt <= 0) return;
    for (let i = this.groups.length - 1; i >= 0; i--) {
      const c = this.groups[i];
      if (!c.bed && !c.loose) {          // in the air, behind its carrier
        const s = c.src; if (s.dead) { this.scatter(c); continue; }
        const last = c.hist[c.hist.length - 1]; if (s.x !== last[0] || s.y !== last[1]) { c.hist.push([s.x, s.y]); if (c.hist.length > 12) c.hist.shift(); }
        c.age += dt;
        for (const p of c.grains) { const h = c.hist[Math.max(0, c.hist.length - 1 - p.lag)]; p.x = h[0] + p.ox + p.dx * c.age; p.fy = h[1] + p.oy + p.dy * c.age; p.q.premultiply(qb.setFromAxisAngle(p.axis, p.spin * dt)); }
        continue;
      }
      const b = c.bed; if (b && b.dead) { this.groups.splice(i, 1); continue; }
      c.age += dt; c.tick += dt; const look = c.tick >= 10; if (look) c.tick = 0;
      const left = b ? Math.min(1, b.life / 50) : 1;          // (near its end the bed crumbles away, grain by grain)
      for (let k = c.grains.length - 1; k >= 0; k--) {
        const p = c.grains[k];
        p.a = c.loose ? Math.max(0, 1 - c.age / 45) : left >= 1 ? 1 : Math.max(0, Math.min(1, (left - p.die * 0.85) * 7));
        if (p.ride) { p.x += p.ride.dx; p.fy = p.ride.y; if (!p.ride.active) { p.ride = null; p.state = 'fall'; p.vy = 0.15; p.lift = 0; } }          // (carried along; or the slab has given way)
        if (p.state === 'rest') { if (look && !p.ride && !held(c.world, p.x, p.fy)) { p.state = 'fall'; p.vy = 0.15; p.lift = 0; } continue; }          // (the floor under it may be broken away)
        if (!this.move(c.world, p, dt)) c.grains.splice(k, 1);
      }
      if (c.loose && c.age > 45) this.groups.splice(i, 1);
    }
  }

  // hand the grains to the graphics card (called once a drawn frame)
  upload() {
    let n = 0; const C = this.col.array, S = this.seed.array;
    for (const c of this.groups) for (const p of c.grains) {
      if (n >= MAX) break; if (p.a <= 0.01) continue;
      this.p.set(Math.round(p.x * 2) / 2, Math.round((p.fy - p.sy / 2 - p.lift) * 2) / 2, 0); this.s.set(p.sx, p.sy, p.sz);          // (kept on the FX canvas's pixels, so a lying grain does not shimmer as the camera moves)
      this.mesh.setMatrixAt(n, this.m.compose(this.p, p.q, this.s));
      C[n * 4] = p.r; C[n * 4 + 1] = p.g; C[n * 4 + 2] = p.b; C[n * 4 + 3] = p.a; S[n] = p.seed; n++;
    }
    this.mesh.count = n; this.mesh.visible = n > 0;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.col.needsUpdate = true; this.seed.needsUpdate = true; }
  }

  reset() { this.groups.length = 0; this.mesh.count = 0; this.mesh.visible = false; }
}
