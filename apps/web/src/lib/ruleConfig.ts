  export interface ParamConfig {
  min: number;
  max: number;
  step: number;
  direction: 'asc' | 'desc'; // asc: Green -> Red (Higher is Harder). desc: Red -> Green (Lower is Harder).
  description?: string;
  imageUrl?: string;
}

export const RULE_SECTION_DESCRIPTIONS: Record<string, string> = {
  SQUAT_DEPTH: "Monitors the depth of the squat to ensure the athlete achieves full range of motion without cheating the rep.",
  POSTURE_STABILITY: "Monitors torso lean and knee alignment (valgus) to prevent lower back strain and joint shear forces.",
  STANCE_CONFIG: "Verifies the athlete maintains the correct foot width and turnout angle for the exercise setup.",
  TEMPO_STILLNESS: "Enforces a static hold to eliminate momentum and ensure the repetition begins under perfect body control.",
  LUNGE_DEPTH: "Monitors the depth of the lunge to ensure maximum muscle activation and mobility.",
  STANCE_SETUP: "Measures stride distance to confirm even weight distribution between both legs.",
  ENGINE_STABILITY: "Fine-tunes the sensitivity and strictness of the AI motion tracking engine.",
  HEEL_TILT: "Measures heel elevation height to enforce full calf muscle contraction and physical body lift.",
  KNEE_STABILITY: "Checks that knees remain fully extended to prevent using leg-spring momentum to lift the body.",
  SYMMETRY: "Measures left/right differential to ensure the athlete lifts symmetrically without favoring a dominant leg.",
  BODY_SWAY: "Enforces vertical balance, preventing the athlete from rocking forward, backward, or swaying sideways."
};

