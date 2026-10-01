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
