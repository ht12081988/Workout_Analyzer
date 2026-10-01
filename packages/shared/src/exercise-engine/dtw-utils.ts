import { Landmark, PoseData, POSE_LANDMARKS } from './types';
import { calculateAngle } from './angle-utils';

export interface NormalizedPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface NormalizedPose3D {
  landmarks: Record<string, NormalizedPoint3D>;
  pelvisCenter: NormalizedPoint3D;
  torsoScale: number;
  isValid: boolean;
}

export interface TrajectoryFrame {
  frameIndex: number;
  timeMs: number;
  normPose: Record<string, NormalizedPoint3D>;
  angles: Record<string, number>;
  progressPct: number; // 0 to 100
}

export interface FocusCheckConfig {
  id: string;
  name: string;
  type: 'knee_valgus' | 'chest_upright' | 'squat_depth' | 'custom_angle';
  feedback: string;
  threshold?: number;
}

export interface TrajectoryProfile {
  exerciseName?: string;
  referenceFrames: TrajectoryFrame[];
  turnaroundIndex?: number; // frame index where turnaround/peak depth occurs
  keyLandmarks?: string[];
  keyAngles?: string[];
  tolerance?: {
    strictnessLevel?: 'relaxed' | 'normal' | 'strict';
    positionThreshold?: number; // fractional torso scale, default 0.20
    angleThresholdDeg?: number;  // degrees, default 18
    minCycleDurationMs?: number; // min time for 1 rep, default 900ms
  };
  focusChecks?: FocusCheckConfig[];
}

export const DEFAULT_KEY_LANDMARKS = [
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.LEFT_KNEE,
  POSE_LANDMARKS.RIGHT_KNEE,
  POSE_LANDMARKS.LEFT_ANKLE,
  POSE_LANDMARKS.RIGHT_ANKLE,
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.RIGHT_SHOULDER
];

export const DEFAULT_KEY_ANGLES = [
  'LEFT_KNEE_ANGLE',
  'RIGHT_KNEE_ANGLE',
  'HIP_HINGE_ANGLE',
  'TORSO_INCLINATION'
];

/**
 * Normalizes pose in 3D:
 * 1. Pelvis Center (midpoint of left & right hip) becomes the origin (0, 0, 0).
 * 2. Coordinates are divided by Torso Scale (3D distance between shoulder midpoint and pelvis midpoint).
 * This makes coordinates invariant to subject height, camera distance, and position in frame.
 */
export function normalizePose3D(pose: PoseData): NormalizedPose3D {
  const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
  const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
  const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];

  if (!lHip || !rHip || !lShoulder || !rShoulder) {
    return {
      landmarks: {},
      pelvisCenter: { x: 0, y: 0, z: 0 },
      torsoScale: 1.0,
      isValid: false
    };
  }

  // Pelvis Center
  const pelvisCenter: NormalizedPoint3D = {
    x: (lHip.x + rHip.x) / 2,
    y: (lHip.y + rHip.y) / 2,
    z: ((lHip.z ?? 0) + (rHip.z ?? 0)) / 2
  };

  // Shoulder Center
  const shoulderCenter: NormalizedPoint3D = {
    x: (lShoulder.x + rShoulder.x) / 2,
    y: (lShoulder.y + rShoulder.y) / 2,
    z: ((lShoulder.z ?? 0) + (rShoulder.z ?? 0)) / 2
  };

  // Torso Scale (3D Euclidean distance from pelvis to shoulder center)
  const dx = shoulderCenter.x - pelvisCenter.x;
  const dy = shoulderCenter.y - pelvisCenter.y;
  const dz = shoulderCenter.z - pelvisCenter.z;
  const rawScale = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const torsoScale = rawScale > 0.05 ? rawScale : 1.0;

  const normalizedLandmarks: Record<string, NormalizedPoint3D> = {};
  for (const [name, lm] of Object.entries(pose)) {
    if (lm) {
      normalizedLandmarks[name] = {
        x: (lm.x - pelvisCenter.x) / torsoScale,
        y: (lm.y - pelvisCenter.y) / torsoScale,
        z: ((lm.z ?? 0) - pelvisCenter.z) / torsoScale
      };
    }
  }

  return {
    landmarks: normalizedLandmarks,
    pelvisCenter,
    torsoScale,
    isValid: true
  };
}

