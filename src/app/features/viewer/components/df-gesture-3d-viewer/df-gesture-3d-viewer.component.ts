import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Output, EventEmitter,
  inject, effect, signal, ChangeDetectionStrategy,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';
import { ViewerStore } from '../../store/viewer.store';
import { ModelLoaderService } from '../../services/model-loader.service';
import { MeasurementService } from '../../services/measurement.service';
import { LIGHTING, MATERIAL_PRESETS } from '../../constants/material-presets.const';
import { GESTURE_VIEWER_CALIBRATION } from '../../constants/gesture-config.const';
import { DENTAL_VIEWS, DENTAL_VIEW_ORDER, DentalViewKey } from '../../constants/dental-views.const';
import { ModelFormat } from '../../models/viewer-state.model';

export type SectionAxis = 'x' | 'y' | 'z';

interface ViewTween {
  fromPos: THREE.Vector3; toPos: THREE.Vector3;
  fromUp: THREE.Vector3;  toUp: THREE.Vector3;
  start: number; dur: number;
}

/** OrbitControls internal API — spherical orbit + pan offset reset for center lock. */
type OrbitInternals = OrbitControls & {
  _rotateLeft(angle: number): void;
  _rotateUp(angle: number): void;
  _dollyIn(scale: number): void;
  _dollyOut(scale: number): void;
  _panOffset: THREE.Vector3;
  _spherical: THREE.Spherical;
  update(): boolean;
};

interface GestureViewAnchor {
  radius: number;
  theta: number;
  phi: number;
  target: THREE.Vector3;
  up: THREE.Vector3;
}

const TWO_PI = 2 * Math.PI;

