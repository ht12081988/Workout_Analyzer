'use client';

export interface VoiceConfigData {
  config: {
    min_interval_ms: number;
    phrase_cooldown_ms: number;
    reinforcement_probability: number;
    speech_rate: number;
    speech_pitch: number;
    positive_reinforcements: string[];
  };
  cues: {
    global: Record<string, string>;
    exercises: Record<string, Record<string, string>>;
  };
  display_cues?: {
    global: Record<string, string>;
    exercises: Record<string, Record<string, string>>;
  };
  cue_types?: {
    global: Record<string, string>;
    exercises: Record<string, Record<string, string>>;
  };
  failure_guidance: Record<string, string>;
}

export interface SpeechManagerConfig {
  customSpeakFn?: (text: string, rate: number, pitch: number) => void;
  customStopFn?: () => void;
}

export class SpeechManager {
  private isEnabled: boolean = true;
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private minIntervalMs: number = 2200; // Minimum time between consecutive spoken correction cues
  private phraseCooldownMs: number = 4000; // Cooldown before repeating the exact same phrase
  private reinforcementProbability: number = 0.70; // Cooldown probability for post-rep praises
  private speechRate: number = 1.05; // Slightly faster to feel like a real trainer
  private speechPitch: number = 1.00; // Pitch level for TTS

  private phraseHistory: Record<string, number> = {}; // Tracks last spoken time for specific phrases
  private currentRepIndex: number = -1;
  private repSpokenCues: Set<string> = new Set();
  
  private activeExerciseId: string | null = null;

  // Custom spoken cues to translate rigid developer feedback into natural coaching voice guidance
  private static readonly DEFAULT_CUES: Record<string, string> = {
    // 1. Pile Squat & Standard Squat Setup / Calibration
    'Widen your stance': 'Widen your stance.',
    'Turn toes outward': 'Turn your toes outward.',
    'Toes out too far': 'Bring toes in slightly.',
    'Ready! Go down': 'Ready! Now, squat down.',
    'Ready! Squat down': 'Ready! Now, squat down.',
    'Feet too wide': 'Bring your feet slightly closer.',
    'Hold still to calibrate': '',
    'Searching for body...': '',

    // 2. Squat Live Corrections
    'Keep chest up!': 'Keep your chest up.',
    'Knees beyond toes!': 'Bring knees back behind your toes.',
    'Push knees out': '',
    'Push through heels': '',
    'Knees out!': 'Push your knees outward.',
    'Push knees out!': 'Push your knees outward.',

    // 3. Squat Bottom Depths & Transitions
    'Great depth! Now up': 'Perfect depth! Drive back up.',
    'Going down...': '',
    'Sitting back...': '',
    'Drive through heels': '',

    // 4. Standing Calf Raise Cues
    'Searching for feet...': '',
    'Wiggle feet closer': 'Bring your feet slightly closer.',
    'Stand tall & squeeze': 'Stand tall and squeeze your calves.',
    'Ready! Rise up': 'Ready! Lift up.',
    'Going up! Squeeze': 'Up and squeeze.',
    'Squeeze calves at peak!': 'Hold and squeeze at the peak!',
    'Heels flat to floor': 'Bring your heels flat to the floor.',
    'Heels down...': 'Lower your heels.',
    'Keep knees straight!': 'Keep your knees straight.',
    'Excessive sway! Stand still': 'Control your balance, stand still.',
    'Asymmetric Lift': 'Lift both heels evenly.',
    'Knees Bent': 'Keep your knees straight.',
    "Don't sway sideways": 'Control your balance and stand still.',
    'Excessive Sway': 'Control your balance and stand still.',

    // 5. Split Lunge Cues (Split Squat)
    'Searching for body profile...': '',
    'Stand sideways and hold still': '',
    'Step one leg forward to begin': 'Step one leg forward to begin.',
    'Take a wider step for stability': 'Take a wider step for stability.',
    'Hold stance...': '',
    'Stay still in your split stance': '',
    'Stance Locked! Lower your hips': 'Stance locked. Now, lower your hips.',
    'Sitting into the lunge...': '',
    'Front knee beyond toe!': 'Bring your front knee back behind your toes.',
    'Keep chest upright!': 'Keep your chest upright.',
    'Keep your head back': 'Keep your head back.',
    'Look straight ahead': 'Look straight ahead.',
    'Great depth! Now push up': 'Perfect depth! Drive back up.',
    'Driving back up...': '',
    "Don't lean forward!": 'Keep your torso upright.'
  };

