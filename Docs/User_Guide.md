# VisionFiT: AI-Guided Workout Analyzer & Posture Coach
## Unified User & Operator Guide

Welcome to the **VisionFiT User Guide**. This document is designed to help athletes, coaches, and system operators get oriented, understand the interface, and successfully operate the VisionFiT AI Workout Form Analyzer application. 

VisionFiT uses real-time computer vision and pose-estimation algorithms to analyze joint angles, count reps, and check exercise biomechanics dynamically. Below, you will find a screen-by-screen breakdown, placeholder slots for visual screenshots, and step-by-step operational instructions.

---

## Quick Start: Environment Setup

Before starting any workout session, ensure your workout environment meets the following conditions for optimal AI posture tracking:

| Requirement | Ideal Configuration | Rationale |
| :--- | :--- | :--- |
| **Lighting** | Bright, even, front-facing or ambient studio lighting. Avoid direct, harsh backlighting (e.g., standing directly in front of a bright window). | Heavy backlighting silhouettes the body, making joint and skeleton detection difficult for the camera. |
| **Spacing & Distance** | Stand **6 to 10 feet (1.8 to 3 meters)** away from the camera. | The tracking engine needs to see your entire body (from head to toe) to lock onto your posture. |
| **Camera Angle** | Set the device at waist height (e.g., on a table or tripod). Pay attention to specific exercise view orientations (e.g., Squats require a **Side View** or **Front/Angle View**). | Placing the camera too low or high distorts joint angles and leads to inaccurate accuracy scoring. |
| **Webcam Permissions** | Allow browser camera access when prompted by the app. | The real-time tracker runs locally inside your secure web browser sandbox. |

---

## Screen 1: Sign-In / Login Screen

### 1. Visual Layout & Screenshots
*Insert your login screen mockup or screenshot below:*

![Login Screen - Screenshot Placeholder](./screenshots/login_screen.png)

---

### 2. Interface Description & Interactive Elements
The Login Screen is divided into a clean, premium split-screen layout designed to welcome the athlete:
*   **Splash Panel (Left - Desktop Only):** Features high-contrast athletic imagery under dramatic lighting, establishing the VisionFiT branding ("Master your form.") and emphasizing real-time biomechanical analysis.
*   **Forms Container (Right):** A highly focused, dark-themed login interface containing:
    1.  **Email Address Input (`#email`):** A custom input text box with a placeholder (`athlete@performance.ai`).
    2.  **Password Input (`#password`):** A secure input field with a built-in **Visibility Toggle** (Eye icon) to show/hide the password.
    3.  **Sign In CTA Button:** An interactive pill-shaped button with a gradient transition (`primary` to `primary_container`) that triggers local authentication.

### 3. Step-by-Step Instructions
1.  Navigate to the root URL of the application.
2.  In the **Email Address** field, enter your registered email address.
3.  In the **Password** field, enter your password. Click the **Eye icon** on the right side of the input field if you need to double-check your typing.
4.  Click the **Sign In** button.
5.  On successful authentication, your user credentials will be securely cached locally, and you will be automatically redirected to the **Practice Dashboard**.

### 4. Troubleshooting & FAQ
*   **Error: "Could not connect to the server":** Verify that your backend server is active and running. Ensure that your internet or network connection is stable.
*   **Error: "Login failed" (Incorrect Credentials):** Double-check your email syntax and password character casing. Use the password visibility toggle to ensure correct character input.

---

## Screen 2: Practice Dashboard (Home Screen)

### 1. Visual Layout & Screenshots
*Insert your dashboard screen mockup or screenshot below:*

![Practice Dashboard - Screenshot Placeholder](./screenshots/dashboard_screen.png)

---

### 2. Interface Description & Interactive Elements
The Practice Dashboard acts as the central command center for choosing your workout exercises:
*   **Top Navigation Bar (Header):**
    *   **VisionFiT Logo (Left):** Clickable header that returns you to the home dashboard.
    *   **Dashboard Links (Center):** Quick tabs to switch between **Practice** (active) and **History** screens.
    *   **Profile Status (Right):** Displays the current athlete's email and features a clean **Sign Out** button (white background with a custom outline and logout icon).
