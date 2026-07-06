import { IExerciseRule } from './MovementEngine';
import { MovementPhase, PoseData, ExerciseState, AttemptLogEntry, POSE_LANDMARKS } from './types';
import { calculateAngle } from './angle-utils';

export class DynamicRule implements IExerciseRule {
  private rules: any[] = [];
  private dynamicProfile: any = null;
  
  // State for the engine
  private currentPhaseIndex: number = 0;
  private isRepCalibrated: boolean = false;
  private failedChecksThisRep: Set<string> = new Set();
  private setupWarningsThisRep: Set<string> = new Set();
  private consecutiveFailures: Map<string, number> = new Map();
  
  // State for Temporal and Calibrated metrics
  private baseTorsoHeight: number | null = null;
  private initialHipX: number | null = null;
  private initialHeelTilt: number | null = null;
  private initialLeftHeelTilt: number | null = null;
  private initialRightHeelTilt: number | null = null;
  private previousPose: PoseData | null = null;
  private lastTimeMs: number = 0;
  private previousHipY: number | null = null;
  
  public setRules(rules: any[]): void {
    this.rules = rules;
    const dynamicRuleRow = rules.find(r => r.rule_name === 'DYNAMIC_PROFILE');
    if (dynamicRuleRow && dynamicRuleRow.threshold_value) {
      this.dynamicProfile = dynamicRuleRow.threshold_value;
    }
  }

