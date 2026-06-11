import {
  Component, ElementRef, Input, ViewChild, AfterViewInit, OnDestroy, OnChanges,
  inject, signal, computed, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FileCacheService } from '../../services/file-cache.service';

type Phase = 'idle' | 'connecting' | 'downloading' | 'decoding' | 'rendering' | 'ready' | 'error';

const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R;
const RANK: Record<Phase, number> = {
  idle: 0, connecting: 1, downloading: 1, decoding: 2, rendering: 3, ready: 4, error: 0,
};

@Component({
  selector: 'df-3d-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TablerIconsModule],
  template: `
    <div class="v3-wrap">
      <div #host class="v3-host"></div>

      @if (phase() !== 'ready' && phase() !== 'idle' && phase() !== 'error') {
        <div class="v3-overlay">
          <div class="v3-ringwrap">
            <svg class="v3-ring" viewBox="0 0 80 80">
              <circle class="v3-ring-bg" cx="40" cy="40" [attr.r]="R"></circle>
              <circle class="v3-ring-fg" cx="40" cy="40" [attr.r]="R"
                      [attr.stroke-dasharray]="C" [attr.stroke-dashoffset]="ringOffset()"></circle>
            </svg>
            <div class="v3-ring-center">
              <i-tabler [name]="centerIcon()" class="icon-22 v3-pulse"></i-tabler>
              <span class="v3-pct">{{ overall() }}%</span>
            </div>
          </div>

          <div class="v3-phase">{{ phaseLabel() }}</div>

          <div class="v3-steps">
            @for (s of steps(); track s.label) {
              <div class="v3-step" [class.done]="s.state === 'done'" [class.active]="s.state === 'active'">
                <span class="v3-step-icon">
                  @if (s.state === 'done') { <i-tabler name="check" class="icon-14"></i-tabler> }
                  @else { <i-tabler [name]="s.icon" class="icon-14"></i-tabler> }
                </span>
                <span class="v3-step-label">{{ s.label }}</span>
              </div>
            }
          </div>
        </div>
      } @else if (phase() === 'error') {
        <div class="v3-overlay v3-err">
          <i-tabler name="cube-off" class="icon-32"></i-tabler>
          <span>Could not load this model.</span>
        </div>
      }

      @if (phase() === 'ready' && stats(); as s) {
        <div class="v3-stats">
          <span class="v3-chip"><b>{{ s.tris | number }}</b> triangles</span>
          <span class="v3-chip"><b>{{ s.verts | number }}</b> vertices</span>
          <span class="v3-chip">{{ s.dim }}</span>
        </div>
      }
      <div class="v3-hint">Drag to rotate · scroll to zoom · right-drag to pan</div>
    </div>
  `,
  styles: [`
    .v3-wrap { position: relative; width: 100%; height: 100%; min-height: 460px; background: radial-gradient(circle at 50% 36%, #1e293b, #0b1222 72%); border-radius: 10px; overflow: hidden; }
    .v3-host { width: 100%; height: 100%; }
    .v3-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: #e2e8f0; }

    .v3-ringwrap { position: relative; width: 96px; height: 96px; }
    .v3-ring { width: 96px; height: 96px; transform: rotate(-90deg); }
    .v3-ring-bg { fill: none; stroke: rgba(255,255,255,.10); stroke-width: 6; }
    .v3-ring-fg { fill: none; stroke: #2dd4bf; stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset .35s cubic-bezier(.4,0,.2,1); filter: drop-shadow(0 0 5px rgba(45,212,191,.5)); }
    .v3-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; color: #5eead4; }
    .v3-pct { font-size: 13px; font-weight: 700; color: #e2e8f0; }
    .v3-pulse { animation: v3-pulse 1.3s ease-in-out infinite; }
    @keyframes v3-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .55; transform: scale(.9); } }

    .v3-phase { font-size: 14px; font-weight: 600; letter-spacing: .2px; }

    .v3-steps { display: flex; align-items: center; gap: 8px; }
    .v3-step { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,.05); color: #64748b; transition: all .25s ease; }
    .v3-step-icon { display: flex; }
    .v3-step.active { background: rgba(45,212,191,.16); color: #5eead4; }
    .v3-step.active .v3-step-icon { animation: v3-spin 1.4s linear infinite; }
    .v3-step.done { background: rgba(34,197,94,.16); color: #86efac; }
    @keyframes v3-spin { to { transform: rotate(360deg); } }

    .v3-err { gap: 10px; color: #fca5a5; }
    .v3-stats { position: absolute; top: 10px; left: 10px; display: flex; flex-wrap: wrap; gap: 6px; animation: v3-fade .5s ease both; }
    .v3-chip { background: rgba(15,23,42,.6); color: #cbd5e1; border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 3px 10px; font-size: 11px; b { color: #5eead4; } }
    @keyframes v3-fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; } }
    .v3-hint { position: absolute; left: 10px; bottom: 8px; color: #64748b; font-size: 11px; }
  `],
})
export class Df3dViewerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  @Input() patientId = '';
  @Input() fileId = '';
  @Input() filename = '';

  private cache = inject(FileCacheService);
  readonly R = RING_R; readonly C = RING_C;
  private readonly DECODE_MIN = 550;  // min ms each phase is shown so the journey is visible
  private readonly RENDER_MIN = 500;

  readonly phase    = signal<Phase>('idle');
  readonly progress = signal(0); // real download %
  readonly stats    = signal<{ tris: number; verts: number; dim: string } | null>(null);

  // Overall progress as a forward-only journey: download 6→70, decode 82, render 94, ready 100.
  readonly overall = computed(() => {
    switch (this.phase()) {
      case 'connecting':  return 4;
      case 'downloading': return Math.round(6 + this.progress() * 0.64);
      case 'decoding':    return 82;
      case 'rendering':   return 94;
      case 'ready':       return 100;
      default:            return 0;
    }
  });
  readonly ringOffset = computed(() => RING_C * (1 - this.overall() / 100));
  readonly centerIcon = computed(() => ({
    connecting: 'plug-connected', downloading: 'cloud-download', decoding: 'binary',
    rendering: 'cube', ready: 'check', error: 'cube-off', idle: 'cube',
  }[this.phase()]));
  readonly phaseLabel = computed(() => ({
    connecting: 'Connecting…', downloading: `Downloading model… ${this.progress()}%`,
    decoding: 'Decoding geometry…', rendering: 'Rendering scene…', ready: 'Ready',
    error: 'Failed', idle: '',
  }[this.phase()]));
  readonly steps = computed(() => {
    const r = RANK[this.phase()];
    return [
      { icon: 'cloud-download', label: 'Download', rank: 1 },
      { icon: 'binary',         label: 'Decode',   rank: 2 },
      { icon: 'cube',           label: 'Render',   rank: 3 },
    ].map((s) => ({ ...s, state: r > s.rank ? 'done' : r === s.rank ? 'active' : 'pending' }));
  });

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private content?: THREE.Object3D;
  private raf = 0;
  private ro?: ResizeObserver;
  private ready = false;
  private spawnStart = 0;
  private currentFileId = '';

  ngAfterViewInit(): void { this.initScene(); this.ready = true; if (this.fileId) this.loadModel(); }
  ngOnChanges(): void { if (this.ready && this.fileId) this.loadModel(); }

  private initScene(): void {
    const el = this.host.nativeElement;
    const w = el.clientWidth || 600, h = el.clientHeight || 460;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    this.camera.position.set(0, 0, 200);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h);
    el.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(1, 1, 1); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4); fill.position.set(-1, -0.5, -1); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3); rim.position.set(0, -1, 0.5); this.scene.add(rim);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2.2;
    this.controls.addEventListener('start', () => { if (this.controls) this.controls.autoRotate = false; });

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(el);

    const animate = () => {
      this.raf = requestAnimationFrame(animate);
      if (this.content && this.spawnStart) {
        const t = Math.min(1, (performance.now() - this.spawnStart) / 420);
        this.content.scale.setScalar(1 - Math.pow(1 - t, 3));
        if (t >= 1) this.spawnStart = 0;
      }
      this.controls?.update();
      if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  private extension(): string {
    return (this.filename.includes('.') ? this.filename.split('.').pop()! : '').toLowerCase();
  }

  private loadModel(): void {
    if (!this.scene) return;
    if (this.fileId === this.currentFileId && this.phase() !== 'idle') return;
    this.currentFileId = this.fileId;
    this.phase.set('connecting'); this.progress.set(0); this.stats.set(null);
    if (this.content) { this.scene.remove(this.content); this.disposeObject(this.content); this.content = undefined; }

    const ext = this.extension();
    this.cache.load(this.patientId, this.fileId).subscribe({
      next: (ev) => {
        if (!ev.buffer) { this.phase.set('downloading'); this.progress.set(ev.progress); return; }
        // Show "Decoding" for a beat so the step is visible, then run the (sync) parse.
        this.phase.set('decoding');
        setTimeout(() => {
          try { this.parse(ext, ev.buffer!); } catch (e) { this.fail(e); }
        }, this.DECODE_MIN);
      },
      error: (e) => this.fail(e),
    });
  }

  private parse(ext: string, buf: ArrayBuffer): void {
    if (ext === 'stl') {
      const g = new STLLoader().parse(buf); g.computeVertexNormals();
      this.place(new THREE.Mesh(g, this.material(g)));
    } else if (ext === 'ply') {
      const g = new PLYLoader().parse(buf); if (!g.getAttribute('normal')) g.computeVertexNormals();
      this.place(new THREE.Mesh(g, this.material(g)));
    } else if (ext === 'obj') {
      const obj = new OBJLoader().parse(new TextDecoder().decode(buf));
      obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = this.material(m.geometry as THREE.BufferGeometry); });
      this.place(obj);
    } else if (ext === 'glb' || ext === 'gltf') {
      new GLTFLoader().parse(buf, '', (g) => this.place(g.scene), (e) => this.fail(e));
    } else {
      this.fail('Unsupported 3D format');
    }
  }

  private material(geo?: THREE.BufferGeometry): THREE.Material {
    const hasColor = !!(geo && geo.getAttribute && geo.getAttribute('color'));
    return new THREE.MeshStandardMaterial({
      color: hasColor ? 0xffffff : 0xe5e7ec, vertexColors: hasColor, metalness: 0.08, roughness: 0.55,
    });
  }

  private fail(e: unknown): void { this.phase.set('error'); console.warn('[3d]', e); }

  private place(obj: THREE.Object3D): void {
    this.phase.set('rendering');
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const dist = maxDim / (2 * Math.tan((Math.PI * 45) / 360)) * 1.7;
    this.camera!.position.set(0, 0, dist);
    this.camera!.near = dist / 100; this.camera!.far = dist * 100; this.camera!.updateProjectionMatrix();
    this.controls!.target.set(0, 0, 0); this.controls!.update();

    obj.scale.setScalar(0.001);
    this.scene!.add(obj);
    this.content = obj;
    this.spawnStart = performance.now();

    let tris = 0, verts = 0;
    obj.traverse((o) => {
      const m = o as THREE.Mesh; const g = m.geometry as THREE.BufferGeometry | undefined;
      if (m.isMesh && g) {
        const pos = g.getAttribute('position');
        verts += pos ? pos.count : 0;
        tris += g.index ? g.index.count / 3 : (pos ? pos.count / 3 : 0);
      }
    });
    const r = (n: number) => Math.round(n);
    this.stats.set({ tris: Math.round(tris), verts, dim: `${r(size.x)} × ${r(size.y)} × ${r(size.z)} units` });

    // Let the "Rendering" step show for a beat, then reveal the model.
    setTimeout(() => this.phase.set('ready'), this.RENDER_MIN);
  }

  private onResize(): void {
    const el = this.host.nativeElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h || !this.renderer || !this.camera) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.controls?.dispose();
    if (this.content) this.disposeObject(this.content);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
