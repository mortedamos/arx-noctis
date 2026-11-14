// Post-processing for the whole picture.  The sprite canvas is uploaded as a texture every frame, the effects scene (fire, light, darkness, fog, particles) is drawn over it into a render target, and
// that finished image goes through three passes before it reaches the screen:
//   * BLOOM: whatever is bright (flames, magic, lightning, lit windows) is blurred and added back, so fire and spells glow instead of just being orange;
//   * HEAT SHIMMER: the air above every warm light (braziers, furnaces, fireballs) wobbles;
//   * CHROMATIC FLASH: the red, green and blue pull apart for a moment when the hero is hurt or the sky flashes.
// It is skipped (the plain two-canvas picture is used) when the GLOW option is off.
import * as THREE from 'three';

const PV = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
const BASE = `precision highp float; varying vec2 vUv; uniform sampler2D uTex; void main(){ gl_FragColor=vec4(texture2D(uTex,vUv).rgb,1.0); }`;
const BRIGHT = `precision highp float; varying vec2 vUv; uniform sampler2D uTex; void main(){ vec3 c=texture2D(uTex,vUv).rgb; float l=dot(c,vec3(0.299,0.587,0.114)); float k=smoothstep(0.42,0.9,l); gl_FragColor=vec4(c*k,1.0); }`;
const BLUR = `precision highp float; varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir;
void main(){ vec3 s=texture2D(uTex,vUv).rgb*0.2270; s+=(texture2D(uTex,vUv+uDir*1.3846).rgb+texture2D(uTex,vUv-uDir*1.3846).rgb)*0.3162; s+=(texture2D(uTex,vUv+uDir*3.2308).rgb+texture2D(uTex,vUv-uDir*3.2308).rgb)*0.0703; gl_FragColor=vec4(s,1.0); }`;
const FINAL = `precision highp float; varying vec2 vUv; uniform sampler2D uTex; uniform sampler2D uBloom; uniform float uTime; uniform float uAb; uniform float uBloomK; uniform float uAspect;
uniform vec4 uHeat[8]; uniform int uHN;
uniform sampler2D uRefl; uniform vec2 uReflSize; uniform vec2 uCam; uniform float uReflOn;
float h21(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv=vUv, disp=vec2(0.0);
  for(int i=0;i<8;i++){ if(i>=uHN) break; vec4 h=uHeat[i]; vec2 d=(uv-h.xy)*vec2(uAspect,1.0); float dist=length(d*vec2(1.0,0.55)); float fall=smoothstep(h.z,0.0,dist)*h.w; float up=smoothstep(-0.02,0.10,uv.y-h.y);
    disp.x+=sin(uv.y*150.0-uTime*7.0+float(i)*1.7)*0.0016*fall*(0.35+0.65*up); disp.y+=cos(uv.x*120.0+uTime*5.0+float(i))*0.0008*fall*up; }
  uv+=disp; vec2 dir=(vUv-0.5)*uAb;
  vec3 c=vec3(texture2D(uTex,uv+dir).r,texture2D(uTex,uv).g,texture2D(uTex,uv-dir).b);
  if(uReflOn>0.5){                       // ICE: a glassy surface mirrors what stands above it, and glints
    vec2 sp=vec2(vUv.x*384.0,(1.0-vUv.y)*216.0), wp=sp+uCam, tc=floor(wp/16.0), tuv=(tc+0.5)/uReflSize;
    if(tuv.x>0.0&&tuv.y>0.0&&tuv.x<1.0&&tuv.y<1.0){
      vec4 m=texture2D(uRefl,tuv);
      if(m.r>0.0){                         // the reflection: the picture flipped about the top of the ice, blurred a little, wobbling, cooler, fading with depth
        float d=wp.y-tc.y*16.0, fade=pow(clamp(1.0-d/15.0,0.0,1.0),1.1)*m.r;       // (the picture is squashed as it is mirrored, so the whole of a flame or a figure shows in the thin slab of ice)
        float wob=sin(d*1.3+uTime*1.1+wp.x*0.05)*0.0011*(0.4+d/14.0), ry=1.0-(sp.y-d-d*2.4-0.4)/216.0;
        vec3 r=(texture2D(uTex,vec2(vUv.x+wob-0.0016,ry)).rgb+texture2D(uTex,vec2(vUv.x+wob,ry)).rgb*2.0+texture2D(uTex,vec2(vUv.x+wob+0.0016,ry)).rgb)*0.25;
        c=mix(c,r*vec3(0.95,1.15,1.35)+vec3(0.0,0.03,0.06),fade*0.95);
      }
      if(m.g>0.0){                         // the sheen: a slow pale band drifts across the ice, and a few facets twinkle
        float s=fract((wp.x*0.7+wp.y*0.45)/170.0-uTime*0.045), band=smoothstep(0.0,0.05,s)*smoothstep(0.17,0.07,s);
        vec2 cell=floor(wp/2.0); float hh=h21(cell), tw=step(0.982,hh)*pow(0.5+0.5*sin(uTime*2.2+hh*500.0),10.0);
        float lit=smoothstep(0.03,0.30,dot(c,vec3(0.299,0.587,0.114)));          // (ice only glints where light falls on it: in a dark cavern the lit patches shine and the rest stays black)
        c+=(vec3(0.45,0.75,1.0)*band*0.22+vec3(0.85,0.95,1.0)*tw*0.9)*m.g*(0.15+0.85*lit);
      }
    }
  }
  c+=texture2D(uBloom,vUv).rgb*uBloomK;
  gl_FragColor=vec4(c,1.0);
}`;

