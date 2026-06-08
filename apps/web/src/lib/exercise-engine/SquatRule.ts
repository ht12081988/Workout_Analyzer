import { POSE_LANDMARKS, MovementPhase, PoseData, ExerciseState, AttemptLogEntry } from './types';
import { calculateAngle } from './angle-utils';

export class SquatRule {
  private thresholds = {
    // 1. STANCE_CONFIG
    MIN_STANCE_RATIO: 0.85,    // Shoulder width approx
    MAX_STANCE_RATIO: 1.3,
    MIN_FOOT_ANGLE: 0,
    MAX_FOOT_ANGLE: 35,

    // 2. SQUAT_DEPTH
    TARGET_KNEE_ANGLE: 105.0,  // Standard depth from front
    START_TRIGGER_ANGLE: 165.0,
    PARTIAL_REP_DROP: 20.0,
    STAND_UP_TOLERANCE: 170.0,

    // 3. POSTURE_STABILITY
    MIN_TORSO_RATIO: 0.70,     // Forward lean detection (Compression)
    KNEE_VALGUS_THRESHOLD: 0.1, // Horizontal knee cave-in
    KNEE_TO_TOE_MIN_DIST: 0.05, // Vertical distance between knee and toe
    HEELS_FLAT_TOLERANCE: 0.02, // Vertical heel movement relative to hip/knee

    // 4. SYMMETRY
    DEPTH_DIFF_MAX: 15.0,

    // 5. TEMPO_STILLNESS
    STILL_REQUIRED: 10,
    MOVEMENT_THRESHOLD: 0.015,
  };

  private minKneeAngleThisRep: number = 180;
  private isAttemptLogged: boolean = false;
  private wasAttemptFailed: boolean = false;
  private stillFrames: number = 0;
  private failReason: string = '';
  private isArmed: boolean = false;
  private kneeCaveInDetected: boolean = false;
  private kneeForwardDetected: boolean = false;
  private torsoLeanDetected: boolean = false;
  private baseTorsoHeight: number | null = null;

  // Smoothing
  private smoothedKneeAngle: number | null = null;
  private smoothedY: number | null = null;
  private readonly SMOOTHING_FACTOR = 0.3;

  public setRules(dbRules: any[]) {
    dbRules.forEach(rule => {
      const val = rule.threshold_value;
      if (!val) return;

      switch (rule.rule_name) {
        case 'STANCE_CONFIG':
          if (val.min_ratio) this.thresholds.MIN_STANCE_RATIO = val.min_ratio;
          if (val.max_ratio) this.thresholds.MAX_STANCE_RATIO = val.max_ratio;
          if (val.min_foot_angle) this.thresholds.MIN_FOOT_ANGLE = val.min_foot_angle;
          break;
        case 'SQUAT_DEPTH':
          if (val.target_angle) this.thresholds.TARGET_KNEE_ANGLE = val.target_angle;
          if (val.start_trigger) this.thresholds.START_TRIGGER_ANGLE = val.start_trigger;
          if (val.partial_drop) this.thresholds.PARTIAL_REP_DROP = val.partial_drop;
          break;
        case 'POSTURE_STABILITY':
          if (val.min_torso_ratio) this.thresholds.MIN_TORSO_RATIO = val.min_torso_ratio;
          if (val.valgus_threshold) this.thresholds.KNEE_VALGUS_THRESHOLD = val.valgus_threshold;
          break;
        case 'TEMPO_STILLNESS':
          if (val.still_required) this.thresholds.STILL_REQUIRED = val.still_required;
          break;
      }
    });
    console.log('Squat Engine: Rules Updated', this.thresholds);
  }

  private calculateFootAngle(heel: any, toe: any): number {
    const dx = Math.abs(toe.x - heel.x);
    const dy = Math.abs(toe.y - heel.y);
    return Math.atan2(dx, dy) * (180 / Math.PI);
  }

