import { Landmark } from './types';

/**
 * Calculates the angle between three points (A, B, C) where B is the vertex.
 * Returns angle in degrees.
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

/**
 * Normalizes landmark coordinates if they are relative to image dimensions.
 * MediaPipe usually provides coordinates between 0 and 1.
 */
export function getDistance(a: Landmark, b: Landmark): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

export function isBetween(val: number, min: number, max: number): boolean {
  return val >= min && val <= max;
}