/**
 * Computes standard anatomical angles from pose.
 */
export function extractPoseAngles(pose: PoseData): Record<string, number> {
  const angles: Record<string, number> = {};

  const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
  const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
  const lAnkle = pose[POSE_LANDMARKS.LEFT_ANKLE];
  if (lHip && lKnee && lAnkle) {
    angles['LEFT_KNEE_ANGLE'] = calculateAngle(lHip, lKnee, lAnkle);
  }

  const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
  const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
  const rAnkle = pose[POSE_LANDMARKS.RIGHT_ANKLE];
  if (rHip && rKnee && rAnkle) {
    angles['RIGHT_KNEE_ANGLE'] = calculateAngle(rHip, rKnee, rAnkle);
  }

  if (angles['LEFT_KNEE_ANGLE'] !== undefined && angles['RIGHT_KNEE_ANGLE'] !== undefined) {
    angles['KNEE_ANGLE'] = (angles['LEFT_KNEE_ANGLE'] + angles['RIGHT_KNEE_ANGLE']) / 2;
  } else if (angles['LEFT_KNEE_ANGLE'] !== undefined) {
    angles['KNEE_ANGLE'] = angles['LEFT_KNEE_ANGLE'];
  } else if (angles['RIGHT_KNEE_ANGLE'] !== undefined) {
    angles['KNEE_ANGLE'] = angles['RIGHT_KNEE_ANGLE'];
  }

  const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
  if (lShoulder && lHip && lKnee) {
    angles['LEFT_HIP_ANGLE'] = calculateAngle(lShoulder, lHip, lKnee);
  }

  const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
  if (rShoulder && rHip && rKnee) {
    angles['RIGHT_HIP_ANGLE'] = calculateAngle(rShoulder, rHip, rKnee);
  }

  // Hip hinge angle (torso to thigh)
  if (angles['LEFT_HIP_ANGLE'] !== undefined && angles['RIGHT_HIP_ANGLE'] !== undefined) {
    angles['HIP_HINGE_ANGLE'] = (angles['LEFT_HIP_ANGLE'] + angles['RIGHT_HIP_ANGLE']) / 2;
  } else {
    angles['HIP_HINGE_ANGLE'] = angles['LEFT_HIP_ANGLE'] ?? angles['RIGHT_HIP_ANGLE'] ?? 180;
  }

  // Torso inclination (angle of shoulder-to-hip vector with vertical)
  if (lShoulder && lHip) {
    const angleRad = Math.atan2(Math.abs(lShoulder.x - lHip.x), Math.abs(lShoulder.y - lHip.y));
    angles['TORSO_INCLINATION'] = (angleRad * 180) / Math.PI;
  }

  return angles;
}

/**
 * Calculates weighted distance between a live frame and a reference frame.
 */
export function calculateFrameDistance(
  liveNorm: NormalizedPose3D,
  liveAngles: Record<string, number>,
  refFrame: TrajectoryFrame,
  keyLandmarks: string[] = DEFAULT_KEY_LANDMARKS,
  keyAngles: string[] = DEFAULT_KEY_ANGLES
): number {
  if (!liveNorm.isValid) return 999.0;

  // 1. Joint Position Distance (3D Normalized Euclidean)
  let posDistSum = 0;
  let posCount = 0;
  for (const lmName of keyLandmarks) {
    const pLive = liveNorm.landmarks[lmName];
    const pRef = refFrame.normPose[lmName];
    if (pLive && pRef) {
      const dx = pLive.x - pRef.x;
      const dy = pLive.y - pRef.y;
      const dz = pLive.z - pRef.z;
      posDistSum += Math.sqrt(dx * dx + dy * dy + dz * dz);
      posCount++;
    }
  }
  const avgPosDist = posCount > 0 ? posDistSum / posCount : 1.0;

  // 2. Joint Angle Distance (normalized to [0..1])
  let angleDistSum = 0;
  let angleCount = 0;
  for (const angleName of keyAngles) {
    const aLive = liveAngles[angleName];
    const aRef = refFrame.angles[angleName];
    if (aLive !== undefined && aRef !== undefined) {
      angleDistSum += Math.abs(aLive - aRef) / 180.0;
      angleCount++;
    }
  }
  const avgAngleDist = angleCount > 0 ? angleDistSum / angleCount : 0.0;

  // Weighted combo: 60% positions, 40% joint angles
  return 0.6 * avgPosDist + 0.4 * avgAngleDist;
}

