# You Can't Rush

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Matter.js](https://img.shields.io/badge/Physics-Matter.js-000000?logo=physics&logoColor=white)
![Pretext](https://img.shields.io/badge/Layout-Pretext-blue?style=flat)
![HTML5](https://img.shields.io/badge/Markup-HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/Styling-CSS3-1572B6?logo=css3&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

A high-fidelity implementation of physics-driven typography, architectural stability, and intentional friction. This project serves as a technical showcase for the **Pretext** library, exploring the visceral relationship between consumption speed and information integrity.

## Core Architecture

### Stability and Chaos Engine
The system implements a surgical asymmetric attack/decay curve to map user interaction to environmental stability. Rapid scrolling initiates an instantaneous transition into a high-chaos state, while recovery is governed by a viscous, spring-dampened 1D noise field. This architecture ensures that "rushing" has a physical consequence, requiring deliberate patience for the system to settle.

### Stochastic Word Detachment
To prevent a total and predictable collapse of the typographical grid, the detachment engine utilizes a 30% selective-decay filter. Even when the stability threshold is breached, the system selectively fragments only a minority subset of candidates per animation frame. This creates a more organic, "sometimes-not-everytime" decay pattern where meaning is lost in fragments rather than all at once.

### The Lens of Patience
A word-based interactive reveal system that explores the metabolic rate of truth. 
*   **Stochastic Alignment**: Moving the cursor slowly over the scrambled word field triggers a high-precision snap to target coordinates. 
*   **Organic Instability**: To resist mechanical perfection, words possess an internal "instability" property (20% chance of flicker). This ensures that even intentional focus requires careful, manual adjustment to fully clarify the hidden message: *"Meaning Requires Friction."*

### Reactive Liquid HUD
The Stability HUD features a spring-based vertical tracking system that maintains a physical link to the scroll progress thumb.
*   **Metric Measurement**: A canvas-based metric engine calculates label widths in real-time, accounting for specific CSS letter-spacing and font-metrics before the browser paints.
*   **Inversion Pipeline**: Utilizing `mix-blend-mode: difference`, the HUD text surgically inverts from accent green to deep black as the reactive fill opacity scales with chaos, maintaining absolute legibility under high-intensity feedback.

### Physical Reconstruction
The article is rendered as a registry of discrete physical bodies using Matter.js.
*   **Sub-Surface Recovery**: To enable seamless reconstruction of text below the fold, the system implements a dynamic floor-shifting mechanism. During recovery, the physics boundary is dropped below the viewport, allowing detached words to traverse the boundary floor and reach their original coordinates.
*   **Inertial Snapping**: Once a word returns to its "Ghost" DOM origin, it undergoes an inertial-zeroing process to ensure sub-pixel accuracy during the hand-off between the canvas renderer and the static browser layer.

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
