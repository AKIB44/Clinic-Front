import {
  Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, Input, NgZone,
} from '@angular/core';

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT = `precision highp float;
attribute vec2 aPosition; varying vec2 vUv;
void main(){ vUv = aPosition * .5 + .5; gl_Position = vec4(aPosition, 0., 1.); }`;

const SPLAT_F = `precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget; uniform float aspectRatio;
uniform vec3 color; uniform vec2 point; uniform float radius;
void main(){
  vec2 p = vUv - point; p.x *= aspectRatio;
  gl_FragColor = vec4(texture2D(uTarget, vUv).rgb + exp(-dot(p,p)/radius) * color, 1.); }`;

const ADVECT_F = `precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity, uSource; uniform vec2 texelSize;
uniform float dt, dissipation;
void main(){
  vec2 c = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = vec4(dissipation * texture2D(uSource, c).rgb, 1.); }`;

const DIV_F = `precision highp float;
varying vec2 vUv; uniform sampler2D uVelocity; uniform vec2 texelSize;
void main(){
  float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.)).x;
  float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.)).x;
  float T = texture2D(uVelocity, vUv + vec2(0., texelSize.y)).y;
  float B = texture2D(uVelocity, vUv - vec2(0., texelSize.y)).y;
  gl_FragColor = vec4(.5*(R-L+T-B), 0., 0., 1.); }`;

const CURL_F = `precision highp float;
varying vec2 vUv; uniform sampler2D uVelocity; uniform vec2 texelSize;
void main(){
  float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.)).y;
  float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.)).y;
  float T = texture2D(uVelocity, vUv + vec2(0., texelSize.y)).x;
  float B = texture2D(uVelocity, vUv - vec2(0., texelSize.y)).x;
  gl_FragColor = vec4(.5*(R-L-T+B), 0., 0., 1.); }`;

const VORT_F = `precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity, uCurl; uniform vec2 texelSize;
uniform float curl, dt;
void main(){
  float L = texture2D(uCurl, vUv - vec2(texelSize.x, 0.)).x;
  float R = texture2D(uCurl, vUv + vec2(texelSize.x, 0.)).x;
  float T = texture2D(uCurl, vUv + vec2(0., texelSize.y)).x;
  float B = texture2D(uCurl, vUv - vec2(0., texelSize.y)).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 f = .5 * vec2(abs(T)-abs(B), abs(R)-abs(L));
  f /= max(length(f), .0001); f *= curl * C; 
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy + f * dt, 0., 1.); }`;

const PRES_F = `precision highp float;
varying vec2 vUv;
uniform sampler2D uPressure, uDivergence; uniform vec2 texelSize;
void main(){
  float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.)).x;
  float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.)).x;
  float T = texture2D(uPressure, vUv + vec2(0., texelSize.y)).x;
  float B = texture2D(uPressure, vUv - vec2(0., texelSize.y)).x;
  float d = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L+R+T+B-d)*.25, 0., 0., 1.); }`;

const GSUB_F = `precision highp float;
varying vec2 vUv;
uniform sampler2D uPressure, uVelocity; uniform vec2 texelSize;
void main(){
  float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.)).x;
  float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.)).x;
  float T = texture2D(uPressure, vUv + vec2(0., texelSize.y)).x;
  float B = texture2D(uPressure, vUv - vec2(0., texelSize.y)).x;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(R-L, T-B), 0., 1.); }`;

