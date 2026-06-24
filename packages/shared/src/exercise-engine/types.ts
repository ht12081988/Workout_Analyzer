export enum MovementPhase {
  START_POSITION = 'START_POSITION',
  HEEL_RAISE = 'HEEL_RAISE',
  TOP_POSITION = 'TOP_POSITION',
  LOWERING = 'LOWERING',
  DESCENDING = 'DESCENDING',
  BOTTOM_POSITION = 'BOTTOM_POSITION',
  ASCENDING = 'ASCENDING',
  REP_COMPLETED = 'REP_COMPLETED',
  INITIALIZING = 'INITIALIZING'
}

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseData {
  [key: string]: Landmark;
}

export interface ExerciseRule {
  id: string;
  name: string;
  type: 'angle' | 'distance' | 'visibility' | 'speed';
  threshold: number | Record<string, number>;
  feedback: string;
  severity: 'warning' | 'error' | 'info';
}

export interface RepStats {
  repNumber: number;
  startTime: string; // ISO string
  topTime?: string; // ISO string
  endTime: string; // ISO string
  qualityScore: number;
  durationSeconds: number;
  status: 'valid' | 'failed' | 'invalid';
  deviations: Array<{
    type: string;
    message: string;
    severity: string;
    frameNumber: number;
  }>;
  startFrameLandmarks: PoseData;
  descendingFrame1Landmarks?: PoseData;
  descendingFrame2Landmarks?: PoseData;
  topFrameLandmarks?: PoseData;
  ascendingFrame1Landmarks?: PoseData;
  ascendingFrame2Landmarks?: PoseData;
  endFrameLandmarks: PoseData;
  
  startFrameAngles: Record<string, number>;
  descendingFrame1Angles?: Record<string, number>;
  descendingFrame2Angles?: Record<string, number>;
  topFrameAngles?: Record<string, number>;
  ascendingFrame1Angles?: Record<string, number>;
  ascendingFrame2Angles?: Record<string, number>;
  endFrameAngles: Record<string, number>;

  _descendingFramesBuffer?: Array<{pose: PoseData, angles: Record<string, number>}>;
  _ascendingFramesBuffer?: Array<{pose: PoseData, angles: Record<string, number>}>;
}

export interface AttemptLogEntry {
  id: string;
  timestamp: number;
  status: 'success' | 'failed' | 'canceled';
  reason: string;
  qualityScore?: number;
}

export interface ExerciseState {
  currentPhase: MovementPhase;
  repCount: number;
  attemptCount: number;
  feedback: string[];
  accuracyScore: number;
  lastRepQuality: number;
  isStarted: boolean;
  startTime?: number;
  attemptLog: AttemptLogEntry[];
}

export const POSE_LANDMARKS = {
  LEFT_SHOULDER: 'LEFT_SHOULDER',
  RIGHT_SHOULDER: 'RIGHT_SHOULDER',
  LEFT_HIP: 'LEFT_HIP',
  RIGHT_HIP: 'RIGHT_HIP',
  LEFT_KNEE: 'LEFT_KNEE',
  RIGHT_KNEE: 'RIGHT_KNEE',
  LEFT_ANKLE: 'LEFT_ANKLE',
  RIGHT_ANKLE: 'RIGHT_ANKLE',
  LEFT_HEEL: 'LEFT_HEEL',
  RIGHT_HEEL: 'RIGHT_HEEL',
  LEFT_FOOT_INDEX: 'LEFT_FOOT_INDEX',
  RIGHT_FOOT_INDEX: 'RIGHT_FOOT_INDEX',
  LEFT_EYE: 'LEFT_EYE',
  RIGHT_EYE: 'RIGHT_EYE',
  LEFT_EAR: 'LEFT_EAR',
  RIGHT_EAR: 'RIGHT_EAR'
};
