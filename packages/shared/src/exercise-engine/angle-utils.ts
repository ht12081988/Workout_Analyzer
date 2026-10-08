import { Landmark, CompactSpine, SpineCurvatureResult } from './types';

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

/**
 * Fits a 2nd degree polynomial v(u) = a*u^2 + b*u + c using least-squares regression.
 * u is the longitudinal axis along the spine (0 to L), and v is the lateral displacement (curvature height).
 */
export function fitSpinePolynomial(points: Array<{ x: number; y: number }>): { a: number; b: number; c: number } | null {
  const n = points.length;
  if (n < 3) return null;

  let sumU = 0, sumU2 = 0, sumU3 = 0, sumU4 = 0;
  let sumV = 0, sumUV = 0, sumU2V = 0;

  for (let i = 0; i < n; i++) {
    const u = points[i].x;
    const v = points[i].y;
    const u2 = u * u;

    sumU += u;
    sumU2 += u2;
    sumU3 += u2 * u;
    sumU4 += u2 * u2;

    sumV += v;
    sumUV += u * v;
    sumU2V += u2 * v;
  }

  // Solve 3x3 linear system using Cramer's rule:
  // [sumU4  sumU3  sumU2] [a]   [sumU2V]
  // [sumU3  sumU2  sumU ] [b] = [sumUV ]
  // [sumU2  sumU   n    ] [c]   [sumV   ]

  const det = (
    sumU4 * (sumU2 * n - sumU * sumU) -
    sumU3 * (sumU3 * n - sumU * sumU2) +
    sumU2 * (sumU3 * sumU - sumU2 * sumU2)
  );

  if (Math.abs(det) < 1e-10) return null;

  const detA = (
    sumU2V * (sumU2 * n - sumU * sumU) -
    sumU3 * (sumUV * n - sumU * sumV) +
    sumU2 * (sumUV * sumU - sumU2 * sumV)
  );

  const detB = (
    sumU4 * (sumUV * n - sumU * sumV) -
    sumU2V * (sumU3 * n - sumU * sumU2) +
    sumU2 * (sumU3 * sumV - sumUV * sumU2)
  );

  const detC = (
    sumU4 * (sumU2 * sumV - sumUV * sumU) -
    sumU3 * (sumU3 * sumV - sumUV * sumU2) +
    sumU2V * (sumU3 * sumU - sumU2 * sumU2)
  );

  return {
    a: detA / det,
    b: detB / det,
    c: detC / det
  };
}

/**
 * Calculates squared distance from point (px, py) to line segment (x1, y1)-(x2, y2).
 */
function distToSegmentSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) {
    const dx = px - x1;
    const dy = py - y1;
    return dx * dx + dy * dy;
  }
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  const dx = px - projX;
  const dy = py - projY;
  return dx * dx + dy * dy;
}

/**
 * Checks if a normalized (x, y) coordinate is within the exclusion capsule of hanging arms, forearms, or legs.
 */
function isNearLimb(
  x: number,
  y: number,
  exclusions: {
    points: Array<{ x: number; y: number; rSq: number }>;
    segments: Array<{ x1: number; y1: number; x2: number; y2: number; rSq: number }>;
  }
): boolean {
  for (let i = 0; i < exclusions.points.length; i++) {
    const p = exclusions.points[i];
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= p.rSq) {
      return true;
    }
  }

  for (let i = 0; i < exclusions.segments.length; i++) {
    const s = exclusions.segments[i];
    if (distToSegmentSq(x, y, s.x1, s.y1, s.x2, s.y2) <= s.rSq) {
      return true;
    }
  }

  return false;
}

/**
 * Builds exclusion zones for wrists, hands, elbows, upper arms, and forearms to prevent hanging limbs
 * from corrupting spine contour tracking during deep bends and tabletop exercises.
 */