  // Helper to calculate any metric from the Master Metrics Library
  public static calculateMetric(metricId: string, pose: PoseData, state: any = {}): number {
    switch (metricId) {
      case 'KNEE_ANGLE': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const lAnkle = pose[POSE_LANDMARKS.LEFT_ANKLE];
        
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        const rAnkle = pose[POSE_LANDMARKS.RIGHT_ANKLE];

        let angles: number[] = [];
        if (lHip && lKnee && lAnkle) {
          angles.push(calculateAngle(lHip, lKnee, lAnkle));
        }
        if (rHip && rKnee && rAnkle) {
          angles.push(calculateAngle(rHip, rKnee, rAnkle));
        }

        if (angles.length > 0) {
          return angles.reduce((a, b) => a + b, 0) / angles.length;
        }
        return 0;
      }
      case 'LEFT_KNEE_ANGLE': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const lAnkle = pose[POSE_LANDMARKS.LEFT_ANKLE];
        if (lHip && lKnee && lAnkle) {
          return calculateAngle(lHip, lKnee, lAnkle);
        }
        return 0;
      }
      case 'RIGHT_KNEE_ANGLE': {
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        const rAnkle = pose[POSE_LANDMARKS.RIGHT_ANKLE];
        if (rHip && rKnee && rAnkle) {
          return calculateAngle(rHip, rKnee, rAnkle);
        }
        return 0;
      }
      case 'TORSO_ANGLE_VERT': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        if (lShoulder && lHip) {
          // Angle with a true vertical drop from the hip
          return calculateAngle(lShoulder, lHip, { x: lHip.x, y: lHip.y - 1.0 });
        }
        return 0;
      }
      case 'BODY_ORIENTATION_ANGLE': {
        const shoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER] || pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const heel = pose[POSE_LANDMARKS.LEFT_HEEL] || pose[POSE_LANDMARKS.RIGHT_HEEL];
        if (shoulder && heel) {
          // Angle between the entire body (heel to shoulder) and a true vertical line
          return calculateAngle(shoulder, heel, { x: heel.x, y: heel.y - 1.0 });
        }
        return 0;
      }
      case 'STANCE_WIDTH_RATIO': {
        const lHeel = pose[POSE_LANDMARKS.LEFT_HEEL];
        const rHeel = pose[POSE_LANDMARKS.RIGHT_HEEL];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        
        if (lHeel && rHeel) {
          const heelWidth = Math.abs(lHeel.x - rHeel.x);
          // If sideways, shoulder width is ~0. Fallback to a fraction of torso height to stabilize the ratio.
          let shoulderWidth = 0.1; 
          if (lShoulder && rShoulder) {
             shoulderWidth = Math.max(Math.abs(lShoulder.x - rShoulder.x), state.baseTorsoHeight ? state.baseTorsoHeight * 0.5 : 0.1);
          } else if (state.baseTorsoHeight) {
             shoulderWidth = state.baseTorsoHeight * 0.5;
          }
          return shoulderWidth > 0 ? heelWidth / shoulderWidth : 0;
        }
        return 0;
      }
      case 'KNEE_VALGUS_RATIO': {
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        const lAnkle = pose[POSE_LANDMARKS.LEFT_ANKLE];
        const rAnkle = pose[POSE_LANDMARKS.RIGHT_ANKLE];
        if (lKnee && rKnee && lAnkle && rAnkle) {
          const kneeWidth = Math.abs(lKnee.x - rKnee.x);
          const ankleWidth = Math.abs(lAnkle.x - rAnkle.x);
          return ankleWidth > 0 ? kneeWidth / ankleWidth : 0;
        }
        return 0;
      }
      case 'FOOT_TURNOUT_ANGLE': {
        const lHeel = pose[POSE_LANDMARKS.LEFT_HEEL];
        const rHeel = pose[POSE_LANDMARKS.RIGHT_HEEL];
        const lFoot = pose[POSE_LANDMARKS.LEFT_FOOT_INDEX];
        const rFoot = pose[POSE_LANDMARKS.RIGHT_FOOT_INDEX];
        if (lHeel && lFoot && rHeel && rFoot) {
          const calcFoot = (heel: any, toe: any) => {
            const dx = Math.abs(toe.x - heel.x);
            const dy = Math.abs(toe.y - heel.y);
            return Math.atan2(dx, dy) * (180 / Math.PI);
          };
          const lAngle = calcFoot(lHeel, lFoot);
          const rAngle = calcFoot(rHeel, rFoot);
          return (lAngle + rAngle) / 2;
        }
        return 0;
      }
      case 'HIP_HINGE_ANGLE': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        if (lShoulder && lHip && lKnee) return calculateAngle(lShoulder, lHip, lKnee);
        return 0;
      }
      case 'GRIP_WIDTH_RATIO': {
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        const rWrist = pose['RIGHT_WRIST'] || pose['RIGHT_INDEX'];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (lWrist && rWrist && lShoulder && rShoulder) {
          const gripWidth = Math.abs(lWrist.x - rWrist.x);
          const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
          return shoulderWidth > 0 ? gripWidth / shoulderWidth : 0;
        }
        return 0;
      }
      case 'KNEE_OVER_TOE': {
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const lFoot = pose[POSE_LANDMARKS.LEFT_FOOT_INDEX];
        if (lKnee && lFoot) return Math.abs(lKnee.x - lFoot.x) * 100;
        return 0;
      }
      case 'HEAD_FORWARD_LEAN': {
        const lEar = pose[POSE_LANDMARKS.LEFT_EAR];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        if (lEar && lShoulder) return Math.abs(lEar.x - lShoulder.x) * 100;
        return 0;
      }
      case 'GAZE_ALIGNMENT': {
        const ear = pose[POSE_LANDMARKS.LEFT_EAR] || pose[POSE_LANDMARKS.RIGHT_EAR];
        const eye = pose[POSE_LANDMARKS.LEFT_EYE] || pose[POSE_LANDMARKS.RIGHT_EYE];
        if (ear && eye) {
           const dy = ear.y - eye.y; 
           // Clamp dx to a minimum of 0.05 to prevent wild atan2 oscillations when facing the camera
           const dx = Math.max(0.05, Math.abs(eye.x - ear.x));
           return Math.atan2(dy, dx) * (180 / Math.PI);
        }
        return 0;
      }
      case 'VERTICAL_BAR_PATH': {
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        const lHeel = pose[POSE_LANDMARKS.LEFT_HEEL];
        const lFoot = pose[POSE_LANDMARKS.LEFT_FOOT_INDEX];
        if (lWrist && lHeel && lFoot) {
          const midFootX = (lHeel.x + lFoot.x) / 2;
          return Math.abs(lWrist.x - midFootX) * 100;
        }
        return 0;
      }
      case 'DYN_TORSO_COMPRESSION': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        if (lShoulder && rShoulder && lHip && rHip) {
          const currentTorsoHeight = Math.abs((lHip.y + rHip.y) / 2 - (lShoulder.y + rShoulder.y) / 2);
          if (state.baseTorsoHeight) {
             return currentTorsoHeight / state.baseTorsoHeight;
          }
        }
        return 1.0;
      }
      case 'HEEL_RAISE_TILT': {
        const lHeel = pose[POSE_LANDMARKS.LEFT_HEEL];
        const lFoot = pose[POSE_LANDMARKS.LEFT_FOOT_INDEX];
        const rHeel = pose[POSE_LANDMARKS.RIGHT_HEEL];
        const rFoot = pose[POSE_LANDMARKS.RIGHT_FOOT_INDEX];
        let tilts: number[] = [];
        
        if (lHeel && lFoot && state.baseTorsoHeight) {
          tilts.push(((lFoot.y - lHeel.y) / state.baseTorsoHeight) * 100);
        }
        if (rHeel && rFoot && state.baseTorsoHeight) {
          tilts.push(((rFoot.y - rHeel.y) / state.baseTorsoHeight) * 100);
        }
        
        if (tilts.length > 0) {
          const currentTilt = tilts.reduce((a, b) => a + b, 0) / tilts.length;
          if (state.initialHeelTilt !== undefined && state.initialHeelTilt !== null) {
            return Math.max(0, currentTilt - state.initialHeelTilt);
          }
          return currentTilt;
        }
        return 0;
      }
      case 'LEFT_HEEL_RAISE_TILT': {
        const lHeel = pose[POSE_LANDMARKS.LEFT_HEEL];
        const lFoot = pose[POSE_LANDMARKS.LEFT_FOOT_INDEX];
        if (lHeel && lFoot && state.baseTorsoHeight) {
          const currentTilt = ((lFoot.y - lHeel.y) / state.baseTorsoHeight) * 100;
          if (state.initialLeftHeelTilt !== undefined && state.initialLeftHeelTilt !== null) {
            return Math.max(0, currentTilt - state.initialLeftHeelTilt);
          }
          return currentTilt;
        }
        return 0;
      }
      case 'RIGHT_HEEL_RAISE_TILT': {
        const rHeel = pose[POSE_LANDMARKS.RIGHT_HEEL];
        const rFoot = pose[POSE_LANDMARKS.RIGHT_FOOT_INDEX];
        if (rHeel && rFoot && state.baseTorsoHeight) {
          const currentTilt = ((rFoot.y - rHeel.y) / state.baseTorsoHeight) * 100;
          if (state.initialRightHeelTilt !== undefined && state.initialRightHeelTilt !== null) {
            return Math.max(0, currentTilt - state.initialRightHeelTilt);
          }
          return currentTilt;
        }
        return 0;
      }
      case 'BODY_SWAY': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        if (lHip && rHip) {
          const currentHipX = (lHip.x + rHip.x) / 2;
          if (state.initialHipX !== undefined && state.initialHipX !== null) {
            return Math.abs(currentHipX - state.initialHipX) * 100;
          }
        }
        return 0;
      }
      case 'SHOULDER_ROTATION': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (lShoulder && rShoulder && state.baseTorsoHeight) {
          const currentWidth = Math.abs(lShoulder.x - rShoulder.x);
          // When facing front, width is max. When twisted sideways, width is 0.
          return (currentWidth / state.baseTorsoHeight) * 100;
        }
        return 0;
      }
      case 'BILATERAL_SYMMETRY': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const lAnkle = pose[POSE_LANDMARKS.LEFT_ANKLE];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        const rAnkle = pose[POSE_LANDMARKS.RIGHT_ANKLE];
        if (lHip && lKnee && lAnkle && rHip && rKnee && rAnkle) {
          const lAngle = calculateAngle(lHip, lKnee, lAnkle);
          const rAngle = calculateAngle(rHip, rKnee, rAnkle);
          return rAngle > 0 ? lAngle / rAngle : 1;
        }
        return 1;
      }
      case 'ELBOW_ANGLE': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lElbow = pose['LEFT_ELBOW'];
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rElbow = pose['RIGHT_ELBOW'];
        const rWrist = pose['RIGHT_WRIST'] || pose['RIGHT_INDEX'];

        let angles: number[] = [];
        if (lShoulder && lElbow && lWrist) {
          angles.push(calculateAngle(lShoulder, lElbow, lWrist));
        }
        if (rShoulder && rElbow && rWrist) {
          angles.push(calculateAngle(rShoulder, rElbow, rWrist));
        }

        if (angles.length > 0) {
          return angles.reduce((a, b) => a + b, 0) / angles.length;
        }
        return 0;
      }
      case 'LEFT_ELBOW_ANGLE': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lElbow = pose['LEFT_ELBOW'];
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        if (lShoulder && lElbow && lWrist) return calculateAngle(lShoulder, lElbow, lWrist);
        return 0;
      }
      case 'RIGHT_ELBOW_ANGLE': {
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rElbow = pose['RIGHT_ELBOW'];
        const rWrist = pose['RIGHT_WRIST'] || pose['RIGHT_INDEX'];
        if (rShoulder && rElbow && rWrist) return calculateAngle(rShoulder, rElbow, rWrist);
        return 0;
      }
      case 'SHOULDER_FLEXION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lElbow = pose['LEFT_ELBOW'];

        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rElbow = pose['RIGHT_ELBOW'];

        let angles: number[] = [];
        if (lHip && lShoulder && lElbow) {
          angles.push(calculateAngle(lHip, lShoulder, lElbow));
        }
        if (rHip && rShoulder && rElbow) {
          angles.push(calculateAngle(rHip, rShoulder, rElbow));
        }

        if (angles.length > 0) {
          return angles.reduce((a, b) => a + b, 0) / angles.length;
        }
        return 0;
      }
      case 'LEFT_SHOULDER_FLEXION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lElbow = pose['LEFT_ELBOW'];
        if (lHip && lShoulder && lElbow) return calculateAngle(lHip, lShoulder, lElbow);
        return 0;
      }
      case 'RIGHT_SHOULDER_FLEXION': {
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rElbow = pose['RIGHT_ELBOW'];
        if (rHip && rShoulder && rElbow) return calculateAngle(rHip, rShoulder, rElbow);
        return 0;
      }
      case 'WRIST_ALIGNMENT': {
        const lElbow = pose['LEFT_ELBOW'];
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        const lIndex = pose['LEFT_INDEX'];

        const rElbow = pose['RIGHT_ELBOW'];
        const rWrist = pose['RIGHT_WRIST'] || pose['RIGHT_INDEX'];
        const rIndex = pose['RIGHT_INDEX'];

        let angles: number[] = [];
        if (lElbow && lWrist && lIndex) {
          angles.push(calculateAngle(lElbow, lWrist, lIndex));
        }
        if (rElbow && rWrist && rIndex) {
          angles.push(calculateAngle(rElbow, rWrist, rIndex));
        }

        if (angles.length > 0) {
          return angles.reduce((a, b) => a + b, 0) / angles.length;
        }
        return 0;
      }
      case 'LEFT_WRIST_ALIGNMENT': {
        const lElbow = pose['LEFT_ELBOW'];
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        const lIndex = pose['LEFT_INDEX'];
        if (lElbow && lWrist && lIndex) return calculateAngle(lElbow, lWrist, lIndex);
        return 0;
      }
      case 'RIGHT_WRIST_ALIGNMENT': {
        const rElbow = pose['RIGHT_ELBOW'];
        const rWrist = pose['RIGHT_WRIST'] || pose['RIGHT_INDEX'];
        const rIndex = pose['RIGHT_INDEX'];
        if (rElbow && rWrist && rIndex) return calculateAngle(rElbow, rWrist, rIndex);
        return 0;
      }
      case 'STILLNESS_JITTER': {
        if (state.previousPose) {
          let jitter = 0;
          const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
          const prevShoulder = state.previousPose[POSE_LANDMARKS.LEFT_SHOULDER];
          if (lShoulder && prevShoulder) {
            jitter += Math.abs(lShoulder.x - prevShoulder.x) + Math.abs(lShoulder.y - prevShoulder.y);
          }
          return jitter * 1000;
        }
        return 0;
      }
      case 'CONCENTRIC_VELOCITY':
      case 'ECCENTRIC_VELOCITY': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        if (lHip && rHip && state.previousHipY !== undefined && state.previousHipY !== null && state.timeMs && state.lastTimeMs > 0) {
           const currentHipY = (lHip.y + rHip.y) / 2;
           const dt = (state.timeMs - state.lastTimeMs) / 1000;
           if (dt > 0) {
             const velocity = (currentHipY - state.previousHipY) / dt; 
             if (metricId === 'CONCENTRIC_VELOCITY') {
               return velocity < 0 ? Math.abs(velocity) * 100 : 0; // Negative Y is moving up
             } else {
               return velocity > 0 ? velocity * 100 : 0; // Positive Y is moving down
             }
           }
        }
        return 0;
      }
      default:
        return 0;
    }
  }

  private evaluateCondition(actualValue: number, operator: string, targetValue: number): boolean {
    switch (operator) {
      case '<': return actualValue < targetValue;
      case '<=': return actualValue <= targetValue;
      case '>': return actualValue > targetValue;
      case '>=': return actualValue >= targetValue;
      case '==': return Math.abs(actualValue - targetValue) < 0.1;
      default: return false;
    }
  }

  public validate(pose: PoseData, state: ExerciseState, timeMs?: number): {
    newPhase: MovementPhase;
    feedback: string[];
    isRepCompleted: boolean;
    isMovementFinished: boolean;
    qualityScore: number;
    angles: Record<string, number>;
    newAttempt?: AttemptLogEntry;
  } {
    let newPhase = state.currentPhase;
    const feedback: string[] = [];
    let isRepCompleted = false;
    let isMovementFinished = false;
    let newAttempt: AttemptLogEntry | undefined;

    const angles: Record<string, number> = {};

    // If no dynamic profile is loaded, just stay in initializing
    if (!this.dynamicProfile || !this.dynamicProfile.phases) {
      return { newPhase, feedback, isRepCompleted, isMovementFinished, qualityScore: 100, angles };
    }

    const phases = this.dynamicProfile.phases;

    // Dynamically calculate metrics used in this exercise profile so they appear in charts
    const usedMetrics = new Set<string>();
    phases.forEach((p: any) => {
      p.entryConditions?.forEach((c: any) => usedMetrics.add(c.metric));
      p.formChecks?.forEach((c: any) => usedMetrics.add(c.metric));
    });

    // Update internal state needed for velocities/jitter
    const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
    const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
    
    // Evaluate all metrics
    for (const metricId of usedMetrics) {
      // Convert metric ID (e.g., HEEL_RAISE_TILT) to camelCase (e.g., heelRaiseTilt) for the frontend charts
      const chartKey = metricId.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      angles[chartKey] = DynamicRule.calculateMetric(metricId, pose, {
        baseTorsoHeight: this.baseTorsoHeight,
        initialHeelTilt: this.initialHeelTilt,
        initialLeftHeelTilt: this.initialLeftHeelTilt,
        initialRightHeelTilt: this.initialRightHeelTilt,
        initialHipX: this.initialHipX,
        previousPose: this.previousPose,
        previousHipY: this.previousHipY,
        lastTimeMs: this.lastTimeMs,
        timeMs: timeMs
      });
    }

    const currentPhaseConfig = phases[this.currentPhaseIndex] || phases[0];

    // If we just reset (e.g. from previous rep completion)
    if (state.currentPhase === MovementPhase.INITIALIZING || state.currentPhase === MovementPhase.START_POSITION) {
      this.currentPhaseIndex = 0;
      
      if (!this.isRepCalibrated) {
        // Only attempt calibration if we have at least one shoulder and one hip visible
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        
        const hasShoulder = lShoulder || rShoulder;
        const hasHip = lHip || rHip;
        
        if (hasShoulder && hasHip) {
          this.failedChecksThisRep.clear();
          this.setupWarningsThisRep.clear();
          this.consecutiveFailures.clear();
          
          const shoulderY = ((lShoulder?.y || rShoulder?.y) + (rShoulder?.y || lShoulder?.y)) / 2;
          const hipY = ((lHip?.y || rHip?.y) + (rHip?.y || lHip?.y)) / 2;
          const hipX = ((lHip?.x || rHip?.x) + (rHip?.x || lHip?.x)) / 2;
          
          this.baseTorsoHeight = Math.abs(hipY - shoulderY);
          this.initialHipX = hipX;
          this.initialHeelTilt = null;
          this.initialLeftHeelTilt = null;
          this.initialRightHeelTilt = null;
        
          const lHeel = pose[POSE_LANDMARKS.LEFT_HEEL];
          const rHeel = pose[POSE_LANDMARKS.RIGHT_HEEL];
          const lFoot = pose[POSE_LANDMARKS.LEFT_FOOT_INDEX];
          const rFoot = pose[POSE_LANDMARKS.RIGHT_FOOT_INDEX];

          let tilts: number[] = [];
          if (lHeel && lFoot && this.baseTorsoHeight) {
            this.initialLeftHeelTilt = ((lFoot.y - lHeel.y) / this.baseTorsoHeight) * 100;
            tilts.push(this.initialLeftHeelTilt);
          }
          if (rHeel && rFoot && this.baseTorsoHeight) {
            this.initialRightHeelTilt = ((rFoot.y - rHeel.y) / this.baseTorsoHeight) * 100;
            tilts.push(this.initialRightHeelTilt);
          }
          if (tilts.length > 0) {
            this.initialHeelTilt = tilts.reduce((a, b) => a + b, 0) / tilts.length;
          }

          this.isRepCalibrated = true;
        } else {
          // If we can't calibrate yet, stay in START_POSITION and return immediately.
          // This forces the engine to wait for a clean camera frame before starting the rep.
          return {
            newPhase: MovementPhase.START_POSITION,
            feedback: ["Please stand fully in frame to begin..."],
            isRepCompleted: false,
            isMovementFinished: false,
            qualityScore: 100,
            angles: {}
          };
        }
      }
      
      // Determine the mapping for the first phase (Phase 0)
      const firstPhaseName = phases[0].name?.toUpperCase() || '';
      if (firstPhaseName.includes('SETUP')) newPhase = MovementPhase.START_POSITION;
      else if (firstPhaseName.includes('DESCEND') || firstPhaseName.includes('FIRST MOVEMENT')) newPhase = MovementPhase.DESCENDING;
      else if (firstPhaseName.includes('BOTTOM') || firstPhaseName.includes('HOLD') || firstPhaseName.includes('PAUSE')) newPhase = MovementPhase.BOTTOM_POSITION;
      else if (firstPhaseName.includes('ASCEND') || firstPhaseName.includes('RETURN MOVEMENT')) newPhase = MovementPhase.ASCENDING;
      else newPhase = MovementPhase.DESCENDING; // Smart fallback for Phase 0
    }

    // 1. Evaluate Live Form Checks for the current phase
    if (currentPhaseConfig.formChecks) {
      for (const check of currentPhaseConfig.formChecks) {
        if (!check.message) continue;

        const actualValue = DynamicRule.calculateMetric(check.metric, pose, {
          baseTorsoHeight: this.baseTorsoHeight,
          initialHeelTilt: this.initialHeelTilt,
          initialLeftHeelTilt: this.initialLeftHeelTilt,
          initialRightHeelTilt: this.initialRightHeelTilt,
          initialHipX: this.initialHipX,
          previousPose: this.previousPose,
          previousHipY: this.previousHipY,
          lastTimeMs: this.lastTimeMs,
          timeMs: timeMs
        });
        const targetValue = check.value !== undefined ? check.value : check.threshold;
        const hasFailed = this.evaluateCondition(actualValue, check.operator, targetValue);
        
        if (hasFailed) {
          const currentCount = (this.consecutiveFailures.get(check.message) || 0) + 1;
          this.consecutiveFailures.set(check.message, currentCount);
          
          if (currentCount >= 4) { // Require 4 consecutive frames (~133ms at 30fps) to debounce occlusion jitter
            feedback.push(check.message); // Always show the feedback on screen while failing
            
            if (currentPhaseConfig.isSetupPhase) {
              this.setupWarningsThisRep.add(check.message);
            } else {
              this.failedChecksThisRep.add(check.message);
            }
          }
        } else {
          // Reset the failure counter if the athlete corrects their form (or if it was just a jitter)
          this.consecutiveFailures.set(check.message, 0);
        }
      }
    }

    // 2. Evaluate Phase Transitions (Exit Conditions)
    if (currentPhaseConfig.entryConditions && currentPhaseConfig.entryConditions.length > 0) {
      // For simplicity, assuming if ALL entry conditions are met, we transition
      let allMet = true;
      for (const cond of currentPhaseConfig.entryConditions) {
        const actualValue = DynamicRule.calculateMetric(cond.metric, pose, {
          baseTorsoHeight: this.baseTorsoHeight,
          initialHeelTilt: this.initialHeelTilt,
          initialLeftHeelTilt: this.initialLeftHeelTilt,
          initialRightHeelTilt: this.initialRightHeelTilt,
          initialHipX: this.initialHipX,
          previousPose: this.previousPose,
          previousHipY: this.previousHipY,
          lastTimeMs: this.lastTimeMs,
          timeMs: timeMs
        });
        const targetValue = cond.value !== undefined ? cond.value : cond.threshold;
        if (!this.evaluateCondition(actualValue, cond.operator, targetValue)) {
          allMet = false;
          break;
        }
      }

      if (allMet) {
        // Transition to next phase
        this.currentPhaseIndex++;
        
        // If we exceeded the phases array, the rep is finished
        if (this.currentPhaseIndex >= phases.length) {
          isMovementFinished = true;
          isRepCompleted = this.failedChecksThisRep.size === 0;
          this.currentPhaseIndex = 0; // Reset for next rep
          newPhase = MovementPhase.START_POSITION;
          this.isRepCalibrated = false; // Reset calibration for next rep
          this.consecutiveFailures.clear(); // Reset failure counters for next rep
          
          if (!isRepCompleted) {
            newAttempt = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              status: 'failed',
              reason: Array.from(this.failedChecksThisRep).join(', '),
              qualityScore: 50
            };
          } else {
            newAttempt = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              status: 'success',
              reason: 'Perfect form!',
              qualityScore: 100
            };
          }
        } else {
          // Just update the visual state phase
          const nextPhaseName = phases[this.currentPhaseIndex].name?.toUpperCase() || '';
          if (nextPhaseName.includes('SETUP')) newPhase = MovementPhase.START_POSITION;
          else if (nextPhaseName.includes('DESCEND') || nextPhaseName.includes('FIRST MOVEMENT')) newPhase = MovementPhase.DESCENDING;
          else if (nextPhaseName.includes('BOTTOM') || nextPhaseName.includes('HOLD') || nextPhaseName.includes('PAUSE')) newPhase = MovementPhase.BOTTOM_POSITION;
          else if (nextPhaseName.includes('ASCEND') || nextPhaseName.includes('RETURN MOVEMENT')) newPhase = MovementPhase.ASCENDING;
          else {
            // Smart fallback based on phase index to ensure the engine detects a state change
            if (this.currentPhaseIndex === 0) newPhase = MovementPhase.DESCENDING;
            else if (this.currentPhaseIndex === phases.length - 1) newPhase = MovementPhase.ASCENDING;
            else if (this.currentPhaseIndex === 1 && phases.length === 3) newPhase = MovementPhase.BOTTOM_POSITION;
            else newPhase = (state.currentPhase === MovementPhase.LOWERING) ? MovementPhase.ASCENDING : MovementPhase.LOWERING;
          }
        }
      }
    }

    // Capture Temporal state for the next frame calculation
    this.previousPose = pose;
    if (timeMs) this.lastTimeMs = timeMs;
    const lHipNext = pose[POSE_LANDMARKS.LEFT_HIP];
    const rHipNext = pose[POSE_LANDMARKS.RIGHT_HIP];
    if (lHipNext && rHipNext) {
      this.previousHipY = (lHipNext.y + rHipNext.y) / 2;
    }

    return {
      newPhase,
      feedback,
      isRepCompleted,
      isMovementFinished,
      qualityScore: this.failedChecksThisRep.size === 0 ? 100 : 50,
      angles,
      newAttempt
    };
  }
}
