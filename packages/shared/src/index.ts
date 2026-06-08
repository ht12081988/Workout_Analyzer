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
