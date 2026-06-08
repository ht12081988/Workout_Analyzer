import { POSE_LANDMARKS, MovementPhase, PoseData, ExerciseState, AttemptLogEntry } from './types';
import { calculateAngle } from './angle-utils';

export class SplitLungeRule {
  private thresholds = {
    // 1. STANCE_SETUP
    MIN_STEP_RATIO: 1.4,          // Distance between ankles / shoulder width
    FEET_TOGETHER_THRESHOLD: 0.25, // Threshold to detect feet together (ratio)

    // 2. LUNGE_DEPTH
    TARGET_KNEE_ANGLE: 85.0,       // Strict target (closer to 90 degrees)
    START_TRIGGER_ANGLE: 150.0,    // Balanced for earlier detection
    PARTIAL_REP_DROP: 15.0,        // More sensitive to "giving up" mid-rep
    STAND_UP_TOLERANCE: 165.0,     // Must stand up more fully
    MIN_MOVEMENT_FOR_ATTEMPT: 135.0,

    // 3. POSTURE_STABILITY
    MAX_TORSO_LEAN: 15.0,
    KNEE_TOE_TOLERANCE: 0.0,
    MAX_HEAD_FORWARD: 0.08,
    GAZE_SENSITIVITY: 0.02,

    // 4. ENGINE_STABILITY
    STILL_REQUIRED: 10,
    MOVEMENT_THRESHOLD: 0.015,
    STILLNESS_SMOOTHING: 0.1,
    BOTTOM_EXIT_TOLERANCE: 10.0,
  };

  private minKneeAngleThisRep: number = 180;
  private stillFrames: number = 0;
  private isArmed: boolean = false;
  private torsoLeanDetected: boolean = false;
  private depthFailureDetected: boolean = false;
  private kneeForwardDetected: boolean = false;
  private headForwardDetected: boolean = false;
  private lockedFrontLeg: 'left' | 'right' | null = null;
  private lockedFacingDir: number | null = null;
  private smoothedY: number | null = null;

  // Smoothing
  private smoothedKneeAngle: number | null = null;
  private SMOOTHING_FACTOR = 0.4; // Filter for jitters