export class Post {
  constructor(renderer, fx, gameCanvas, FXS, W, H) {
    this.r = renderer; this.fx = fx; this.on = true; this.W = W * FXS; this.H = H * FXS; this.aspect = W / H;
    const mk = (w, h, nearest) => new THREE.WebGLRenderTarget(w, h, { minFilter: nearest ? THREE.NearestFilter : THREE.LinearFilter, magFilter: nearest ? THREE.NearestFilter : THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, generateMipmaps: false });
    this.rtA = mk(this.W, this.H, true); this.rtB = mk(this.W >> 1, this.H >> 1); this.rtC = mk(this.W >> 1, this.H >> 1);
    this.tex = new THREE.CanvasTexture(gameCanvas); this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter; this.tex.generateMipmaps = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const pass = (frag, uniforms) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false })); m.frustumCulled = false; const s = new THREE.Scene(); s.add(m); return { s, u: uniforms }; };
    this.pBase = pass(BASE, { uTex: { value: this.tex } });
    this.pBright = pass(BRIGHT, { uTex: { value: this.rtA.texture } });
    this.pBlur = pass(BLUR, { uTex: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.pFinal = pass(FINAL, { uTex: { value: this.rtA.texture }, uBloom: { value: this.rtB.texture }, uTime: { value: 0 }, uAb: { value: 0 }, uBloomK: { value: 0.6 }, uAspect: { value: this.aspect }, uHeat: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uHN: { value: 0 }, uRefl: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType) }, uReflSize: { value: new THREE.Vector2(1, 1) }, uCam: { value: new THREE.Vector2() }, uReflOn: { value: 0 } });
    this.ab = 0; this.reflTex = null;
  }
  // which tiles are glassy (call whenever the room is loaded or a tile changes): R = how well it mirrors (a floor of ice with open air above it), G = how much it glints (ice itself)
  setReflMask(room) {
    const w = room.w, h = room.h, t = room.tiles, iceRoom = room.theme === 'ice', d = new Uint8Array(w * h * 4); let any = false;
    const solid = v => v === 1 || v === 4 || v === 5 || v === 6 || v === 7 || v === 8;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = t[y * w + x], i = (y * w + x) * 4;
      if (v === 8) { d[i + 1] = 255; if (y > 0 && !solid(t[(y - 1) * w + x])) d[i] = 235; any = true; }
      else if (v === 1 && iceRoom) { d[i + 1] = 110; if (y > 0 && !solid(t[(y - 1) * w + x])) d[i] = 190; any = true; }
    }
    this.pFinal.u.uReflOn.value = any ? 1 : 0; if (!any) return;
    let tx = this.reflTex;
    if (!tx || tx.image.width !== w || tx.image.height !== h) { tx = new THREE.DataTexture(d, w, h, THREE.RGBAFormat, THREE.UnsignedByteType); tx.minFilter = tx.magFilter = THREE.NearestFilter; tx.generateMipmaps = false; tx.needsUpdate = true; this.reflTex = tx; this.pFinal.u.uRefl.value = tx; }
    else { tx.image.data.set(d); tx.needsUpdate = true; }
    this.pFinal.u.uReflSize.value.set(w, h);
  }
  render() {
    const r = this.r, fx = this.fx, U = this.pFinal.u;
    r.autoClear = false; this.tex.needsUpdate = true;
    r.setRenderTarget(this.rtA); r.clear(); r.render(this.pBase.s, this.cam); r.render(fx.scene, fx.cam);          // the sprites, then the effects over them
    r.setRenderTarget(this.rtB); r.clear(); r.render(this.pBright.s, this.cam);                                      // the bright parts, blurred twice over (at half size)
    const hx = 1 / (this.W >> 1), hy = 1 / (this.H >> 1);
    for (let i = 0; i < 2; i++) {
      this.pBlur.u.uTex.value = this.rtB.texture; this.pBlur.u.uDir.value.set(hx * (1 + i), 0); r.setRenderTarget(this.rtC); r.clear(); r.render(this.pBlur.s, this.cam);
      this.pBlur.u.uTex.value = this.rtC.texture; this.pBlur.u.uDir.value.set(0, hy * (1 + i)); r.setRenderTarget(this.rtB); r.clear(); r.render(this.pBlur.s, this.cam);
    }
    // the heat of every warm light on screen (a flame, a brazier, a fireball): where the air will shimmer
    let n = 0; const camX = fx.camX, camY = fx.camY;
    for (const l of fx.lights) {
      if (n >= 8) break; const c = l[4], warm = !c || (c[0] > c[2] * 1.25 && c[0] > 0.6); if (!warm || l[2] < 24) continue;
      const sx = (l[0] - camX) / 384, sy = (l[1] - camY) / 216; if (sx < -0.3 || sx > 1.3 || sy < -0.3 || sy > 1.3) continue;
      U.uHeat.value[n].set(sx, 1 - sy, Math.min(0.2, l[2] / 384 * 0.55), Math.min(1, l[3])); n++;
    }
    U.uHN.value = n; U.uTime.value = fx.time; U.uCam.value.set(camX, camY);
    const want = 0.0009 + Math.max(0, fx.hurt) * 0.014 + Math.max(0, fx.flashA) * 0.007; this.ab += (want - this.ab) * 0.5; U.uAb.value = this.ab < 0.0012 ? 0 : this.ab;          // (tiny offsets are rounded away so the pixel art stays crisp)
    U.uBloomK.value = fx.bloomK === undefined ? 0.55 : fx.bloomK;
    r.setRenderTarget(null); r.clear(); r.render(this.pFinal.s, this.cam);
  }
}