  public validate(pose: PoseData, state: ExerciseState): {
    newPhase: MovementPhase;
    feedback: string[];
    isRepCompleted: boolean;
    isMovementFinished: boolean;
    qualityScore: number;
    angles: Record<string, number>;
    newAttempt?: AttemptLogEntry;
  } {
    const landmarks = pose;
    const feedback: string[] = [];
    let isRepCompleted = false;
    let isMovementFinished = false;
    let newPhase = state.currentPhase;
    let newAttempt: AttemptLogEntry | undefined;
    let score = 100;

    // Get landmarks
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const lHeel = landmarks[POSE_LANDMARKS.LEFT_HEEL];
    const rHeel = landmarks[POSE_LANDMARKS.RIGHT_HEEL];
    const lFoot = landmarks[POSE_LANDMARKS.LEFT_FOOT_INDEX];
    const rFoot = landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX];

    if (!lShoulder || !rShoulder || !lHip || !rHip || !lKnee || !rKnee || !lAnkle || !rAnkle || !lHeel || !rHeel || !lFoot || !rFoot) {
      return { newPhase, feedback: ['Searching for body...'], isRepCompleted, isMovementFinished: false, qualityScore: 0, angles: {} };
    }

    // 1. CORE CALCULATIONS
    const lKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const avgKneeAngle = (lKneeAngle + rKneeAngle) / 2;

    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
    const heelWidth = Math.abs(lHeel.x - rHeel.x);
    const stanceRatio = heelWidth / shoulderWidth;

    // Torso Compression (Front-facing lean detection)
    const currentTorsoHeight = Math.abs((lHip.y + rHip.y) / 2 - (lShoulder.y + rShoulder.y) / 2);
    const torsoRatio = this.baseTorsoHeight ? currentTorsoHeight / this.baseTorsoHeight : 1.0;

    // Knee Alignment (Valgus check)
    // Distance between knees vs distance between ankles
    const ankleWidth = Math.abs(lAnkle.x - rAnkle.x);
    const kneeWidth = Math.abs(lKnee.x - rKnee.x);
    const valgusRatio = kneeWidth / ankleWidth; // Should stay > 0.8-0.9

    // Smoothing
    if (this.smoothedKneeAngle === null) this.smoothedKneeAngle = avgKneeAngle;
    this.smoothedKneeAngle = (avgKneeAngle * this.SMOOTHING_FACTOR) + (this.smoothedKneeAngle * (1 - this.SMOOTHING_FACTOR));