function getLimbExclusions(
  pose: Record<string, Landmark>,
  torsoLength: number
): {
  points: Array<{ x: number; y: number; rSq: number }>;
  segments: Array<{ x1: number; y1: number; x2: number; y2: number; rSq: number }>;
} {
  const points: Array<{ x: number; y: number; rSq: number }> = [];
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number; rSq: number }> = [];

  const handRadius = Math.max(0.035, torsoLength * 0.18);
  const handRadiusSq = handRadius * handRadius;
  const armRadius = Math.max(0.028, torsoLength * 0.14);
  const armRadiusSq = armRadius * armRadius;

  const limbPointKeys = [
    'LEFT_WRIST', 'RIGHT_WRIST',
    'LEFT_INDEX', 'RIGHT_INDEX',
    'LEFT_PINKY', 'RIGHT_PINKY',
    'LEFT_ELBOW', 'RIGHT_ELBOW',
    'LEFT_ANKLE', 'RIGHT_ANKLE',
    'LEFT_HEEL', 'RIGHT_HEEL',
    'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'
  ];

  limbPointKeys.forEach(k => {
    const lm = pose[k];
    if (lm && (lm.visibility === undefined || lm.visibility > 0.20)) {
      points.push({ x: lm.x, y: lm.y, rSq: handRadiusSq });
    }
  });

  // Add arm segment capsules (Shoulder -> Elbow and Elbow -> Wrist)
  const armSegments = [
    ['LEFT_SHOULDER', 'LEFT_ELBOW'],
    ['LEFT_ELBOW', 'LEFT_WRIST'],
    ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
    ['RIGHT_ELBOW', 'RIGHT_WRIST'],
    ['LEFT_HIP', 'LEFT_KNEE'],
    ['RIGHT_HIP', 'RIGHT_KNEE']
  ];

  armSegments.forEach(([k1, k2]) => {
    const lm1 = pose[k1];
    const lm2 = pose[k2];
    if (lm1 && lm2 && (lm1.visibility === undefined || lm1.visibility > 0.20) && (lm2.visibility === undefined || lm2.visibility > 0.20)) {
      segments.push({
        x1: lm1.x,
        y1: lm1.y,
        x2: lm2.x,
        y2: lm2.y,
        rSq: armRadiusSq
      });
    }
  });

  return { points, segments };
}

/**
 * Extracts posterior back boundary points using Vector-Adaptive Normal Raycasting.
 * Uses invariant chiral geometry:
 * In camera 2D space along the Hip -> Shoulder vector (ux, uy):
 * When facing Right (+1), the dorsal back is ALWAYS rotated 90° CCW: (uy, -ux).
 * When facing Left (-1), the dorsal back is ALWAYS rotated 90° CW: (-uy, ux).
 */
export function extractBackContourPoints(
  mask: { data?: Uint8ClampedArray | Uint8Array | Float32Array | number[]; width: number; height: number; getAsFloat32Array?: () => Float32Array; getAsUint8Array?: () => Uint8Array } | any,
  pose: Record<string, Landmark>,
  facingDir = 1
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  if (!mask || !mask.width || !mask.height) return points;

  let maskData: any = mask.data;
  if (!maskData) {
    if (typeof mask.getAsFloat32Array === 'function') {
      try { maskData = mask.getAsFloat32Array(); } catch (e) {}
    } else if (typeof mask.getAsUint8Array === 'function') {
      try { maskData = mask.getAsUint8Array(); } catch (e) {}
    }
  }
  if (!maskData || maskData.length === 0) return points;

  const width = mask.width;
  const height = mask.height;

  const lShoulder = pose['LEFT_SHOULDER'];
  const rShoulder = pose['RIGHT_SHOULDER'];
  const lHip = pose['LEFT_HIP'];
  const rHip = pose['RIGHT_HIP'];

  const shoulder = (lShoulder && rShoulder) ? { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 } : (lShoulder || rShoulder);
  const hip = (lHip && rHip) ? { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 } : (lHip || rHip);

  if (!shoulder || !hip) return points;

  // 1. Compute Spine Vector & Unit Tangent Vector
  const spineDx = shoulder.x - hip.x;
  const spineDy = shoulder.y - hip.y;
  const spineLen = Math.sqrt(spineDx * spineDx + spineDy * spineDy);
  if (spineLen < 0.04) return points;

  const ux = spineDx / spineLen;
  const uy = spineDy / spineLen;

  // 2. Derive Dorsal Normal Vector using invariant 2D sagittal chirality
  // Facing Right (+1): (uy, -ux). Facing Left (-1): (-uy, ux).
  const dorsalNormal = {
    x: uy * facingDir,
    y: -ux * facingDir
  };

  // 3. Build Limb Exclusion zones to prevent hanging arm / leg collision
  const limbExclusions = getLimbExclusions(pose, spineLen);

  // 4. Raycasting along the Dorsal Normal for 16 stations along the spine
  const numStations = 16;
  // Increase search distance so deep arches in Cat pose start well outside the body in ambient background
  const searchDist = Math.max(0.18, spineLen * 0.70);
  const raySteps = 48; // Granular marching steps along the normal ray

  for (let s = 0; s < numStations; s++) {
    const t = 0 + 1.0 * (s / (numStations - 1)); // Along spine from Hip (t=0) to Shoulder (t=1) - full coverage
    const axisX = hip.x + t * spineDx;
    const axisY = hip.y + t * spineDy;

    // Ray starts outside the body on the dorsal side and marches inwards towards the spine axis
    const startX = axisX + dorsalNormal.x * searchDist;
    const startY = axisY + dorsalNormal.y * searchDist;

    let hitPoint: { x: number; y: number } | null = null;
    let sawBackground = false;

    for (let step = 0; step <= raySteps; step++) {
      const alpha = step / raySteps;
      const currX = startX + (axisX - startX) * alpha;
      const currY = startY + (axisY - startY) * alpha;

      const px = Math.floor(currX * width);
      const py = Math.floor(currY * height);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = py * width + px;
        const val = maskData[idx];
        const isForeground = val > 128 || val > 0.5;

        if (!isForeground) {
          sawBackground = true;
        } else if (sawBackground || step >= 3) {
          // Verify this point is not inside an arm/hand occlusion zone
          if (!isNearLimb(currX, currY, limbExclusions)) {
            hitPoint = { x: currX, y: currY };
            break;
          }
        }
      }
    }

    if (hitPoint) {
      points.push(hitPoint);
    }
  }

  return points;
}

