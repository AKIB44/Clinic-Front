import {
  Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, NgZone,
} from '@angular/core';

const VERT = `
  attribute vec2 aPos; varying vec2 vUv;
  void main(){ vUv = aPos*.5+.5; gl_Position = vec4(aPos,0.,1.); }
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;

// ── Simplex noise ────────────────────────────────────────────────────────────
vec3 p3(vec3 x){ return x-floor(x*(1./289.))*289.; }
vec2 p2(vec2 x){ return x-floor(x*(1./289.))*289.; }
vec3 pm(vec3 x){ return p3(((x*34.)+1.)*x); }
float sn(vec2 v){
  const vec4 C=vec4(.211324865,.366025404,-.577350269,.024390244);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
  i=p2(i);
  vec3 p=pm(pm(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
  m=m*m;m=m*m;
  vec3 x=2.*fract(p*C.www)-1.;
  vec3 h=abs(x)-.5;
  vec3 a0=x-floor(x+.5);
  m*=1.79284291-.85373472*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}

// ── One aurora band ──────────────────────────────────────────────────────────
float band(float y, float ctr, float n, float w){
  return exp(-pow((y-(ctr+n*.20))/w, 2.));
}

void main(){
  vec2 uv = vUv;
  float t  = time * 0.16;

  // Three bands — top, mid, bottom
  float n1 = sn(vec2(uv.x*1.6 + t*.50,       t*.35));
  float n2 = sn(vec2(uv.x*1.2 - t*.40 + 2.1, t*.28 + 1.3));
  float n3 = sn(vec2(uv.x*1.9 + t*.35 + 4.7, t*.32 + 2.6));

  float b1 = band(uv.y, 0.72, n1, 0.13);
  float b2 = band(uv.y, 0.45, n2, 0.12);
  float b3 = band(uv.y, 0.18, n3, 0.11);

  float p1 = .50 + .14*sin(t*1.0);
  float p2 = .48 + .13*sin(t*0.85 + 1.3);
  float p3 = .46 + .12*sin(t*1.1  + 2.6);

  vec3 col = c1*b1*p1 + c2*b2*p2 + c3*b3*p3;

  // Final premultiplied-alpha composite
  float a = clamp(length(col) * 0.95, 0., 0.58);
  gl_FragColor = vec4(col * a, a);
}
`;

@Component({
  selector: 'app-aurora-bg',
  standalone: true,
  template: `<canvas #c></canvas>`,
  styles: [`:host{display:block;position:absolute;inset:0;margin:0;padding:0;pointer-events:none;}
            canvas{width:100%;height:100%;display:block;margin:0;padding:0;}`],
})
export class AuroraBgComponent implements AfterViewInit, OnDestroy {
  @ViewChild('c') ref!: ElementRef<HTMLCanvasElement>;

  // #22068e and slightly lighter tonal siblings
  private readonly C1 = [0.18, 0.06, 0.72];  // #2e0fb8
  private readonly C2 = [0.13, 0.04, 0.58];  // #220a94
  private readonly C3 = [0.24, 0.08, 0.82];  // #3d14d1

  private gl!: WebGLRenderingContext;
  private prog!: WebGLProgram;
  private vbo!: WebGLBuffer;
  private uTime!: WebGLUniformLocation;
  private canvas!: HTMLCanvasElement;
  private rafId = 0;
  private t0 = 0;

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

  ngOnDestroy() { cancelAnimationFrame(this.rafId); }

  private boot() {
    if (!this.initGL()) return;
    this.zone.runOutsideAngular(() => {
      this.t0    = performance.now();
      this.rafId = requestAnimationFrame(t => this.loop(t));
    });
  }

  private initGL(): boolean {
    const opts: WebGLContextAttributes =
      { alpha: true, depth: false, stencil: false, antialias: false };
    const gl = (
      this.canvas.getContext('webgl2', opts) ??
      this.canvas.getContext('webgl',  opts) ??
      this.canvas.getContext('experimental-webgl', opts)
    ) as WebGLRenderingContext | null;
    if (!gl) return false;
    this.gl = gl;

    const mkShader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s); return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, mkShader(gl.VERTEX_SHADER,   VERT));
    gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    this.prog = prog;

    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, -1,1, 1,1, -1,-1, 1,1, 1,-1]), gl.STATIC_DRAW);

    this.uTime = gl.getUniformLocation(prog, 'time')!;

    gl.useProgram(prog);
    const u3 = (n: string, v: number[]) =>
      gl.uniform3f(gl.getUniformLocation(prog, n), v[0], v[1], v[2]);
    u3('c1', this.C1); u3('c2', this.C2); u3('c3', this.C3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  private resize() {
    const c = this.canvas;
    const w = c.clientWidth  || c.offsetWidth  || 800;
    const h = c.clientHeight || c.offsetHeight || 600;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  private loop(now: number) {
    this.resize();
    const gl = this.gl;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform1f(this.uTime, (now - this.t0) / 1000);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    this.rafId = requestAnimationFrame(t => this.loop(t));
  }
}
