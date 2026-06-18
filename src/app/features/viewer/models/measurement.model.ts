import { Vec3 } from '../constants/dental-views.const';

// Linear measurement between two surface points (PRD §6.1). GV-3 populates these.
export interface Measurement {
  id: string;
  a: Vec3;          // world-space point A
  b: Vec3;          // world-space point B
  distanceMm: number;
}
