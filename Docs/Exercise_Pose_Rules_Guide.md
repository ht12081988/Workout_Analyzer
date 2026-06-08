# Exercise Pose Rules Configuration Guide

This guide provides a comprehensive breakdown of the biomechanical rules stored in the `exercise_pose_rules` table, explaining their description, functional purpose, default database settings, and specific instructions for scaling the difficulty level.

---

## 1. Standard Squats
Standard squats focus on bilateral symmetry, deep knee flexion (targeting quadriceps/glutes), and keeping a straight vertical path.

### **A. SQUAT_DEPTH**
* **Description:** Monitors the average angle of both knee joints ($\text{Hip} \rightarrow \text{Knee} \rightarrow \text{Ankle}$).
* **Purpose:** Ensures the user squats deep enough (ideally thighs parallel to the floor) to fully activate the target muscles, and returns to full standing extension to complete the rep.
* **Default Values:** 
  * `target_angle`: `122` (degrees). The minimum angle the knees must bend to. *(Note: Engine code default is `105.0`)*.
  * `start_trigger`: `165` (degrees). The knee angle below which the descending phase begins.
  * `partial_drop`: `20` (degrees). The maximum upward wobble allowed during descent before a rep is failed as a "partial rep".
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Decrease `target_angle`** (e.g., to `100` or `95` degrees): Requires the user to squat significantly deeper (below parallel).
    * **Decrease `partial_drop`** (e.g., to `10` or `12` degrees): Restricts any minor upward bobbing or pausing mid-descent, requiring a highly smooth, continuous motion.
  * **To Decrease Difficulty:**
    * **Increase `target_angle`** (e.g., to `130` or `135` degrees): Allows shallow, half-squats to count as valid repetitions.
    * **Increase `partial_drop`** (e.g., to `30` degrees): Allows for shakiness or pausing during the descent without resetting the rep.

### **B. POSTURE_STABILITY**
* **Description:** Monitors torso vertical height compression (torso ratio of active height vs. standing height) and horizontal knee alignment relative to ankles (valgus check).
* **Purpose:** Prevents excessive forward leaning (which strains the lower back) and knee cave-in (which puts shearing force on the ACL/kneecap).
* **Default Values:**
  * `min_torso_ratio`: `0.7` (ratio). Minimum active-to-standing torso length allowed.
  * `valgus_threshold`: `0.1` (ratio). Limits horizontal knee inward cave-in relative to ankle distance.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `min_torso_ratio`** (e.g., to `0.85` or `0.90`): Restricts forward chest leaning, forcing the user to squat with an extremely upright back.
    * **Decrease `valgus_threshold`** (e.g., to `0.05`): Tightens the tolerance for knee cave-in, immediately flagging even minor inward knee collapse.
  * **To Decrease Difficulty:**
    * **Decrease `min_torso_ratio`** (e.g., to `0.60`): Permits a deeper forward hinge at the hips, helpful for individuals with long thigh bones or poor ankle mobility.
    * **Increase `valgus_threshold`** (e.g., to `0.20`): Becomes highly tolerant of knees wobbling inward.

### **C. STANCE_CONFIG**
* **Description:** Measures the distance between heels relative to shoulder width (stance ratio) and the starting turnout angle of the feet.
* **Purpose:** Verifies the user sets up in a proper shoulder-width stance to ensure skeletal alignment.
* **Default Values:**
  * `min_ratio`: `0.65` (stance ratio). Minimum heel distance relative to shoulder width.
  * `max_ratio`: `1.5` (stance ratio). Maximum stance width allowed.
  * `min_foot_angle`: `10` (degrees). Minimum outwards turnout of the feet at setup.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `min_ratio`** (e.g., to `0.85` or `0.9`): Forces a wider, more challenging squat stance.
    * **Tighten range parameters** (e.g., narrowing `min_ratio` to `0.9` and `max_ratio` to `1.2`): Enforces a highly specific setup footprint.
  * **To Decrease Difficulty:**
    * **Decrease `min_ratio`** (e.g., to `0.5`): Permits narrow-stance squats.
    * **Increase `max_ratio`** (e.g., to `1.8`): Permits very wide sumo-style stances to register as valid standard squats.

