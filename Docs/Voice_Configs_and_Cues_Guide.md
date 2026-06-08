# Voice Configurations, Cues, and Failure Guidance Guide

This guide provides a comprehensive breakdown of the voice engine settings, custom auditory cues, and dynamic failure guidance parameters stored in the database (`voice_configs`, `voice_cues`, and `voice_failure_guidance` tables).

---

## 1. Global Voice Settings (`voice_configs`)

### **A. Explanation**
`voice_configs` acts as the global control panel for the Web Speech API Text-to-Speech (TTS) synthesizer. It defines voice delivery rates, pitches, timing intervals (throttling), and sets the pool of dynamic encouraging remarks.

### **B. Purpose**
* **Trainer Tone:** Speeds up and pitches the voice slightly to feel like a high-energy personal trainer rather than a flat, slow machine.
* **Collision Control:** Prevents the "machine gun voice" effect. Without these configs, rapid telemetry updates would stack audio feeds on top of each other, creating an overlapping mess.
* **Gamification & Engagement:** Intersperses successful reps with randomized positive reinforcements to keep motivation high.

### **C. Database Configs & Default Values (`id = 'global'`)**
| Key / Property Name | Default Value | Description / Unit |
| :--- | :---: | :--- |
| **`id`** | `"global"` | Primary Key identifier. |
| **`min_interval_ms`** | `2200` | Minimum gap (milliseconds) between *any* consecutive spoken correction cues. |
| **`phrase_cooldown_ms`** | `4000` | Cooldown (milliseconds) required before repeating the exact same warning cue. |
| **`reinforcement_probability`** | `0.70` | `70%` chance that a random positive reinforcement is appended after a successful rep. |
| **`speech_rate`** | `1.05` | Speed rate of vocal playback (1.05x normal speed to feel energetic and paced). |
| **`speech_pitch`** | `1.00` | Vocal pitch level offset. |
| **`positive_reinforcements`** | *Array of Strings* | Pool of congratulatory comments: <br> `["Perfect form!", "Excellent depth!", "Great repp!", "Spot on!", "Nice job!", "Keep it up!", "Amazing control!"]` |

---

## 2. Audible Form Corrections (`voice_cues`)

### **A. Explanation**
`voice_cues` acts as a translation layer. It matches raw, rigid telemetry warning tags raised by the movement validation engine (e.g., `Knees beyond toes!`) to clean, friendly, and actionable verbal coaching instructions (e.g., `Bring knees back behind your toes.`).

### **B. Purpose**
* **Actionable Coaching:** Replaces developer-centric alert tags with clear, physical cues on what the user should *do* to correct their form.
* **Context Overrides:** Supports custom exercise overrides. For example, `"Widen your stance"` can be configured differently for a standard squat versus a wide Plie squat.
* **Telemetry Muting:** Allows mapping specific tracking alerts to an empty string (`""`), keeping the trainer quiet during silent phases like calibration or body matching.

### **C. Database Schema & Columns**
* **`id`**: Unique UUID primary key.
* **`exercise_name`**: Human-readable name of the parent exercise (`Global`, `Squats`, `Plie Squats`, etc.).
* **`exercise_id`**: Foreign key to `exercises` (or `NULL` to fall back to global cue definitions).
* **`raw_cue`**: The exact code/string sent from the mechanical processing engine.
* **`spoken_cue`**: The clean string read aloud by the speaker. If set to `""`, the cue is muted.
* **`is_active`**: Boolean flag to enable/disable cue tracking.

### **D. Seeded Default Configurations**

#### **Global / Universal Setup Cues**
* `"Searching for body..."` $\rightarrow$ `""` *(Muted to prevent annoying startup chatter)*
* `"Hold still to calibrate"` $\rightarrow$ `""` *(Muted to maintain quiet focus during baseline setups)*

#### **Standard Squats**
* `"Widen your stance"` $\rightarrow$ `"Widen your stance."`
* `"Ready! Go down"` $\rightarrow$ `"Ready! Now, squat down."`
* `"Feet too wide"` $\rightarrow$ `"Bring your feet slightly closer."`
* `"Keep chest up!"` $\rightarrow$ `"Keep your chest up."`
* `"Knees beyond toes!"` $\rightarrow$ `"Bring knees back behind your toes."`
* `"Great depth! Now up"` $\rightarrow$ `"Perfect depth! Drive back up."`
* `"Push knees out"`, `"Push through heels"`, `"Going down..."` $\rightarrow$ `""` *(Muted telemetry)*