const DISP_F = `precision highp float;
varying vec2 vUv; uniform sampler2D uTexture;
void main(){
  vec3 c = texture2D(uTexture, vUv).rgb;
  float a = clamp(length(c) * 2., 0., 1.);
  gl_FragColor = vec4(c * a, a); }`;

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Prog {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
  use(): void;
}
interface SFBO {
  fbo: WebGLFramebuffer; tex: WebGLTexture;
  w: number; h: number; sx: number; sy: number;
  attach(unit: number): number;
}
interface DFBO {
  w: number; h: number; sx: number; sy: number;
  read: SFBO; write: SFBO; swap(): void;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-fluid-canvas',
  standalone: true,
  template: `<canvas #c></canvas>`,
  styles: [`:host { display: block; position: absolute; inset: 0; }
            canvas { width: 100%; height: 100%; display: block; }`],
})
export class FluidCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('c') ref!: ElementRef<HTMLCanvasElement>;

  @Input() colors        = ['#5227FF', '#FF9FFC', '#B497CF'];
  @Input() mouseForce    = 30;
  @Input() autoDemo      = true;
  @Input() autoSpeed     = 0.35;
  @Input() autoIntensity = 2.8;
  @Input() curlStrength  = 28;
  @Input() pressureIter  = 25;
  @Input() splatRadius   = 0.06;   // Gaussian radius — keep small for tight trails

  private gl!: WebGLRenderingContext;
  private canvas!: HTMLCanvasElement;
  private rafId = 0;
  private last  = 0;

  private iF!: number; private fmt!: number;
  private tp!: number; private lin!: number;

  private pSplat!: Prog; private pAdv!: Prog;
  private pDiv!: Prog;   private pCurl!: Prog;
  private pVort!: Prog;  private pPres!: Prog;
  private pGSub!: Prog;  private pDisp!: Prog;

  private vel!: DFBO;  private dye!: DFBO;
  private divF!: SFBO; private curlF!: SFBO; private pres!: DFBO;

  private vbo!: WebGLBuffer;

  // Mouse state — px/py = previous position, -1 means not yet seen
  private mouse = { x: 0.5, y: 0.5, px: -1, py: -1 };

  private colorIdx  = 0;
  private autoAngle = Math.random() * Math.PI * 2;

  // Stored so we can remove them in ngOnDestroy
  private _onMove!: (e: MouseEvent) => void;
  private _onTouch!: (e: TouchEvent) => void;

  constructor(private zone: NgZone) {}

  ngAfterViewInit() {
    this.canvas = this.ref.nativeElement;
    this.resize();
    if (!this.canvas.width || !this.canvas.height) {
      requestAnimationFrame(() => { this.resize(); this.boot(); });
    } else {
      this.boot();
    }
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('touchmove', this._onTouch);
  }

  private boot() {
    if (!this.initGL()) return;
    this.initVBO();
    this.buildProgs();
    this.initFBOs();
    this.bindEvents();
    this.zone.runOutsideAngular(() => {
      this.last  = performance.now();
      this.rafId = requestAnimationFrame(t => this.loop(t));
    });
  }

  // ── WebGL init ──────────────────────────────────────────────────────────────

  private initGL(): boolean {
    const opts: WebGLContextAttributes =
      { alpha: true, depth: false, stencil: false, antialias: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gl: any = this.canvas.getContext('webgl2', opts);
    if (gl) {
      gl.getExtension('EXT_color_buffer_float');
      this.iF = gl.RGBA16F; this.fmt = gl.RGBA;
      this.tp = gl.HALF_FLOAT; this.lin = gl.LINEAR;
    } else {
      gl = this.canvas.getContext('webgl', opts)
        ?? this.canvas.getContext('experimental-webgl', opts);
      if (!gl) return false;
      const hf  = gl.getExtension('OES_texture_half_float');
      const hfl = hf && gl.getExtension('OES_texture_half_float_linear');
      const cb  = hf && gl.getExtension('EXT_color_buffer_half_float');
      if (hf && cb) {
        this.iF = gl.RGBA; this.fmt = gl.RGBA;
        this.tp = hf.HALF_FLOAT_OES; this.lin = hfl ? gl.LINEAR : gl.NEAREST;
      } else {
        this.iF = gl.RGBA; this.fmt = gl.RGBA;
        this.tp = gl.UNSIGNED_BYTE; this.lin = gl.LINEAR;
      }
    }
    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  // ── VBO / blit ──────────────────────────────────────────────────────────────

  private initVBO() {
    const gl = this.gl;
    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, -1,1, 1,1, -1,-1, 1,1, 1,-1]), gl.STATIC_DRAW);
  }

  private blit(dst: SFBO | null, clear = false) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst?.fbo ?? null);
    gl.viewport(0, 0,
      dst?.w ?? gl.drawingBufferWidth,
      dst?.h ?? gl.drawingBufferHeight);
    if (clear) { gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ── Programs ────────────────────────────────────────────────────────────────

  private mkShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s  = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    return s;
  }

  private mkProg(frag: string): Prog {
    const gl = this.gl;
    const p  = gl.createProgram()!;
    gl.attachShader(p, this.mkShader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, this.mkShader(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    const u: Record<string, WebGLUniformLocation | null> = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)!;
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { prog: p, u, use() { gl.useProgram(p); } };
  }

  private buildProgs() {
    this.pSplat = this.mkProg(SPLAT_F);
    this.pAdv   = this.mkProg(ADVECT_F);
    this.pDiv   = this.mkProg(DIV_F);
    this.pCurl  = this.mkProg(CURL_F);
    this.pVort  = this.mkProg(VORT_F);
    this.pPres  = this.mkProg(PRES_F);
    this.pGSub  = this.mkProg(GSUB_F);
    this.pDisp  = this.mkProg(DISP_F);
  }

  // ── FBOs ────────────────────────────────────────────────────────────────────

  private mkFBO(w: number, h: number, filter: number): SFBO {
    const gl  = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.iF, w, h, 0, this.fmt, this.tp, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
    const sx = 1 / w, sy = 1 / h;
    return {
      fbo, tex, w, h, sx, sy,
      attach(unit: number) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        return unit;
      },
    };
  }

  private mkDFBO(w: number, h: number, filter: number): DFBO {
    let r = this.mkFBO(w, h, filter), wr = this.mkFBO(w, h, filter);
    return {
      w, h, sx: r.sx, sy: r.sy,
      get read()  { return r;  },
      get write() { return wr; },
      swap() { [r, wr] = [wr, r]; },
    };
  }

  private simRes(n: number): { w: number; h: number } {
    const ar = this.canvas.width / this.canvas.height;
    return ar > 1
      ? { w: Math.round(n * ar), h: n }
      : { w: n, h: Math.round(n / ar) };
  }

  private initFBOs() {
    const sim = this.simRes(128);
    const dye = this.simRes(512);
    const gl  = this.gl;
    this.vel   = this.mkDFBO(sim.w, sim.h, this.lin);
    this.dye   = this.mkDFBO(dye.w, dye.h, this.lin);
    this.divF  = this.mkFBO(sim.w, sim.h, gl.NEAREST);
    this.curlF = this.mkFBO(sim.w, sim.h, gl.NEAREST);
    this.pres  = this.mkDFBO(sim.w, sim.h, gl.NEAREST);
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  // Returns canvas-normalised [0,1] coords, or null if outside canvas bounds
  private toCanvasCoords(cx: number, cy: number): { x: number; y: number } | null {
    const r = this.canvas.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
    return {
      x: (cx - r.left) / r.width,
      y: 1 - (cy - r.top) / r.height,
    };
  }

  private updateMouse(cx: number, cy: number) {
    const pos = this.toCanvasCoords(cx, cy);
    if (!pos) return;
    if (this.mouse.px < 0) {
      // First ever position — seed prev so delta starts at zero
      this.mouse.px = pos.x;
      this.mouse.py = pos.y;
    }
    this.mouse.x = pos.x;
    this.mouse.y = pos.y;
  }

  private bindEvents() {
    this._onMove  = (e: MouseEvent) => this.updateMouse(e.clientX, e.clientY);
    this._onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      this.updateMouse(t.clientX, t.clientY);
    };
    // document-level so events fire even when content div is on top
    document.addEventListener('mousemove', this._onMove,  { passive: true });
    document.addEventListener('touchmove', this._onTouch, { passive: true });
  }

  // ── Splat ────────────────────────────────────────────────────────────────────

  private hex2rgb(h: string): [number, number, number] {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  private splat(x: number, y: number, dx: number, dy: number, col: [number, number, number]) {
    const gl = this.gl;
    const ar = this.canvas.width / this.canvas.height;
    const p  = this.pSplat;
    p.use();
    gl.uniform1f(p.u['aspectRatio'], ar);
    gl.uniform2f(p.u['point'], x, y);

    // velocity splat
    gl.uniform1i(p.u['uTarget'], this.vel.read.attach(0));
    gl.uniform3f(p.u['color'], dx * this.mouseForce, dy * this.mouseForce, 0);
    gl.uniform1f(p.u['radius'], this.splatRadius * this.splatRadius);
    this.blit(this.vel.write); this.vel.swap();

    // dye splat — 2× wider than velocity
    const [r, g, b] = col;
    gl.uniform1i(p.u['uTarget'], this.dye.read.attach(0));
    gl.uniform3f(p.u['color'],
      r * this.autoIntensity, g * this.autoIntensity, b * this.autoIntensity);
    gl.uniform1f(p.u['radius'], this.splatRadius * this.splatRadius * 2);
    this.blit(this.dye.write); this.dye.swap();
  }

  // ── Resize ───────────────────────────────────────────────────────────────────

  private resize() {
    const c = this.canvas;
    const w = c.clientWidth  || c.offsetWidth  || 800;
    const h = c.clientHeight || c.offsetHeight || 600;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  // ── Main loop ────────────────────────────────────────────────────────────────

  private loop(now: number) {
    const dt = Math.min((now - this.last) / 1000, 0.016);
    this.last = now;
    this.resize();
    const gl = this.gl;
    const v  = this.vel;

    // ── Auto-demo: two counter-rotating orbits ──────────────────────────────
    if (this.autoDemo) {
      this.autoAngle += dt * this.autoSpeed;

      const col1 = this.hex2rgb(this.colors[this.colorIdx % this.colors.length]);
      const col2 = this.hex2rgb(this.colors[(this.colorIdx + 1) % this.colors.length]);

      // Outer orbit
      const a1 = this.autoAngle;
      const r1 = 0.20;
      this.splat(
        0.5 + r1 * Math.cos(a1), 0.5 + r1 * Math.sin(a1),
        -Math.sin(a1) * r1 * this.autoSpeed,
         Math.cos(a1) * r1 * this.autoSpeed, col1);

      // Inner counter-orbit
      const a2 = -(this.autoAngle * 0.73) + Math.PI * 0.6;
      const r2 = 0.12;
      this.splat(
        0.5 + r2 * Math.cos(a2), 0.5 + r2 * Math.sin(a2),
        -Math.sin(a2) * r2 * this.autoSpeed,
         Math.cos(a2) * r2 * this.autoSpeed, col2);

      if (Math.random() < 0.003) this.colorIdx++;
    }

    // ── Mouse / touch trail ─────────────────────────────────────────────────
    if (this.mouse.px >= 0) {
      const dx = this.mouse.x - this.mouse.px;
      const dy = this.mouse.y - this.mouse.py;
      if (Math.abs(dx) + Math.abs(dy) > 0.0002) {
        this.splat(
          this.mouse.x, this.mouse.y,
          dx * 15, dy * 15,
          this.hex2rgb(this.colors[this.colorIdx % this.colors.length]),
        );
      }
      // Advance prev so next frame delta starts from here
      this.mouse.px = this.mouse.x;
      this.mouse.py = this.mouse.y;
    }

    // ── Curl ────────────────────────────────────────────────────────────────
    this.pCurl.use();
    gl.uniform2f(this.pCurl.u['texelSize'], v.sx, v.sy);
    gl.uniform1i(this.pCurl.u['uVelocity'], v.read.attach(0));
    this.blit(this.curlF);

    // ── Vorticity ───────────────────────────────────────────────────────────
    this.pVort.use();
    gl.uniform2f(this.pVort.u['texelSize'], v.sx, v.sy);
    gl.uniform1i(this.pVort.u['uVelocity'], v.read.attach(0));
    gl.uniform1i(this.pVort.u['uCurl'],     this.curlF.attach(1));
    gl.uniform1f(this.pVort.u['curl'],      this.curlStrength);
    gl.uniform1f(this.pVort.u['dt'],        dt);
    this.blit(v.write); v.swap();

    // ── Divergence ──────────────────────────────────────────────────────────
    this.pDiv.use();
    gl.uniform2f(this.pDiv.u['texelSize'], v.sx, v.sy);
    gl.uniform1i(this.pDiv.u['uVelocity'], v.read.attach(0));
    this.blit(this.divF);

    // ── Pressure (Jacobi) ───────────────────────────────────────────────────
    this.pPres.use();
    gl.uniform2f(this.pPres.u['texelSize'],   v.sx, v.sy);
    gl.uniform1i(this.pPres.u['uDivergence'], this.divF.attach(0));
    for (let i = 0; i < this.pressureIter; i++) {
      gl.uniform1i(this.pPres.u['uPressure'], this.pres.read.attach(1));
      this.blit(this.pres.write); this.pres.swap();
    }

    // ── Gradient subtract ───────────────────────────────────────────────────
    this.pGSub.use();
    gl.uniform2f(this.pGSub.u['texelSize'], v.sx, v.sy);
    gl.uniform1i(this.pGSub.u['uPressure'], this.pres.read.attach(0));
    gl.uniform1i(this.pGSub.u['uVelocity'], v.read.attach(1));
    this.blit(v.write); v.swap();

    // ── Advect velocity ─────────────────────────────────────────────────────
    this.pAdv.use();
    gl.uniform2f(this.pAdv.u['texelSize'], v.sx, v.sy);
    gl.uniform1i(this.pAdv.u['uVelocity'], v.read.attach(0));
    gl.uniform1i(this.pAdv.u['uSource'],   v.read.attach(0));
    gl.uniform1f(this.pAdv.u['dt'],          dt);
    gl.uniform1f(this.pAdv.u['dissipation'], 0.98);
    this.blit(v.write); v.swap();

    // ── Advect dye ──────────────────────────────────────────────────────────
    const d = this.dye;
    gl.uniform2f(this.pAdv.u['texelSize'], d.sx, d.sy);
    gl.uniform1i(this.pAdv.u['uVelocity'], v.read.attach(0));
    gl.uniform1i(this.pAdv.u['uSource'],   d.read.attach(1));
    gl.uniform1f(this.pAdv.u['dt'],          dt);
    gl.uniform1f(this.pAdv.u['dissipation'], 0.97);
    this.blit(d.write); d.swap();

    // ── Display ─────────────────────────────────────────────────────────────
    this.pDisp.use();
    gl.uniform1i(this.pDisp.u['uTexture'], d.read.attach(0));
    this.blit(null, true);

    this.rafId = requestAnimationFrame(t => this.loop(t));
  }
}