/**
 * Online Subsequence Dynamic Time Warping (Online Subsequence DTW).
 * Performs O(N) streaming alignment per live frame against an N-frame reference trajectory.
 */
export class OnlineSubsequenceDTW {
  private refFrames: TrajectoryFrame[];
  private nRef: number;
  private keyLandmarks: string[];
  private keyAngles: string[];
  private turnaroundIdx: number;

  // DTW cost accumulators
  private prevCost: number[];
  private currentCost: number[];

  // Tracking state
  private bestMatchedIdx: number = 0;
  private currentProgressPct: number = 0;
  private repCycleActive: boolean = false;
  private reachedTurnaround: boolean = false;
  private repStartTimeMs: number = 0;
  private lastMatchedIdx: number = 0;

  // Additional robustness state
  private primaryAngleName: string = 'KNEE_ANGLE';
  private refStartPrimaryAngle: number = 175;
  private refTurnaroundPrimaryAngle: number = 80;
  private repDistances: number[] = [];
  private standingFramesCount: number = 0;
  private strictness: 'relaxed' | 'normal' | 'strict' = 'normal';

  constructor(profile: TrajectoryProfile) {
    this.refFrames = profile.referenceFrames || [];
    this.nRef = this.refFrames.length;
    this.keyLandmarks = profile.keyLandmarks || DEFAULT_KEY_LANDMARKS;
    this.keyAngles = profile.keyAngles || DEFAULT_KEY_ANGLES;
    this.turnaroundIdx = profile.turnaroundIndex ?? Math.floor(this.nRef * 0.5);
    this.strictness = profile.tolerance?.strictnessLevel || 'normal';

    // Identify primary joint angle that changes the most between start and turnaround
    if (this.nRef > 0 && this.refFrames[0]?.angles && this.refFrames[this.turnaroundIdx]?.angles) {
      const startAngles = this.refFrames[0].angles;
      const turnAngles = this.refFrames[this.turnaroundIdx].angles;
      let maxDelta = 0;
      let bestAngle = 'KNEE_ANGLE';

      for (const [name, val] of Object.entries(startAngles)) {
        if (turnAngles[name] !== undefined) {
          const delta = Math.abs(val - turnAngles[name]);
          if (delta > maxDelta) {
            maxDelta = delta;
            bestAngle = name;
          }
        }
      }
      this.primaryAngleName = bestAngle;
      this.refStartPrimaryAngle = startAngles[bestAngle] ?? 175;
      this.refTurnaroundPrimaryAngle = turnAngles[bestAngle] ?? 80;
    }

    this.prevCost = new Array(this.nRef).fill(0);
    this.currentCost = new Array(this.nRef).fill(0);
    this.reset();
  }

  public reset(): void {
    // In Subsequence DTW, cost at index 0 allows starting a new subsequence at any frame
    this.prevCost.fill(Infinity);
    this.currentCost.fill(Infinity);
    this.bestMatchedIdx = 0;
    this.lastMatchedIdx = 0;
    this.currentProgressPct = 0;
    this.repCycleActive = false;
    this.reachedTurnaround = false;
    this.repStartTimeMs = 0;
    this.standingFramesCount = 0;
    this.repDistances = [];
  }

  public setStrictness(level: 'relaxed' | 'normal' | 'strict'): void {
    this.strictness = level;
  }

  public getStrictness(): 'relaxed' | 'normal' | 'strict' {
    return this.strictness;
  }

