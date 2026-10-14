import { PoseData } from './types';

export interface MetricPrediction {
  metric: string;
  prevValue: number;
  currentValue: number;
  delta: number;
  operator: '<' | '>';
  targetValue: number;
  buffer: number;
  movementType: 'flexion' | 'extension' | 'neutral';
  explanation: string;
  isSignificantChange: boolean;
}

export interface ExtractionStateContext {
  timeMs: number;
  baseTorsoHeight: number;
  initialHipY?: number;
  groundBaselineY?: number;
  peakJumpHeightThisRep?: number;
  flightTimeMs?: number;
}

/**
 * Automatically extracts standing calibration anchors (initialHipY, baseTorsoHeight, groundBaselineY)
 * from video telemetry so that displacement metrics (e.g. VERTICAL_JUMP_HEIGHT, JUMP_FLIGHT_TIME)
 * compute accurate physiological measurements during admin extraction instead of returning 0.
 */
export function buildExtractionContext(
  telemetry: Array<{ frameIndex: number; timeMs: number; pose: PoseData }>,
  currentTimeMs: number,
  setupPose?: PoseData | null
): ExtractionStateContext {
  // 1. Find the best baseline pose (standing setup)
  let baselinePose: PoseData | null = setupPose || null;

  if (!baselinePose && telemetry && telemetry.length > 0) {
    // Scan the first 20 frames for the first frame where both shoulders and hips are detected
    for (let i = 0; i < Math.min(20, telemetry.length); i++) {
      const p = telemetry[i].pose;
      const lS = p['LEFT_SHOULDER'] || (p as any)[11];
      const rS = p['RIGHT_SHOULDER'] || (p as any)[12];
      const lH = p['LEFT_HIP'] || (p as any)[23];
      const rH = p['RIGHT_HIP'] || (p as any)[24];
      if ((lS || rS) && (lH || rH)) {
        baselinePose = p;
        break;
      }
    }
    if (!baselinePose) {
      baselinePose = telemetry[0].pose;
    }
  }

  let baseTorsoHeight = 0.5;
  let initialHipY: number | undefined = undefined;
  let groundBaselineY: number | undefined = undefined;

  if (baselinePose) {
    const lShoulder = baselinePose['LEFT_SHOULDER'] || (baselinePose as any)[11];
    const rShoulder = baselinePose['RIGHT_SHOULDER'] || (baselinePose as any)[12];
    const lHip = baselinePose['LEFT_HIP'] || (baselinePose as any)[23];
    const rHip = baselinePose['RIGHT_HIP'] || (baselinePose as any)[24];

    let shoulderY: number | undefined;
    if (lShoulder && rShoulder) shoulderY = (lShoulder.y + rShoulder.y) / 2;
    else if (lShoulder) shoulderY = lShoulder.y;
    else if (rShoulder) shoulderY = rShoulder.y;

    let hipY: number | undefined;
    if (lHip && rHip) hipY = (lHip.y + rHip.y) / 2;
    else if (lHip) hipY = lHip.y;
    else if (rHip) hipY = rHip.y;

    if (shoulderY !== undefined && hipY !== undefined) {
      const torso = Math.abs(hipY - shoulderY);
      if (torso > 0.05) {
        baseTorsoHeight = torso;
        initialHipY = hipY;
      }
    }

    const lHeel = baselinePose['LEFT_HEEL'] || (baselinePose as any)[29];
    const rHeel = baselinePose['RIGHT_HEEL'] || (baselinePose as any)[30];
    const lFoot = baselinePose['LEFT_FOOT_INDEX'] || (baselinePose as any)[31];
    const rFoot = baselinePose['RIGHT_FOOT_INDEX'] || (baselinePose as any)[32];
    const groundCandidates: number[] = [];
    if (lHeel) groundCandidates.push(lHeel.y);
    if (rHeel) groundCandidates.push(rHeel.y);
    if (lFoot) groundCandidates.push(lFoot.y);
    if (rFoot) groundCandidates.push(rFoot.y);
    if (groundCandidates.length > 0) {
      groundBaselineY = Math.max(...groundCandidates);
    }
  }

  // 2. Compute dynamic peak jump height and flight time up to currentTimeMs
  let peakJumpHeightThisRep = 0;
  let flightTimeMs = 0;
  let isAirborne = false;
  let takeoffTimestampMs = 0;

  if (telemetry && telemetry.length > 0 && initialHipY !== undefined && baseTorsoHeight > 0.05) {
    const cmPerPixel = 52.0 / baseTorsoHeight;

    for (const frame of telemetry) {
      if (frame.timeMs > currentTimeMs) break;

      const fLHip = frame.pose['LEFT_HIP'] || (frame.pose as any)[23];
      const fRHip = frame.pose['RIGHT_HIP'] || (frame.pose as any)[24];
      if (fLHip || fRHip) {
        const curHipY = (fLHip && fRHip) ? (fLHip.y + fRHip.y) / 2 : (fLHip ? fLHip.y : fRHip!.y);
        const liveJump = Math.max(0, (initialHipY - curHipY) * cmPerPixel);
        if (liveJump > peakJumpHeightThisRep) {
          peakJumpHeightThisRep = liveJump;
        }
      }

      if (groundBaselineY !== undefined) {
        const fLHeel = frame.pose['LEFT_HEEL'] || (frame.pose as any)[29];
        const fRHeel = frame.pose['RIGHT_HEEL'] || (frame.pose as any)[30];
        const fLFoot = frame.pose['LEFT_FOOT_INDEX'] || (frame.pose as any)[31];
        const fRFoot = frame.pose['RIGHT_FOOT_INDEX'] || (frame.pose as any)[32];
        const feetY: number[] = [];
        if (fLHeel) feetY.push(fLHeel.y);
        if (fRHeel) feetY.push(fRHeel.y);
        if (fLFoot) feetY.push(fLFoot.y);
        if (fRFoot) feetY.push(fRFoot.y);

        if (feetY.length > 0) {
          const lowestFootY = Math.max(...feetY);
          const isOffGround = lowestFootY < (groundBaselineY - 0.035);
          if (isOffGround) {
            if (!isAirborne) {
              isAirborne = true;
              takeoffTimestampMs = frame.timeMs;
            } else {
              const currentFlight = frame.timeMs - takeoffTimestampMs;
              if (currentFlight > flightTimeMs) {
                flightTimeMs = currentFlight;
              }
            }
          } else {
            if (isAirborne) {
              flightTimeMs = Math.max(flightTimeMs, frame.timeMs - takeoffTimestampMs);
              isAirborne = false;
            }
          }
        }
      }
    }
  }

  return {
    timeMs: currentTimeMs,
    baseTorsoHeight,
    initialHipY,
    groundBaselineY,
    peakJumpHeightThisRep: Math.round(peakJumpHeightThisRep * 10) / 10,
    flightTimeMs: Math.round(flightTimeMs)
  };
}