    // 2. STATE MACHINE
    switch (state.currentPhase) {
      case MovementPhase.INITIALIZING:
        if (this.checkStillness(pose)) {
          newPhase = MovementPhase.START_POSITION;
        } else {
          feedback.push('Hold still to calibrate');
        }
        break;

      case MovementPhase.START_POSITION:
        // Validate Setup
        if (stanceRatio < this.thresholds.MIN_STANCE_RATIO) {
          feedback.push('Widen your stance');
          this.stillFrames = 0;
        } else if (stanceRatio > this.thresholds.MAX_STANCE_RATIO) {
          feedback.push('Feet too wide');
          this.stillFrames = 0;
        } else {
          feedback.push('Ready! Squat down');
          if (this.checkStillness(pose)) {
            this.stillFrames++;
            if (this.stillFrames >= this.thresholds.STILL_REQUIRED) {
              this.isArmed = true;
              this.baseTorsoHeight = currentTorsoHeight; // Calibrate standing height
            }
          }
        }

        // Trigger Descent
        if (avgKneeAngle < this.thresholds.START_TRIGGER_ANGLE && (this.isArmed || this.stillFrames >= this.thresholds.STILL_REQUIRED)) {
          newPhase = MovementPhase.DESCENDING;
          this.minKneeAngleThisRep = avgKneeAngle;
          this.stillFrames = 0;
          this.isArmed = false;
          this.wasAttemptFailed = false;
          this.kneeCaveInDetected = false;
          this.kneeForwardDetected = false;
          this.torsoLeanDetected = false;
          this.failReason = '';
        }
        break;

      case MovementPhase.DESCENDING:
        this.minKneeAngleThisRep = Math.min(this.minKneeAngleThisRep, avgKneeAngle);
        feedback.push("Sitting back...");

        // Live Form Checks
        if (torsoRatio < this.thresholds.MIN_TORSO_RATIO) {
          feedback.push("Keep chest up!");
          this.torsoLeanDetected = true;
        }

        if (valgusRatio < 0.85) {
          feedback.push("Knees out!");
          this.kneeCaveInDetected = true;
        }

        // Knee Forward Check
        const lKneeToToeDist = Math.abs(lKnee.y - lFoot.y);
        const rKneeToToeDist = Math.abs(rKnee.y - rFoot.y);
        if (lKneeToToeDist < this.thresholds.KNEE_TO_TOE_MIN_DIST || rKneeToToeDist < this.thresholds.KNEE_TO_TOE_MIN_DIST) {
          feedback.push("Knees beyond toes!");
          this.kneeForwardDetected = true;
        }

        if (avgKneeAngle < this.thresholds.TARGET_KNEE_ANGLE) {
          newPhase = MovementPhase.BOTTOM_POSITION;
        } else if (avgKneeAngle > this.minKneeAngleThisRep + this.thresholds.PARTIAL_REP_DROP) {
          newPhase = MovementPhase.ASCENDING;
          this.wasAttemptFailed = true;
          this.failReason = 'Partial Rep - Go deeper';
        }
        break;

      case MovementPhase.BOTTOM_POSITION:
        feedback.push("Great depth! Now up");
        if (avgKneeAngle > this.thresholds.TARGET_KNEE_ANGLE + 10) {
          newPhase = MovementPhase.ASCENDING;
        }
        break;

      case MovementPhase.ASCENDING:
        feedback.push("Drive through heels");

        if (valgusRatio < 0.85) {
          feedback.push("Push knees out!");
          this.kneeCaveInDetected = true;
        }

        if (torsoRatio < this.thresholds.MIN_TORSO_RATIO) {
          feedback.push("Keep chest up!");
          this.torsoLeanDetected = true;
        }

        if (avgKneeAngle > this.thresholds.STAND_UP_TOLERANCE) {
          newPhase = MovementPhase.START_POSITION;
          isMovementFinished = true;

          const failReasons: string[] = [];
          if (this.kneeCaveInDetected) failReasons.push('Knee cave-in');
          if (this.kneeForwardDetected) failReasons.push('Knees beyond toes');
          if (this.torsoLeanDetected) failReasons.push('Leaning forward');
          if (this.wasAttemptFailed && this.failReason) failReasons.push(this.failReason);

          if (failReasons.length === 0) {
            isRepCompleted = true;
            newAttempt = {
              id: Math.random().toString(),
              timestamp: Date.now(),
              status: 'success',
              reason: 'Excellent Squat',
              qualityScore: 100
            };
          } else {
            isRepCompleted = false;
            newAttempt = {
              id: Math.random().toString(),
              timestamp: Date.now(),
              status: 'failed',
              reason: failReasons.join(' & '),
              qualityScore: 100
            };
          }
          this.stillFrames = 0;
        }
        break;
    }

    return {
      newPhase,
      feedback,
      isRepCompleted,
      isMovementFinished,
      qualityScore: 100,
      newAttempt,
      angles: {
        kneeAngle: avgKneeAngle,
        stanceRatio: stanceRatio,
        torsoRatio: torsoRatio,
        valgusRatio: valgusRatio
      }
    };
  }

  private checkStillness(pose: PoseData): boolean {
    const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
    const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
    if (!lHip || !rHip) return false;

    const avgY = (lHip.y + rHip.y) / 2;

    if (this.smoothedY === null) {
      this.smoothedY = avgY;
      return true;
    }

    const isStill = Math.abs(avgY - this.smoothedY) < this.thresholds.MOVEMENT_THRESHOLD;
    this.smoothedY = (avgY * 0.1) + (this.smoothedY * 0.9);
    return isStill;
  }
}
