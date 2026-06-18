/** 1€ filter — low-latency smoothing for noisy hand landmarks (Casiez et al.). */

function smoothingFactor(cutoff: number, dtSec: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtSec);
}

export class OneEuroFilter {
  private x = 0;
  private dx = 0;
  private ready = false;

  constructor(
    private readonly minCutoff = 1.5,
    private readonly beta = 0.018,
    private readonly dCutoff = 1.0,
  ) {}

  reset(value?: number): void {
    this.ready = false;
    this.dx = 0;
    if (value !== undefined) {
      this.x = value;
      this.ready = true;
    }
  }

  filter(value: number, dtMs: number): number {
    const dt = Math.max(1, dtMs) / 1000;
    if (!this.ready) {
      this.x = value;
      this.ready = true;
      return value;
    }
    const ad = smoothingFactor(this.dCutoff, dt);
    const edx = (value - this.x) / dt;
    this.dx = ad * edx + (1 - ad) * this.dx;
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    const a = smoothingFactor(cutoff, dt);
    this.x = a * value + (1 - a) * this.x;
    return this.x;
  }
}
