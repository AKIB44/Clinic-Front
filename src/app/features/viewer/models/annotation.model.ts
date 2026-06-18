import { Vec3 } from '../constants/dental-views.const';

// Text label pinned to a 3D surface coordinate (PRD §6.4). GV-3 renders via
// CSS2DRenderer and persists to the session attachment metadata (JSONB).
export interface Annotation {
  id: string;
  position: Vec3;   // world-space anchor
  text: string;
  color?: string;
}