### **D. TEMPO_STILLNESS**
* **Description:** Enforces static stillness of the hips before beginning the descent to trigger stance calibration.
* **Purpose:** Ensures the rep begins under perfect body control rather than bouncing or utilizing momentum.
* **Default Values:**
  * `still_required`: `7` (frames). Consecutive frames of stillness required to lock start position.
  * `movement_threshold`: `0.02` (coordinate units per frame). Maximum allowable speed to be classed as "still".
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `still_required`** (e.g., to `15` or `20` frames): Forces the user to hold the standing setup still for longer (e.g., a solid 0.5–1 second pause) before they can begin.
  * **To Decrease Difficulty:**
    * **Decrease `still_required`** (e.g., to `3` or `4` frames): Allows the user to cycle reps rapidly without pausing at the top.

---

## 2. Plie Squats *(Misspelled in DB as "Pile Squats")*
Plie squats differ from standard squats by requiring a very wide stance, outward foot turnout, and a strictly vertical torso to target the adductors (inner thighs).

### **A. SQUAT_DEPTH**
* **Description:** Monitors knee flexion depth and extension recovery, optimized for wide-stance dynamics.
* **Purpose:** Requires full ROM targeted to the inner thighs and adductor length.
* **Default Values:**
  * `target_angle`: `115` (degrees). *(More forgiving than standard squats due to wide hips constraint)*.
  * `start_trigger`: `168` (degrees). Knee angle below which descent is armed.
  * `partial_drop`: `25` (degrees). Wobble allowance limit.
  * `stand_up_tolerance`: `172` (degrees). Extension threshold to mark the rep complete.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Decrease `target_angle`** (e.g., to `100` or `95` degrees): Requires the user to squat deeper into their hips.
    * **Increase `stand_up_tolerance`** (e.g., to `176` or `178`): Forces the knees to return to an almost complete lock out at the top of each rep.
  * **To Decrease Difficulty:**
    * **Increase `target_angle`** (e.g., to `125` degrees): Allows a shallower, easier squat depth.
    * **Decrease `stand_up_tolerance`** (e.g., to `165` degrees): Registers the rep as complete even if the user maintains a soft bend in the knees at the top.

### **B. STANCE_CONFIG**
* **Description:** Monitors wide heel stance and heavy foot turnout (outward ankle rotation) before permitting calibration.
* **Purpose:** Enforces the structural wide stance (feet wider than shoulders) and extreme turnout required to shift the mechanical load to the adductors.
* **Default Values:**
  * `min_ratio`: `1.2` (stance ratio). Minimum foot width (1.2x shoulder width).
  * `min_foot_angle`: `35` (degrees). Minimum outwards turnout angle.
  * `max_foot_angle`: `75` (degrees). Maximum outwards turnout limit.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `min_ratio`** (e.g., to `1.4` or `1.5`): Demands an exceptionally wide stance, requiring significant hip flexibility.
    * **Increase `min_foot_angle`** (e.g., to `45` or `50` degrees): Demands greater hip external rotation capacity.
  * **To Decrease Difficulty:**
    * **Decrease `min_ratio`** (e.g., to `1.0` or `0.9`): Allows a narrower setup (closer to standard squats).
    * **Decrease `min_foot_angle`** (e.g., to `20` degrees): Tolerates toes facing more forward.

### **C. POSTURE_STABILITY**
* **Description:** Monitors vertical torso compression, torso lean angle, and ensures knees track directly over toes.
* **Purpose:** Forces a strictly upright posture (preventing pelvic tilt or back strain) and checks that knees track directly over the toes to protect the knee joint.
* **Default Values:**
  * `max_lean`: `32` (degrees). The maximum forward torso lean allowed.
  * `min_torso_ratio`: `0.1` (ratio). Torso height ratio *(Note: Engine default is `0.82`)*.
  * `knee_over_toe_buffer`: `0.5` (ratio). Buffer for lateral knee expansion beyond foot index.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Decrease `max_lean`** (e.g., to `15` or `20` degrees): Enforces an intensely vertical posture with minimal forward chest tilt.
    * **Decrease `knee_over_toe_buffer`** (e.g., to `0.0` or negative values): Becomes highly sensitive to knees tracking incorrectly (inward or too far forward relative to the toes).
  * **To Decrease Difficulty:**
    * **Increase `max_lean`** (e.g., to `40` degrees): Allows the user to lean forward to counter poor hip or ankle mobility.
    * **Increase `knee_over_toe_buffer`** (e.g., to `0.8`): Extremely forgiving of tracking deviations.

### **D. TEMPO_STILLNESS**
* **Description:** Monitors start setup stillness (hips position).
* **Purpose:** Standardizes the starting posture and baseline measurements.
* **Default Values:**
  * `still_required`: `10` (frames).
  * `movement_threshold`: `0.01` (coordinate units per frame).
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Decrease `movement_threshold`** (e.g., to `0.005`): Extremely sensitive to micro-movements, requiring the user to hold perfectly still before starting.