/**
 * Extracts cervical (neck and head) posterior contour boundary points using Vector-Adaptive Normal Raycasting.
 * Aligns rays perpendicular to the neck trajectory (Shoulder -> Head) to avoid inflating into giant blobs in tabletop.
 */
export function extractCervicalContourPoints(
  mask: { data?: Uint8ClampedArray | Uint8Array | Float32Array | number[]; width: number; height: number; getAsFloat32Array?: () => Float32Array; getAsUint8Array?: () => Uint8Array } | any,
  pose: Record<string, Landmark>,
  facingDir = 1
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  if (!mask || !mask.width || !mask.height) return points;

  let maskData: any = mask.data;
  if (!maskData) {
    if (typeof mask.getAsFloat32Array === 'function') {
      try { maskData = mask.getAsFloat32Array(); } catch (e) {}
    } else if (typeof mask.getAsUint8Array === 'function') {
      try { maskData = mask.getAsUint8Array(); } catch (e) {}
    }
  }
  if (!maskData || maskData.length === 0) return points;

  const width = mask.width;
  const height = mask.height;

  const lShoulder = pose['LEFT_SHOULDER'];
  const rShoulder = pose['RIGHT_SHOULDER'];
  const lEar = pose['LEFT_EAR'];
  const rEar = pose['RIGHT_EAR'];
  const nose = pose['NOSE'];

  const shoulder = (lShoulder && rShoulder) ? { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 } : (lShoulder || rShoulder);
  const headTop = (lEar && rEar) ? { x: (lEar.x + rEar.x) / 2, y: (lEar.y + rEar.y) / 2 } : (lEar || rEar || nose);

  if (!shoulder || !headTop) return points;

  // 1. Compute Cervical Vector & Unit Tangent
  const neckDx = headTop.x - shoulder.x;
  const neckDy = headTop.y - shoulder.y;
  const neckLen = Math.sqrt(neckDx * neckDx + neckDy * neckDy);
  if (neckLen < 0.02) return points;

  const ux = neckDx / neckLen;
  const uy = neckDy / neckLen;

  // 2. Derive Perpendicular Dorsal Normal for the Neck using invariant chirality
  const dorsalNormal = {
    x: uy * facingDir,
    y: -ux * facingDir
  };

  // 3. Raycast 8 stations along the cervical unit
  const numStations = 8;
  const searchDist = Math.max(0.12, neckLen * 0.70);
  const raySteps = 30;

  for (let s = 0; s < numStations; s++) {
    const t = 0 + 1.0 * (s / (numStations - 1)); // From shoulder (t=0) to head (t=1) - full coverage
    const axisX = shoulder.x + t * neckDx;
    const axisY = shoulder.y + t * neckDy;

    const startX = axisX + dorsalNormal.x * searchDist;
    const startY = axisY + dorsalNormal.y * searchDist;

    let hitPoint: { x: number; y: number } | null = null;
    let sawBackground = false;

    for (let step = 0; step <= raySteps; step++) {
      const alpha = step / raySteps;
      const currX = startX + (axisX - startX) * alpha;
      const currY = startY + (axisY - startY) * alpha;

      const px = Math.floor(currX * width);
      const py = Math.floor(currY * height);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = py * width + px;
        const val = maskData[idx];
        const isForeground = val > 128 || val > 0.5;

        if (!isForeground) {
          sawBackground = true;
        } else if (sawBackground || step >= 2) {
          hitPoint = { x: currX, y: currY };
          break;
        }
      }
    }

    if (hitPoint) {
      points.push(hitPoint);
    }
  }

  return points;
}

