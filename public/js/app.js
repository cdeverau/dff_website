/**
 * app.js — Three.js background, Barba page transitions (with GSAP), nav state.
 *
 * Persistent across transitions: <canvas>, <header>, and .content-panel.
 * Only <main data-barba="container"> swaps. Imports resolve via the
 * importmap in each HTML file.
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

// Standard fullscreen-quad: orthographic camera + 2x2 plane fills clip space.
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

const clock = new THREE.Clock();
(function tick() {
  requestAnimationFrame(tick);
  uniforms.uTime.value = clock.getElapsedTime();
  renderer.render(scene, camera);
})();

// =============================================================================
//  Active Navigation State
// =============================================================================

// Maps data-barba-namespace → nav link href. Update when adding/renaming pages.
const NAMESPACE_TO_HREF = {
  home:     'index.html',
  about:    'about.html',
  partners: 'partners.html',
  contact:  'contact.html',
};

// Used by once() and enter() — the source of truth for popstate + initial load.
function setActiveNav(namespace) {
  const target = NAMESPACE_TO_HREF[namespace];
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === target);
  });
}

// Used by the click handler to mark active *before* Barba's fetch+enter runs,
// so a quick double-click is caught by the "already active" guard.
function setActiveNavFromLink(link) {
  if (!link.classList.contains('nav-link')) return;
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l === link);
  });
}

// =============================================================================
//  Barba.js — Page Transitions
// =============================================================================
//
// .content-panel is persistent (lives OUTSIDE data-barba="container"). Only
// the <main> inside swaps. This lets us animate one panel's height between
// pages, cross-fade only the section children, and handle spam-click
// collisions without ever touching the panel's shadow.

// Height to animate the panel FROM on next enter; set by leave, read by enter.
let prevPanelHeight = null;

// Refs to the in-flight enter animation, held so the click-time collision
// handler can kill it and settle barba's promise before starting the next nav.
let activeEnterTl       = null;
let activeEnterResolve  = null;
let activeNextContainer = null;

// Persistent — safe to cache once.
const panel = document.querySelector('.content-panel');

barba.init({
  // Ignore links that point outside the site
  prevent: ({ el }) => el.hostname !== window.location.hostname,

  transitions: [
    {
      name: 'slide-fade',

      // Run leave + enter in parallel so old content fades while new slides in.
      sync: true,

      // Initial page load — fade the solid intro overlay out to reveal the
      // already-settled page. Only runs on real page loads (fresh tab or
      // refresh); Barba-driven nav uses leave/enter and never fires once.
      once({ next }) {
        setActiveNav(next.namespace);

        const overlay = document.getElementById('intro-overlay');
        if (!overlay) return;

        return gsap.to(overlay, {
          opacity:  0,
          duration: 1.0,
          ease:     'power2.out',
          onComplete() {
            overlay.remove();
            document.documentElement.classList.remove('show-intro');
          },
        });
      },

      // Lock the panel's current height, abs-position the outgoing <main>
      // inside it so only the incoming drives layout, and fade outgoing sections.
      leave({ current }) {
        // If panel is mid-animation (collision case), its inline height is the
        // visible height. Otherwise read the outgoing <main>'s own height —
        // panel.offsetHeight at this point includes the incoming sibling.
        const lockedHeight = panel.style.height
          ? parseFloat(panel.style.height)
          : current.container.offsetHeight;

        prevPanelHeight    = lockedHeight;
        panel.style.height = lockedHeight + 'px';

        Object.assign(current.container.style, {
          position:      'absolute',
          top:           '0',
          left:          '0',
          width:         '100%',
          pointerEvents: 'none',
        });

        return gsap.to(current.container.children, {
          opacity:  0,
          y:        50,
          duration: 0.25,
          ease:     'power2.out',
        });
      },

      // Animate the persistent panel's height to its new natural value while
      // fading + sliding the incoming sections in from above.
      enter({ next }) {
        setActiveNav(next.namespace);
        window.scrollTo(0, 0);

        activeNextContainer = next.container;

        const fromHeight = prevPanelHeight ?? panel.offsetHeight;

        // Measure new natural height: clear the lock, read, restore — all
        // synchronous so no paint happens in between.
        const savedHeight  = panel.style.height;
        panel.style.height = '';
        const toHeight     = panel.offsetHeight;
        panel.style.height = savedHeight;

        return new Promise(resolve => {
          activeEnterResolve = resolve;

          activeEnterTl = gsap.timeline({
            onComplete() {
              activeEnterTl       = null;
              activeEnterResolve  = null;
              activeNextContainer = null;
              panel.style.height  = ''; // release lock — panel stays responsive
              resolve();
            },
          });

          activeEnterTl.fromTo(panel,
            { height: fromHeight },
            { height: toHeight, duration: 0.5, ease: 'power2.out' },
            0
          );

          activeEnterTl.from(next.container.children, {
            opacity:    0,
            y:          -100,
            duration:   0.5,
            ease:       'power2.out',
            clearProps: 'all',
          }, 0);
        });
      },
    },
  ],
});

let isTransitioning = false;

barba.hooks.before(() => { isTransitioning = true;  });
barba.hooks.after(()  => { isTransitioning = false; });

document.addEventListener('click', e => {
  const link = e.target.closest('a');
  if (!link || link.hostname !== window.location.hostname) return;

  // Swallow repeat clicks on the active link (also catches fast double-clicks,
  // since the active state is updated below before this handler returns).
  if (link.classList.contains('active')) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  if (isTransitioning) {
    e.preventDefault();
    e.stopImmediatePropagation();

    if (!activeEnterTl) return; // enter hasn't started yet — drop the click

    setActiveNavFromLink(link);

    // Snapshot + clear refs so the timeline's natural onComplete can't fire
    // after we've kicked off the collision fade.
    const tl        = activeEnterTl;
    const container = activeNextContainer;
    const resolve   = activeEnterResolve;
    const href      = link.getAttribute('href');
    activeEnterTl       = null;
    activeEnterResolve  = null;
    activeNextContainer = null;

    // Freeze enter at its current state, fade the incoming sections out from
    // there, then hand off to the next nav. Panel height stays locked so the
    // next transition picks up continuity; the shadow never flickers.
    tl.kill();
    gsap.to(container.children, {
      opacity:  0,
      duration: 0.05,
      ease:     'power2.in',
      onComplete() {
        resolve();                                          // settle barba's promise
        requestAnimationFrame(() => barba.go(href));        // defer a frame for barba cleanup
      },
    });
    return;
  }

  setActiveNavFromLink(link);
}, true);
