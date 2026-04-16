# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static marketing site for the Deveraux Family Foundation. No build step — files are served directly to the browser. Deployed to Netlify from the repo root.

## Development

Open HTML files directly in a browser or use any static file server:

```bash
# Option 1: Python
python -m http.server 8080

# Option 2: Node
npx serve .
```

There is no package.json, no bundler, and no compilation step.

## Architecture

### File Layout

```
index.html / about.html / partners.html / contact.html
css/style.css      — single stylesheet (all pages)
js/app.js          — single JS entry point (all pages)
js/shaders.js      — WebGL vertex + fragment shader source strings
assets/            — images go here (currently empty / placeholder)
netlify.toml       — deployment + cache + security headers
```

### How Pages Work

All four HTML files share an identical shell. The only differences are the page title, meta description, `data-barba-namespace` attribute on `<main>`, and the content inside `.content-panel`.

Barba.js intercepts navigation, runs GSAP transitions (fade/slide), and swaps only the `<main data-barba="container">` element. The `<canvas>` and `<header>` persist across transitions — never duplicate or re-initialize them in page-specific code.

Dependencies are loaded from CDN via a `<script type="importmap">` in each HTML file. All three libraries (Three.js, GSAP, Barba.js) are pinned to specific versions there.

### Background Renderer (app.js + shaders.js)

The animated background is a fullscreen quad rendered by Three.js using a custom ShaderMaterial. The fragment shader in `shaders.js` blends three brand colors using layered procedural noise driven by a `uTime` uniform. Tuning the look means adjusting noise frequencies, blend weights, or the color mix in the fragment shader.

### CSS Conventions

All brand colors and layout measurements are CSS custom properties on `:root` in `style.css`. Use those variables — don't hardcode values. The frosted-glass `.content-panel` uses `backdrop-filter: blur()` over the canvas; keep panel backgrounds semi-transparent so the animation shows through.

### Placeholders Still Needing Real Content

- **Logo:** Replace `.logo-text` span with `<img src="assets/logo.png">` once the asset exists
- **Team headshots:** Replace SVG silhouette placeholders with `<img src="assets/headshot-[name].jpg">`
- **Partner logos:** Replace "Logo" placeholder text with `<img src="assets/partner-[name].png">`
- **Contact email:** `foundation@example.com` in `contact.html`
- **LinkedIn URL:** `PLACEHOLDER` href in `contact.html`
