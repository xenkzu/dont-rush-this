# You Can't Rush

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Matter.js](https://img.shields.io/badge/Physics-Matter.js-000000?logo=physics&logoColor=white)
![Pretext](https://img.shields.io/badge/Layout-Pretext-blue?style=flat)
![HTML5](https://img.shields.io/badge/Markup-HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/Styling-CSS3-1572B6?logo=css3&logoColor=white)
![Canvas](https://img.shields.io/badge/Graphics-2D_Canvas-blue?style=flat)
![License](https://img.shields.io/badge/license-MIT-green)

A high-fidelity implementation of physics-driven typography, architectural stability, and intentional friction. This project serves as a technical showcase for the **Pretext** library, exploring the visceral relationship between consumption speed and information integrity.

## Core Architecture

### Stability and Chaos Engine
The system implements a surgical asymmetric attack/decay curve to map user interaction to environmental stability. Rapid scrolling initiates an instantaneous transition into a high-chaos state, while recovery is governed by a viscous, spring-dampened 1D noise field. This architecture ensures that "rushing" has a physical consequence, requiring deliberate patience for the system to settle.

### The Signal Oscilloscope
A real-time telemetry visualization driven by a hybrid deterministic-noise engine. The oscilloscope integrates multiple sine harmonics and a spring-based noise field to provide a high-fidelity visual representation of the current stability index. Users can interfere with the signal via high-frequency pointer inputs, triggering localized chaotic anomalies in the typographical grid.

### Reactive Liquid HUD
The Stability HUD features a spring-based vertical tracking system that maintains a physical link to the scroll progress thumb.
*   **Metric Measurement**: A canvas-based metric engine calculates label widths in real-time, accounting for specific CSS letter-spacing and font-metrics before the browser paints.
*   **Inversion Pipeline**: Utilizing `mix-blend-mode: difference`, the HUD text surgically inverts from accent green to deep black as the reactive fill opacity scales with chaos, maintaining absolute legibility under high-intensity feedback.

### Physical Reconstruction
The article is rendered as a registry of discrete physical bodies using Matter.js.
*   **Sub-Surface Recovery**: To enable seamless reconstruction of text below the fold, the system implements a dynamic floor-shifting mechanism. During recovery, the physics boundary is dropped below the viewport, allowing detached words to traverse the boundary floor and reach their original coordinates.
*   **Inertial Snapping**: Once a word returns to its "Ghost" DOM origin, it undergoes an inertial-zeroing process to ensure sub-pixel accuracy during the hand-off between the canvas renderer and the static browser layer.

### Narrative Reveal and Onboarding
The onboarding sequence is designed to establish an atmospheric tone.
*   **Atmospheric Bloom**: The preloader features a 2.2-second slow-decay transition, allowing the "The Signal" preloader to dissolve gracefully into the article content.
*   **Gradient Masking**: A full-width bottom bar provides the "ACCELERATE TO DISRUPT" prompt, utilizing a linear-gradient mask to prevent article content overlap while maintaining high visual salience.

---

## Technical: Pretext Integration

This project is a primary implementation of the **Pretext** library, created by **[Cheng Lou (@chenglou)](https://github.com/chenglou)**.

### Operational Methodology
Pretext provides the foundation for layout-agnostic text measurement. By extracting raw font metrics (ascent, descent, precision widths) and performing deterministic layout calculations off-thread, the library allows this project to:
1.  Establish a mathematical source-of-truth for typographical coordinates.
2.  Enable a perfectly consistent "hand-over" between the Matter.js physics engine and the 2D canvas renderer.
3.  Calculate wrapping and alignment without the latency or side-effects associated with traditional DOM-based measurement.

---

## License
Licensed under the [MIT License](LICENSE).
