import { IExerciseRule } from './MovementEngine';
import { MovementPhase, PoseData, ExerciseState, AttemptLogEntry, POSE_LANDMARKS } from './types';
import {
  OnlineSubsequenceDTW,
  TrajectoryProfile,
  normalizePose3D,
  extractPoseAngles,
  TrajectoryFrame
} from './dtw-utils';
import { calculateAngle } from './angle-utils';

export class TrajectoryRule implements IExerciseRule {
  private profile: TrajectoryProfile | null = null;
  private dtw: OnlineSubsequenceDTW | null = null;
  private lastFeedbackTime: number = 0;
  private feedbackCooldownMs: number = 1800; // avoid feedback spamming
  private strictness: 'relaxed' | 'normal' | 'strict' = 'normal';

  public setStrictness(level: 'relaxed' | 'normal' | 'strict'): void {
    this.strictness = level;
    if (this.dtw) {
      this.dtw.setStrictness(level);
    }
  }

  public getStrictness(): 'relaxed' | 'normal' | 'strict' {
    return this.strictness;
  }

  public setRules(rules: any[]): void {
    const trajectoryRow = rules.find(r => r.rule_name === 'TRAJECTORY_PROFILE');
    if (trajectoryRow && trajectoryRow.threshold_value) {
      const raw = trajectoryRow.threshold_value;
      const parsed: TrajectoryProfile = typeof raw === 'string' ? JSON.parse(raw) : raw;
      this.profile = parsed;
      this.dtw = new OnlineSubsequenceDTW(parsed);
      if (parsed.tolerance?.strictnessLevel) {
        this.setStrictness(parsed.tolerance.strictnessLevel);
      }
      console.log('TrajectoryRule initialized with', parsed.referenceFrames?.length ?? 0, 'frames, strictness:', this.strictness);
    }
  }