  /**
   * Process incoming live frame and update online DTW path.
   * Returns:
   *  - matchedIndex: best matching frame on the reference curve
   *  - progressPct: 0 to 100% of the movement
   *  - alignmentDistance: form error distance (lower is better)
   *  - avgRepDistance: average distance across the current repetition
   *  - isRepCompleted: true if cycle reached turnaround and cleanly returned to lockout
   *  - isRepFailed: true if cycle was aborted or stalled
   *  - failReason: reason string if failed
   *  - reachedPeak: true if turnaround was reached
   *  - refFrame: reference frame matched
   */
  public update(
    livePose: PoseData,
    timeMs: number = Date.now()
  ): {
    matchedIndex: number;
    progressPct: number;
    alignmentDistance: number;
    avgRepDistance: number;
    isRepCompleted: boolean;
    isRepFailed: boolean;
    failReason?: string;
    reachedPeak: boolean;
    refFrame: TrajectoryFrame | null;
  } {
    if (this.nRef === 0) {
      return {
        matchedIndex: 0,
        progressPct: 0,
        alignmentDistance: 1.0,
        avgRepDistance: 1.0,
        isRepCompleted: false,
        isRepFailed: false,
        reachedPeak: false,
        refFrame: null
      };
    }

    const liveNorm = normalizePose3D(livePose);
    const liveAngles = extractPoseAngles(livePose);

    // 1. Determine direction-aware search range along the trajectory
    const stepBudget = Math.max(8, Math.floor(this.nRef * 0.06));
    let minSearchIdx = 0;
    let maxSearchIdx = this.nRef - 1;

    if (!this.repCycleActive) {
      // Waiting to start rep: search near start [0 .. ~20%]
      minSearchIdx = 0;
      maxSearchIdx = Math.min(this.nRef - 1, Math.max(10, Math.floor(this.nRef * 0.20)));
    } else if (!this.reachedTurnaround) {
      // Descending towards turnaround: allow search up to turnaround + 8
      minSearchIdx = Math.max(0, this.lastMatchedIdx - 4);
      maxSearchIdx = Math.min(this.turnaroundIdx + 8, this.lastMatchedIdx + stepBudget);
    } else {
      // Ascending from turnaround towards lockout: allow search up to end
      minSearchIdx = Math.max(0, this.lastMatchedIdx - 4);
      maxSearchIdx = Math.min(this.nRef - 1, this.lastMatchedIdx + stepBudget);
    }

    if (minSearchIdx > maxSearchIdx) {
      minSearchIdx = Math.max(0, maxSearchIdx - stepBudget);
    }

    // 2. Find best matching reference frame within valid temporal window
    let bestDist = Infinity;
    let bestIdx = this.lastMatchedIdx;

    for (let j = minSearchIdx; j <= maxSearchIdx; j++) {
      const d = calculateFrameDistance(
        liveNorm,
        liveAngles,
        this.refFrames[j],
        this.keyLandmarks,
        this.keyAngles
      );

      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }

    this.bestMatchedIdx = bestIdx;
    this.lastMatchedIdx = bestIdx;

    const matchedRef = this.refFrames[bestIdx];
    const progress = (bestIdx / (this.nRef - 1)) * 100;
    this.currentProgressPct = Math.round(progress);
    this.repDistances.push(bestDist);

    // 3. Posture metrics for start lockout and turnaround depth
    const livePrimary = liveAngles[this.primaryAngleName] ?? (liveAngles['KNEE_ANGLE'] ?? 175);
    const totalRange = Math.abs(this.refTurnaroundPrimaryAngle - this.refStartPrimaryAngle);
    const distFromStart = Math.abs(livePrimary - this.refStartPrimaryAngle);
    const distFromTurnaround = Math.abs(livePrimary - this.refTurnaroundPrimaryAngle);

    // Check if live pose is in start/lockout position (within 25% of start value or knee >= 160)
    const isAtStartLockout = distFromStart <= Math.max(18, totalRange * 0.25) || 
      (liveAngles['KNEE_ANGLE'] !== undefined && liveAngles['KNEE_ANGLE'] >= 162);

    // Check if live pose reached turnaround depth (adaptive based on strictness level)
    const depthToleranceRatio = this.strictness === 'relaxed' ? 0.55 : this.strictness === 'strict' ? 0.15 : 0.28;
    const indexThresholdRatio = this.strictness === 'relaxed' ? 0.35 : this.strictness === 'strict' ? 0.75 : 0.50;
    const indexFrameOffset = this.strictness === 'relaxed' ? 30 : this.strictness === 'strict' ? 4 : 10;

    const isAtTurnaroundDepth = bestIdx >= this.turnaroundIdx - indexFrameOffset || 
      (bestIdx >= Math.floor(this.turnaroundIdx * indexThresholdRatio) && distFromTurnaround <= Math.max(16, totalRange * depthToleranceRatio)) ||
      (this.strictness === 'relaxed' && distFromStart >= Math.max(18, totalRange * 0.30));

    let isRepCompleted = false;
    let isRepFailed = false;
    let failReason: string | undefined;

    // 4. Rep progression state machine
    if (!this.repCycleActive) {
      // Rep starts when athlete leaves start position:
      // Either progress >= 10% or primary joint moves > 15% of range
      if (this.currentProgressPct >= 10 || distFromStart > Math.max(12, totalRange * 0.15)) {
        this.repCycleActive = true;
        this.reachedTurnaround = false;
        this.repStartTimeMs = timeMs;
        this.repDistances = [bestDist];
        this.standingFramesCount = 0;
      }
    } else if (!this.reachedTurnaround) {
      // Descending towards turnaround
      if (isAtTurnaroundDepth) {
        this.reachedTurnaround = true;
        this.standingFramesCount = 0;
      } else if (isAtStartLockout) {
        // User stood back up without reaching turnaround depth!
        this.standingFramesCount++;
        if (this.standingFramesCount >= 8) { // ~300ms standing back up
          isRepFailed = true;
          failReason = 'Partial Rep - Go deeper';
          this.reset();
        }
      } else {
        this.standingFramesCount = 0;
      }

      // 10-second timeout on descent
      if (!isRepFailed && this.repStartTimeMs > 0 && timeMs - this.repStartTimeMs > 10000) {
        isRepFailed = true;
        failReason = 'Rep Timed Out';
        this.reset();
      }
    } else {
      // Ascending back from turnaround towards lockout:
      const progressHigh = this.strictness === 'relaxed' 
        ? (this.currentProgressPct >= 50 || bestIdx >= Math.floor(this.nRef * 0.50))
        : (this.currentProgressPct >= 70 || bestIdx >= Math.floor(this.nRef * 0.70));
      const isAtEndOfTrajectory = bestIdx >= this.nRef - 5;

      // Completion triggers when:
      // 1. Matched index reached end of reference trajectory, OR
      // 2. Trajectory reached high progress and athlete is in standing lockout, OR
      // 3. In relaxed mode, athlete successfully returned to lockout after turnaround
      if (isAtEndOfTrajectory || (progressHigh && isAtStartLockout) || (this.strictness === 'relaxed' && isAtStartLockout)) {
        const duration = timeMs - this.repStartTimeMs;
        if (duration >= 500) { // Valid rep duration (at least 0.5s)
          isRepCompleted = true;
        } else {
          isRepFailed = true;
          failReason = 'Rep too fast';
        }
        this.reset();
      } else if (!isRepCompleted && !isRepFailed && this.repStartTimeMs > 0 && timeMs - this.repStartTimeMs > 12000) {
        // Stalled during ascent
        isRepFailed = true;
        failReason = 'Rep Stalled';
        this.reset();
      }
    }

    const avgDist = this.repDistances.length > 0
      ? this.repDistances.reduce((a, b) => a + b, 0) / this.repDistances.length
      : bestDist;

    return {
      matchedIndex: bestIdx,
      progressPct: this.currentProgressPct,
      alignmentDistance: bestDist,
      avgRepDistance: avgDist,
      isRepCompleted,
      isRepFailed,
      failReason,
      reachedPeak: this.reachedTurnaround,
      refFrame: matchedRef
    };
  }

  public getMatchedFrame(index: number): TrajectoryFrame | null {
    return this.refFrames[index] || null;
  }
}
