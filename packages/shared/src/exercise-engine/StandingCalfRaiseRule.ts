import { POSE_LANDMARKS, MovementPhase, PoseData, ExerciseState, AttemptLogEntry } from './types';
import { calculateAngle } from './angle-utils';

export class StandingCalfRaiseRule {
  private thresholds = {
    // Detection
    START_LIFT: 4.0,
    TOP_POSITION: 5.5,
    MAX_TILT_SAFETY: 25.0,
    BASELINE_TOLERANCE: 1.5,
    END_POSITION_TOLERANCE: 4.0,
    PARTIAL_REP_DROP: 5.0,

    // Stability/Form
    KNEE_BEND_MIN: 155.0,
    KNEE_FLEX_ALLOWANCE: 10.0,
    SYMMETRY_START_MAX: 18.0,
    SYMMETRY_MID_MAX: 30.0,
    SWAY_START_MAX: 0.10, // 10%
    SWAY_MOVE_MAX: 0.15,  // 15%

    // Calibration/Tempo
    STILLNESS_REQUIRED: 10,
    LOG_RESET_STILLNESS: 5,
    MOVEMENT_STILLNESS_THRESHOLD: 0.01,
    LOCK_RESET_REQUIRED: 10,
    CALIBRATION_REQUIRED: 20,
    CALIBRATION_MOVEMENT_MAX: 0.002,
    CALIBRATION_KNEE_MIN: 170.0,

    // Scoring
    PENALTY_KNEE: 20,
    PENALTY_SYMMETRY: 10,

    // Body displacement checks
    MIN_BODY_LIFT: 0.005
  };

  private messages = {
    HEEL_TILT: 'Lift your heels',
    SYMMETRY: 'Asymmetric Lift',
    KNEE_STABILITY: 'Knees Bent',
    BODY_SWAY: "Don't sway sideways",
    INVALID: 'Invalid Movement'
  };

  private maxFootTiltThisRep: number = 0;
  private startAnkleXThisRep: number = 0;
  private startShoulderXThisRep: number = 0;
  private lastAnkleX: number = 0;

  // Calibration
  private isCalibrated: boolean = false;
  private calibrationFrames: number = 0;
  private baseFootTilt: number = 0;
  private isAttemptLogged: boolean = false;
  private wasAttemptFailed: boolean = false;
  private stillFrames: number = 0;
  private startAnkleXSum: number = 0;
  private startShoulderXSum: number = 0;
  private startShoulderYSum: number = 0;
  private baseFootLengthL: number = 0;
  private baseFootLengthR: number = 0;

  // Smoothing
  private smoothedTiltL: number | null = null;
  private smoothedTiltR: number | null = null;
  private readonly SMOOTHING_FACTOR = 0.4;

  public setRules(dbRules: any[]) {
    dbRules.forEach(rule => {
      const val = rule.threshold_value;
      if (!val) return;

      switch (rule.rule_name) {
        case 'HEEL_TILT':
          this.messages.HEEL_TILT = rule.feedback_message || this.messages.HEEL_TILT;
          if (val.start) this.thresholds.START_LIFT = val.start;
          if (val.top) this.thresholds.TOP_POSITION = val.top;
          if (val.max_safety) this.thresholds.MAX_TILT_SAFETY = val.max_safety;
          if (val.baseline_tolerance) this.thresholds.BASELINE_TOLERANCE = val.baseline_tolerance;
          if (val.end_tolerance) this.thresholds.END_POSITION_TOLERANCE = val.end_tolerance;
          if (val.partial_drop) this.thresholds.PARTIAL_REP_DROP = val.partial_drop;
          if (val.min_body_lift !== undefined) this.thresholds.MIN_BODY_LIFT = val.min_body_lift;
          break;
        case 'SYMMETRY':
          this.messages.SYMMETRY = rule.feedback_message || this.messages.SYMMETRY;
          if (val.start_diff) this.thresholds.SYMMETRY_START_MAX = val.start_diff;
          if (val.mid_diff) this.thresholds.SYMMETRY_MID_MAX = val.mid_diff;
          if (val.penalty) this.thresholds.PENALTY_SYMMETRY = val.penalty;
          break;
        case 'KNEE_STABILITY':
          this.messages.KNEE_STABILITY = rule.feedback_message || this.messages.KNEE_STABILITY;
          if (val.min_angle) this.thresholds.KNEE_BEND_MIN = val.min_angle;
          if (val.flex_allowance) this.thresholds.KNEE_FLEX_ALLOWANCE = val.flex_allowance;
          if (val.penalty) this.thresholds.PENALTY_KNEE = val.penalty;
          break;
        case 'BODY_SWAY':
          this.messages.BODY_SWAY = rule.feedback_message || this.messages.BODY_SWAY;
          if (val.start_max) this.thresholds.SWAY_START_MAX = val.start_max / 100;
          if (val.move_max) this.thresholds.SWAY_MOVE_MAX = val.move_max / 100;
          break;
        case 'TEMPO_STILLNESS':
          if (val.still_required) this.thresholds.STILLNESS_REQUIRED = val.still_required;
          if (val.log_reset) this.thresholds.LOG_RESET_STILLNESS = val.log_reset;
          if (val.movement_threshold) this.thresholds.MOVEMENT_STILLNESS_THRESHOLD = val.movement_threshold;
          if (val.lock_reset) this.thresholds.LOCK_RESET_REQUIRED = val.lock_reset;
          break;
      }
    });
    console.log('Engine Rules Updated:', this.thresholds);
    console.log('Feedback Messages Updated:', this.messages);
  }

