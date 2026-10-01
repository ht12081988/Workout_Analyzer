import { MovementPhase, PoseData, ExerciseState, RepStats, AttemptLogEntry } from './types';
import { StandingCalfRaiseRule } from './StandingCalfRaiseRule';
import { PlieSquatRule } from './PlieSquatRule';
import { SquatRule } from './SquatRule';
import { SplitLungeRule } from './SplitLungeRule';
import { DynamicRule } from './DynamicRule';
import { TrajectoryRule } from './TrajectoryRule';

export interface IExerciseRule {
  validate(pose: PoseData, state: ExerciseState, timeMs?: number): {
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
    /** One-shot voice cue to fire on entering a new phase (from phase.entryCue). */
    pendingEntryCue?: string;
    /** Emitted on intermediate phase transitions so the track page can log partial progress. */
    pendingPhaseCompletion?: { phaseIndex: number; phaseName: string };
  };
  setRules(rules: any[]): void;
}

export class MovementEngine {
  private state: ExerciseState;
  private rule: IExerciseRule;
  private currentRepMetadata: Partial<RepStats> & { frameCount: number } | null = null;
  private lastMovementStats: RepStats | null = null;
  private minRepDurationSeconds: number = 0.8;
  private _lastRecordedPhaseIndex: number | undefined = undefined;

  constructor(exerciseName: string = 'Standing Calf Raise', rules?: any[]) {
    this.state = {
      currentPhase: MovementPhase.INITIALIZING,
      repCount: 0,
      attemptCount: 0,
      feedback: [],
      accuracyScore: 100,
      lastRepQuality: 0,
      isStarted: false,
      attemptLog: [],
    };

    this.rule = new StandingCalfRaiseRule(); // Default
    this.setExercise(exerciseName);

    if (rules && rules.length > 0) {
      this.setRules(rules);
    }
  }

  public setExercise(exerciseName: string) {
    console.log('Engine switching to:', exerciseName);
    const name = exerciseName.toLowerCase();
    
    if (name.includes('plie') || name.includes('pile')) {
      this.rule = new PlieSquatRule();
    } else if (name.includes('squat') && !name.includes('split')) {
      this.rule = new SquatRule();
    } else if (name.includes('lunge') || name.includes('split')) {
      this.rule = new SplitLungeRule();
    } else {
      this.rule = new StandingCalfRaiseRule();
    }
    this.state.currentPhase = MovementPhase.INITIALIZING;
  }

  public setRules(rules: any[]) {
    const hasTrajectoryProfile = rules.some(r => r.rule_name === 'TRAJECTORY_PROFILE');
    const hasDynamicProfile = rules.some(r => r.rule_name === 'DYNAMIC_PROFILE');

    if (hasTrajectoryProfile) {
      console.log('Engine switching to TrajectoryRule (DTW) profile from DB');
      this.rule = new TrajectoryRule();
    } else if (hasDynamicProfile) {
      console.log('Engine switching to DynamicRule profile from DB');
      this.rule = new DynamicRule();
    }

    this.rule.setRules(rules);
    
    // Extract movement engine specific rules
    const tempoRule = rules.find(r => r.rule_name === 'TEMPO_STILLNESS');
    if (tempoRule?.threshold_value?.min_duration_sec) {
      this.minRepDurationSeconds = tempoRule.threshold_value.min_duration_sec;
      console.log('Engine Min Duration Updated:', this.minRepDurationSeconds);
    }
  }

  public start() {
    this.state.isStarted = true;
    this.state.startTime = Date.now();
    this.state.currentPhase = MovementPhase.START_POSITION;
    this.state.phaseName = 'Start Position';
    this.state.currentPhaseIndex = 0;
    this.state.progressPct = 0;
    this.state.strictness = (this.rule as any).getStrictness ? (this.rule as any).getStrictness() : 'normal';
    this.state.repCount = 0;
    this.state.accuracyScore = 100;
    this.state.lastRepQuality = 0;
    this.state.attemptCount = 0;
    this.state.attemptLog = [];
    this.resetRepMetadata();
  }

  private resetRepMetadata(timeMs?: number) {
    this._lastRecordedPhaseIndex = undefined;
    this.currentRepMetadata = {
      repNumber: this.state.repCount + 1,
      startTime: timeMs ? new Date(timeMs).toISOString() : new Date().toISOString(),
      deviations: [],
      startFrameLandmarks: {},
      endFrameLandmarks: {},
      startFrameAngles: {},
      endFrameAngles: {},
      frameCount: 0,
      phaseFrames: [],
      _descendingFramesBuffer: [],
      _ascendingFramesBuffer: [],
      _perPhaseFrameBuffers: {}
    };
  }