---

## 3. Split Lunges
Split lunges are performed in profile (side-view), tracking gait step distance, lunge depth (rear knee nearing the floor), upright back, and forward knee safety.

### **A. LUNGE_DEPTH**
* **Description:** Monitors the knee angle of the active leg in a profile view.
* **Purpose:** Ensures the hips drop low enough (front thigh parallel, back knee near floor) for complete leg and glute activation.
* **Default Values:**
  * `target_angle`: `115` (degrees). Maximum flexion angle *(Note: Engine default is `85.0`)*.
  * `start_trigger`: `150` (degrees).
  * `partial_drop`: `15` (degrees). Wobble allowance.
  * `stand_up_tolerance`: `165` (degrees). Stand up straight limit.
  * `min_movement`: `135` (degrees). *(Refers to `MIN_MOVEMENT_FOR_ATTEMPT`)*.
  * `bottom_exit_tolerance`: `10` (degrees).
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Decrease `target_angle`** (e.g., to `90` or `85` degrees): Requires a much deeper lunge (closer to a full 90-degree bend).
    * **Increase `stand_up_tolerance`** (e.g., to `175` degrees): Forces the front leg to fully extend at the top.
  * **To Decrease Difficulty:**
    * **Increase `target_angle`** (e.g., to `125` degrees): Allows shallow, half-depth lunges.

### **B. POSTURE_STABILITY**
* **Description:** Monitors forward head shift (chin protrusion), gaze level, torso forward tilt, and ensures the front knee stays behind the toe line.
* **Purpose:** Keeps the cervical spine neutral, maintains core upright verticality, and prevents shear force on the patella by keeping the knee stacked over the ankle/foot.
* **Default Values:**
  * `max_torso_lean`: `25` (degrees). Torso forward tilt limit.
  * `knee_toe_tolerance`: `0.5` (ratio). Tolerance of knee advancing forward past toe index.
  * `max_head_forward`: `0.08` (coordinate units). Forward neck drift limit.
  * `gaze_sensitivity`: `0.02` (coordinate units). Check to ensure eyes look straight ahead.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Decrease `max_torso_lean`** (e.g., to `15` degrees): Restricts leaning forward over the front quad.
    * **Decrease `knee_toe_tolerance`** (e.g., to `0.0` or `-0.05`): Demands that the front knee *never* passes the vertical plane of the toe.
    * **Decrease `max_head_forward`** (e.g., to `0.04`): Punishes forward head posturing (gazing down at the feet).
  * **To Decrease Difficulty:**
    * **Increase `max_torso_lean`** (e.g., to `35` degrees): Permits the chest to drop slightly forward, relieving strain on tight hip flexors.
    * **Increase `knee_toe_tolerance`** (e.g., to `0.8`): Extremely permissive of knee glide past the toe.

### **C. STANCE_SETUP**
* **Description:** Measures forward-backward stride distance relative to shoulder width.
* **Purpose:** Confirms the user has stepped far enough apart to distribute weight evenly between legs.
* **Default Values:**
  * `min_step_ratio`: `1.4` (stride ratio). Minimum stride distance relative to shoulder width.
  * `feet_together_threshold`: `0.25`. Threshold below which feet are considered "closed".
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `min_step_ratio`** (e.g., to `1.6` or `1.7`): Demands a longer stride length, stretching the back hip flexor further.
  * **To Decrease Difficulty:**
    * **Decrease `min_step_ratio`** (e.g., to `1.1` or `1.2`): Allows a narrower stride footprint, simplifying balance.

### **D. ENGINE_STABILITY**
* **Description:** Handles signal filtering, stillness locking, and frame smoothing constraints.
* **Purpose:** Fine-tunes sensor tracking sensitivity.
* **Default Values:**
  * `still_required`: `10` (frames).
  * `smoothing_factor`: `0.4` (weight multiplier).
  * `movement_threshold`: `0.015` (speed check).
  * `stillness_smoothing`: `0.1`.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `still_required`** (e.g., to `15` or `20` frames): Requires the user to hold their balance stationary for a solid second before beginning the lunge.

---

## 4. Standing Calf Raises
Standing calf raises track vertical lift, heel elevation (ankle plantarflexion angle), knee straightness, side-to-side body sway, and symmetry.