/**
 * Automatically predicts the mathematically correct operator (< or >)
 * and applies a biomechanical tolerance buffer based on movement direction.
 */
export function predictMetricOperatorAndBuffer(
  metric: string,
  prevValue: number,
  currentValue: number
): MetricPrediction {
  const delta = currentValue - prevValue;
  const isRatio = metric.toUpperCase().includes('RATIO') || metric.toUpperCase().includes('FACTOR');

  if (isRatio) {
    const isSignificantChange = Math.abs(delta) >= 0.05;
    if (delta < -0.04) {
      const buffer = 0.06;
      const targetValue = Math.max(0, Number((currentValue + buffer).toFixed(2)));
      return {
        metric,
        prevValue: Number(prevValue.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        operator: '<',
        targetValue,
        buffer,
        movementType: 'flexion',
        explanation: `Ratio decreased by ${Math.abs(delta).toFixed(2)} (operator '<' with +${buffer} buffer)`,
        isSignificantChange
      };
    } else if (delta > 0.04) {
      const buffer = 0.06;
      const targetValue = Math.max(0, Number((currentValue - buffer).toFixed(2)));
      return {
        metric,
        prevValue: Number(prevValue.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        operator: '>',
        targetValue,
        buffer,
        movementType: 'extension',
        explanation: `Ratio increased by +${delta.toFixed(2)} (operator '>' with -${buffer} buffer)`,
        isSignificantChange
      };
    } else {
      return {
        metric,
        prevValue: Number(prevValue.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        operator: '<',
        targetValue: Number(currentValue.toFixed(2)),
        buffer: 0,
        movementType: 'neutral',
        explanation: `Stationary ratio (minor change of ${delta.toFixed(2)})`,
        isSignificantChange: false
      };
    }
  }

  // Vertical Jump Height (Centimeters)
  if (metric === 'VERTICAL_JUMP_HEIGHT' || metric.toUpperCase().includes('JUMP_HEIGHT')) {
    const isSignificantChange = Math.abs(delta) >= 4.0 || currentValue >= 10.0;
    if (delta > 3.0 || currentValue >= 15.0) {
      // Athlete propelled upward into air: require reaching target height
      const buffer = 5.0; // 5 cm buffer tolerance
      const targetValue = Math.max(0, Number((currentValue - buffer).toFixed(1)));
      return {
        metric,
        prevValue: Number(prevValue.toFixed(1)),
        currentValue: Number(currentValue.toFixed(1)),
        delta: Number(delta.toFixed(1)),
        operator: '>',
        targetValue,
        buffer,
        movementType: 'extension',
        explanation: `Jump height reached ${currentValue.toFixed(1)} cm (operator '>' with -${buffer} cm buffer)`,
        isSignificantChange: true
      };
    } else if (delta < -3.0) {
      // Landing downward
      const buffer = 5.0;
      const targetValue = Math.max(5.0, Number((currentValue + buffer).toFixed(1)));
      return {
        metric,
        prevValue: Number(prevValue.toFixed(1)),
        currentValue: Number(currentValue.toFixed(1)),
        delta: Number(delta.toFixed(1)),
        operator: '<',
        targetValue,
        buffer,
        movementType: 'flexion',
        explanation: `Jump height descended to ${currentValue.toFixed(1)} cm (operator '<' with target ${targetValue} cm)`,
        isSignificantChange
      };
    } else {
      const isAirborne = currentValue >= 10.0;
      const operator = isAirborne ? '>' : '<';
      const targetValue = isAirborne 
        ? Math.max(0, Number((currentValue - 3.0).toFixed(1))) 
        : Math.max(5.0, Number((currentValue + 3.0).toFixed(1)));
      return {
        metric,
        prevValue: Number(prevValue.toFixed(1)),
        currentValue: Number(currentValue.toFixed(1)),
        delta: Number(delta.toFixed(1)),
        operator,
        targetValue,
        buffer: isAirborne ? 3.0 : 0,
        movementType: 'neutral',
        explanation: isAirborne 
          ? `Airborne apex at ${currentValue.toFixed(1)} cm (operator '>' with -3 cm buffer)`
          : `Ground level height (operator '<' with ${targetValue} cm ground tolerance)`,
        isSignificantChange: isAirborne
      };
    }
  }

  // Jump Flight Time (Milliseconds)
  if (metric === 'JUMP_FLIGHT_TIME' || metric.toUpperCase().includes('FLIGHT_TIME')) {
    if (delta > 50 || currentValue >= 100) {
      const buffer = 50; // 50 ms tolerance buffer
      const targetValue = Math.max(0, Math.round(currentValue - buffer));
      return {
        metric,
        prevValue: Math.round(prevValue),
        currentValue: Math.round(currentValue),
        delta: Math.round(delta),
        operator: '>',
        targetValue,
        buffer,
        movementType: 'extension',
        explanation: `Flight time reached ${Math.round(currentValue)} ms (operator '>' with -${buffer} ms buffer)`,
        isSignificantChange: true
      };
    }
  }

  // Joint Angles (Degrees)
  const isSignificantChange = Math.abs(delta) >= 7.0;

  if (delta < -5.0) {
    // Angle decreased: Joint is flexing / bending downwards
    const buffer = 12.0;
    const targetValue = Number((currentValue + buffer).toFixed(1));
    return {
      metric,
      prevValue: Number(prevValue.toFixed(1)),
      currentValue: Number(currentValue.toFixed(1)),
      delta: Number(delta.toFixed(1)),
      operator: '<',
      targetValue,
      buffer,
      movementType: 'flexion',
      explanation: `Decreased from ${prevValue.toFixed(1)}° to ${currentValue.toFixed(1)}° (Flexion: operator '<' with +${buffer}° buffer)`,
      isSignificantChange
    };
  } else if (delta > 5.0) {
    // Angle increased: Joint is extending / standing back up
    const buffer = 10.0;
    const targetValue = Number((currentValue - buffer).toFixed(1));
    return {
      metric,
      prevValue: Number(prevValue.toFixed(1)),
      currentValue: Number(currentValue.toFixed(1)),
      delta: Number(delta.toFixed(1)),
      operator: '>',
      targetValue,
      buffer,
      movementType: 'extension',
      explanation: `Increased from ${prevValue.toFixed(1)}° to ${currentValue.toFixed(1)}° (Extension: operator '>' with -${buffer}° buffer)`,
      isSignificantChange
    };
  } else {
    // Stationary / Isometric joint
    return {
      metric,
      prevValue: Number(prevValue.toFixed(1)),
      currentValue: Number(currentValue.toFixed(1)),
      delta: Number(delta.toFixed(1)),
      operator: '<',
      targetValue: Number(currentValue.toFixed(1)),
      buffer: 0,
      movementType: 'neutral',
      explanation: `Stationary joint (angle moved by only ${Math.abs(delta).toFixed(1)}°)`,
      isSignificantChange: false
    };
  }
}