  public stop() {
    this.state.isStarted = false;
    this.state.feedback = [];
    this.state.currentPhase = MovementPhase.INITIALIZING;
  }

  public processFrame(pose: PoseData, timeMs?: number): ExerciseState {
    if (!this.state.isStarted) return this.state;

    // Debugging: Log active rule once every 100 frames to avoid spam
    if (this.currentRepMetadata && this.currentRepMetadata.frameCount % 100 === 0) {
      console.log('Active Engine Rule:', this.rule.constructor.name, 'Phase:', this.state.currentPhase);
    }

    const result = this.rule.validate(pose, this.state, timeMs);
    
    // Only log failed attempts immediately from the rule (e.g. form violations).
    // Successful attempts will be verified for minimum duration before being logged.
    if (result.newAttempt && result.newAttempt.status !== 'success') {
      const now = timeMs || Date.now();
      const lastAttempt = this.state.attemptLog[0];
      const timeSinceLast = lastAttempt ? Math.abs(now - lastAttempt.timestamp) : 1001;

      if (timeSinceLast > 800) { // 800ms debounce
        this.state.attemptCount++;
        this.state.attemptLog = [result.newAttempt, ...this.state.attemptLog].slice(0, 500);
      }
    }

    if (this.currentRepMetadata) {
      this.currentRepMetadata.frameCount++;
      
      // Dynamic per-phase frame buffering & keyframe capturing
      const activePhaseIndex = result.currentPhaseIndex !== undefined ? result.currentPhaseIndex : 0;
      const activePhaseName = result.phaseName || `Phase ${activePhaseIndex + 1}`;

      if (!this.currentRepMetadata._perPhaseFrameBuffers) {
        this.currentRepMetadata._perPhaseFrameBuffers = {};
      }
      if (!this.currentRepMetadata._perPhaseFrameBuffers[activePhaseIndex]) {
        this.currentRepMetadata._perPhaseFrameBuffers[activePhaseIndex] = [];
      }
      this.currentRepMetadata._perPhaseFrameBuffers[activePhaseIndex].push({
        pose: { ...pose },
        angles: { ...result.angles }
      });

      if (!this.currentRepMetadata.phaseFrames) {
        this.currentRepMetadata.phaseFrames = [];
      }

      if (this._lastRecordedPhaseIndex === undefined || this._lastRecordedPhaseIndex !== activePhaseIndex) {
        // Record Keyframe for the newly entered phase
        this.currentRepMetadata.phaseFrames.push({
          type: `phase_${activePhaseIndex + 1}_start`,
          landmarks: { ...pose },
          angles: { ...result.angles },
          frameNumber: this.currentRepMetadata.frameCount,
          phaseIndex: activePhaseIndex + 1,
          phaseName: activePhaseName
        });

        // If transitioning from a previous phase, extract 2 intermediate frames from its buffer
        if (this._lastRecordedPhaseIndex !== undefined && this.currentRepMetadata._perPhaseFrameBuffers[this._lastRecordedPhaseIndex]) {
          const prevBuf = this.currentRepMetadata._perPhaseFrameBuffers[this._lastRecordedPhaseIndex];
          if (prevBuf.length > 0) {
            const idx1 = Math.floor(prevBuf.length * 0.33);
            const idx2 = Math.floor(prevBuf.length * 0.66);
            
            this.currentRepMetadata.phaseFrames.push({
              type: `phase_${this._lastRecordedPhaseIndex + 1}_mid1`,
              landmarks: prevBuf[idx1].pose,
              angles: prevBuf[idx1].angles,
              frameNumber: Math.max(1, this.currentRepMetadata.frameCount - Math.floor(prevBuf.length * 0.67)),
              phaseIndex: this._lastRecordedPhaseIndex + 1
            });

            this.currentRepMetadata.phaseFrames.push({
              type: `phase_${this._lastRecordedPhaseIndex + 1}_mid2`,
              landmarks: prevBuf[idx2].pose,
              angles: prevBuf[idx2].angles,
              frameNumber: Math.max(1, this.currentRepMetadata.frameCount - Math.floor(prevBuf.length * 0.33)),
              phaseIndex: this._lastRecordedPhaseIndex + 1
            });
          }
          this.currentRepMetadata._perPhaseFrameBuffers[this._lastRecordedPhaseIndex] = []; // Free memory
        }

        this._lastRecordedPhaseIndex = activePhaseIndex;
      }

      // Handle Start of Rep Detection based on Phase changes
      const isStartingRep = 
        (this.state.currentPhase === MovementPhase.START_POSITION && 
         (result.newPhase === MovementPhase.HEEL_RAISE || result.newPhase === MovementPhase.DESCENDING)) ||
        (this._lastRecordedPhaseIndex === 0 && result.currentPhaseIndex !== undefined && result.currentPhaseIndex > 0);

      if (isStartingRep) {
        this.currentRepMetadata.startTime = timeMs ? new Date(timeMs).toISOString() : new Date().toISOString();
        this.currentRepMetadata.startFrameLandmarks = { ...pose };
        this.currentRepMetadata.startFrameAngles = { ...result.angles };
      }
      if (result.newPhase === MovementPhase.DESCENDING || result.newPhase === MovementPhase.LOWERING) {
        this.currentRepMetadata._descendingFramesBuffer?.push({ pose: { ...pose }, angles: { ...result.angles } });
      } else if (result.newPhase === MovementPhase.ASCENDING) {
        this.currentRepMetadata._ascendingFramesBuffer?.push({ pose: { ...pose }, angles: { ...result.angles } });
      }
      
      if (result.newPhase !== this.state.currentPhase) {
        // Extract intermediate frames if we just finished a motion phase
        if (this.state.currentPhase === MovementPhase.DESCENDING || this.state.currentPhase === MovementPhase.LOWERING) {
          const buf = this.currentRepMetadata._descendingFramesBuffer || [];
          if (buf.length > 0) {
            const idx1 = Math.floor(buf.length * 0.33);
            const idx2 = Math.floor(buf.length * 0.66);
            this.currentRepMetadata.descendingFrame1Landmarks = buf[idx1].pose;
            this.currentRepMetadata.descendingFrame1Angles = buf[idx1].angles;
            this.currentRepMetadata.descendingFrame2Landmarks = buf[idx2].pose;
            this.currentRepMetadata.descendingFrame2Angles = buf[idx2].angles;
            this.currentRepMetadata._descendingFramesBuffer = []; // Free memory
          }
        }
        
        if (this.state.currentPhase === MovementPhase.ASCENDING) {
          const buf = this.currentRepMetadata._ascendingFramesBuffer || [];
          if (buf.length > 0) {
            const idx1 = Math.floor(buf.length * 0.33);
            const idx2 = Math.floor(buf.length * 0.66);
            this.currentRepMetadata.ascendingFrame1Landmarks = buf[idx1].pose;
            this.currentRepMetadata.ascendingFrame1Angles = buf[idx1].angles;
            this.currentRepMetadata.ascendingFrame2Landmarks = buf[idx2].pose;
            this.currentRepMetadata.ascendingFrame2Angles = buf[idx2].angles;
            this.currentRepMetadata._ascendingFramesBuffer = []; // Free memory
          }
        }

        // Handle Peak/Top Detection
        if (result.newPhase === MovementPhase.TOP_POSITION || result.newPhase === MovementPhase.BOTTOM_POSITION) {
          this.currentRepMetadata.topTime = new Date().toISOString();
          this.currentRepMetadata.topFrameLandmarks = { ...pose };
          this.currentRepMetadata.topFrameAngles = { ...result.angles };
        } else if ((result.newPhase === MovementPhase.LOWERING || result.newPhase === MovementPhase.ASCENDING) && !this.currentRepMetadata.topFrameLandmarks) {
          this.currentRepMetadata.topTime = new Date().toISOString();
          this.currentRepMetadata.topFrameLandmarks = { ...pose };
          this.currentRepMetadata.topFrameAngles = { ...result.angles };
        }
        this.state.currentPhase = result.newPhase;
      } else if (this.currentRepMetadata.topFrameLandmarks) {
        // Continuous Peak Tracking: update the peak if they go deeper/higher while still in the phase
        if (result.newPhase === MovementPhase.BOTTOM_POSITION) {
          // In squats/lunges, hips go down (Y increases). Higher Y = deeper.
          const currentHipsY = (pose['LEFT_HIP']?.y || 0) + (pose['RIGHT_HIP']?.y || 0);
          const bestHipsY = (this.currentRepMetadata.topFrameLandmarks['LEFT_HIP']?.y || 0) + (this.currentRepMetadata.topFrameLandmarks['RIGHT_HIP']?.y || 0);
          
          if (currentHipsY > bestHipsY) {
            this.currentRepMetadata.topTime = new Date().toISOString();
            this.currentRepMetadata.topFrameLandmarks = { ...pose };
            this.currentRepMetadata.topFrameAngles = { ...result.angles };
          }
        } else if (result.newPhase === MovementPhase.TOP_POSITION) {
          // In calf raises, heels go up (Y decreases). Lower Y = higher.
          const currentHeelsY = (pose['LEFT_HEEL']?.y || 0) + (pose['RIGHT_HEEL']?.y || 0);
          const bestHeelsY = (this.currentRepMetadata.topFrameLandmarks['LEFT_HEEL']?.y || 0) + (this.currentRepMetadata.topFrameLandmarks['RIGHT_HEEL']?.y || 0);
          
          if (currentHeelsY < bestHeelsY) {
            this.currentRepMetadata.topTime = new Date().toISOString();
            this.currentRepMetadata.topFrameLandmarks = { ...pose };
            this.currentRepMetadata.topFrameAngles = { ...result.angles };
          }
        }
      }

      if (result.feedback.length > 0) {
        result.feedback.forEach(msg => {
          const alreadyLogged = this.currentRepMetadata?.deviations?.some(d => d.message === msg);
          if (!alreadyLogged && this.currentRepMetadata?.deviations) {
            this.currentRepMetadata.deviations.push({
              type: 'posture',
              message: msg,
              severity: 'warning',
              frameNumber: this.currentRepMetadata.frameCount || 0
            });
          }
        });
      }
    }

    this.state.currentPhase = result.newPhase;
    this.state.feedback = result.feedback;
    this.state.phaseName = result.phaseName;
    this.state.currentPhaseIndex = result.currentPhaseIndex;
    if (result.totalPhases !== undefined) {
      this.state.totalPhases = result.totalPhases;
    }
    // Pass through any one-shot entry cue emitted by the rule on phase transition
    this.state.pendingEntryCue = result.pendingEntryCue || undefined;
    // Pass through phase completion event for partial-progress logging
    this.state.pendingPhaseCompletion = result.pendingPhaseCompletion || undefined;

    if (result.progressPct !== undefined) {
      this.state.progressPct = Math.min(100, Math.max(0, result.progressPct));
    } else if (result.angles?.['TRAJECTORY_PROGRESS'] !== undefined) {
      this.state.progressPct = Math.min(100, Math.max(0, result.angles['TRAJECTORY_PROGRESS']));
    } else if (this.state.totalPhases && this.state.totalPhases > 0 && this.state.currentPhaseIndex !== undefined) {
      this.state.progressPct = Math.min(100, Math.max(0, Math.round((this.state.currentPhaseIndex / this.state.totalPhases) * 100)));
    } else {
      switch (result.newPhase) {
        case MovementPhase.START_POSITION:
          this.state.progressPct = 0;
          break;
        case MovementPhase.DESCENDING:
        case MovementPhase.HEEL_RAISE:
          this.state.progressPct = 30;
          break;
        case MovementPhase.BOTTOM_POSITION:
        case MovementPhase.TOP_POSITION:
          this.state.progressPct = 50;
          break;
        case MovementPhase.ASCENDING:
        case MovementPhase.LOWERING:
          this.state.progressPct = 80;
          break;
        case MovementPhase.REP_COMPLETED:
          this.state.progressPct = 100;
          break;
        default:
          this.state.progressPct = 0;
      }
    }

    if (result.isMovementFinished && this.currentRepMetadata) {
      const endTime = timeMs ? new Date(timeMs).toISOString() : new Date().toISOString();
      const startTimeDate = new Date(this.currentRepMetadata.startTime!);
      const endTimeDate = new Date(endTime);
      const duration = Math.max(0.1, (endTimeDate.getTime() - startTimeDate.getTime()) / 1000);

      // Extract intermediate frames for the final active phase buffer
      if (this._lastRecordedPhaseIndex !== undefined && this.currentRepMetadata._perPhaseFrameBuffers?.[this._lastRecordedPhaseIndex]) {
        const finalBuf = this.currentRepMetadata._perPhaseFrameBuffers[this._lastRecordedPhaseIndex];
        if (finalBuf.length > 0 && this.currentRepMetadata.phaseFrames) {
          const idx1 = Math.floor(finalBuf.length * 0.33);
          const idx2 = Math.floor(finalBuf.length * 0.66);
          this.currentRepMetadata.phaseFrames.push({
            type: `phase_${this._lastRecordedPhaseIndex + 1}_mid1`,
            landmarks: finalBuf[idx1].pose,
            angles: finalBuf[idx1].angles,
            frameNumber: Math.max(1, this.currentRepMetadata.frameCount - Math.floor(finalBuf.length * 0.67)),
            phaseIndex: this._lastRecordedPhaseIndex + 1
          });
          this.currentRepMetadata.phaseFrames.push({
            type: `phase_${this._lastRecordedPhaseIndex + 1}_mid2`,
            landmarks: finalBuf[idx2].pose,
            angles: finalBuf[idx2].angles,
            frameNumber: Math.max(1, this.currentRepMetadata.frameCount - Math.floor(finalBuf.length * 0.33)),
            phaseIndex: this._lastRecordedPhaseIndex + 1
          });
        }
        if (this.currentRepMetadata.phaseFrames) {
          this.currentRepMetadata.phaseFrames.push({
            type: 'rep_end',
            landmarks: { ...pose },
            angles: { ...result.angles },
            frameNumber: this.currentRepMetadata.frameCount
          });
        }
      }

      // Extract any remaining frames from the final phase before finalizing
      if (this.state.currentPhase === MovementPhase.DESCENDING || this.state.currentPhase === MovementPhase.LOWERING) {
        const buf = this.currentRepMetadata._descendingFramesBuffer || [];
        if (buf.length > 0) {
          const idx1 = Math.floor(buf.length * 0.33);
          const idx2 = Math.floor(buf.length * 0.66);
          this.currentRepMetadata.descendingFrame1Landmarks = buf[idx1].pose;
          this.currentRepMetadata.descendingFrame1Angles = buf[idx1].angles;
          this.currentRepMetadata.descendingFrame2Landmarks = buf[idx2].pose;
          this.currentRepMetadata.descendingFrame2Angles = buf[idx2].angles;
          this.currentRepMetadata._descendingFramesBuffer = [];
        }
      } else if (this.state.currentPhase === MovementPhase.ASCENDING) {
        const buf = this.currentRepMetadata._ascendingFramesBuffer || [];
        if (buf.length > 0) {
          const idx1 = Math.floor(buf.length * 0.33);
          const idx2 = Math.floor(buf.length * 0.66);
          this.currentRepMetadata.ascendingFrame1Landmarks = buf[idx1].pose;
          this.currentRepMetadata.ascendingFrame1Angles = buf[idx1].angles;
          this.currentRepMetadata.ascendingFrame2Landmarks = buf[idx2].pose;
          this.currentRepMetadata.ascendingFrame2Angles = buf[idx2].angles;
          this.currentRepMetadata._ascendingFramesBuffer = [];
        }
      }

      // Record failure reason in deviations if rep failed
      if (!result.isRepCompleted && result.newAttempt?.reason && this.currentRepMetadata.deviations) {
        const alreadyLogged = this.currentRepMetadata.deviations.some(d => d.message === result.newAttempt!.reason);
        if (!alreadyLogged) {
          this.currentRepMetadata.deviations.unshift({
            type: 'posture',
            message: result.newAttempt.reason,
            severity: 'error',
            frameNumber: this.currentRepMetadata.frameCount || 0
          });
        }
      }

      // Prepare stats for this movement regardless of outcome
      this.lastMovementStats = {
        ...this.currentRepMetadata as RepStats,
        endTime: endTime,
        qualityScore: result.qualityScore,
        durationSeconds: duration,
        status: result.isRepCompleted ? 'valid' : 'failed',
        endFrameLandmarks: { ...pose },
        endFrameAngles: { ...result.angles }
      };

      if (result.isRepCompleted) {
        // Strict Duration Check for successful reps
        const isTrajectory = this.rule.constructor.name === 'TrajectoryRule';
        const minDuration = isTrajectory ? 0.5 : this.minRepDurationSeconds;
        if (duration < minDuration) {
          this.resetRepMetadata(timeMs);
          this.state.currentPhase = MovementPhase.START_POSITION;
          return { ...this.state };
        }

        // Add verified success attempt to attempt log
        if (result.newAttempt && result.newAttempt.status === 'success') {
          this.state.attemptCount++;
          this.state.attemptLog = [result.newAttempt, ...this.state.attemptLog].slice(0, 500);
        }

        this.state.repCount++;
        this.state.lastRepQuality = result.qualityScore || 100;
      }

      this.resetRepMetadata(timeMs);
      this.state.currentPhase = MovementPhase.START_POSITION;
    }

    this.state.accuracyScore = this.state.attemptCount > 0 
      ? (this.state.repCount / this.state.attemptCount) * 100
      : 100;

    return { ...this.state };
  }

  public getState(): ExerciseState {
    return { ...this.state };
  }

  public getLastMovementStats(): RepStats | null {
    return this.lastMovementStats;
  }

  public setStrictness(level: 'relaxed' | 'normal' | 'strict'): void {
    this.state.strictness = level;
    if ((this.rule as any).setStrictness) {
      (this.rule as any).setStrictness(level);
    }
  }

  public getStrictness(): 'relaxed' | 'normal' | 'strict' {
    return this.state.strictness || 'normal';
  }
}