### **A. HEEL_TILT**
* **Description:** Measures heel lift height (plantarflexion tilt angle) and physical upward shoulder displacement (body lift).
* **Purpose:** Enforces a full contraction of the gastrocnemius/soleus and verifies the user is lifting their actual weight vertically (not just rocking on their feet).
* **Default Values:**
  * `start`: `2` (degrees). The tilt angle change that triggers a raise.
  * `top`: `5.5` (degrees). The minimum extension tilt angle required to count as a "full contraction" peak.
  * `max_safety`: `25` (degrees). Extreme tilt safety threshold.
  * `partial_drop`: `3` (degrees). Minimum height to avoid a partial rep.
  * `end_tolerance`: `2` (degrees). Angle threshold to declare the heel returned to the floor.
  * `min_body_lift`: `0.003` (coordinate units). Confirms physical shoulder upward movement.
  * `baseline_tolerance`: `3` (degrees). Allowed drift in baseline ankle angle.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `top`** (e.g., to `7.5` or `8.0` degrees): Demands the user rise much higher on their toes, requiring a powerful contraction at the peak.
    * **Increase `min_body_lift`** (e.g., to `0.008`): Verifies significant upward torso displacement, eliminating ankle rolling tricks.
* **How to Adjust Difficulty:**
  * **To Decrease Difficulty:**
    * **Decrease `top`** (e.g., to `4.0` degrees): Registers reps even with a shallow heel raise (perfect for ankle rehabilitation).

### **B. KNEE_STABILITY**
* **Description:** Checks that knees remain extended and straight throughout the exercise.
* **Purpose:** Forces the calves to execute the work, preventing the user from using knee recoil (spring) or quadriceps momentum to throw themselves upward.
* **Default Values:**
  * `min_angle`: `155` (degrees) *(refers to `KNEE_BEND_MIN`)*. Minimum angle indicating straight knees.
  * `flex_allowance`: `20` (degrees) *(Note: Engine default is `10.0`)*. Knee bend margin allowed.
  * `penalty`: `20` (points). Quality penalty on infraction.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `min_angle`** (e.g., to `170` or `175` degrees): Requires almost perfectly locked, rigid knee extension throughout.
    * **Decrease `flex_allowance`** (e.g., to `5` or `10` degrees): Punishes even tiny micro-bends of the knee.
  * **To Decrease Difficulty:**
    * **Decrease `min_angle`** (e.g., to `140` degrees): Forgives mild knee bends or buckling under load.

### **C. SYMMETRY**
* **Description:** Measures the difference in height (ankle tilt angle) between the left and right heels.
* **Purpose:** Prevents muscle imbalances and ensures equal weight distribution.
* **Default Values:**
  * `start_diff`: `20` (degrees difference). Maximum imbalance at starting lift off.
  * `mid_diff`: `35` (degrees difference). Maximum imbalance at the peak of the raise.
  * `penalty`: `10` (points). Score penalty.
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Decrease `mid_diff`** (e.g., to `10` or `15` degrees): Fails the repetition if one heel rises slightly higher than the other.
  * **To Decrease Difficulty:**
    * **Increase `mid_diff`** (e.g., to `50` degrees): Tolerates highly asymmetric lifting.

### **D. BODY_SWAY**
* **Description:** Monitors horizontal movement of the shoulders and ankles away from their static starting baseline axis.
* **Purpose:** Enforces clean vertical alignment, preventing the user from rocking forward/backward or swaying sideways.
* **Default Values:**
  * `start_max`: `3` (representing a `3%` or `0.03` coordinate shift allowed at setup).
  * `move_max`: `6` (representing a `6%` or `0.06` coordinate shift allowed during movement).
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Decrease `move_max`** (e.g., to `2` or `3`): Enforces extreme torso verticality; any lateral rocking or shifting immediately aborts or fails the rep.
  * **To Decrease Difficulty:**
    * **Increase `move_max`** (e.g., to `12` or `15`): Allows the user to sway or lean to recover their balance while rising onto their toes.

### **E. TEMPO_STILLNESS**
* **Description:** Enforces stillness at the bottom of the movement and controls calibration intervals.
* **Purpose:** Eliminates Achilles tendon recoil (bouncing) and ensures the calf muscle lifts from a dead stop.
* **Default Values:**
  * `still_required`: `6` (frames).
  * `movement_threshold`: `0.03` (speed).
  * `log_reset`: `10` (frames).
  * `lock_reset`: `5` (frames).
* **How to Adjust Difficulty:**
  * **To Increase Difficulty:**
    * **Increase `still_required`** (e.g., to `15` or `20` frames): Enforces a strict static pause at the bottom (eccentric stretch) before allowing a raise.
  * **To Decrease Difficulty:**
    * **Decrease `still_required`** (e.g., to `2` frames): Permits fast, rapid-fire repetitions with zero bottom pauses.