  public setRules(dbRules: any[]) {
    if (!dbRules || dbRules.length === 0) return;

    dbRules.forEach(rule => {
      const val = rule.threshold_value;
      if (!val) return;
      
      // The backend saves JSON as a string or object depending on driver
      const config = typeof val === 'string' ? JSON.parse(val) : val;

      switch (rule.rule_name) {
        case 'STANCE_SETUP':
          if (config.min_step_ratio) this.thresholds.MIN_STEP_RATIO = config.min_step_ratio;
          if (config.feet_together_threshold) this.thresholds.FEET_TOGETHER_THRESHOLD = config.feet_together_threshold;
          break;
        case 'LUNGE_DEPTH':
          if (config.target_angle) this.thresholds.TARGET_KNEE_ANGLE = config.target_angle;
          if (config.start_trigger) this.thresholds.START_TRIGGER_ANGLE = config.start_trigger;
          if (config.partial_drop) this.thresholds.PARTIAL_REP_DROP = config.partial_drop;
          if (config.min_movement) this.thresholds.MIN_MOVEMENT_FOR_ATTEMPT = config.min_movement;
          if (config.stand_up_tolerance) this.thresholds.STAND_UP_TOLERANCE = config.stand_up_tolerance;
          if (config.bottom_exit_tolerance) this.thresholds.BOTTOM_EXIT_TOLERANCE = config.bottom_exit_tolerance;
          break;
        case 'POSTURE_STABILITY':
          if (config.max_torso_lean) this.thresholds.MAX_TORSO_LEAN = config.max_torso_lean;
          if (config.knee_toe_tolerance !== undefined) this.thresholds.KNEE_TOE_TOLERANCE = config.knee_toe_tolerance;
          if (config.max_head_forward) this.thresholds.MAX_HEAD_FORWARD = config.max_head_forward;
          if (config.gaze_sensitivity) this.thresholds.GAZE_SENSITIVITY = config.gaze_sensitivity;
          break;
        case 'ENGINE_STABILITY':
          if (config.smoothing_factor) this.SMOOTHING_FACTOR = config.smoothing_factor;
          if (config.movement_threshold) this.thresholds.MOVEMENT_THRESHOLD = config.movement_threshold;
          if (config.still_required) this.thresholds.STILL_REQUIRED = config.still_required;
          if (config.stillness_smoothing) this.thresholds.STILLNESS_SMOOTHING = config.stillness_smoothing;
          break;
      }
    });

    console.log('Split Lunge Engine: Dynamic JSON Rules Loaded', this.thresholds);
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
    const feedback: string[] = [];
    let isRepCompleted = false;
    let isMovementFinished = false;
    let newPhase = state.currentPhase;
    let newAttempt: AttemptLogEntry | undefined;
    let score = 100;

    // Get landmarks
    const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
    const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
    const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle = pose[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = pose[POSE_LANDMARKS.RIGHT_ANKLE];
    const lToe = pose[POSE_LANDMARKS.LEFT_FOOT_INDEX];
    const rToe = pose[POSE_LANDMARKS.RIGHT_FOOT_INDEX];
    const lEar = pose[POSE_LANDMARKS.LEFT_EAR];
    const rEar = pose[POSE_LANDMARKS.RIGHT_EAR];
    const lEye = pose[POSE_LANDMARKS.LEFT_EYE];
    const rEye = pose[POSE_LANDMARKS.RIGHT_EYE];

    if (!lShoulder || !rShoulder || !lHip || !rHip || !lKnee || !rKnee || !lAnkle || !rAnkle || !lToe || !rToe) {
      return { newPhase, feedback: ['Searching for body profile...'], isRepCompleted, isMovementFinished: false, qualityScore: 0, angles: {} };
    }

    // 1. CORE CALCULATIONS (Profile View Focus)
    const lKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const rawActiveKneeAngle = Math.min(lKneeAngle, rKneeAngle);

    if (this.smoothedKneeAngle === null) {
      this.smoothedKneeAngle = rawActiveKneeAngle;
    } else {
      this.smoothedKneeAngle = (rawActiveKneeAngle * this.SMOOTHING_FACTOR) + (this.smoothedKneeAngle * (1 - this.SMOOTHING_FACTOR));
    }
    const activeKneeAngle = this.smoothedKneeAngle;

    // Detect/Use Locked Facing Direction
    let facingDir = this.lockedFacingDir;
    if (facingDir === null) {
      facingDir = (lKnee.x > lHip.x || rKnee.x > rHip.x) ? 1 : -1;
    }

    // Head Alignment (Neck/Gaze)
    const activeEar = facingDir === 1 ? rEar : lEar;
    const activeShoulder = facingDir === 1 ? rShoulder : lShoulder;
    const activeEye = facingDir === 1 ? rEye : lEye;
    
    let headFeedback = "";
    if (activeEar && activeShoulder) {
      const headForwardDist = (activeEar.x - activeShoulder.x) * facingDir;
      if (headForwardDist > this.thresholds.MAX_HEAD_FORWARD) {
        headFeedback = "Keep your head back";
        this.headForwardDetected = true;
      }
    }
    if (activeEye && activeEar && activeEye.y > activeEar.y + this.thresholds.GAZE_SENSITIVITY) {
      headFeedback = "Look straight ahead";
    }

    // Identify/Use Locked Front Leg
    let isLeftFront = false;
    if (this.lockedFrontLeg === 'left') {
      isLeftFront = true;
    } else if (this.lockedFrontLeg === 'right') {
      isLeftFront = false;
    } else {
      isLeftFront = (lAnkle.x * facingDir) > (rAnkle.x * facingDir);
    }

    const frontKnee = isLeftFront ? lKnee : rKnee;
    const frontToe = isLeftFront ? lToe : rToe;

    // Step length calculation
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x) || 0.1;
    const ankleDist = Math.abs(lAnkle.x - rAnkle.x);
    const stanceRatio = ankleDist / shoulderWidth;

    // Torso angle
    const avgShoulderX = (lShoulder.x + rShoulder.x) / 2;
    const avgHipX = (lHip.x + rHip.x) / 2;
    const avgShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const avgHipY = (lHip.y + rHip.y) / 2;
    const torsoVectorX = avgShoulderX - avgHipX;
    const torsoVectorY = avgShoulderY - avgHipY;
    const torsoAngle = Math.abs(Math.atan2(torsoVectorX, -torsoVectorY) * (180 / Math.PI));

    // 2. STATE MACHINE (Trainer's Way: Split Squat)
    switch (state.currentPhase) {
      case MovementPhase.INITIALIZING:
        if (this.checkStillness(pose)) {
          newPhase = MovementPhase.START_POSITION;
        } else {
          feedback.push('Stand sideways and hold still');
        }
        break;

      case MovementPhase.START_POSITION:
        if (stanceRatio < this.thresholds.FEET_TOGETHER_THRESHOLD) {
          feedback.push('Step one leg forward to begin');
          this.isArmed = false;
          this.stillFrames = 0;
          this.smoothedKneeAngle = null;
          this.lockedFrontLeg = null;
          this.lockedFacingDir = null;
        } else if (stanceRatio > this.thresholds.MIN_STEP_RATIO) {
          if (this.checkStillness(pose)) {
            this.stillFrames++;
            if (this.stillFrames >= this.thresholds.STILL_REQUIRED) {
              feedback.push('Stance Locked! Lower your hips');
              this.isArmed = true;
              
              // LOCK THE STANCE GEOMETRY
              if (this.lockedFacingDir === null) {
                this.lockedFacingDir = (lKnee.x > lHip.x || rKnee.x > rHip.x) ? 1 : -1;
                this.lockedFrontLeg = (lAnkle.x * this.lockedFacingDir) > (rAnkle.x * this.lockedFacingDir) ? 'left' : 'right';
              }
            } else {
              feedback.push('Hold stance...');
            }
          } else {
            feedback.push('Stay still in your split stance');
            this.stillFrames = 0;
          }
        } else {
          feedback.push('Take a wider step for stability');
          this.stillFrames = 0;
        }

        if (this.isArmed && activeKneeAngle < this.thresholds.START_TRIGGER_ANGLE) {
          newPhase = MovementPhase.DESCENDING;
          this.minKneeAngleThisRep = activeKneeAngle;
          this.torsoLeanDetected = false;
          this.depthFailureDetected = false;
          this.kneeForwardDetected = false;
          this.headForwardDetected = false;
        }
        break;

      case MovementPhase.DESCENDING:
        this.minKneeAngleThisRep = Math.min(this.minKneeAngleThisRep, activeKneeAngle);
        feedback.push("Sitting into the lunge...");
        if (headFeedback) feedback.push(headFeedback);

        // Safety Check: Knee over Toe
        const kneeBeyondToe = (frontKnee.x - frontToe.x) * facingDir > this.thresholds.KNEE_TOE_TOLERANCE;
        if (kneeBeyondToe) {
          feedback.push("Front knee beyond toe!");
          this.kneeForwardDetected = true;
        }

        if (torsoAngle > this.thresholds.MAX_TORSO_LEAN) {
          feedback.push("Keep chest upright!");
          this.torsoLeanDetected = true;
        }

        if (activeKneeAngle < this.thresholds.TARGET_KNEE_ANGLE) {
          newPhase = MovementPhase.BOTTOM_POSITION;
        } else if (activeKneeAngle > this.minKneeAngleThisRep + this.thresholds.PARTIAL_REP_DROP) {
          newPhase = MovementPhase.ASCENDING;
          this.depthFailureDetected = true;
        }
        break;

      case MovementPhase.BOTTOM_POSITION:
        feedback.push("Great depth! Now push up");
        if (headFeedback) feedback.push(headFeedback);
        if (activeKneeAngle > this.thresholds.TARGET_KNEE_ANGLE + this.thresholds.BOTTOM_EXIT_TOLERANCE) {
          newPhase = MovementPhase.ASCENDING;
        }
        break;

      case MovementPhase.ASCENDING:
        feedback.push("Driving back up...");
        if (headFeedback) feedback.push(headFeedback);

        if (torsoAngle > this.thresholds.MAX_TORSO_LEAN) {
          feedback.push("Don't lean forward!");
          this.torsoLeanDetected = true;
        }

        if (activeKneeAngle > this.thresholds.STAND_UP_TOLERANCE) {
          newPhase = MovementPhase.START_POSITION;

          // GHOST REP FILTER:
          // If the "minimum angle" during the rep was still quite standing (e.g. > 140),
          // it was likely just jitter or a tiny movement. We ignore these.
          if (this.minKneeAngleThisRep > this.thresholds.MIN_MOVEMENT_FOR_ATTEMPT) {
            isMovementFinished = false; // Don't even finish the rep
            return {
              newPhase,
              feedback,
              isRepCompleted: false,
              isMovementFinished: false,
              qualityScore: 100,
              angles: {
                kneeAngle: activeKneeAngle,
                torsoAngle: torsoAngle,
                stanceRatio: stanceRatio
              }
            };
          }

          isMovementFinished = true;
          const failReasons: string[] = [];
          if (this.torsoLeanDetected) failReasons.push('Torso lean');
          if (this.depthFailureDetected) failReasons.push('Insufficient depth');
          if (this.kneeForwardDetected) failReasons.push('Knee beyond toe');
          if (this.headForwardDetected) failReasons.push('Forward head');

          if (failReasons.length === 0) {
            isRepCompleted = true;
            newAttempt = {
              id: Math.random().toString(),
              timestamp: Date.now(),
              status: 'success',
              reason: 'Excellent Split Squat!',
              qualityScore: 100
            };
          } else {
            newAttempt = {
              id: Math.random().toString(),
              timestamp: Date.now(),
              status: 'failed',
              reason: failReasons.join(' & '),
              qualityScore: 100
            };
          }
          this.stillFrames = 0; // Reset to allow immediate next rep
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
        kneeAngle: activeKneeAngle,
        torsoAngle: torsoAngle,
        stanceRatio: stanceRatio
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
    this.smoothedY = (avgY * this.thresholds.STILLNESS_SMOOTHING) + (this.smoothedY * (1 - this.thresholds.STILLNESS_SMOOTHING));
    return isStill;
  }
}