/**
 * Calculates localized articulation angles across the 7 functional spinal units (C1 to S1).
 */
export function calculateSegmentalSpineAngles(
  splinePoints: Array<{ x: number; y: number }>,
  cervicalPoints: Array<{ x: number; y: number }> | undefined,
  pose: Record<string, Landmark>,
  facingDir = 1,
  globalCurvature = 0
): {
  cervicalUpperAngle: number;
  cervicothoracicAngle: number;
  thoracicUpperAngle: number;
  thoracicMidAngle: number;
  thoracolumbarAngle: number;
  lumbarUpperAngle: number;
  lumbosacralAngle: number;
} {
  const lEar = pose['LEFT_EAR'];
  const rEar = pose['RIGHT_EAR'];
  const lShoulder = pose['LEFT_SHOULDER'];
  const rShoulder = pose['RIGHT_SHOULDER'];

  const ear = (lEar && rEar) ? { x: (lEar.x + rEar.x) / 2, y: (lEar.y + rEar.y) / 2 } : (lEar || rEar);
  const shoulder = (lShoulder && rShoulder) ? { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 } : (lShoulder || rShoulder);

  // 1. Cervical Angles (C1–C3 and C4–C7)
  let cervicalUpperAngle = 0;
  let cervicothoracicAngle = 0;

  if (ear && shoulder) {
    const dx = (ear.x - shoulder.x) * facingDir;
    const dy = Math.max(0.01, shoulder.y - ear.y);
    const neckPitch = Math.round(Math.atan2(dx, dy) * (180 / Math.PI));
    cervicothoracicAngle = Math.max(0, neckPitch);
    cervicalUpperAngle = Math.max(0, Math.round(neckPitch * 0.75));
  }

  if (cervicalPoints && cervicalPoints.length >= 4) {
    const midIdx = Math.floor(cervicalPoints.length / 2);
    const pTop = cervicalPoints[0];
    const pMid = cervicalPoints[midIdx];
    const pBot = cervicalPoints[cervicalPoints.length - 1];

    const dx1 = (pMid.x - pTop.x) * facingDir;
    const dy1 = Math.max(0.001, pMid.y - pTop.y);
    const ang1 = Math.atan2(dx1, dy1) * (180 / Math.PI);

    const dx2 = (pBot.x - pMid.x) * facingDir;
    const dy2 = Math.max(0.001, pBot.y - pMid.y);
    const ang2 = Math.atan2(dx2, dy2) * (180 / Math.PI);

    cervicalUpperAngle = Math.round(Math.min(45, Math.max(0, Math.abs(ang1))));
    cervicothoracicAngle = Math.round(Math.min(50, Math.max(0, Math.abs(ang2))));
  }

  // 2. Thoracic & Lumbar Segmental Angles from Spline
  let thoracicUpperAngle = 0;
  let thoracicMidAngle = 0;
  let thoracolumbarAngle = 0;
  let lumbarUpperAngle = 0;
  let lumbosacralAngle = 0;

  if (splinePoints && splinePoints.length >= 16) {
    const calcSegAngle = (idx1: number, idx2: number) => {
      const p1 = splinePoints[idx1];
      const p2 = splinePoints[idx2];
      const dx = (p2.x - p1.x) * facingDir;
      const dy = Math.max(0.001, p2.y - p1.y);
      return Math.atan2(dx, dy) * (180 / Math.PI);
    };

    const angT1_T4 = calcSegAngle(0, 4);
    const angT5_T8 = calcSegAngle(4, 8);
    const angT9_T12 = calcSegAngle(8, 11);
    const angL1_L3 = calcSegAngle(11, 14);
    const angL4_S1 = calcSegAngle(14, splinePoints.length - 1);

    thoracicUpperAngle = Math.round(Math.min(45, Math.max(0, Math.abs(angT1_T4))));
    thoracicMidAngle = Math.round(Math.min(55, Math.max(0, Math.abs(angT5_T8 - angT1_T4) + (globalCurvature * 0.4))));
    thoracolumbarAngle = Math.round(Math.min(40, Math.max(0, Math.abs(angT9_T12 - angT5_T8) + (globalCurvature * 0.25))));
    lumbarUpperAngle = Math.round(Math.min(35, Math.max(0, Math.abs(angL1_L3 - angT9_T12) + (globalCurvature * 0.15))));
    lumbosacralAngle = Math.round(Math.min(35, Math.max(0, Math.abs(angL4_S1))));
  } else {
    thoracicUpperAngle = Math.round(globalCurvature * 0.35);
    thoracicMidAngle = Math.round(globalCurvature * 0.55);
    thoracolumbarAngle = Math.round(globalCurvature * 0.30);
    lumbarUpperAngle = Math.round(globalCurvature * 0.20);
    lumbosacralAngle = Math.round(globalCurvature * 0.15);
  }

  return {
    cervicalUpperAngle,
    cervicothoracicAngle,
    thoracicUpperAngle,
    thoracicMidAngle,
    thoracolumbarAngle,
    lumbarUpperAngle,
    lumbosacralAngle
  };
}