  private calculateFootTilt(heel: any, toe: any, refLength: number = 0): number {
    const dy = toe.y - heel.y;
    const dx = Math.abs(toe.x - heel.x);

    // If we have a calibrated reference length, use it as the denominator (Hypotenuse).
    // This makes the angle calculation independent of horizontal perspective shifts (swaying).
    if (refLength > 0) {
      // Use asin for a true vertical angle relative to the physical foot length
      return Math.asin(Math.max(-1, Math.min(1, dy / refLength))) * (180 / Math.PI);
    }

    // Fallback for calibration phase
    const currentLength = Math.sqrt(dx * dx + dy * dy);
    return Math.atan2(dy, Math.max(dx, 0.03)) * (180 / Math.PI);
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

    // Get Landmarks
    const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const lHeel = landmarks[POSE_LANDMARKS.LEFT_HEEL];
    const rHeel = landmarks[POSE_LANDMARKS.RIGHT_HEEL];
    const lFoot = landmarks[POSE_LANDMARKS.LEFT_FOOT_INDEX];
    const rFoot = landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX];
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    if (!lKnee || !rKnee || !lAnkle || !rAnkle || !lHeel || !rHeel || !lFoot || !rFoot) {
      return { newPhase, feedback: ['Searching for feet...'], isRepCompleted, isMovementFinished: false, qualityScore: 0, angles: {} };
    }

    // 1. Calculations
    const lTilt_raw = this.calculateFootTilt(lHeel, lFoot, this.baseFootLengthL);
    const rTilt_raw = this.calculateFootTilt(rHeel, rFoot, this.baseFootLengthR);

    // Apply Exponential Moving Average (EMA) Smoothing
    if (this.smoothedTiltL === null) this.smoothedTiltL = lTilt_raw;
    if (this.smoothedTiltR === null) this.smoothedTiltR = rTilt_raw;

    this.smoothedTiltL = (lTilt_raw * this.SMOOTHING_FACTOR) + (this.smoothedTiltL * (1 - this.SMOOTHING_FACTOR));
    this.smoothedTiltR = (rTilt_raw * this.SMOOTHING_FACTOR) + (this.smoothedTiltR * (1 - this.SMOOTHING_FACTOR));

    const lTilt = this.smoothedTiltL;
    const rTilt = this.smoothedTiltR;
    const avgFootTilt = (lTilt + rTilt) / 2;
    const tiltDiff = Math.abs(lTilt - rTilt);

    const lKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const avgKneeAngle = (lKneeAngle + rKneeAngle) / 2;

    const currentAnkleX = (lAnkle.x + rAnkle.x) / 2;
    const currentShoulderX = (lShoulder.x + rShoulder.x) / 2;
    const currentShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const frameMovement = Math.abs(currentAnkleX - this.lastAnkleX);
    this.lastAnkleX = currentAnkleX;

    // Auto-Calibration
    if (!this.isCalibrated || (frameMovement < this.thresholds.CALIBRATION_MOVEMENT_MAX && avgKneeAngle > this.thresholds.CALIBRATION_KNEE_MIN && state.currentPhase === MovementPhase.START_POSITION)) {
      this.calibrationFrames++;
      if (this.calibrationFrames > this.thresholds.CALIBRATION_REQUIRED) {
        this.baseFootTilt = avgFootTilt;
        // Store the reference foot length (hypotenuse) during calibration.
        // This reference length stays constant even if the foot turns/sways.
        this.baseFootLengthL = Math.sqrt(Math.pow(lFoot.x - lHeel.x, 2) + Math.pow(lFoot.y - lHeel.y, 2));
        this.baseFootLengthR = Math.sqrt(Math.pow(rFoot.x - rHeel.x, 2) + Math.pow(rFoot.y - rHeel.y, 2));
        this.isCalibrated = true;
      }
    }

