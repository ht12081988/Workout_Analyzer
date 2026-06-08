---
name: Workout Analyzer
colors:
  surface: '#f8f9ff'
  surface-dim: '#d8dadf'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3f9'
  surface-container: '#eceef3'
  surface-container-high: '#e6e8ed'
  surface-container-highest: '#e1e2e8'
  on-surface: '#191c20'
  on-surface-variant: '#43474f'
  inverse-surface: '#2e3135'
  inverse-on-surface: '#eff0f6'
  outline: '#737780'
  outline-variant: '#c3c6d1'
  surface-tint: '#3b5f94'
  primary: '#001d3f'
  on-primary: '#ffffff'
  primary-container: '#003265'
  on-primary-container: '#799cd5'
  inverse-primary: '#a8c8ff'
  secondary: '#24695a'
  on-secondary: '#ffffff'
  secondary-container: '#a9edda'
  on-secondary-container: '#296d5e'
  tertiary: '#371200'
  on-tertiary: '#ffffff'
  tertiary-container: '#52260e'
  on-tertiary-container: '#cc8b6c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#a8c8ff'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#20477b'
  secondary-fixed: '#acf0dd'
  secondary-fixed-dim: '#90d4c1'
  on-secondary-fixed: '#00201a'
  on-secondary-fixed-variant: '#005143'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#fdb694'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#6b3a20'
  background: '#f8f9ff'
  on-background: '#191c20'
  surface-variant: '#e1e2e8'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 3.5rem
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02rem
  headline-md:
    fontFamily: Manrope
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01rem
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.05rem
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  spacing-6: 2rem
  spacing-12: 4rem
  spacing-16: 5.5rem
  gutter: 1.5rem
  margin-mobile: 1rem
  margin-desktop: 4rem
---

# Design System Document: The Workout Analyzer.

## 1. Overview & Creative North 

This system moves beyond traditional dashboard "boxes" to create an environment that feels curated and professional. We achieve this through **Intentional Asymmetry**—where elements are not always centered, allowing white space to act as a functional "pause"—and **Editorial Layering**, where content stacks like fine stationery. 

---

## 2. Colors & Tonal Architecture
Color is used as a structural tool, not just decoration. We rely on Material Design tonal tokens to define hierarchy without the need for rigid containment.

### The "No-Line" Rule
**Strict Prohibition:** Do not use 1px solid borders to separate sections or group content. 
Boundaries must be defined through background color shifts. Use `surface_container_low` (#f3f3f9) as a base for secondary sections and `surface_container_lowest` (#ffffff) for high-priority interactive cards. The change in tone is the boundary.

### Surface Hierarchy
*   **Background (#f9f9ff):** The canvas. Use for wide-open spaces.
*   **Surface Container Low (#f3f3f9):** Use for secondary content areas or sidebar backgrounds.
*   **Surface Container Lowest (#ffffff):** Reserved for "active" containers, cards, and floating elements that need to pop against the background.

### The "Glass & Gradient" Rule
To elevate the UI from "flat" to "premium":
*   **Overlays & Modals:** Apply `surface_container_lowest` at **80% opacity** with a **20px backdrop blur**. This creates a frosted-glass effect that keeps the mentor’s presence integrated with the performance context.
*   **Signature Gradients:** For primary CTAs and hero backgrounds, use a subtle linear gradient from `primary` (#003265) to `primary_container` (#00488d). This adds a "soul" to the interface that flat colors cannot replicate.

---

## 3. Typography
The typographic pairing is designed to reflect the tension between classical training (Manrope) and modern performance (Inter).

*   **The Display Scale (Manrope):** Use `display-lg` (3.5rem) for hero moments and `headline-md` (1.75rem) for section titles. Manrope’s geometric yet warm character provides the "authoritative mentor" voice.
*   **The Utility Scale (Inter):** Use `body-lg` (1rem) for all instructional text. Inter provides the necessary legibility for script analysis and feedback.
*   **Editorial Spacing:** Always increase the letter-spacing of `label-md` (0.75rem) to +0.05rem and use uppercase for metadata to mimic high-end editorial layouts.

---

## 4. Elevation & Depth
Depth in this system is organic, not artificial. We mimic the way light hits physical layers of paper and glass.

### The Layering Principle
Construct the UI as a physical stack. For example, a "Performance Score" card should be `surface_container_lowest` (#ffffff) sitting on top of a `surface_container_low` (#f3f3f9) layout. The contrast alone provides the "lift."

### Ambient Shadows
When a "floating" effect is necessary (e.g., a floating action button or a modal):
*   **Shadow Value:** Use a 32px blur with only **6% opacity**.
*   **Shadow Tint:** Use the `on_surface` (#191c20) token for the shadow color. This ensures the shadow feels like a natural ambient occlusion rather than a "drop shadow" effect.

### The "Ghost Border" Fallback
If a visual boundary is absolutely required for accessibility (e.g., a high-contrast input field):
*   **Token:** Use `outline_variant` (#c2c6d2).
*   **Opacity:** Must be reduced to **20%**. 100% opaque borders are forbidden as they "suffocate" the layout.

---

## 5. Components

### Buttons
*   **Primary:** Pill-shaped (`rounding-full`), using the signature gradient (`primary` to `primary_container`). Use `on_primary` (#ffffff) for text.
*   **Secondary:** Pill-shaped, using `secondary_container` (#acf0dd) with `on_secondary_container` (#2c6f60) text.
*   **States:** On hover, increase the elevation by shifting the background tone slightly higher; do not change the border.

### Informational Containers (Cards)
*   **Rounding:** Always use `xl` (3rem/48px) for large content containers.
*   **Layout:** Embrace asymmetry. Place titles in the top-left and secondary actions in the bottom-right, leaving the center-right for white space or a subtle background graphic.

### Performance Feedback Inputs
*   **Text Inputs:** Use `surface_container_high` (#e7e8ee) as the background with no border. Upon focus, shift to `surface_container_lowest` (#ffffff) with the 20% Ghost Border.
*   **Checkboxes/Radios:** Must be `rounding-full`. Interaction should feel "soft," using a tonal expansion of the `primary_fixed` color on click.

### The "Script List" (Specific Component)
*   **Rule:** Forbid divider lines between scripts. 
*   **Style:** Use the `Spacing-6` (2rem) scale to separate items. Differentiate the "Current Script" from others by applying a `surface_container_lowest` background and the 6% ambient shadow.

---

## 6. Do's and Don'ts

### Do:
*   **Use Intentional Asymmetry:** If a layout feels too "balanced," try offsetting a headline or pushing a CTA to a non-traditional corner.
*   **Prioritize Breathing Room:** Use the `Spacing-12` (4rem) and `Spacing-16` (5.5rem) tokens generously between major sections.
*   **Layer with Glass:** Use backdrop-blur overlays when displaying feedback over an actor's video feed.

### Don't:
*   **Don't Use 1px Borders:** Never use a solid line to separate content. Use tonal shifts (`surface` vs. `surface_container_low`).
*   **Don't Use Sharp Corners:** Avoid any rounding smaller than `md` (1.5rem) for containers. This is a mentor's space; it should feel approachable.
*   **Don't Crowd the Display:** If you have more than 5 elements in a single horizontal row, move to a layered vertical layout. High-end editorial design values "The Pause."

### Accessibility Note:
While we use tonal shifts, ensure the contrast between `surface_container` and `on_surface` text meets WCAG AA standards. If a tonal shift is too subtle for a specific user base, increase the contrast by one tier (e.g., move from `surface_container_low` to `surface_container_high`).