#### **Plie Squats**
* `"Widen your stance"` $\rightarrow$ `"Widen your stance."`
* `"Turn toes outward"` $\rightarrow$ `"Turn your toes outward."`
* `"Toes out too far"` $\rightarrow$ `"Bring toes in slightly."`
* `"Feet too wide"` $\rightarrow$ `"Bring feet closer."`
* `"Keep chest up!"` $\rightarrow$ `"Keep your chest up!"`
* `"Knees out!"` / `"Push knees out!"` $\rightarrow$ `"Push your knees outward."`
* `"Great depth! Now up"` $\rightarrow$ `"Perfect depth! Drive back up."`

#### **Split Lunges**
* `"Step one leg forward to begin"` $\rightarrow$ `"Step one leg forward to begin."`
* `"Take a wider step for stability"` $\rightarrow$ `"Take a wider step for stability."`
* `"Stance Locked! Lower your hips"` $\rightarrow$ `"Stance locked. Now, lower your hips."`
* `"Front knee beyond toe!"` $\rightarrow$ `"Bring your front knee back behind your toes."`
* `"Keep chest upright!"` $\rightarrow$ `"Keep your chest upright."`
* `"Look straight ahead"` $\rightarrow$ `"Look straight ahead."`
* `"Great depth! Now push up"` $\rightarrow$ `"Perfect depth! Drive back up."`
* `"Don't lean forward!"` $\rightarrow$ `"Keep your torso upright."`

#### **Standing Calf Raises**
* `"Wiggle feet closer"` $\rightarrow$ `"Bring your feet slightly closer."`
* `"Stand tall & squeeze"` $\rightarrow$ `"Stand tall and squeeze your calves."`
* `"Ready! Rise up"` $\rightarrow$ `"Ready! Lift up."`
* `"Going up! Squeeze"` $\rightarrow$ `"Up and squeeze."`
* `"Squeeze calves at peak!"` $\rightarrow$ `"Hold and squeeze at the peak!"`
* `"Heels flat to floor"` $\rightarrow$ `"Bring your heels flat to the floor."`
* `"Keep knees straight!"` / `"Knees Bent"` $\rightarrow$ `"Keep your knees straight."`
* `"Excessive sway! Stand still"` / `"Don't sway sideways"` $\rightarrow$ `"Control your balance, stand still."`
* `"Asymmetric Lift"` $\rightarrow$ `"Lift both heels evenly."`

---

## 3. Dynamic Rep-Failure Guidance (`voice_failure_guidance`)

### **A. Explanation**
When the validation engine registers a failed attempt (e.g., user returns upright early, or wobbled out of control), `voice_failure_guidance` provides a dedicated verbal diagnostic advice phrase to correct form on the subsequent attempt.

### **B. Purpose**
* **Fail-Safe Encouragement:** When a user commits a mistake that invalidates a rep, the system declares `"No rep."` immediately followed by specific, constructive coaching advice so they can succeed on the next attempt.
* **Keyword Matching:** The engine scans the primary failure reason using partial keyword-matching (`deep`, `lean`, `toes`, `sway`) to dynamically select the most relevant advice.

### **C. Database Configs & Default Values**
* **`id`**: Unique UUID primary key.
* **`failure_keyword`**: The keyword analyzed against the failed rep reason (lowercased).
* **`spoken_advice`**: The coaching advice read aloud post-failure.
* **`is_active`**: Boolean flag.

### **D. Seeded Default Matches**
| Keyword | Trigger Condition | Spoken Advice |
| :--- | :--- | :--- |
| **`deep`** | Shallow range of motion (failed depth check). | `"Try to go deeper on your next repp."` |
| **`lean`** | Torso collapsed forward / rounded spine. | `"Remember to keep your chest up."` |
| **`toes`** | Knee pushed too far forward over foot line. | `"Try to keep your knees behind your toes."` |
| **`sway`** | Heavy sideways drift or excessive balance wobble. | `"Try to stand completely still."` |