*   **Dashboard Body:**
    *   **Intro & Header:** Motivational, clean editorial header text ("Refine Your Form.") clarifying the AI posture tracking concept.
    *   **Selected Movement Tag:** Displays a floating container highlighting the currently active movement when selected.
    *   **Exercise Cards Grid:** A beautifully balanced grid showcasing all available physical movements loaded dynamically from the database (e.g., *Squats*, *Pile Squats*, *Split Lunges*, *Standing Calf Raise*). Each card features:
        1.  **Gradient Card Header:** Stylized gradient background with matching custom hand-drawn icon representing the movement.
        2.  **Camera Angle Badge:** High-contrast camera icon badge highlighting the optimal camera view (e.g., `SIDE VIEW`, `FRONT VIEW`) needed for tracking rules.
        3.  **Exercise Name & Description:** Details on how to execute the movement and what postural points are evaluated.
        4.  **Start Tracking Button:** A primary interactive action button that transitions to the live analysis screen.
*   **Mobile Navigation Bar:** A sticky bottom navigation bar that appears on mobile devices to easily toggle between **Practice** and **History** tabs.

### 3. Step-by-Step Instructions
1.  Log in to access the **Practice Dashboard**.
2.  Browse the **Exercise Cards Grid** to review exercise descriptions and the recommended **Camera Angle Badge**.
3.  Position your webcam tripod/device according to the exercise card's camera angle guidelines.
4.  Hover over or tap your chosen exercise card.
5.  Click the **Start Tracking** button at the bottom of the card to begin your real-time posture analysis session.

---

## Screen 3: Live AI Posture Tracking (Workout Screen)

### 1. Visual Layout & Screenshots
*Insert your live workout analysis screen mockup or screenshot below:*

![Live AI Posture Tracking Screen - Screenshot Placeholder](./screenshots/live_tracking_screen.png)

---

### 2. Interface Description & Interactive Elements
The Live Posture Tracking screen is a professional, high-performance dark-themed HUD designed for real-time interaction:
*   **Header HUD Panel:**
    *   **Chevron Back Button:** Safe navigation button on the top-left to exit the workout (triggers an exit confirmation modal to save your progress).
    *   **Exercise Title & Engine Badge:** Shows the name of the exercise and the active rule-matching engine (e.g., `SquatsEngine` or `LungesEngine`).
    *   **Live Indicators:** Green "Live Analysis" pulsing pill and an active **FPS (Frames Per Second)** counter indicating video processing speeds.
    *   **Voice Guide Toggle:** Interactive volume icon button (Mute/Unmute). Enabling this turns on the **Speech Assistant**, which reads out reps and gives real-time vocal posture corrections.
    *   **Stats Dashboard Cards:** High-visibility, tabular-font statistic cards counting **Attempts** (blue), valid **Reps** (cyan), and **Workout Duration Timer** (yellow).
    *   **Start/Stop Workout Button:** Desktop button to toggle workout recording.
*   **Interactive Video Canvas (Left Column):**
    *   **Webcam Stream Feed:** Feeds your local camera view into the browser.
    *   **Skeleton Overlay:** A real-time, responsive neon blue skeleton line drawing overlaid on top of your body landmarks (shoulders, hips, knees, heels, and wrists) using low-latency joint smoothing.
    *   **Top-Right Feedback Toasts:** Interactive visual cue popups showing live instruction cues.
        *   > [!IMPORTANT]
        *   **Orange Alert Cues:** Display urgent biomechanical corrections (e.g., *"Keep back straight"*, *"Widen your stance"*, *"Knees over toes"*).
        *   > [!TIP]
        *   **Bright Green Success Cues:** Display positive exercise triggers or phase guides (e.g., *"Great depth"*, *"Going down"*, *"Now drive up"*).
