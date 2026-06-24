import { POSE_LANDMARKS, MovementPhase, PoseData, ExerciseState, AttemptLogEntry } from './types';
import { calculateAngle } from './angle-utils';

export class PlieSquatRule {
  private thresholds = {
    // 1. STANCE_CONFIG
    MIN_STANCE_RATIO: 1.2,
    MIN_FOOT_ANGLE: 15,
    MAX_FOOT_ANGLE: 75,

    // 2. SQUAT_DEPTH
    TARGET_KNEE_ANGLE: 115.0, // More forgiving depth
    START_TRIGGER_ANGLE: 168.0, 
    PARTIAL_REP_DROP: 25.0,   // More tolerant of wobbles
    STAND_UP_TOLERANCE: 172.0,

    // 3. POSTURE_STABILITY
    MAX_TORSO_LEAN: 15.0,
    MIN_TORSO_RATIO: 0.82,    // Allows ~18% vertical compression (Advanced Lean Detection)
    KNEE_VALGUS_THRESHOLD: 0.08,
    KNEE_OVER_TOE_TOLERANCE: -0.007, // Ultra-precision buffer (0.7%)
    HEELS_FLAT_TOLERANCE: 5.0,

    // 4. SYMMETRY
    DEPTH_DIFF_MAX: 10.0,
    WEIGHT_SHIFT_MAX: 0.1,

    // 5. TEMPO_STILLNESS
    STILL_REQUIRED: 10,
    MOVEMENT_THRESHOLD: 0.01,
    
    // Internal Calibration
    LOG_RESET_STILLNESS: 5,
  };