/**
 * Robustly determines the athlete's facing direction (+1 = facing right, -1 = facing left).
 * Prioritizes torso orientation (Shoulder vs Hip in horizontal poses like Cat-Cow/Plank/Tabletop)
 * and lower-body anchor points (Knees/Feet) so head tucking during Cat pose does not flip facing direction.
 */
export function getAthleteFacingDirection(
  pose: Record<string, Landmark>,
  state: any = {}
): number {
  if (state.baseFacingDir === 1 || state.baseFacingDir === -1) {
    return state.baseFacingDir;
  }

  const lShoulder = pose['LEFT_SHOULDER'];
  const rShoulder = pose['RIGHT_SHOULDER'];
  const lHip = pose['LEFT_HIP'];
  const rHip = pose['RIGHT_HIP'];

  const shoulder = (lShoulder && rShoulder) ? { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 } : (lShoulder || rShoulder);
  const hip = (lHip && rHip) ? { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 } : (lHip || rHip);

  // 1. In Horizontal / Tabletop / Quadruped / Cat-Cow / Plank postures:
  // Shoulder X relative to Hip X is 100% immune to head tucking!
  if (shoulder && hip) {
    const dx = shoulder.x - hip.x;
    const dy = shoulder.y - hip.y;
    // If torso is horizontal or tilted (dx is significant)
    if (Math.abs(dx) > 0.05 && Math.abs(dx) > Math.abs(dy) * 0.35) {
      return dx > 0 ? 1 : -1;
    }
  }

  // 2. In Standing postures, check lower-body orientation (Knee vs Ankle or Foot Index vs Heel)
  const lFoot = pose['LEFT_FOOT_INDEX'];
  const rFoot = pose['RIGHT_FOOT_INDEX'];
  const lHeel = pose['LEFT_HEEL'];
  const rHeel = pose['RIGHT_HEEL'];
  const foot = lFoot || rFoot;
  const heel = lHeel || rHeel;
  if (foot && heel && Math.abs(foot.x - heel.x) > 0.015) {
    return foot.x > heel.x ? 1 : -1;
  }

  const lKnee = pose['LEFT_KNEE'];
  const rKnee = pose['RIGHT_KNEE'];
  const lAnkle = pose['LEFT_ANKLE'];
  const rAnkle = pose['RIGHT_ANKLE'];
  const knee = lKnee || rKnee;
  const ankle = lAnkle || rAnkle;
  if (knee && ankle && Math.abs(knee.x - ankle.x) > 0.02) {
    return knee.x > ankle.x ? 1 : -1;
  }

  // 3. Fallback to head if not tucked (Nose vs Ear)
  const nose = pose['NOSE'];
  const lEar = pose['LEFT_EAR'];
  const rEar = pose['RIGHT_EAR'];
  const ear = lEar || rEar;
  if (nose && ear && Math.abs(nose.x - ear.x) > 0.008) {
    return nose.x > ear.x ? 1 : -1;
  }

  return 1;
}