*   **Attempt Log Panel (Right Column):**
    *   A running list of every movement attempt detected during the session.
    *   Each entry shows:
        *   **Status Label:** Success (emerald), Failed (rose), or Canceled (amber).
        *   **Reason/Flaw Breakdown:** A description of why the rep passed or failed (e.g., *"Knee bend too shallow"* or *"Hips did not break parallel"*).
        *   **Timestamp:** The precise system time the rep was logged.
*   **Active Countdown Overlay:** A screen-wide dark overlay with a large font countdown (`5`, `4`, `3`, `2`, `1`, `GO!`) that triggers when you start a workout, giving you ample time to walk back and frame your body.
*   **Confirmation Modal Dialog:** A defensive overlay preventing accidental clicks on the back button. Warns you that leaving will save and stop the current session.

### 3. Step-by-Step Instructions
1.  Click **Start Workout** (desktop or bottom mobile dock).
2.  A **5-second countdown** will initiate. Walk backward immediately until your entire body (from head to toes) is framed inside the video screen.
3.  Once the countdown hits **"GO!"**, the engine will state *"Searching for body"* or *"Stance locked"* as it calibrates your alignment.
4.  Begin performing the exercise. Keep your ears open for the **Speech Assistant** voice:
    *   It will count valid reps out loud (e.g., *"One"*, *"Two"*).
    *   It will vocalize live warnings to correct your posture mid-rep (e.g., *"Keep back straight"*).
    *   If a repetition fails, it will announce the failure reason (e.g., *"Rep failed: Knee angle too shallow"*).
5.  Watch the **Attempt Log** on the right side of the screen update in real time.
6.  Once you complete your set, click **Stop Workout** (or click the **Back Chevron** and select **Confirm**). The session will save automatically to your history profile.

---

## Screen 4: Performance Journey (History List Screen)

### 1. Visual Layout & Screenshots
*Insert your athlete history screen mockup or screenshot below:*

![Performance Journey Screen - Screenshot Placeholder](./screenshots/history_screen.png)

---

### 2. Interface Description & Interactive Elements
This screen houses your historical athletic data, providing searchable access to past workouts:
*   **Page Header:** Bold, editorial typography outlining your workout stats over time.
*   **Search & Filtering HUD Bar:** A unified inline bar designed to navigate through hundreds of workouts:
    1.  **Search Input Box:** Type exercise names or keywords with an instant search filter.
    2.  **Category Selector:** Drop-down selector to filter by major muscle groups or exercise types (e.g., *Squats*, *Lunges*).
    3.  **Subcategory Selector:** Filter sessions further by sub-movement variants.
    4.  **Clear Filters Button:** A floating button featuring a custom filter-off icon to quickly reset search states.
*   **Chronological Session List:** Layered vertical cards displaying your sessions:
    *   **Left Details:** Custom sport category icon, session name, precise calendar date, and category tags.
    *   **Performance Metrics:** Fast comparative columns showing **Successful Attempts (Reps)**, **Total Attempts**, and **Total Duration**.
    *   **Chevron Link:** Interactive directional arrow to transition into deep diagnostic details.

### 3. Step-by-Step Instructions
1.  Click the **History** link in the top navigation bar of the application.
2.  Use the **Search Bar** to find specific workouts by name.
3.  Utilize the **Category** or **Subcategory** drop-down selectors to isolate specific muscle groups or days.
4.  Review the high-level metrics (Reps, Duration) directly on the cards.
5.  Click on any session card to drill down into the full **Biomechanical Breakdown** screen.

---

## Screen 5: Biomechanical Breakdown (Session Details Screen)

### 1. Visual Layout & Screenshots
*Insert your biomechanical session details mockup or screenshot below:*

![Biomechanical Breakdown Screen - Screenshot Placeholder](./screenshots/session_details_screen.png)

---

