# You Can't Rush

![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Matter.js](https://img.shields.io/badge/Physics-Matter.js-000000?logo=physics&logoColor=white)
![Pretext](https://img.shields.io/badge/Layout-Pretext-blue?style=flat)
![HTML5](https://img.shields.io/badge/Markup-HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/Styling-CSS3-1572B6?logo=css3&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)


This project is an interactive implementation of the Pretext library. I built this website to experiment with physics-driven typography and to explore the idea that rushing through content should have visual consequences.



## Core Mechanics



### Text Interaction and Falling

The primary mechanic is tied directly to how you scroll. If you rush through the page, the environment destabilizes. The words detach from the grid and fall via a physics engine. It is a literal representation of losing meaning when you move too fast. To recover the text and read the article, you just have to stop. The words will pull themselves back into place once the chaos settles.



### The Interactives (Signal & Lissajous)

There are several interactive canvas components mixed in, like the Signal noise oscilloscope and the Lissajous harmonic curves. These share the same philosophy as the text layout. If you move your cursor violently or try to rush the interaction, the systems suffer from signal overrun. The mathematical patterns break down into frantic, high-velocity traces. Interacting deliberately and slowly is the only way to lock them back into clean shapes.



## What I Learned Using Pretext



Working with Pretext really shifted my perspective on web typography limitatons. 

Normally, treating individual words as physical bodies requires reading layout data directly from the DOM. This causes layout thrashing and ruins performance when scaling up. 

Pretext solves this by measuring text limits and bounds off the main thread. It gave me a mathematical source of truth for where every word belonged before the browser even painted them. This allowed the handover between the static typography and the Matter.js engine to be perfectly consistent and highly performant, no matter how many words were falling.



## License

Licensed under the MIT License.