  // Positive reinforcement list to keep workouts high-energy
  private static readonly DEFAULT_POSITIVE_REINFORCEMENTS = [
    'Perfect form!',
    'Excellent depth!',
    'Great repp!',
    'Spot on!',
    'Nice job!',
    'Keep it up!',
    'Amazing control!'
  ];

  private globalCues: Record<string, string> = { ...SpeechManager.DEFAULT_CUES };
  private exerciseSpecificCues: Record<string, Record<string, string>> = {};
  private globalDisplayCues: Record<string, string> = {};
  private exerciseSpecificDisplayCues: Record<string, Record<string, string>> = {};
  private globalCueTypes: Record<string, string> = {};
  private exerciseSpecificCueTypes: Record<string, Record<string, string>> = {};
  private positiveReinforcements: string[] = [ ...SpeechManager.DEFAULT_POSITIVE_REINFORCEMENTS ];
  private failureGuidance: Record<string, string> = {
    'deep': 'Try to go deeper on your next repp.',
    'lean': 'Remember to keep your chest up.',
    'toes': 'Try to keep your knees behind your toes.',
    'sway': 'Try to stand completely still.'
  };

  private customSpeakFn?: (text: string, rate: number, pitch: number) => void;
  private customStopFn?: () => void;

  constructor(config?: SpeechManagerConfig) {
    if (config) {
      this.customSpeakFn = config.customSpeakFn;
      this.customStopFn = config.customStopFn;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('visionfit.voice_guidance_enabled');
        this.isEnabled = saved !== 'false';
      } catch (e) {
        this.isEnabled = true;
      }
    } else {
      this.isEnabled = true;
    }
  }

  /**
   * Initializes the manager with dynamic settings loaded from the backend API.
   * If there is an issue or some keys are missing, it falls back to hardcoded defaults.
   */
  public initializeConfig(data: VoiceConfigData, currentExerciseId?: string) {
    if (!data) return;

    try {
      if (data.config) {
        this.minIntervalMs = Number(data.config.min_interval_ms) || this.minIntervalMs;
        this.phraseCooldownMs = Number(data.config.phrase_cooldown_ms) || this.phraseCooldownMs;
        this.reinforcementProbability = data.config.reinforcement_probability !== undefined 
          ? Number(data.config.reinforcement_probability) 
          : this.reinforcementProbability;
        this.speechRate = Number(data.config.speech_rate) || this.speechRate;
        this.speechPitch = Number(data.config.speech_pitch) || this.speechPitch;
        if (Array.isArray(data.config.positive_reinforcements) && data.config.positive_reinforcements.length > 0) {
          this.positiveReinforcements = data.config.positive_reinforcements;
        }
      }

      if (data.cues) {
        if (data.cues.global) {
          this.globalCues = { ...SpeechManager.DEFAULT_CUES, ...data.cues.global };
        }
        if (data.cues.exercises) {
          // Normalize all exercise-specific cue IDs to lowercase to prevent UUID casing mismatches
          const normalizedExercises: Record<string, Record<string, string>> = {};
          for (const [exId, cueMap] of Object.entries(data.cues.exercises)) {
            normalizedExercises[exId.toLowerCase()] = cueMap;
          }
          this.exerciseSpecificCues = normalizedExercises;
          console.log('[SpeechManager] Loaded exercise cues for IDs:', Object.keys(this.exerciseSpecificCues));
        }
      }

      if (data.display_cues) {
        if (data.display_cues.global) {
          this.globalDisplayCues = { ...data.display_cues.global };
        }
        if (data.display_cues.exercises) {
          const normalizedDisplayCues: Record<string, Record<string, string>> = {};
          for (const [exId, cueMap] of Object.entries(data.display_cues.exercises)) {
            normalizedDisplayCues[exId.toLowerCase()] = cueMap;
          }
          this.exerciseSpecificDisplayCues = normalizedDisplayCues;
        }
      }

      if (data.cue_types) {
        if (data.cue_types.global) {
          this.globalCueTypes = { ...data.cue_types.global };
        }
        if (data.cue_types.exercises) {
          const normalizedCueTypes: Record<string, Record<string, string>> = {};
          for (const [exId, cueMap] of Object.entries(data.cue_types.exercises)) {
            normalizedCueTypes[exId.toLowerCase()] = cueMap;
          }
          this.exerciseSpecificCueTypes = normalizedCueTypes;
        }
      }

      if (data.failure_guidance) {
        this.failureGuidance = { ...this.failureGuidance, ...data.failure_guidance };
      }

      console.log('[SpeechManager] Successfully initialized with backend configurations.');
    } catch (e) {
      console.warn('[SpeechManager] Failed parsing backend configurations, using standard defaults.', e);
    }

    if (currentExerciseId) {
      this.activeExerciseId = currentExerciseId.toLowerCase();
      console.log('[SpeechManager] Active Exercise ID set to (lowercase):', this.activeExerciseId);
    }
  }

  public setActiveExercise(exerciseId: string) {
    this.activeExerciseId = exerciseId.toLowerCase();
    console.log('[SpeechManager] Active Exercise ID updated to (lowercase):', this.activeExerciseId);
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('visionfit.voice_guidance_enabled', String(enabled));
    }
    if (!enabled) {
      this.stop();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Resolves the user-friendly cue string based on raw developer codes.
   */
  private getSpokenCue(rawText: string): string | null {
    const searchId = this.activeExerciseId?.toLowerCase();
    
    // 1. Check exercise-specific cues first (normalized keys)
    if (searchId && this.exerciseSpecificCues[searchId]) {
      const exerciseCue = this.exerciseSpecificCues[searchId][rawText];
      if (exerciseCue !== undefined) {
        console.log(`[SpeechManager] Cue Lookup: "${rawText}" -> "${exerciseCue}" (Database Exercise-Specific Override)`);
        return exerciseCue;
      }
    }

    // 2. Fallback to global cues mapping
    const globalCue = this.globalCues[rawText];
    if (globalCue !== undefined) {
      console.log(`[SpeechManager] Cue Lookup: "${rawText}" -> "${globalCue}" (Global Mapping / Hardcoded Default)`);
      return globalCue;
    }

    // 3. Fallback to raw text
    console.log(`[SpeechManager] Cue Lookup: "${rawText}" -> "${rawText}" (Raw Text Fallback)`);
    return rawText;
  }

  /**
   * Resolves the display text based on the raw cue text.
   */
  public getDisplayCue(rawText: string): string {
    const searchId = this.activeExerciseId?.toLowerCase();
    
    if (searchId && this.exerciseSpecificDisplayCues[searchId]) {
      const exerciseCue = this.exerciseSpecificDisplayCues[searchId][rawText];
      if (exerciseCue !== undefined) return exerciseCue;
    }

    const globalCue = this.globalDisplayCues[rawText];
    if (globalCue !== undefined) return globalCue;

    return rawText;
  }

  /**
   * Resolves the cue type (info/warning) based on the raw cue text.
   */
  public getCueType(rawText: string): string {
    const searchId = this.activeExerciseId?.toLowerCase();
    
    if (searchId && this.exerciseSpecificCueTypes[searchId]) {
      const exerciseCue = this.exerciseSpecificCueTypes[searchId][rawText];
      if (exerciseCue !== undefined) return exerciseCue;
    }

    const globalCue = this.globalCueTypes[rawText];
    if (globalCue !== undefined) return globalCue;

    return 'info';
  }

  /**
   * Speaks the text via Web Speech API speechSynthesis.
   * @param rawText The feedback string or message to speak.
   * @param force Set to true to instantly interrupt ongoing speech and bypass overall cooldowns (e.g. for rep count updates)
   * @param repIndex Pass the current repCount to enforce once-per-rep feedback restrictions.
   */
  public speak(rawText: string, force: boolean = false, repIndex: number = -1) {
    if (!this.isEnabled) return;
    if (!this.customSpeakFn && (typeof window === 'undefined' || !window.speechSynthesis)) return;

    // Get translated coach speak if available, otherwise use original text
    const textToSpeak = this.getSpokenCue(rawText);
    if (!textToSpeak) return; // Muted if mapped to empty string

    const now = Date.now();

    // Enforce once-per-rep restriction
    if (repIndex !== -1) {
      if (repIndex !== this.currentRepIndex) {
        this.currentRepIndex = repIndex;
        this.repSpokenCues.clear();
      }

      if (this.repSpokenCues.has(textToSpeak)) {
        return;
      }
    }

    // Throttling logic to avoid overlapping or machine gun speech
    if (!force) {
      // 1. Minimum cooldown between ANY consecutive spoken correction phrases
      if (now - this.lastSpokenTime < this.minIntervalMs) {
        return;
      }

      // 2. Phrase-specific debouncer (don't repeat the exact same correction within phraseCooldownMs)
      const lastPhraseSpoken = this.phraseHistory[textToSpeak] || 0;
      if (now - lastPhraseSpoken < this.phraseCooldownMs) {
        return;
      }
    }

    try {
      // Stop current speech instantly to give clean real-time feedback
      if (this.customStopFn) {
        this.customStopFn();
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      if (this.customSpeakFn) {
        this.customSpeakFn(textToSpeak, this.speechRate, this.speechPitch);
      } else if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = this.speechRate;
        utterance.pitch = this.speechPitch;

        // Select high quality English voice if available
        const voices = window.speechSynthesis.getVoices();
        const idealVoice = 
          voices.find(v => v.lang.startsWith('en-') && v.name.toLowerCase().includes('google')) ||
          voices.find(v => v.lang.startsWith('en-') && v.name.toLowerCase().includes('natural')) ||
          voices.find(v => v.lang.startsWith('en-'));
        
        if (idealVoice) {
          utterance.voice = idealVoice;
        }

        window.speechSynthesis.speak(utterance);
      }

      // Record logs
      this.lastSpokenText = textToSpeak;
      this.lastSpokenTime = now;
      this.phraseHistory[textToSpeak] = now;

      // Record once-per-rep mapping
      if (repIndex !== -1) {
        this.repSpokenCues.add(textToSpeak);
      }
    } catch (e) {
      console.error('SpeechManager error:', e);
    }
  }

  public speakRepCount(count: number, qualityScore: number = 100) {
    let message = `${count}.`;
    // Decoupled from qualityScore. Play encouragement reinforcementProbability of the time.
    if (Math.random() < this.reinforcementProbability && this.positiveReinforcements.length > 0) {
      const index = Math.floor(Math.random() * this.positiveReinforcements.length);
      message += ` ${this.positiveReinforcements[index]}`;
    } else {
      message += ` Nice repp.`;
    }
    this.speak(message, true);
  }

  /**
   * Speaks failure details to help coach the user.
   */
  public speakFailure(reason: string) {
    // Check if it has multiple reasons joined by '&', split them
    const reasons = reason.split('&').map(r => r.trim());
    const primaryReason = reasons[0].toLowerCase();
    
    // Map failures to polite guidance using dynamic keywords mapping
    let advice = 'Focus on form.';
    for (const [keyword, spokenAdvice] of Object.entries(this.failureGuidance)) {
      if (primaryReason.includes(keyword)) {
        advice = spokenAdvice;
        break;
      }
    }

    this.speak(`No repp. ${advice}`, true);
  }

  public stop() {
    if (this.customStopFn) {
      this.customStopFn();
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
