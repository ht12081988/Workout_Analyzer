export type ExerciseType = 'squat' | 'pushup' | 'lunge' | 'plank';

export interface RepetitionData {
  count: number;
  quality: number; // 0-100
  feedback: string[];
}

export interface WorkoutSession {
  id: string;
  userId: string;
  exerciseType: ExerciseType;
  startTime: Date;
  endTime?: Date;
  reps: RepetitionData[];
}

export * from './exercise-engine/types';
export * from './exercise-engine/angle-utils';
export * from './exercise-engine/MovementEngine';
export * from './exercise-engine/SquatRule';
export * from './exercise-engine/StandingCalfRaiseRule';
export * from './exercise-engine/SplitLungeRule';
export * from './exercise-engine/PlieSquatRule';
export * from './exercise-engine/DynamicRule';
export * from './exercise-engine/SpeechManager';