/**
 * Calculates spinal curvature degrees, direction (flexion vs extension), and smooth spline coordinates.
 */
export function calculateSpineCurvature(
  pose: Record<string, Landmark>,
  state: any = {}
): {
  curvatureDegrees: number;
  isFlexion: boolean;
  compressionRatio: number;
  splinePoints: Array<{ x: number; y: number }>;
  contourPoints?: Array<{ x: number; y: number }>;
  cervicalContourPoints?: Array<{ x: number; y: number }>;
  segmentalAngles?: {
    cervicalUpperAngle: number;
    cervicothoracicAngle: number;
    thoracicUpperAngle: number;
    thoracicMidAngle: number;
    thoracolumbarAngle: number;
    lumbarUpperAngle: number;
    lumbosacralAngle: number;
  };
} {
  const lShoulder = pose['LEFT_SHOULDER'];
  const rShoulder = pose['RIGHT_SHOULDER'];
  const lHip = pose['LEFT_HIP'];
  const rHip = pose['RIGHT_HIP'];

  const shoulder = (lShoulder && rShoulder) ? { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 } : (lShoulder || rShoulder);
  const hip = (lHip && rHip) ? { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 } : (lHip || rHip);

  if (!shoulder || !hip) {
    return { curvatureDegrees: 0, isFlexion: false, compressionRatio: 1.0, splinePoints: [], contourPoints: [], cervicalContourPoints: [] };
  }

  // Determine facing direction robustly
  const facingDir = getAthleteFacingDirection(pose, state);

  // 1. Calculate Chord Compression Ratio (Torso Euclidean distance vs baseline)
  const currentTorsoHeight = Math.sqrt(Math.pow(shoulder.x - hip.x, 2) + Math.pow(shoulder.y - hip.y, 2));
  const baseTorso = state.baseTorsoHeight && state.baseTorsoHeight > 0.05 ? state.baseTorsoHeight : currentTorsoHeight;
  const compressionRatio = Math.round(Math.min(1.5, Math.max(0.5, currentTorsoHeight / baseTorso)) * 100) / 100;

  // 2. Try Image Segmentation Contour Fitting with Vector-Adaptive Local Coordinate System
  let fittedA = 0;
  let contourPoints: Array<{ x: number; y: number }> = [];
  let cervicalContourPoints: Array<{ x: number; y: number }> = [];

  const spineDx = shoulder.x - hip.x;
  const spineDy = shoulder.y - hip.y;
  const spineLen = Math.max(0.01, Math.sqrt(spineDx * spineDx + spineDy * spineDy));
  const ux = spineDx / spineLen;
  const uy = spineDy / spineLen;
  // Dorsal normal matching 2D chirality
  const nx = uy * facingDir;
  const ny = -ux * facingDir;

  if (state.segmentationMask) {
    contourPoints = extractBackContourPoints(state.segmentationMask, pose, facingDir);
    cervicalContourPoints = extractCervicalContourPoints(state.segmentationMask, pose, facingDir);

    if (contourPoints.length >= 4) {
      // Transform contour points into local spine coordinates (u = longitudinal axis, v = dorsal displacement)
      const localPoints = contourPoints.map(p => {
        const dx = p.x - hip.x;
        const dy = p.y - hip.y;
        const u = dx * ux + dy * uy;
        const v = dx * nx + dy * ny;
        return { x: u, y: v };
      });

      const poly = fitSpinePolynomial(localPoints);
      if (poly) {
        fittedA = poly.a;
      }
    }
  }

  // 3. Sagittal Kinematics & Posture Classification
  const isHorizontalTorso = Math.abs(spineDx) > Math.abs(spineDy) * 0.45;
  let isFlexion = false;

  if (isHorizontalTorso && Math.abs(fittedA) > 0.0001) {
    // In Cat-Cow/Tabletop, a parabolic bow outwards (+dorsal) is Cat (flexion)
    // a parabolic bow inwards (-dorsal) is Cow (extension)
    isFlexion = fittedA < 0; // In local u-v coordinates, peak dorsal displacement gives negative quadratic curvature
  } else {
    const dxTorso = (shoulder.x - hip.x) * facingDir;
    const dyTorso = Math.max(0.001, hip.y - shoulder.y);
    const pitchAngle = Math.atan2(dxTorso, dyTorso) * (180 / Math.PI);
    isFlexion = pitchAngle >= 0;
  }

  // Compute Curvature Index (combining contour polynomial curvature & chord compression)
  let curvatureDegrees = 0;
  if (Math.abs(fittedA) > 0.0001) {
    const rawCurvature = Math.abs(fittedA) * 1000;
    curvatureDegrees = Math.round(Math.min(65, rawCurvature));
  } else {
    const dxTorso = (shoulder.x - hip.x) * facingDir;
    const dyTorso = Math.max(0.001, hip.y - shoulder.y);
    const pitchAngle = Math.atan2(dxTorso, dyTorso) * (180 / Math.PI);
    const chordShorteningPct = Math.max(0, (1.0 - compressionRatio) * 100);
    const angularDisplacement = Math.abs(pitchAngle);
    curvatureDegrees = Math.round(Math.min(65, angularDisplacement * 0.7 + chordShorteningPct * 1.5));
  }

  // 4. Generate 16 Smooth Spine Spline Points from Shoulder down to Hip for UI Overlays
  const splinePoints: Array<{ x: number; y: number }> = [];
  const numSteps = 16;
  const arcMagnitude = (isFlexion ? 1 : -1) * (curvatureDegrees / 55) * 0.04;

  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const baseX = shoulder.x + (hip.x - shoulder.x) * t;
    const baseY = shoulder.y + (hip.y - shoulder.y) * t;

    // Normal vector offset along the true dorsal normal
    const arcOffset = Math.sin(t * Math.PI) * arcMagnitude;
    splinePoints.push({
      x: baseX + nx * arcOffset,
      y: baseY + ny * arcOffset
    });
  }

  const segmentalAngles = calculateSegmentalSpineAngles(
    splinePoints,
    cervicalContourPoints.length > 0 ? cervicalContourPoints : undefined,
    pose,
    facingDir,
    curvatureDegrees
  );

  return {
    curvatureDegrees,
    isFlexion,
    compressionRatio,
    splinePoints,
    contourPoints: contourPoints.length > 0 ? contourPoints : undefined,
    cervicalContourPoints: cervicalContourPoints.length > 0 ? cervicalContourPoints : undefined,
    segmentalAngles
  };
}

/**
 * Converts a SpineCurvatureResult to a compact binary representation.
 * Rounds coordinates to 3 decimals and returns undefined if no contour data.
 */
export function compactSpine(spineData: SpineCurvatureResult | undefined): CompactSpine | undefined {
  if (!spineData) return undefined;

  const contourPoints = spineData.contourPoints || [];
  const cervicalContourPoints = spineData.cervicalContourPoints || [];

  // Only compact if we have contour data
  if (contourPoints.length === 0 && cervicalContourPoints.length === 0) {
    return undefined;
  }

  // Flatten and round contour points
  const c: number[] = [];
  for (const pt of contourPoints) {
    c.push(Math.round(pt.x * 1000) / 1000);
    c.push(Math.round(pt.y * 1000) / 1000);
  }

  // Flatten and round cervical contour points
  const n: number[] = [];
  for (const pt of cervicalContourPoints) {
    n.push(Math.round(pt.x * 1000) / 1000);
    n.push(Math.round(pt.y * 1000) / 1000);
  }

  return {
    c,
    n,
    d: Math.round(spineData.curvatureDegrees * 10) / 10,
    f: spineData.isFlexion
  };
}