@Component({
  selector: 'df-gesture-3d-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './df-gesture-3d-viewer.component.html',
  styleUrl: './df-gesture-3d-viewer.component.scss',
})
export class DfGesture3dViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLDivElement>;
  @Output() loaded = new EventEmitter<void>();
  @Output() annotationPick = new EventEmitter<[number, number, number]>();

  readonly store  = inject(ViewerStore);
  private loader  = inject(ModelLoaderService);
  private measure = inject(MeasurementService);

  private renderer?: THREE.WebGLRenderer;
  private labelRenderer?: CSS2DRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private content?: THREE.Object3D;
  private raf = 0;
  private ro?: ResizeObserver;
  private fitRadius = 1;
  private tween: ViewTween | null = null;
  private gestureAnchor: GestureViewAnchor | null = null;
  private zoomSessionActive = false;
  private zoomBaseRadius = 0;

  // GV-3 dental tools
  private overlay = new THREE.Group();          // measurement lines/labels + annotations
  private pendingPick: THREE.Vector3[] = [];
  private sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  private readonly sectionAxis = signal<SectionAxis>('x');
  private readonly sectionPos = signal(0.5);     // 0..1 along the axis
  private pointerDownAt: { x: number; y: number } | null = null;

  // GV-4 before/after comparison
  private comparisonObj?: THREE.Object3D;
  private static readonly LOD_TRIANGLES = 1_500_000;   // large-model threshold (GEC-7)

  // FPS bookkeeping
  private frames = 0;
  private fpsClock = 0;

  constructor() {
    // Re-render overlays + clipping reactively from the store.
    effect(() => { this.store.measurements(); this.store.annotations(); this.syncOverlay(); });
    effect(() => { this.applySection(this.store.sectionPlaneActive(), this.sectionAxis(), this.sectionPos()); });
    effect(() => { this.applyComparison(this.store.comparisonOpacity(), this.store.comparisonVisible()); });
    // Picking modes disable orbit so a tap doesn't rotate.
    effect(() => {
      const measuring = this.store.measureMode();
      const picking = measuring || this.store.annotateMode();
      if (this.controls) this.controls.enableRotate = !picking;
      if (this.host) this.host.nativeElement.style.cursor = picking ? 'crosshair' : '';
      if (!measuring && this.pendingPick.length) { this.pendingPick = []; this.syncOverlay(); }
    });
  }

  ngAfterViewInit(): void {
    this.initScene();
    document.addEventListener('fullscreenchange', this.onFsChange);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    document.removeEventListener('fullscreenchange', this.onFsChange);
    this.clearOverlay();
    this.clearComparison();
    if (this.content) this.disposeObject(this.content);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.labelRenderer?.domElement.remove();
  }

  // ── scene setup ────────────────────────────────────────────────────────────
  private initScene(): void {
    const el = this.host.nativeElement;
    const w = el.clientWidth || 800, h = el.clientHeight || 600;

    // GEC-9 — no WebGL → graceful message, no scene.
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
      this.store.phase.set('error');
      this.store.modelError.set("Your browser doesn't support 3D rendering. Please use Chrome or Edge.");
      return;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(MATERIAL_PRESETS.background);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 5000);
    this.camera.position.set(0, 0, 200);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.localClippingEnabled = true;        // section plane (GV-3)
    el.appendChild(this.renderer.domElement);
    this.scene.add(this.overlay);

    // CSS2D layer for measurement + annotation labels (always faces camera).
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    const lr = this.labelRenderer.domElement;
    lr.style.position = 'absolute'; lr.style.top = '0'; lr.style.left = '0'; lr.style.pointerEvents = 'none';
    el.appendChild(lr);

    // Click-to-pick (measure / annotate). A real click = small pointer travel.
    this.renderer.domElement.addEventListener('pointerdown', (e) => { this.pointerDownAt = { x: e.clientX, y: e.clientY }; });
    this.renderer.domElement.addEventListener('pointerup', (e) => this.onPick(e));

    this.scene.add(new THREE.AmbientLight(LIGHTING.ambient.color, LIGHTING.ambient.intensity));
    for (const l of [LIGHTING.key, LIGHTING.fill, LIGHTING.rim]) {
      const d = new THREE.DirectionalLight(l.color, l.intensity);
      d.position.set(l.position[0], l.position[1], l.position[2]);
      this.scene.add(d);
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    // Drop any active snap tween the moment the user grabs the model.
    this.controls.addEventListener('start', () => { this.tween = null; });
    this.renderer.domElement.addEventListener('dblclick', () => this.resetView());

    this.ro = new ResizeObserver(() => this.onResize());
    this.ro.observe(el);

    this.animate();
  }

  private animate = (): void => {
    this.raf = requestAnimationFrame(this.animate);
    const now = performance.now();

    if (this.tween) this.applyTween(now);
    this.controls?.update();

    const t0 = now;
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer?.render(this.scene, this.camera);
    }
    this.store.renderTime.set(Math.round((performance.now() - t0) * 10) / 10);

    // FPS over ~500ms windows
    this.frames++;
    if (now - this.fpsClock >= 500) {
      this.store.fps.set(Math.round((this.frames * 1000) / (now - this.fpsClock)));
      this.frames = 0; this.fpsClock = now;
    }
  };

  // ── public API (called by the page / toolbar / keyboard) ───────────────────
  async loadBuffer(buffer: ArrayBuffer, format: ModelFormat, name: string): Promise<void> {
    if (!this.scene) return;
    this.store.modelFormat.set(format);
    this.store.modelName.set(name);
    this.store.modelError.set(null);
    this.store.phase.set('decoding');
    // New model → drop stale overlays from the previous one.
    this.pendingPick = [];
    this.store.measurements.set([]);
    this.store.annotations.set([]);
    this.clearComparison();

    if (this.content) { this.scene.remove(this.content); this.disposeObject(this.content); this.content = undefined; }

    try {
      const obj = await this.loader.parse(format, buffer);
      this.store.phase.set('rendering');
      this.placeAndFit(obj);
      const s = this.loader.meshStats(obj);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const r = (n: number) => Math.round(n);
      this.store.modelStats.set({ triangles: s.triangles, vertices: s.vertices, dimensions: `${r(size.x)} × ${r(size.y)} × ${r(size.z)} units` });
      this.store.isLargeModel.set(s.triangles > DfGesture3dViewerComponent.LOD_TRIANGLES);   // GEC-7
      this.store.phase.set('ready');
      this.loaded.emit();
    } catch (e) {
      this.fail(e);
    }
  }

  fail(e: unknown): void {
    console.warn('[viewer]', e);
    this.store.phase.set('error');
    this.store.modelError.set('Unable to load model — file may be corrupt or unsupported.');
  }

  resetView(): void { this.snapToView('ANTERIOR'); }

  snapToView(key: DentalViewKey): void {
    if (!this.camera || !this.controls) return;
    this.store.currentView.set(key);
    const v = DENTAL_VIEWS[key];
    const dir = new THREE.Vector3(...v.position).normalize();
    const dist = this.fitRadius / Math.sin((this.camera.fov * Math.PI) / 360) * 1.15;
    this.tween = {
      fromPos: this.camera.position.clone(),
      toPos: dir.multiplyScalar(dist),
      fromUp: this.camera.up.clone(),
      toUp: new THREE.Vector3(...v.up),
      start: performance.now(), dur: 320,
    };
    this.controls.target.set(0, 0, 0);
  }

  snapToIndex(i: number): void {
    const key = DENTAL_VIEW_ORDER[i];
    if (key) this.snapToView(key);
  }

  toggleFullscreen(): void {
    const el = this.host.nativeElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  screenshot(): string {
    // preserveDrawingBuffer keeps the framebuffer readable.
    this.renderer?.render(this.scene!, this.camera!);
    return this.renderer?.domElement.toDataURL('image/png') ?? '';
  }

  // ── gesture 3D orbit (OrbitControls spherical — position persists) ─────────

  setGestureOrbitActive(active: boolean): void {
    if (!this.controls) return;
    const cal = GESTURE_VIEWER_CALIBRATION;
    if (active) {
      this.controls.enablePan = false;
      this.controls.target.set(0, 0, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = cal.dampingFactor;
    } else {
      this.controls.enablePan = true;
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.zoomSessionActive = false;
    }
  }

  /** Thumb + index touch — save current cavity angle & zoom as the zoom anchor. */
  lockGestureAnchor(): void {
    const controls = this.controls as OrbitInternals | undefined;
    if (!controls || !this.camera) return;

    controls.update();
    const s = controls._spherical;
    this.gestureAnchor = {
      radius: s.radius,
      theta: s.theta,
      phi: s.phi,
      target: controls.target.clone(),
      up: this.camera.up.clone(),
    };
    this.zoomSessionActive = false;
  }

  readonly hasGestureAnchor = (): boolean => this.gestureAnchor !== null;

  private restoreGestureAnchor(): void {
    const controls = this.controls as OrbitInternals | undefined;
    if (!controls || !this.camera || !this.gestureAnchor) return;

    const a = this.gestureAnchor;
    controls._spherical.radius = a.radius;
    controls._spherical.theta = a.theta;
    controls._spherical.phi = a.phi;
    controls.target.copy(a.target);
    this.camera.up.copy(a.up);
    controls._panOffset.set(0, 0, 0);
    controls.update();
  }

  /**
   * Absolute anchored zoom — `ratio` is currentFingerSpan / spanAtPinchStart
   * (hand-scale normalized by the mapper). Camera distance tracks it directly:
   * radius = anchorRadius / ratio^zoomGamma, eased and clamped to the model's
   * fit radius. Returning the fingers to their starting span returns the view
   * to the starting zoom — repeatable like a calibrated instrument.
   */
  applyGestureZoom(ratio: number): void {
    const controls = this.controls as OrbitInternals | undefined;
    if (!controls || !this.camera) return;

    this.tween = null;
    controls.enablePan = false;
    const cal = GESTURE_VIEWER_CALIBRATION;

    if (!this.zoomSessionActive) {
      // New pinch: zoom FROM the locked cavity anchor when one exists,
      // otherwise from wherever the camera currently is.
      if (this.gestureAnchor) this.restoreGestureAnchor();
      controls.update();
      this.zoomBaseRadius = controls._spherical.radius;
      this.zoomSessionActive = true;
    } else if (this.gestureAnchor) {
      // Keep the locked angle steady while the pinch drives distance.
      const a = this.gestureAnchor;
      controls._spherical.theta = a.theta;
      controls._spherical.phi = a.phi;
      controls.target.copy(a.target);
      this.camera.up.copy(a.up);
      controls._panOffset.set(0, 0, 0);
    }

    const minR = this.fitRadius * cal.zoomMinFit;
    const maxR = this.fitRadius * cal.zoomMaxFit;
    const target = Math.min(maxR, Math.max(minR, this.zoomBaseRadius / Math.pow(ratio, cal.zoomGamma)));

    const s = controls._spherical;
    s.radius += (target - s.radius) * cal.zoomLerp;

    controls.update();
    if (this.gestureAnchor) this.gestureAnchor.radius = controls._spherical.radius;
  }

  applyGestureOrbit(dx: number, dy: number): void {
    const controls = this.controls as OrbitInternals | undefined;
    if (!controls || !this.renderer) return;

    this.tween = null;
    controls.enablePan = false;
    const cal = GESTURE_VIEWER_CALIBRATION;

    this.zoomSessionActive = false;
    controls.target.set(0, 0, 0);
    controls._panOffset.set(0, 0, 0);

    const h = this.renderer.domElement.clientHeight || 600;
    const rotUnit = (TWO_PI / h) * controls.rotateSpeed * cal.rotateMultiplier;
    const px = dx * h;
    const py = dy * h;

    if (Math.abs(px) > 0.05) controls._rotateLeft(px * rotUnit);
    if (Math.abs(py) > 0.05) controls._rotateUp(py * rotUnit);

    controls.update();

    if (this.gestureAnchor) {
      this.gestureAnchor.radius = controls._spherical.radius;
      this.gestureAnchor.theta = controls._spherical.theta;
      this.gestureAnchor.phi = controls._spherical.phi;
      this.gestureAnchor.target.copy(controls.target);
      this.gestureAnchor.up.copy(this.camera!.up);
    }
  }

  // ── before/after comparison + LOD (GV-4) ───────────────────────────────────
  async loadComparison(buffer: ArrayBuffer, format: ModelFormat, name: string): Promise<boolean> {
    if (!this.scene) return false;
    this.clearComparison();
    try {
      const obj = await this.loader.parse(format, buffer);
      const box = new THREE.Box3().setFromObject(obj);
      obj.position.sub(box.getCenter(new THREE.Vector3()));   // align to origin with the primary model
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = new THREE.MeshStandardMaterial({
            color: 0x60a5fa, transparent: true, opacity: this.store.comparisonOpacity(),
            metalness: 0.05, roughness: 0.6, depthWrite: false,
          });
        }
      });
      this.comparisonObj = obj;
      obj.visible = this.store.comparisonVisible();
      this.scene.add(obj);
      this.store.comparisonName.set(name);
      return true;
    } catch (e) { console.warn('[compare]', e); return false; }
  }

  private applyComparison(opacity: number, visible: boolean): void {
    if (!this.comparisonObj) return;
    this.comparisonObj.visible = visible;
    this.comparisonObj.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.Material | undefined;
      if (mat) { (mat as THREE.MeshStandardMaterial).opacity = opacity; mat.transparent = true; }
    });
  }

  clearComparison(): void {
    if (this.comparisonObj && this.scene) { this.scene.remove(this.comparisonObj); this.disposeObject(this.comparisonObj); }
    this.comparisonObj = undefined;
    this.store.comparisonName.set(null);
  }

  /** Decimate the primary mesh for smoother interaction on large files (GV-4 / GEC-7).
   *  Synchronous (SimplifyModifier) — Web-Worker decimation is a further optimisation. */
  optimizeModel(): void {
    if (!this.content) return;
    const mod = new SimplifyModifier();
    this.content.traverse((o) => {
      const m = o as THREE.Mesh;
      const g = m.geometry as THREE.BufferGeometry | undefined;
      if (m.isMesh && g) {
        const count = g.getAttribute('position')?.count ?? 0;
        const remove = Math.floor(count * 0.5);
        if (remove > 0) { try { m.geometry = mod.modify(g, remove); } catch (e) { console.warn('[lod]', e); } }
      }
    });
    const s = this.loader.meshStats(this.content);
    const cur = this.store.modelStats();
    this.store.modelStats.set({ triangles: s.triangles, vertices: s.vertices, dimensions: cur?.dimensions ?? '' });
    this.store.isLargeModel.set(false);
  }

  // ── dental tools (GV-3) ────────────────────────────────────────────────────
  setSectionAxis(a: SectionAxis): void { this.sectionAxis.set(a); }
  setSectionPos(p: number): void { this.sectionPos.set(Math.max(0, Math.min(1, p))); }

  private onPick(e: PointerEvent): void {
    if (!this.content || !this.camera || !this.renderer) return;
    if (!this.store.measureMode() && !this.store.annotateMode()) return;
    const d = this.pointerDownAt; this.pointerDownAt = null;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;   // was a drag, not a tap

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const p = this.measure.pick(ndc, this.camera, this.content);
    if (!p) return;

    if (this.store.annotateMode()) { this.annotationPick.emit([p.x, p.y, p.z]); return; }

    this.pendingPick.push(p);
    if (this.pendingPick.length === 2) {
      this.store.addMeasurement(this.measure.make(this.pendingPick[0], this.pendingPick[1]));
      this.pendingPick = [];
    } else {
      this.syncOverlay();   // show the first endpoint
    }
  }

  private syncOverlay(): void {
    if (!this.scene) return;
    this.clearOverlay();
    for (const m of this.store.measurements()) {
      const a = new THREE.Vector3(...m.a), b = new THREE.Vector3(...m.b);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([a, b]),
        new THREE.LineBasicMaterial({ color: 0x34d399, depthTest: false }),
      );
      line.renderOrder = 998;
      this.overlay.add(line, this.dot(a, 0x34d399), this.dot(b, 0x34d399));
      this.overlay.add(this.label(this.measure.format(m.distanceMm), a.clone().add(b).multiplyScalar(0.5), 'meas'));
    }
    for (const an of this.store.annotations()) {
      this.overlay.add(this.dot(new THREE.Vector3(...an.position), 0xa78bfa));
      this.overlay.add(this.label(an.text, new THREE.Vector3(...an.position), 'anno'));
    }
    for (const p of this.pendingPick) this.overlay.add(this.dot(p, 0xfbbf24));
  }

  private dot(v: THREE.Vector3, color: number): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(this.fitRadius * 0.012, 0.01), 12, 12),
      new THREE.MeshBasicMaterial({ color, depthTest: false }),
    );
    m.position.copy(v); m.renderOrder = 999;
    return m;
  }

  private label(text: string, v: THREE.Vector3, variant: 'meas' | 'anno'): CSS2DObject {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      padding: '3px 8px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700',
      whiteSpace: 'nowrap', transform: 'translateY(-14px)', pointerEvents: 'none',
      color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif",
      background: variant === 'meas' ? 'rgba(5,150,105,.92)' : 'rgba(109,40,217,.92)',
      boxShadow: '0 4px 12px -4px rgba(0,0,0,.6)',
    } as CSSStyleDeclaration);
    const obj = new CSS2DObject(el); obj.position.copy(v);
    return obj;
  }

  private clearOverlay(): void {
    for (const c of [...this.overlay.children]) {
      this.overlay.remove(c);
      if (c instanceof CSS2DObject) { c.element.remove(); }
      else { const a = c as THREE.Mesh; a.geometry?.dispose?.(); (a.material as THREE.Material)?.dispose?.(); }
    }
  }

  private applySection(active: boolean, axis: SectionAxis, pos: number): void {
    const planes: THREE.Plane[] = [];
    if (active && this.content) {
      this.sectionPlane.normal.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
      this.sectionPlane.constant = -((pos * 2 - 1) * this.fitRadius);
      planes.push(this.sectionPlane);
    }
    this.content?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        (mat as THREE.Material).clippingPlanes = planes;
        (mat as THREE.Material).side = active ? THREE.DoubleSide : THREE.FrontSide;
        (mat as THREE.Material).needsUpdate = true;
      }
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────
  private placeAndFit(obj: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);

    const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
    this.fitRadius = sphere.radius || Math.max(size.x, size.y, size.z) / 2 || 1;

    if (this.camera) {
      this.camera.near = this.fitRadius / 100;
      this.camera.far = this.fitRadius * 100;
      this.camera.updateProjectionMatrix();
    }
    this.scene!.add(obj);
    this.content = obj;
    this.snapToView('ANTERIOR');
  }

  private applyTween(now: number): void {
    if (!this.camera || !this.tween) return;
    const t = Math.min(1, (now - this.tween.start) / this.tween.dur);
    const e = 1 - Math.pow(1 - t, 3);                 // easeOutCubic
    this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e);
    this.camera.up.lerpVectors(this.tween.fromUp, this.tween.toUp, e).normalize();
    if (t >= 1) this.tween = null;
  }

  private onResize(): void {
    const el = this.host.nativeElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h || !this.renderer || !this.camera) return;
    this.renderer.setSize(w, h);
    this.labelRenderer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private onFsChange = (): void => {
    this.store.isFullscreen.set(!!document.fullscreenElement);
    setTimeout(() => this.onResize(), 60);
  };

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }
}
