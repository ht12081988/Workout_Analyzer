# AI Prompt Template for Feature Demo Videos

*Save this prompt and use it whenever you need me to create a feature demo video for a new app in the same exact presentation style as the Audition Coach / Workout Analyzer videos.*

---

**Prompt:**

> "I need to create a 30-second feature demo video for my new platform using HyperFrames and Kokoro TTS. Please follow the **'Audition Coach Presentation Style'** exactly as we used in the Workout Analyzer demo.
> 
> **Here is the script and the sequence of UI screens:**
> *[Insert Script and list of Screens here]*
> 
> **Please adhere to the following strict guidelines:**
> 
> 1. **Setup & Narration:**
>    - Initialize the project in `demo-video` using HyperFrames.
>    - Generate the narration using Kokoro TTS (`af_heart` voice).
> 
> 2. **Layout & Framing (1920x1080 Landscape):**
>    - Do NOT make the screens full-width or stretch them.
>    - Place the UI screenshots inside a `.fullscreen-visual` container and wrap them in a `.screen-wrap` div.
>    - Apply a `border-radius: 20px`, a deep shadow (`box-shadow: 0 40px 120px rgba(0,0,0,0.8)`), and a subtle 1px white border (`0 0 0 1px rgba(255,255,255,0.05)`).
> 
> 3. **Motion:**
>    - Add a subtle entrance animation where the framed screen scales up from `0.95`, moves up on the Y-axis slightly, and fades in.
>    - Scroll the UI screen smoothly inside its container using `object-position: 50% 100%` over the duration of the scene.
> 
> 4. **IndiaNIC Typography & Subtitles:**
>    - Avoid word-by-word karaoke highlights.
>    - Use a persistent `.subtitle-overlay` at the bottom with a dark gradient (`linear-gradient(to top, rgba(10,10,10,1), rgba(10,10,10,0))`).
>    - Extract the script into a 3-part layout for each scene: 
>      - **Kicker:** JetBrains Mono, uppercase, tracked out (`letter-spacing: 0.15em`), flanked by short orange lines.
>      - **Headline:** Bold, 56px. Use *Instrument Serif italics* with the IndiaNIC flame orange (`#FF6B1A`) for emphasized words.
>      - **Body Text:** Clean, readable 26px text fading to 70% opacity.
>    - Load and use the **Inter Tight** font family from Google Fonts for the main text.
> 
> 5. **Atmosphere:**
>    - Add the `.bg-mesh` and `.bg-glow-center` effects to the background behind the screens.
>    - Include a fixed `.topbar` showing the App Name and a 'Feature Demo' badge.
> 
> 6. **Transitions:**
>    - Ensure scenes stack seamlessly using `data-transition="crossfade"` and the `clip` class, with `data-layout-allow-overflow` applied to suppress overlap linting."