    // 2. Phase Detection
    switch (state.currentPhase) {
      case MovementPhase.INITIALIZING:
      case MovementPhase.START_POSITION:
        // Continuous Baseline Calibration: If still for a long time and not excessively tilted,
        // update the baseFootTilt to handle drift/weight shifts.
        if (this.stillFrames > (this.thresholds.STILLNESS_REQUIRED * 2) && avgFootTilt < (this.baseFootTilt + (this.thresholds.BASELINE_TOLERANCE * 2))) {
          // Slow adjustment to the baseline
          this.baseFootTilt = this.baseFootTilt * 0.8 + avgFootTilt * 0.2;
        }

        if (avgFootTilt - this.baseFootTilt <= this.thresholds.BASELINE_TOLERANCE) {
          newPhase = MovementPhase.START_POSITION;

          if (frameMovement < this.thresholds.MOVEMENT_STILLNESS_THRESHOLD) {
            this.stillFrames++;
            
            // Dynamic EMA Fix: Instead of infinite accumulation, we use a rolling average
            // so the anchor smoothly follows the user if they rest for a long time.
            if (this.stillFrames === 1) {
              this.startAnkleXSum = currentAnkleX;
              this.startShoulderXSum = currentShoulderX;
              this.startShoulderYSum = currentShoulderY;
            } else {
              this.startAnkleXSum = this.startAnkleXSum * 0.9 + currentAnkleX * 0.1;
              this.startShoulderXSum = this.startShoulderXSum * 0.9 + currentShoulderX * 0.1;
              this.startShoulderYSum = this.startShoulderYSum * 0.9 + currentShoulderY * 0.1;
            }

            if (this.stillFrames > this.thresholds.LOG_RESET_STILLNESS) {
              this.isAttemptLogged = false;
              this.wasAttemptFailed = false; // Allow a clean start
            }
          } else {
            this.stillFrames = 0;
          }
        }

        const avgStartAnkleX = this.stillFrames > 0 ? this.startAnkleXSum : currentAnkleX;
        const avgStartShoulderX = this.stillFrames > 0 ? this.startShoulderXSum : currentShoulderX;
        const avgStartShoulderY = this.stillFrames > 0 ? this.startShoulderYSum : currentShoulderY;

        const tiltChange = avgFootTilt - this.baseFootTilt;
        const swayAnkle = Math.abs(currentAnkleX - avgStartAnkleX);
        const swayShoulder = Math.abs(currentShoulderX - avgStartShoulderX);
        const bodyLift = avgStartShoulderY - currentShoulderY; // positive means moving UP (Y decreases)

        if (tiltChange > this.thresholds.START_LIFT && bodyLift > this.thresholds.MIN_BODY_LIFT && this.stillFrames > this.thresholds.STILLNESS_REQUIRED) {
          this.startAnkleXThisRep = avgStartAnkleX;
          this.startShoulderXThisRep = avgStartShoulderX;
          if (tiltDiff > this.thresholds.SYMMETRY_START_MAX) {
            feedback.push(this.messages.SYMMETRY);
            if (!this.isAttemptLogged) {
              newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: this.messages.SYMMETRY };
              this.isAttemptLogged = true;
            }
            this.wasAttemptFailed = true;
          } else if (avgKneeAngle < this.thresholds.KNEE_BEND_MIN) {
            feedback.push(this.messages.KNEE_STABILITY);
            if (!this.isAttemptLogged) {
              newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: this.messages.KNEE_STABILITY };
              this.isAttemptLogged = true;
              this.wasAttemptFailed = true;
            }
          } else if (swayAnkle > this.thresholds.SWAY_START_MAX || swayShoulder > this.thresholds.SWAY_START_MAX) {
            feedback.push(this.messages.BODY_SWAY);
            if (!this.isAttemptLogged) {
              newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: 'Excessive Sway' };
              this.isAttemptLogged = true;
              this.wasAttemptFailed = true;
            }
          } else {
            newPhase = MovementPhase.HEEL_RAISE;
            this.maxFootTiltThisRep = avgFootTilt;
            this.stillFrames = 0;
          }
        }
        break;

      case MovementPhase.HEEL_RAISE:
        this.maxFootTiltThisRep = Math.max(this.maxFootTiltThisRep, avgFootTilt);
        const raiseAnkleDrift = Math.abs(currentAnkleX - this.startAnkleXThisRep);
        const raiseShoulderDrift = Math.abs(currentShoulderX - this.startShoulderXThisRep);

        if (raiseAnkleDrift > this.thresholds.SWAY_MOVE_MAX || raiseShoulderDrift > this.thresholds.SWAY_MOVE_MAX) {
          if (!this.isAttemptLogged) {
            newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: 'Excessive Sway' };
            this.isAttemptLogged = true;
          }
          newPhase = MovementPhase.START_POSITION;
          this.wasAttemptFailed = true;
          this.stillFrames = 0;
        } else if (avgKneeAngle < (this.thresholds.KNEE_BEND_MIN - this.thresholds.KNEE_FLEX_ALLOWANCE)) {
          if (!this.isAttemptLogged) {
            newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: this.messages.KNEE_STABILITY };
            this.isAttemptLogged = true;
          }
          newPhase = MovementPhase.START_POSITION;
          this.wasAttemptFailed = true;
          this.stillFrames = 0;
        } else if (tiltDiff > this.thresholds.SYMMETRY_MID_MAX) {
          if (!this.isAttemptLogged) {
            newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: this.messages.SYMMETRY };
            this.isAttemptLogged = true;
          }
          newPhase = MovementPhase.START_POSITION;
          this.wasAttemptFailed = true;
          this.stillFrames = 0;
        } else if (avgFootTilt - this.baseFootTilt > this.thresholds.MAX_TILT_SAFETY) {
          if (!this.isAttemptLogged) {
            newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: this.messages.INVALID };
            this.isAttemptLogged = true;
          }
          newPhase = MovementPhase.START_POSITION;
          this.wasAttemptFailed = true;
          this.stillFrames = 0;
        } else if (avgFootTilt - this.baseFootTilt > this.thresholds.TOP_POSITION) {
          newPhase = MovementPhase.TOP_POSITION;
        } else if (avgFootTilt < this.maxFootTiltThisRep - this.thresholds.PARTIAL_REP_DROP || avgFootTilt <= this.baseFootTilt + this.thresholds.END_POSITION_TOLERANCE) {
          newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'failed', reason: 'Partial Rep (Low Height)' };
          newPhase = MovementPhase.LOWERING;
          this.isAttemptLogged = true;
          this.wasAttemptFailed = true;
        }
        break;

      case MovementPhase.TOP_POSITION:
        const topAnkleDrift = Math.abs(currentAnkleX - this.startAnkleXThisRep);
        const topShoulderDrift = Math.abs(currentShoulderX - this.startShoulderXThisRep);

        if (topAnkleDrift > this.thresholds.SWAY_MOVE_MAX || topShoulderDrift > this.thresholds.SWAY_MOVE_MAX) {
          if (!this.isAttemptLogged) {
            newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: 'Excessive Sway' };
            this.isAttemptLogged = true;
          }
          newPhase = MovementPhase.START_POSITION;
          this.wasAttemptFailed = true;
          this.stillFrames = 0;
        } else if (avgFootTilt < this.maxFootTiltThisRep - this.thresholds.PARTIAL_REP_DROP || avgFootTilt <= this.baseFootTilt + this.thresholds.END_POSITION_TOLERANCE) {
          newPhase = MovementPhase.LOWERING;
        }
        break;

      case MovementPhase.LOWERING:
        const lowerAnkleDrift = Math.abs(currentAnkleX - this.startAnkleXThisRep);
        const lowerShoulderDrift = Math.abs(currentShoulderX - this.startShoulderXThisRep);

        if (lowerAnkleDrift > this.thresholds.SWAY_MOVE_MAX || lowerShoulderDrift > this.thresholds.SWAY_MOVE_MAX) {
          if (!this.isAttemptLogged) {
            newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'canceled', reason: 'Excessive Sway' };
            this.isAttemptLogged = true;
          }
          newPhase = MovementPhase.START_POSITION;
          this.wasAttemptFailed = true;
          this.stillFrames = 0;
        } else if (avgFootTilt <= this.baseFootTilt + this.thresholds.END_POSITION_TOLERANCE) {
          newPhase = MovementPhase.START_POSITION;
          isMovementFinished = true;

          if (!this.wasAttemptFailed) {
            isRepCompleted = true;
            newAttempt = { id: Math.random().toString(), timestamp: Date.now(), status: 'success', reason: 'Clean Rep' };
          }

          this.isAttemptLogged = false;
          if (this.stillFrames > this.thresholds.LOCK_RESET_REQUIRED) {
            this.wasAttemptFailed = false;
          }
        }
        break;
    }

    let qualityScore = 100;

    return {
      newPhase, feedback, isRepCompleted, isMovementFinished, qualityScore: 100, newAttempt,
      angles: {
        footTilt: this.isCalibrated ? Number((avgFootTilt - this.baseFootTilt).toFixed(1)) : 0,
        kneeAngle: avgKneeAngle,
        symmetry: tiltDiff
      }
    };

  }
}