### 2. Interface Description & Interactive Elements
This screen provides deep-dive athletic coaching diagnostics, visualizing your posture, joint range-of-motion, and flaws:
*   **Summary Stats Grid:** A 6-column grid displaying high-level performance cards:
    *   *Total Attempts*, *Successful Attempts*, *Failed Attempts*, *Cancelled Attempts*, *Workout Duration*, and *Total Form Flaws*.
*   **Analysis vs. Log Tab Toggle:** A rounded tab switcher located in the header to toggle between:
    *   **Analysis Tab:** High-resolution interactive charts.
    *   **Log Tab:** A vertical timeline of all attempts and failures.
*   **Global Attempt Timeline Slider:** A horizontal scrollbar featuring pill-shaped buttons. Selecting **"ALL"** plots the entire workout. Selecting an individual rep button (e.g. `Rep 1`, `Rep 2`) updates all joint charts to focus exclusively on that single movement attempt.
*   **Kinematic Joint Charts:** Advanced Area/Line charts plotting real-time biomechanics:
    *   **Bilateral Symmetry Pairings (Left vs. Right Joint Angles):** Dual-line plots comparing left and right limbs (e.g. Left Knee vs. Right Knee, or Left Hip vs. Right Hip). Allows coaches to spot structural imbalances or unilateral compensation.
    *   **Movement Rhythm Plot (Tempo):** Evaluates speed and pacing (seconds elapsed vs. frame rate) showing contraction and extension pacing.
    *   **Interactive Zoom Slider (Brush):** A timeline slider at the bottom of each chart to zoom in on specific fractions of a second or specific reps.
    *   **Visual Phase Markers:** Vertical lines marking the **START** of the movement (initial eccentric phase), the **MID** peak depth (concentric pivot), and the **END** recovery point of the rep.
*   **Form Flaw Distribution Chart:** A stylized area chart plotting the frequency of posture errors across repetitions, complete with a custom hover tooltip highlighting exactly what flaws were detected (e.g., *"Knee bend too shallow"*).
*   **Session Attempt History Log (Log Tab):** A list showing the time, status, and precise cause of failure for every single movement.

### 3. Step-by-Step Instructions
1.  From the **History List**, click a session card to open the **Biomechanical Breakdown** screen.
2.  Review your high-level card metrics in the **Summary Stats Grid** to see your overall success rate and total flaws.
3.  Scroll down to the **Joint Charts**:
    *   Leave the slider on **"ALL"** to examine your general tempo and muscle fatigue across the entire session.
    *   Click on specific pills (e.g., `Rep 3`) to zoom the charts directly into the eccentric and concentric phases of that single repetition.
4.  Observe the **Bilateral Symmetry Pairing** charts:
    *   Look for gap variations between the Left and Right joint lines. Large gaps indicate asymmetry, implying you are loading one side of your body more than the other.
5.  Hover your mouse or tap on the **Form Flaw Distribution Chart** points to read the exact corrective feedback generated by the posture engine.
6.  Toggle the header tab to **"Log"** to view a simple list of all successful, canceled, or failed reps with exact timestamps.

---

## Technical Specifications & Operator Controls

For developers, coaches, or advanced users looking to fine-tune the system, the VisionFiT engine supports several runtime parameters that can be customized in the project database:

### 1. Tracking Model Types (`tracking_model`)
The system can run three different variations of the pose-estimation model depending on your hardware:
*   **Lite:** High-speed, lower accuracy. Ideal for older mobile devices or low-spec webcams.
*   **Full:** The standard model. Provides balanced accuracy and performance for standard laptops.
*   **Heavy:** High-resolution tracking. Highly accurate but computationally intensive. Best suited for modern desktop environments with dedicated GPUs.

### 2. UI Smoothing (`ui_smoothing`)
Configures an exponential moving average (EMA) filter on skeleton joints to reduce visual "jitter" on screen. Recommended values:
*   `0.1` - Raw, ultra-responsive telemetry (higher jitter).
*   `0.3` - Balanced default. Smooth skeleton line with minimal latency.
*   `0.6` - Highly smoothed visualization (slight rendering delay).