export const RULE_PARAM_CONFIG: Record<string, ParamConfig> = {
  // Angle / Depth
  target_angle: { min: 45, max: 160, step: 1, direction: 'desc', description: "The maximum angle the knee must bend to register a successful repetition.", imageUrl: "/guides/squat_depth.png" },
  stand_up_tolerance: { min: 140, max: 180, step: 1, direction: 'asc', description: "The knee angle required to be considered fully returned to the standing position.", imageUrl: "/guides/stand_up.png" },
  min_movement: { min: 90, max: 160, step: 1, direction: 'desc', description: "The minimum range of motion required before a movement is counted as an attempt.", imageUrl: "/guides/squat_depth.png" },
  partial_drop: { min: 5, max: 45, step: 1, direction: 'desc', description: "The amount of upward wobble allowed during the descent before a rep is aborted.", imageUrl: "/guides/partial_drop.png" },
  start_trigger: { min: 120, max: 180, step: 1, direction: 'asc', description: "The angle at which the AI begins tracking a downward descent.", imageUrl: "/guides/stand_up.png" },
  bottom_exit_tolerance: { min: 0, max: 30, step: 1, direction: 'desc', description: "The angle tolerance for exiting the bottom of the movement.", imageUrl: "/guides/squat_depth.png" },
  
  // Posture / Lean
  max_lean: { min: 0, max: 60, step: 1, direction: 'desc', description: "The maximum forward torso lean allowed. Lower values force an upright posture.", imageUrl: "/guides/torso_lean.png" },
  max_torso_lean: { min: 0, max: 60, step: 1, direction: 'desc', description: "The maximum forward torso lean allowed during a lunge.", imageUrl: "/guides/torso_lean.png" },
  min_torso_ratio: { min: 0.1, max: 1.0, step: 0.05, direction: 'asc', description: "Minimum active-to-standing torso length. Restricts folding over at the hips.", imageUrl: "/guides/torso_lean.png" },
  knee_over_toe_buffer: { min: -0.3, max: 1.0, step: 0.05, direction: 'desc', description: "Tolerance for the knee passing the toe line. Negative values force knees strictly behind toes.", imageUrl: "/guides/knee_buffer.png" },
  knee_toe_tolerance: { min: -0.3, max: 1.0, step: 0.05, direction: 'desc', description: "Tolerance for front knee advancing past the toe in lunges.", imageUrl: "/guides/knee_buffer.png" },
  valgus_threshold: { min: 0.01, max: 0.3, step: 0.01, direction: 'desc', description: "Limits horizontal knee inward cave-in. Lower values heavily penalize wobbly knees.", imageUrl: "/guides/valgus.png" },
  max_head_forward: { min: 0.0, max: 0.5, step: 0.01, direction: 'desc', description: "Forward neck drift limit. Punishes looking down at the floor.", imageUrl: "/guides/neck_drift.png" },
  gaze_sensitivity: { min: 0.0, max: 0.1, step: 0.01, direction: 'desc', description: "Check to ensure the athlete's eyes remain looking straight ahead.", imageUrl: "/guides/neck_drift.png" },
  
  // Stance / Distance
  min_ratio: { min: 0.4, max: 2.0, step: 0.05, direction: 'asc', description: "Minimum heel distance relative to shoulder width. Forces a wider stance.", imageUrl: "/guides/stance_width.png" },
  max_ratio: { min: 0.5, max: 2.5, step: 0.05, direction: 'desc', description: "Maximum allowed stance width. Forces a narrower, stricter setup footprint.", imageUrl: "/guides/stance_width.png" },
  min_step_ratio: { min: 0.8, max: 2.5, step: 0.05, direction: 'asc', description: "Minimum stride distance for a lunge. Forces a longer step.", imageUrl: "/guides/lunge_stride.png" },
  feet_together_threshold: { min: 0.1, max: 0.5, step: 0.01, direction: 'desc', description: "Distance threshold below which feet are considered closed together.", imageUrl: "/guides/feet_together.png" },
  min_foot_angle: { min: 0, max: 90, step: 1, direction: 'asc', description: "Minimum outwards turnout of the feet at setup.", imageUrl: "/guides/foot_turnout.png" },
  max_foot_angle: { min: 0, max: 90, step: 1, direction: 'desc', description: "Maximum outwards turnout limit. Prevents excessively duck-footed stances.", imageUrl: "/guides/foot_turnout.png" },
  
  // Tempo / Stillness
  still_required: { min: 0, max: 30, step: 1, direction: 'asc', description: "Consecutive frames the athlete must hold perfectly still before starting.", imageUrl: "/guides/stillness_tempo.png" },
  movement_threshold: { min: 0.001, max: 0.1, step: 0.001, direction: 'desc', description: "Maximum allowable speed to be classed as 'still'. Lower values require robotic stillness.", imageUrl: "/guides/stillness_tempo.png" },
  smoothing_factor: { min: 0.1, max: 1.0, step: 0.05, direction: 'desc', description: "Signal filtering weight multiplier for sensor tracking.", imageUrl: "/guides/stillness_tempo.png" },
  stillness_smoothing: { min: 0.01, max: 0.5, step: 0.01, direction: 'desc', description: "Smoothing applied specifically to stillness checks.", imageUrl: "/guides/stillness_tempo.png" },
  log_reset: { min: 0, max: 30, step: 1, direction: 'asc', description: "Frame window required to reset the tracking logic.", imageUrl: "/guides/stillness_tempo.png" },
  lock_reset: { min: 0, max: 30, step: 1, direction: 'asc', description: "Frame window required to reset the calibration lock.", imageUrl: "/guides/stillness_tempo.png" },
  
  // Calf Raises
  min_angle: { min: 130, max: 180, step: 1, direction: 'asc', description: "Minimum angle indicating straight knees. Higher values prohibit any knee bending.", imageUrl: "/guides/stand_up.png" },
  flex_allowance: { min: 0, max: 40, step: 1, direction: 'desc', description: "Margin allowed for knee bend before the repetition is penalized.", imageUrl: "/guides/stand_up.png" },
  top: { min: 2.0, max: 15.0, step: 0.5, direction: 'asc', description: "The minimum extension tilt angle required to count as a full contraction peak.", imageUrl: "/guides/calf_heel_tilt.png" },
  start: { min: 0.5, max: 5.0, step: 0.5, direction: 'asc', description: "The initial tilt angle change that triggers a raise attempt.", imageUrl: "/guides/calf_heel_tilt.png" },
  max_safety: { min: 10, max: 40, step: 1, direction: 'asc', description: "Extreme tilt safety threshold to abort if the sensor drifts excessively.", imageUrl: "/guides/calf_heel_tilt.png" },
  end_tolerance: { min: 0, max: 10, step: 0.5, direction: 'desc', description: "Angle threshold to declare the heel has returned fully to the floor.", imageUrl: "/guides/calf_heel_tilt.png" },
  min_body_lift: { min: 0.001, max: 0.02, step: 0.001, direction: 'asc', description: "Confirms physical shoulder upward movement, eliminating ankle-rolling tricks.", imageUrl: "/guides/calf_body_lift.png" },
  baseline_tolerance: { min: 0, max: 10, step: 0.5, direction: 'desc', description: "Allowed drift in the starting baseline ankle angle.", imageUrl: "/guides/calf_heel_tilt.png" },
  mid_diff: { min: 5, max: 60, step: 1, direction: 'desc', description: "Maximum difference allowed between left and right heels at the peak of the raise.", imageUrl: "/guides/calf_heel_tilt.png" },
  start_diff: { min: 5, max: 60, step: 1, direction: 'desc', description: "Maximum difference allowed between heels at the start of the raise.", imageUrl: "/guides/calf_heel_tilt.png" },
  move_max: { min: 1, max: 15, step: 0.5, direction: 'desc', description: "Maximum lateral body sway allowed during the movement.", imageUrl: "/guides/calf_sway.png" },
  start_max: { min: 1, max: 10, step: 0.5, direction: 'desc', description: "Maximum lateral body sway allowed during the starting setup.", imageUrl: "/guides/calf_sway.png" },
  
  // Fallback default
  default: { min: 0, max: 100, step: 1, direction: 'asc', description: "Configuration parameter threshold value." }
};

export function getParamConfig(key: string): ParamConfig {
  return RULE_PARAM_CONFIG[key] || RULE_PARAM_CONFIG['default'];
}