  public validate(
    pose: PoseData,
    state: ExerciseState,
    timeMs: number = Date.now()
  ): {
    newPhase: MovementPhase;
    feedback: string[];
    isRepCompleted: boolean;
    isMovementFinished: boolean;
    qualityScore: number;
    angles: Record<string, number>;
    newAttempt?: AttemptLogEntry;
    currentPhaseIndex?: number;
    phaseName?: string;
    progressPct?: number;
  } {
    const liveAngles = extractPoseAngles(pose);

    if (!this.dtw || !this.profile || !this.profile.referenceFrames?.length) {
      return {
        newPhase: MovementPhase.INITIALIZING,
        feedback: ['Reference trajectory not loaded'],
        isRepCompleted: false,
        isMovementFinished: false,
        qualityScore: 100,
        angles: liveAngles
      };
    }

    const {
      matchedIndex,
      progressPct,
      alignmentDistance,
      avgRepDistance,
      isRepCompleted,
      isRepFailed,
      failReason,
      reachedPeak,
      refFrame
    } = this.dtw.update(pose, timeMs);

    // 1. Determine Quality Score (0 to 100)
    // activeDist typically ranges from 0.05 (perfect) to 0.45 (poor)
    const activeDist = avgRepDistance || alignmentDistance;
    const distTolerance = this.strictness === 'relaxed' ? 0.12 : this.strictness === 'strict' ? 0.05 : 0.08;
    const slope = this.strictness === 'relaxed' ? 160 : this.strictness === 'strict' ? 260 : 220;
    const rawQuality = Math.max(0, Math.min(100, 100 - (activeDist - distTolerance) * slope));
    const qualityScore = Math.round(rawQuality);

    // 2. Determine Movement Phase and Attempt Logging
    let newPhase = MovementPhase.START_POSITION;
    let phaseName = 'Start Position';
    let currentPhaseIndex = 0;
    let newAttempt: AttemptLogEntry | undefined;

    if (isRepCompleted) {
      newPhase = MovementPhase.REP_COMPLETED;
      phaseName = 'Rep Completed';
      currentPhaseIndex = 4;
      newAttempt = {
        id: Math.random().toString(),
        timestamp: timeMs,
        status: 'success',
        reason: qualityScore >= 80 ? 'Clean Rep' : 'Rep Completed',
        qualityScore
      };
    } else if (isRepFailed) {
      newPhase = MovementPhase.START_POSITION;
      phaseName = 'Start Position';
      currentPhaseIndex = 0;
      newAttempt = {
        id: Math.random().toString(),
        timestamp: timeMs,
        status: 'failed',
        reason: failReason || 'Rep Failed',
        qualityScore: Math.min(50, qualityScore)
      };
    } else if (reachedPeak && progressPct >= 65) {
      newPhase = MovementPhase.ASCENDING;
      phaseName = 'Ascending';
      currentPhaseIndex = 3;
    } else if (reachedPeak || (progressPct >= 35 && progressPct < 65)) {
      newPhase = MovementPhase.BOTTOM_POSITION;
      phaseName = 'Bottom Position';
      currentPhaseIndex = 2;
    } else if (progressPct >= 10) {
      newPhase = MovementPhase.DESCENDING;
      phaseName = 'Descending';
      currentPhaseIndex = 1;
    }

    const isMovementFinished = isRepCompleted || isRepFailed;

    // 3. Form Deviation Analysis & Real-Time Cues
    const feedback: string[] = [];
    if (isRepFailed && failReason) {
      feedback.push(failReason);
    }

    const canEmitFeedback = timeMs - this.lastFeedbackTime > this.feedbackCooldownMs;

    if (refFrame && canEmitFeedback && feedback.length === 0) {
      const liveNorm = normalizePose3D(pose);
      if (liveNorm.isValid) {
        // A. Knee Valgus Check (Knees caving inward)
        const lKnee = liveNorm.landmarks[POSE_LANDMARKS.LEFT_KNEE];
        const rKnee = liveNorm.landmarks[POSE_LANDMARKS.RIGHT_KNEE];
        const refLKnee = refFrame.normPose[POSE_LANDMARKS.LEFT_KNEE];
        const refRKnee = refFrame.normPose[POSE_LANDMARKS.RIGHT_KNEE];

        if (lKnee && rKnee && refLKnee && refRKnee) {
          const liveKneeDist = Math.abs(rKnee.x - lKnee.x);
          const refKneeDist = Math.abs(refRKnee.x - refLKnee.x);
          const valgusFactor = this.strictness === 'relaxed' ? 0.65 : this.strictness === 'strict' ? 0.88 : 0.78;
          if (liveKneeDist < refKneeDist * valgusFactor) {
            feedback.push('Push your knees outward');
            this.lastFeedbackTime = timeMs;
          }
        }

        // B. Torso Uprightness / Chest Collapse Check
        if (canEmitFeedback && feedback.length === 0) {
          const liveTorso = liveAngles['TORSO_INCLINATION'];
          const refTorso = refFrame.angles['TORSO_INCLINATION'];
          const torsoTolerance = this.strictness === 'relaxed' ? 26 : this.strictness === 'strict' ? 12 : 18;
          if (liveTorso !== undefined && refTorso !== undefined) {
            if (liveTorso - refTorso > torsoTolerance) {
              feedback.push('Keep your chest up');
              this.lastFeedbackTime = timeMs;
            }
          }
        }

        // C. Squat Depth Check
        if (canEmitFeedback && feedback.length === 0 && reachedPeak) {
          const liveKneeAngle = liveAngles['KNEE_ANGLE'];
          const refKneeAngle = refFrame.angles['KNEE_ANGLE'];
          const depthThreshold = this.strictness === 'relaxed' ? 122 : this.strictness === 'strict' ? 95 : 105;
          if (liveKneeAngle !== undefined && refKneeAngle !== undefined) {
            if (liveKneeAngle > refKneeAngle + 20 && liveKneeAngle > depthThreshold) {
              feedback.push('Squat deeper for full range');
              this.lastFeedbackTime = timeMs;
            }
          }
        }
      }
    }

    return {
      newPhase,
      phaseName,
      currentPhaseIndex,
      progressPct,
      feedback,
      isRepCompleted,
      isMovementFinished,
      qualityScore,
      newAttempt,
      angles: {
        ...liveAngles,
        'TRAJECTORY_PROGRESS': progressPct,
        'MATCHED_FRAME': matchedIndex
      }
    };
  }
}
