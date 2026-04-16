/**
 * app.js — Application entry point
 *
 * Responsibilities:
 *   1. Three.js  — spins up a fullscreen WebGL renderer for the background shader
 *   2. Barba.js  — intercepts navigation so page transitions are animated instead
 *                  of hard reloads
 *   3. GSAP      — powers the enter/leave animations for each transition
 *   4. Nav state — keeps the active nav link in sync with the current page
 *
 * Because <canvas> and <header> live outside the Barba wrapper, they persist
 * across every transition — only the page content swaps.
 *
 * Note on imports:
 *   Three.js is pulled in via the importmap defined in each HTML file.
 *   GSAP and Barba are loaded as ES modules from their own script tags (also
 *   via the same importmap), so they're available as normal imports here.
 */

import * as THREE from 'three';
import gsap        from 'gsap';
import barba       from '@barba/core';

import { vertexShader, fragmentShader } from './shaders.js';

// =============================================================================
//  Three.js — Background Shader
// =============================================================================

const canvas   = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
const scene    = new THREE.Scene();

// Orthographic camera + PlaneGeometry(2,2) fills the clip-space exactly.
// This is the standard "fullscreen quad" technique — identical in concept to a
// fullscreen quad in a game engine.
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

const uniforms = {
  uTime:       { value: 0.0 },
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
};

scene.add(
  new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
  )
);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
}
onResize();
window.addEventListener('resize', onResize);

// Main render loop — runs continuously in the background
const clock = new THREE.Clock();
(function tick() {
  requestAnimationFrame(tick);
  uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
})();

// =============================================================================
//  Active Navigation State
// =============================================================================

/**
 * Maps the data-barba-namespace on each page's container to the href used
 * in the nav. Update these if you add or rename pages.
 */
const NAMESPACE_TO_HREF = {
  home:     'index.html',
  about:    'about.html',
  partners: 'partners.html',
  contact:  'contact.html',
};

function setActiveNav(namespace) {
  const target = NAMESPACE_TO_HREF[namespace];
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === target);
  });
}

// =============================================================================
//  Barba.js — Page Transitions
// =============================================================================

// Height of the outgoing panel, captured in `leave` and consumed in `enter`
// so the incoming panel can animate from the right starting size.
let prevPanelHeight = null;

barba.init({
  // Ignore links that point outside the site
  prevent: ({ el }) => el.hostname !== window.location.hostname,

  transitions: [
    {
      name: 'slide-fade',

      // Run leave and enter at the same time so old content fades out while
      // new content is already animating in.
      sync: true,

      /**
       * `once` fires exactly once, on the very first page load.
       * Animates the initial content in so the site never just "pops" into view.
       */
      once({ next }) {
        setActiveNav(next.namespace);
        const panel = next.container.querySelector('.content-panel');

        return gsap.from(panel.children, {
          opacity:    0,
          y:          -100,
          duration:   0.5,
          ease:       'power2.out',
          clearProps: 'all',
        });
      },

      /**
       * `leave` fades the current page out over 0.25 s.
       * Runs simultaneously with `enter` because sync: true is set above.
       *
       * With sync mode both containers are in the DOM at the same time. Locking
       * the outgoing container to its current screen position (fixed) removes it
       * from normal flow so the incoming container can lay out correctly.
       */
      leave({ current }) {
        // Snapshot the panel's natural height for the enter animation.
        prevPanelHeight = current.container.querySelector('.content-panel')?.offsetHeight ?? null;

        const { top, left, width } = current.container.getBoundingClientRect();
        Object.assign(current.container.style, {
          position:      'fixed',
          top:           top + 'px',
          left:          left + 'px',
          width:         width + 'px',
          margin:        '0',
          zIndex:        '5',
          pointerEvents: 'none',
        });
        return gsap.to(current.container, {
          opacity:  0,
          duration: 0.25,
          ease:     'power2.out',
        });
      },

      /**
       * `enter` runs two animations in parallel via a timeline:
       *   1. The panel background resizes from the outgoing page's height to its own.
       *   2. The sections inside fade in and slide down from 100 px above.
       */
      enter({ next }) {
        setActiveNav(next.namespace);
        window.scrollTo(0, 0);

        const panel        = next.container.querySelector('.content-panel');
        const targetHeight = panel.offsetHeight;
        const fromHeight   = prevPanelHeight ?? targetHeight;

        const tl = gsap.timeline();

        // Panel shell: height-only animation, no positional movement
        tl.from(panel, {
          height:     fromHeight,
          duration:   0.5,
          ease:       'power2.out',
          clearProps: 'height',
        }, 0);

        // Content inside: fade + slide down from above
        tl.from(panel.children, {
          opacity:    0,
          y:          -100,
          duration:   0.5,
          ease:       'power2.out',
          clearProps: 'all',
        }, 0);

        return tl;
      },
    },
  ],
});
