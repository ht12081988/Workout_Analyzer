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
  
  // State for phase transition stability & dwell
  private consecutiveTransitionFrames: number = 0;
  private currentPhaseDwellFrames: number = 0;

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
      case 'LEFT_HIP_HINGE_ANGLE': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        if (lShoulder && lHip && lKnee) return calculateAngle(lShoulder, lHip, lKnee);
        return 0;
      }
      case 'RIGHT_HIP_HINGE_ANGLE': {
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        if (rShoulder && rHip && rKnee) return calculateAngle(rShoulder, rHip, rKnee);
        return 0;
      }
      case 'HIP_HINGE_ANGLE': {
        // Preserves 100% exact calculation for all existing exercises (Left side),
        // with fallback to Right side if left landmarks are occluded.
        const lHinge = DynamicRule.calculateMetric('LEFT_HIP_HINGE_ANGLE', pose, state);
        if (lHinge > 0) return lHinge;
        return DynamicRule.calculateMetric('RIGHT_HIP_HINGE_ANGLE', pose, state);
      }
      case 'LEFT_HIP_ABDUCTION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        if (lHip && lKnee) {
          if (rHip) {
            // Pelvis vector from Right Hip to Left Hip (points outward along the left lateral axis)
            const px = lHip.x - rHip.x;
            const py = lHip.y - rHip.y;
            const pz = (lHip.z || 0) - (rHip.z || 0);
            const pLen = Math.sqrt(px * px + py * py + pz * pz);
            if (pLen > 0.001) {
              const ux = px / pLen;
              const uy = py / pLen;
              const uz = pz / pLen;

              // Femur vector from Left Hip to Left Knee
              const fx = lKnee.x - lHip.x;
              const fy = lKnee.y - lHip.y;
              const fz = (lKnee.z || 0) - (lHip.z || 0);
              const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz);
              if (fLen > 0.001) {
                // Outward projection along lateral pelvis axis
                const vLat = fx * ux + fy * uy + fz * uz;
                // Sagittal component (forward/backward and vertical in-plane movement)
                const vSag = Math.sqrt(Math.max(0, fLen * fLen - vLat * vLat));
                return Math.round(Math.atan2(Math.max(0, vLat), vSag) * (180 / Math.PI));
              }
            }
          }
          // Fallback if rHip is missing
          const vy = Math.max(0, lKnee.y - lHip.y);
          const vz = Math.abs((lKnee.z || 0) - (lHip.z || 0));
          const denom = Math.sqrt(vy * vy + vz * vz);
          if (denom > 0.001) {
            const angleRad = Math.acos(Math.min(1, Math.max(0, vy / denom)));
            return Math.round(angleRad * (180 / Math.PI));
          }
        }
        return 0;
      }
      case 'RIGHT_HIP_ABDUCTION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        if (rHip && rKnee) {
          if (lHip) {
            // Pelvis vector from Left Hip to Right Hip (points outward along the right lateral axis)
            const px = rHip.x - lHip.x;
            const py = rHip.y - lHip.y;
            const pz = (rHip.z || 0) - (lHip.z || 0);
            const pLen = Math.sqrt(px * px + py * py + pz * pz);
            if (pLen > 0.001) {
              const ux = px / pLen;
              const uy = py / pLen;
              const uz = pz / pLen;

              // Femur vector from Right Hip to Right Knee
              const fx = rKnee.x - rHip.x;
              const fy = rKnee.y - rHip.y;
              const fz = (rKnee.z || 0) - (lHip.z || 0);
              const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz);
              if (fLen > 0.001) {
                // Outward projection along lateral pelvis axis
                const vLat = fx * ux + fy * uy + fz * uz;
                const vSag = Math.sqrt(Math.max(0, fLen * fLen - vLat * vLat));
                return Math.round(Math.atan2(Math.max(0, vLat), vSag) * (180 / Math.PI));
              }
            }
          }
          // Fallback if lHip is missing
          const vy = Math.max(0, rKnee.y - rHip.y);
          const vz = Math.abs((rKnee.z || 0) - (rHip.z || 0));
          const denom = Math.sqrt(vy * vy + vz * vz);
          if (denom > 0.001) {
            const angleRad = Math.acos(Math.min(1, Math.max(0, vy / denom)));
            return Math.round(angleRad * (180 / Math.PI));
          }
        }
        return 0;
      }
      case 'HIP_ABDUCTION_ANGLE': {
        const lAb = DynamicRule.calculateMetric('LEFT_HIP_ABDUCTION', pose, state);
        const rAb = DynamicRule.calculateMetric('RIGHT_HIP_ABDUCTION', pose, state);
        return Math.max(lAb, rAb);
      }
      case 'LEFT_KNEE_OUTSIDE_HAND_RATIO': {
        const lWrist = pose[POSE_LANDMARKS.LEFT_WRIST] || pose[POSE_LANDMARKS.LEFT_ELBOW] || pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];

        if (lWrist && lKnee && lHip) {
          // Normalize by athlete's torso length (shoulder to hip)
          let torsoLen = 0.35;
          if (lShoulder && lHip) {
            const dx = lHip.x - lShoulder.x;
            const dy = lHip.y - lShoulder.y;
            const dz = (lHip.z || 0) - (lShoulder.z || 0);
            torsoLen = Math.max(0.15, Math.sqrt(dx * dx + dy * dy + dz * dz));
          } else if (state?.baseTorsoHeight) {
            torsoLen = state.baseTorsoHeight;
          }

          if (rHip) {
            // Pelvis vector from Right Hip to Left Hip (points leftward / outward for left side)
            const px = lHip.x - rHip.x;
            const py = lHip.y - rHip.y;
            const pz = (lHip.z || 0) - (rHip.z || 0);
            const pLen = Math.sqrt(px * px + py * py + pz * pz);
            if (pLen > 0.001) {
              const ux = px / pLen;
              const uy = py / pLen;
              const uz = pz / pLen;

              // Vector from planted wrist to active knee
              const vx = lKnee.x - lWrist.x;
              const vy = lKnee.y - lWrist.y;
              const vz = (lKnee.z || 0) - (lWrist.z || 0);

              // Lateral displacement outward
              const latDisp = vx * ux + vy * uy + vz * uz;
              return Math.round((latDisp / torsoLen) * 100) / 100;
            }
          }

          // Fallback if rHip is missing
          const latDisp = Math.abs(lKnee.x - lWrist.x);
          return Math.round((latDisp / torsoLen) * 100) / 100;
        }
        return 0;
      }
      case 'RIGHT_KNEE_OUTSIDE_HAND_RATIO': {
        const rWrist = pose[POSE_LANDMARKS.RIGHT_WRIST] || pose[POSE_LANDMARKS.RIGHT_ELBOW] || pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];

        if (rWrist && rKnee && rHip) {
          let torsoLen = 0.35;
          if (rShoulder && rHip) {
            const dx = rHip.x - rShoulder.x;
            const dy = rHip.y - rShoulder.y;
            const dz = (rHip.z || 0) - (rShoulder.z || 0);
            torsoLen = Math.max(0.15, Math.sqrt(dx * dx + dy * dy + dz * dz));
          } else if (state?.baseTorsoHeight) {
            torsoLen = state.baseTorsoHeight;
          }

          if (lHip) {
            // Pelvis vector from Left Hip to Right Hip (points rightward / outward for right side)
            const px = rHip.x - lHip.x;
            const py = rHip.y - lHip.y;
            const pz = (rHip.z || 0) - (lHip.z || 0);
            const pLen = Math.sqrt(px * px + py * py + pz * pz);
            if (pLen > 0.001) {
              const ux = px / pLen;
              const uy = py / pLen;
              const uz = pz / pLen;

              const vx = rKnee.x - rWrist.x;
              const vy = rKnee.y - rWrist.y;
              const vz = (rKnee.z || 0) - (rWrist.z || 0);

              const latDisp = vx * ux + vy * uy + vz * uz;
              return Math.round((latDisp / torsoLen) * 100) / 100;
            }
          }

          const latDisp = Math.abs(rKnee.x - rWrist.x);
          return Math.round((latDisp / torsoLen) * 100) / 100;
        }
        return 0;
      }
      case 'KNEE_OUTSIDE_HAND_RATIO': {
        const lVal = DynamicRule.calculateMetric('LEFT_KNEE_OUTSIDE_HAND_RATIO', pose, state);
        const rVal = DynamicRule.calculateMetric('RIGHT_KNEE_OUTSIDE_HAND_RATIO', pose, state);
        return Math.max(lVal, rVal);
      }
      case 'LEFT_HIP_INTERNAL_ROTATION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const lAnkle = pose[POSE_LANDMARKS.LEFT_ANKLE];
        if (lHip && rHip && lKnee && lAnkle) {
          const px = lHip.x - rHip.x, py = lHip.y - rHip.y, pz = (lHip.z || 0) - (rHip.z || 0);
          const pLen = Math.sqrt(px * px + py * py + pz * pz);
          if (pLen > 0.001) {
            const ux = px / pLen, uy = py / pLen, uz = pz / pLen;
            const tx = lAnkle.x - lKnee.x, ty = lAnkle.y - lKnee.y, tz = (lAnkle.z || 0) - (lKnee.z || 0);
            const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tLen > 0.001) {
              const vLat = tx * ux + ty * uy + tz * uz;
              if (vLat > 0) return Math.round(Math.asin(Math.min(1, vLat / tLen)) * (180 / Math.PI));
            }
          }
        }
        return 0;
      }
      case 'RIGHT_HIP_INTERNAL_ROTATION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        const rAnkle = pose[POSE_LANDMARKS.RIGHT_ANKLE];
        if (lHip && rHip && rKnee && rAnkle) {
          const px = rHip.x - lHip.x, py = rHip.y - lHip.y, pz = (rHip.z || 0) - (lHip.z || 0);
          const pLen = Math.sqrt(px * px + py * py + pz * pz);
          if (pLen > 0.001) {
            const ux = px / pLen, uy = py / pLen, uz = pz / pLen;
            const tx = rAnkle.x - rKnee.x, ty = rAnkle.y - rKnee.y, tz = (rAnkle.z || 0) - (rKnee.z || 0);
            const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tLen > 0.001) {
              const vLat = tx * ux + ty * uy + tz * uz;
              if (vLat > 0) return Math.round(Math.asin(Math.min(1, vLat / tLen)) * (180 / Math.PI));
            }
          }
        }
        return 0;
      }
      case 'HIP_INTERNAL_ROTATION': {
        const lIr = DynamicRule.calculateMetric('LEFT_HIP_INTERNAL_ROTATION', pose, state);
        const rIr = DynamicRule.calculateMetric('RIGHT_HIP_INTERNAL_ROTATION', pose, state);
        return Math.max(lIr, rIr);
      }
      case 'LEFT_HIP_EXTERNAL_ROTATION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const lKnee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const lAnkle = pose[POSE_LANDMARKS.LEFT_ANKLE];
        if (lHip && rHip && lKnee && lAnkle) {
          const px = lHip.x - rHip.x, py = lHip.y - rHip.y, pz = (lHip.z || 0) - (rHip.z || 0);
          const pLen = Math.sqrt(px * px + py * py + pz * pz);
          if (pLen > 0.001) {
            const ux = px / pLen, uy = py / pLen, uz = pz / pLen;
            const tx = lAnkle.x - lKnee.x, ty = lAnkle.y - lKnee.y, tz = (lAnkle.z || 0) - (lKnee.z || 0);
            const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tLen > 0.001) {
              const vLat = tx * ux + ty * uy + tz * uz;
              if (vLat < 0) return Math.round(Math.asin(Math.min(1, Math.abs(vLat) / tLen)) * (180 / Math.PI));
            }
          }
        }
        return 0;
      }
      case 'RIGHT_HIP_EXTERNAL_ROTATION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rKnee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        const rAnkle = pose[POSE_LANDMARKS.RIGHT_ANKLE];
        if (lHip && rHip && rKnee && rAnkle) {
          const px = rHip.x - lHip.x, py = rHip.y - lHip.y, pz = (rHip.z || 0) - (lHip.z || 0);
          const pLen = Math.sqrt(px * px + py * py + pz * pz);
          if (pLen > 0.001) {
            const ux = px / pLen, uy = py / pLen, uz = pz / pLen;
            const tx = rAnkle.x - rKnee.x, ty = rAnkle.y - rKnee.y, tz = (rAnkle.z || 0) - (rKnee.z || 0);
            const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (tLen > 0.001) {
              const vLat = tx * ux + ty * uy + tz * uz;
              if (vLat < 0) return Math.round(Math.asin(Math.min(1, Math.abs(vLat) / tLen)) * (180 / Math.PI));
            }
          }
        }
        return 0;
      }
      case 'HIP_EXTERNAL_ROTATION': {
        const lEr = DynamicRule.calculateMetric('LEFT_HIP_EXTERNAL_ROTATION', pose, state);
        const rEr = DynamicRule.calculateMetric('RIGHT_HIP_EXTERNAL_ROTATION', pose, state);
        return Math.max(lEr, rEr);
      }
      case 'THORACOLUMBAR_ROTATION': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        if (lShoulder && rShoulder && lHip && rHip) {
          const sYaw = Math.atan2((lShoulder.z || 0) - (rShoulder.z || 0), lShoulder.x - rShoulder.x);
          const hYaw = Math.atan2((lHip.z || 0) - (rHip.z || 0), lHip.x - rHip.x);
          let diff = Math.abs(sYaw - hYaw) * (180 / Math.PI);
          if (diff > 180) diff = 360 - diff;
          return Math.round(diff);
        }
        return 0;
      }
      case 'SPINE_LATERAL_FLEXION': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        if (lShoulder && rShoulder && lHip && rHip) {
          const midSx = (lShoulder.x + rShoulder.x) / 2;
          const midSy = (lShoulder.y + rShoulder.y) / 2;
          const midHx = (lHip.x + rHip.x) / 2;
          const midHy = (lHip.y + rHip.y) / 2;
          const dx = midSx - midHx;
          const dy = midHy - midSy; // Inverted because Y increases downwards
          const tiltDeg = Math.abs(Math.atan2(dx, dy) * (180 / Math.PI));
          return Math.round(tiltDeg);
        }
        return 0;
      }
      case 'SCAPULAR_ELEVATION_RATIO': {
        const lEar = pose[POSE_LANDMARKS.LEFT_EAR];
        const rEar = pose[POSE_LANDMARKS.RIGHT_EAR];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (lEar && rEar && lShoulder && rShoulder) {
          const earY = (lEar.y + rEar.y) / 2;
          const shoulderY = (lShoulder.y + rShoulder.y) / 2;
          const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
          const drop = shoulderY - earY;
          if (shoulderWidth > 0.05) {
            // When shrugging, ear-shoulder vertical gap shrinks
            const ratio = drop / (shoulderWidth * 0.45);
            return Math.round(ratio * 100) / 100;
          }
        }
        return 1.0;
      }
      case 'LEFT_ANKLE_DORSIFLEXION': {
        const knee = pose[POSE_LANDMARKS.LEFT_KNEE];
        const ankle = pose[POSE_LANDMARKS.LEFT_ANKLE];
        const heel = pose[POSE_LANDMARKS.LEFT_HEEL];
        const foot = pose[POSE_LANDMARKS.LEFT_FOOT_INDEX];
        if (knee && ankle && (heel || foot)) {
          // Angle of tibia forward tilt past 90 degrees vertical
          const dx = Math.abs(knee.x - ankle.x);
          const dy = Math.max(0.01, ankle.y - knee.y);
          const tibiaAngle = Math.atan2(dx, dy) * (180 / Math.PI);
          return Math.round(tibiaAngle);
        }
        return 0;
      }
      case 'RIGHT_ANKLE_DORSIFLEXION': {
        const knee = pose[POSE_LANDMARKS.RIGHT_KNEE];
        const ankle = pose[POSE_LANDMARKS.RIGHT_ANKLE];
        const heel = pose[POSE_LANDMARKS.RIGHT_HEEL];
        const foot = pose[POSE_LANDMARKS.RIGHT_FOOT_INDEX];
        if (knee && ankle && (heel || foot)) {
          const dx = Math.abs(knee.x - ankle.x);
          const dy = Math.max(0.01, ankle.y - knee.y);
          const tibiaAngle = Math.atan2(dx, dy) * (180 / Math.PI);
          return Math.round(tibiaAngle);
        }
        return 0;
      }
      case 'ANKLE_DORSIFLEXION_ANGLE': {
        const lDf = DynamicRule.calculateMetric('LEFT_ANKLE_DORSIFLEXION', pose, state);
        const rDf = DynamicRule.calculateMetric('RIGHT_ANKLE_DORSIFLEXION', pose, state);
        return Math.max(lDf, rDf);
      }
      case 'PELVIC_DROP_ANGLE': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        if (lHip && rHip) {
          const dx = Math.abs(lHip.x - rHip.x);
          const dy = Math.abs(lHip.y - rHip.y);
          if (dx > 0.01) {
            return Math.round(Math.atan2(dy, dx) * (180 / Math.PI));
          }
        }
        return 0;
      }
      case 'LEFT_SHOULDER_ABDUCTION': {
        const lHip = pose[POSE_LANDMARKS.LEFT_HIP];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lElbow = pose['LEFT_ELBOW'];
        if (lHip && lShoulder && lElbow) return calculateAngle(lHip, lShoulder, lElbow);
        return 0;
      }
      case 'RIGHT_SHOULDER_ABDUCTION': {
        const rHip = pose[POSE_LANDMARKS.RIGHT_HIP];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rElbow = pose['RIGHT_ELBOW'];
        if (rHip && rShoulder && rElbow) return calculateAngle(rHip, rShoulder, rElbow);
        return 0;
      }
      case 'SHOULDER_ABDUCTION_ANGLE': {
        const lAb = DynamicRule.calculateMetric('LEFT_SHOULDER_ABDUCTION', pose, state);
        const rAb = DynamicRule.calculateMetric('RIGHT_SHOULDER_ABDUCTION', pose, state);
        return Math.max(lAb, rAb);
      }
      case 'LEFT_SHOULDER_EXTERNAL_ROTATION': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lElbow = pose['LEFT_ELBOW'];
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        if (lShoulder && lElbow && lWrist) {
          const dy = lElbow.y - lWrist.y;
          const dx = Math.abs(lWrist.x - lElbow.x);
          return Math.round(Math.atan2(Math.max(0, dy), dx) * (180 / Math.PI));
        }
        return 0;
      }
      case 'RIGHT_SHOULDER_EXTERNAL_ROTATION': {
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rElbow = pose['RIGHT_ELBOW'];
        const rWrist = pose['RIGHT_WRIST'] || pose['RIGHT_INDEX'];
        if (rShoulder && rElbow && rWrist) {
          const dy = rElbow.y - rWrist.y;
          const dx = Math.abs(rWrist.x - rElbow.x);
          return Math.round(Math.atan2(Math.max(0, dy), dx) * (180 / Math.PI));
        }
        return 0;
      }
      case 'SHOULDER_EXTERNAL_ROTATION': {
        const lEr = DynamicRule.calculateMetric('LEFT_SHOULDER_EXTERNAL_ROTATION', pose, state);
        const rEr = DynamicRule.calculateMetric('RIGHT_SHOULDER_EXTERNAL_ROTATION', pose, state);
        return Math.max(lEr, rEr);
      }
      case 'LEFT_SHOULDER_INTERNAL_ROTATION': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const lElbow = pose['LEFT_ELBOW'];
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        if (lShoulder && lElbow && lWrist) {
          const dy = lWrist.y - lElbow.y;
          const dx = Math.abs(lWrist.x - lElbow.x);
          return Math.round(Math.atan2(Math.max(0, dy), dx) * (180 / Math.PI));
        }
        return 0;
      }
      case 'RIGHT_SHOULDER_INTERNAL_ROTATION': {
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        const rElbow = pose['RIGHT_ELBOW'];
        const rWrist = pose['RIGHT_WRIST'] || pose['RIGHT_INDEX'];
        if (rShoulder && rElbow && rWrist) {
          const dy = rWrist.y - rElbow.y;
          const dx = Math.abs(rWrist.x - rElbow.x);
          return Math.round(Math.atan2(Math.max(0, dy), dx) * (180 / Math.PI));
        }
        return 0;
      }
      case 'SHOULDER_INTERNAL_ROTATION': {
        const lIr = DynamicRule.calculateMetric('LEFT_SHOULDER_INTERNAL_ROTATION', pose, state);
        const rIr = DynamicRule.calculateMetric('RIGHT_SHOULDER_INTERNAL_ROTATION', pose, state);
        return Math.max(lIr, rIr);
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
      case 'SHOULDER_ROTATION_LEFT':
      case 'SHOULDER_ROTATION_RIGHT': {
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (lShoulder && rShoulder && state.baseTorsoHeight) {
          const currentWidth = Math.abs(lShoulder.x - rShoulder.x);
          const maxExpectedWidth = state.baseTorsoHeight * 0.9;
          const ratio = Math.min(1.0, currentWidth / maxExpectedWidth);
          const angleDeg = Math.round(Math.acos(ratio) * (180 / Math.PI));

          // 3D depth difference determines leftward vs rightward direction
          const zDiff = (lShoulder.z || 0) - (rShoulder.z || 0);
          const isRotatingLeft = zDiff > 0.015;
          const isRotatingRight = zDiff < -0.015;

          if (metricName === 'SHOULDER_ROTATION_LEFT') {
            return isRotatingLeft ? angleDeg : 0;
          } else {
            return isRotatingRight ? angleDeg : 0;
          }
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
      case 'RIGHT_PALM_ROTATION_ANGLE': {
        const rPinky = pose['RIGHT_PINKY'];
        const rThumb = pose['RIGHT_THUMB'];
        if (rPinky && rThumb) {
          const dx = rThumb.x - rPinky.x;
          const dy = rThumb.y - rPinky.y;
          let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angleDeg < 0) angleDeg += 360;
          if (angleDeg > 180) angleDeg = 360 - angleDeg; // Fold to clean 0-180 range
          return Math.round(angleDeg);
        }
        return 0;
      }
      case 'LEFT_PALM_ROTATION_ANGLE': {
        const lPinky = pose['LEFT_PINKY'];
        const lThumb = pose['LEFT_THUMB'];
        if (lPinky && lThumb) {
          const dx = lPinky.x - lThumb.x;
          const dy = lPinky.y - lThumb.y;
          let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
          if (angleDeg < 0) angleDeg += 360;
          if (angleDeg > 180) angleDeg = 360 - angleDeg; // Fold to clean 0-180 range
          return Math.round(angleDeg);
        }
        return 0;
      }
      case 'RIGHT_PALM_FACING_DIRECTION': {
        const rIndex = pose['RIGHT_INDEX'];
        const rPinky = pose['RIGHT_PINKY'];
        if (rIndex && rPinky) {
          const dx = rPinky.x - rIndex.x;
          const dy = rPinky.y - rIndex.y;
          const handSpan = Math.sqrt(dx * dx + dy * dy);
          if (handSpan > 0.005) {
            // +1.0 = Palm Facing Camera, 0.0 = Sideways, -1.0 = Palm Facing Away
            const ratio = dx / handSpan;
            return Math.round(Math.max(-1, Math.min(1, ratio)) * 10) / 10;
          }
        }
        return 0;
      }
      case 'LEFT_PALM_FACING_DIRECTION': {
        const lIndex = pose['LEFT_INDEX'];
        const lPinky = pose['LEFT_PINKY'];
        if (lIndex && lPinky) {
          const dx = lIndex.x - lPinky.x;
          const dy = lIndex.y - lPinky.y;
          const handSpan = Math.sqrt(dx * dx + dy * dy);
          if (handSpan > 0.005) {
            // +1.0 = Palm Facing Camera, 0.0 = Sideways, -1.0 = Palm Facing Away
            const ratio = dx / handSpan;
            return Math.round(Math.max(-1, Math.min(1, ratio)) * 10) / 10;
          }
        }
        return 0;
      }
      case 'RIGHT_WRIST_CHEST_CROSSING': {
        const rWrist = pose['RIGHT_WRIST'] || pose['RIGHT_INDEX'];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (rWrist && lShoulder && rShoulder) {
          const shoulderWidth = Math.abs(rShoulder.x - lShoulder.x);
          if (shoulderWidth > 0.01) {
            const chestMidX = (lShoulder.x + rShoulder.x) / 2;
            const distFromMidline = Math.abs(rWrist.x - chestMidX);
            // 100% when hand is at chest midline, 50% at shoulder edge, 0% when outside body
            const score = (1.0 - (distFromMidline / shoulderWidth)) * 100;
            return Math.round(Math.max(0, Math.min(100, score)));
          }
        }
        return 0;
      }
      case 'LEFT_WRIST_CHEST_CROSSING': {
        const lWrist = pose['LEFT_WRIST'] || pose['LEFT_INDEX'];
        const lShoulder = pose[POSE_LANDMARKS.LEFT_SHOULDER];
        const rShoulder = pose[POSE_LANDMARKS.RIGHT_SHOULDER];
        if (lWrist && lShoulder && rShoulder) {
          const shoulderWidth = Math.abs(rShoulder.x - lShoulder.x);
          if (shoulderWidth > 0.01) {
            const chestMidX = (lShoulder.x + rShoulder.x) / 2;
            const distFromMidline = Math.abs(lWrist.x - chestMidX);
            const score = (1.0 - (distFromMidline / shoulderWidth)) * 100;
            return Math.round(Math.max(0, Math.min(100, score)));
          }
        }
        return 0;
      }
      case 'WRIST_CHEST_CROSSING': {
        const lScore = DynamicRule.calculateMetric('LEFT_WRIST_CHEST_CROSSING', pose, state);
        const rScore = DynamicRule.calculateMetric('RIGHT_WRIST_CHEST_CROSSING', pose, state);
        return Math.max(lScore, rScore);
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
    currentPhaseIndex?: number;
    phaseName?: string;
    totalPhases?: number;
    progressPct?: number;
    pendingEntryCue?: string;
    pendingPhaseCompletion?: { phaseIndex: number; phaseName: string };
  } {
    let newPhase = state.currentPhase;
    const feedback: string[] = [];
    let isRepCompleted = false;
    let isMovementFinished = false;
    let newAttempt: AttemptLogEntry | undefined;
    let pendingEntryCue: string | undefined;
    let pendingPhaseCompletion: { phaseIndex: number; phaseName: string } | undefined;

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

    this.currentPhaseDwellFrames++;

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
        this.consecutiveTransitionFrames++;
        // Debounce: Conditions must be held for at least 2 consecutive frames (~66ms)
        // and at least 3 frames (~100ms) spent in current phase to prevent accidental rapid skipping
        const canAdvance = this.consecutiveTransitionFrames >= 2 && this.currentPhaseDwellFrames >= 3;

        if (canAdvance) {
          this.consecutiveTransitionFrames = 0;
          this.currentPhaseDwellFrames = 0;
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
            const nextPhaseConfig = phases[this.currentPhaseIndex];
            const nextPhaseName = nextPhaseConfig?.name?.toUpperCase() || '';
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

            // Emit entry cue if configured and enabled for the new phase
            if (nextPhaseConfig?.entryCueEnabled && nextPhaseConfig?.entryCue) {
              pendingEntryCue = nextPhaseConfig.entryCue;
            }

            // Emit phase completion so the track page can log partial progress
            const completedPhaseIndex = this.currentPhaseIndex - 1;
            pendingPhaseCompletion = {
              phaseIndex: completedPhaseIndex,
              phaseName: phases[completedPhaseIndex]?.name || `Phase ${completedPhaseIndex + 1}`
            };
          }
        }
      } else {
        this.consecutiveTransitionFrames = 0;
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

    const totalPhases = phases.length;
    let progressPct = 0;
    if (isRepCompleted || isMovementFinished) {
      progressPct = 100;
    } else if (totalPhases > 0) {
      const isSetup = phases[0]?.isSetupPhase;
      if (isSetup) {
        if (this.currentPhaseIndex === 0) {
          progressPct = 0;
        } else {
          progressPct = Math.min(99, Math.max(5, Math.round((this.currentPhaseIndex / totalPhases) * 100)));
        }
      } else {
        progressPct = Math.min(99, Math.max(0, Math.round(((this.currentPhaseIndex + 0.5) / totalPhases) * 100)));
      }
    }

    return {
      newPhase,
      feedback,
      isRepCompleted,
      isMovementFinished,
      qualityScore: this.failedChecksThisRep.size === 0 ? 100 : 50,
      angles,
      newAttempt,
      currentPhaseIndex: this.currentPhaseIndex,
      phaseName: currentPhaseConfig?.name,
      totalPhases,
      progressPct,
      pendingEntryCue,
      pendingPhaseCompletion
    };
  }
}