  private minKneeAngleThisRep: number = 180;
  private isAttemptLogged: boolean = false;
  private wasAttemptFailed: boolean = false;
  private stillFrames: number = 0;
  private failReason: string = '';
  private isArmed: boolean = false;
  private kneesBeyondToesDetected: boolean = false;
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
          if (val.min_foot_angle) this.thresholds.MIN_FOOT_ANGLE = val.min_foot_angle;
          if (val.max_foot_angle) this.thresholds.MAX_FOOT_ANGLE = val.max_foot_angle;
          break;
        case 'SQUAT_DEPTH':
          if (val.target_angle) this.thresholds.TARGET_KNEE_ANGLE = val.target_angle;
          if (val.start_trigger) this.thresholds.START_TRIGGER_ANGLE = val.start_trigger;
          if (val.partial_drop) this.thresholds.PARTIAL_REP_DROP = val.partial_drop;
          if (val.stand_up_tolerance) this.thresholds.STAND_UP_TOLERANCE = val.stand_up_tolerance;
          break;
        case 'POSTURE_STABILITY':
          if (val.max_lean) this.thresholds.MAX_TORSO_LEAN = val.max_lean;
          if (val.min_torso_ratio) this.thresholds.MIN_TORSO_RATIO = val.min_torso_ratio;
          if (val.knee_over_toe_buffer) this.thresholds.KNEE_OVER_TOE_TOLERANCE = val.knee_over_toe_buffer;
          break;
        case 'TEMPO_STILLNESS':
          if (val.still_required) this.thresholds.STILL_REQUIRED = val.still_required;
          if (val.movement_threshold) this.thresholds.MOVEMENT_THRESHOLD = val.movement_threshold;
          break;
      }
    });
    console.log('PlieSquat Engine: Rules Updated from DB', this.thresholds);
  }

  private calculateFootAngle(heel: any, toe: any): number {
    const dx = Math.abs(toe.x - heel.x);
    const dy = Math.abs(toe.y - heel.y);
    // In 2D, a toe turned OUT has a larger horizontal distance (dx) from the heel
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

    // Core Calculations
    const lKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const avgKneeAngle = (lKneeAngle + rKneeAngle) / 2;
    
    // Stance Calculation
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
    const heelWidth = Math.abs(lHeel.x - rHeel.x);
    const stanceRatio = heelWidth / shoulderWidth;
    
    // Foot turnout angles
    const lFootAngle = this.calculateFootAngle(lHeel, lFoot);
    const rFootAngle = this.calculateFootAngle(rHeel, rFoot);
    
    // Torso lean (Verticality) - Average both sides for accuracy
    const lTorsoAngle = calculateAngle(lShoulder, lHip, { x: lHip.x, y: lHip.y - 1.0 });
    const rTorsoAngle = calculateAngle(rShoulder, rHip, { x: rHip.x, y: rHip.y - 1.0 });
    const torsoAngle = (lTorsoAngle + rTorsoAngle) / 2;

    // Torso Compression (Advanced front-facing lean detection)
    const currentTorsoHeight = Math.abs((lHip.y + rHip.y) / 2 - (lShoulder.y + rShoulder.y) / 2);
    const torsoRatio = this.baseTorsoHeight ? currentTorsoHeight / this.baseTorsoHeight : 1.0;
    
    // Valgus (Knee Cave-in) - Horizontal distance from hip to knee vs hip to ankle
    const lValgus = (lKnee.x - lHip.x) / (lAnkle.x - lHip.x); // Should be close to 1.0 if knee follows ankle
    const rValgus = (rHip.x - rKnee.x) / (rHip.x - rAnkle.x);

    // Smoothing
    if (this.smoothedKneeAngle === null) this.smoothedKneeAngle = avgKneeAngle;
    this.smoothedKneeAngle = (avgKneeAngle * this.SMOOTHING_FACTOR) + (this.smoothedKneeAngle * (1 - this.SMOOTHING_FACTOR));

    // State Machine
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
        } else if (lFootAngle < this.thresholds.MIN_FOOT_ANGLE || rFootAngle < this.thresholds.MIN_FOOT_ANGLE) {
          feedback.push('Turn toes outward');
          this.stillFrames = 0;
        } else if (lFootAngle > this.thresholds.MAX_FOOT_ANGLE || rFootAngle > this.thresholds.MAX_FOOT_ANGLE) {
          feedback.push('Toes out too far');
          this.stillFrames = 0;
        } else {
          feedback.push('Ready! Go down');
          if (this.checkStillness(pose)) {
            this.stillFrames++;
            if (this.stillFrames >= this.thresholds.STILL_REQUIRED) {
              this.isArmed = true;
              this.baseTorsoHeight = currentTorsoHeight; // Calibrate standing height
            }
          }
        }

        // Trigger Descent (Require armed status OR high stillness)
        if (avgKneeAngle < this.thresholds.START_TRIGGER_ANGLE && (this.isArmed || this.stillFrames >= this.thresholds.STILL_REQUIRED)) {
          newPhase = MovementPhase.DESCENDING;
          this.minKneeAngleThisRep = avgKneeAngle;
          this.stillFrames = 0;
          this.isArmed = false; // Reset for next rep
          this.wasAttemptFailed = false;
          this.kneesBeyondToesDetected = false;
          this.torsoLeanDetected = false;
          this.failReason = '';
        }
        break;

      case MovementPhase.DESCENDING:
        this.minKneeAngleThisRep = Math.min(this.minKneeAngleThisRep, avgKneeAngle);
        feedback.push("Going down...");

        // Live Form Checks
        if (torsoAngle > this.thresholds.MAX_TORSO_LEAN || torsoRatio < this.thresholds.MIN_TORSO_RATIO) {
          feedback.push("Keep chest up!");
          this.torsoLeanDetected = true;
        }
        // Knee tracking check (Beyond toes)
        const kneeWidth = Math.abs(lKnee.x - rKnee.x);
        const footWidth = Math.abs(lFoot.x - rFoot.x);
        if (kneeWidth > footWidth + this.thresholds.KNEE_OVER_TOE_TOLERANCE) {
          feedback.push("Knees beyond toes!");
          this.kneesBeyondToesDetected = true;
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
        if (avgKneeAngle > this.thresholds.TARGET_KNEE_ANGLE + 5) {
          newPhase = MovementPhase.ASCENDING;
        }
        break;

      case MovementPhase.ASCENDING:
        feedback.push("Push through heels");
        
        // Check for knee cave-in during ascent
        if (lValgus < 0.9 || rValgus < 0.9) {
          feedback.push("Push knees out");
        }

        // Check torso during ascent
        if (torsoAngle > this.thresholds.MAX_TORSO_LEAN || torsoRatio < this.thresholds.MIN_TORSO_RATIO) {
          feedback.push("Keep chest up!");
          this.torsoLeanDetected = true;
        }

        // Knee tracking check (Beyond toes) - Also check during ascent
        const kneeWidthAsc = Math.abs(lKnee.x - rKnee.x);
        const footWidthAsc = Math.abs(lFoot.x - rFoot.x);
        if (kneeWidthAsc > footWidthAsc + this.thresholds.KNEE_OVER_TOE_TOLERANCE) {
          feedback.push("Knees beyond toes!");
          this.kneesBeyondToesDetected = true;
        }

        if (avgKneeAngle > this.thresholds.STAND_UP_TOLERANCE) {
          newPhase = MovementPhase.START_POSITION;
          isMovementFinished = true;
          
          const failReasons: string[] = [];
          if (this.kneesBeyondToesDetected) failReasons.push('Knees beyond toes');
          if (this.torsoLeanDetected) failReasons.push('Leaning too far');
          if (this.wasAttemptFailed && this.failReason) failReasons.push(this.failReason);

          if (failReasons.length === 0) {
            isRepCompleted = true;
            newAttempt = { 
              id: Math.random().toString(), 
              timestamp: Date.now(), 
              status: 'success', 
              reason: 'Excellent Rep',
              qualityScore: 100
            };
          } else {
            isRepCompleted = false; // Strict: any violation fails the rep
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
        lKneeAngle,
        rKneeAngle,
        kneeAngle: avgKneeAngle,
        stanceRatio: stanceRatio,
        torsoAngle: torsoAngle,
        lFootAngle,
        rFootAngle
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
    
    // Slowly follow the movement to calibrate
    this.smoothedY = (avgY * 0.1) + (this.smoothedY * 0.9);
    
    return isStill;
  }
}
