/**
 * shaders.js — WebGL shader source strings
 *
 * These are passed directly into Three.js ShaderMaterial. Isolating them here
 * means you can iterate on the visual without touching app.js.
 *
 * The /* glsl *\/ comment before each template literal is a hint for editor
 * plugins (e.g. "Comment tagged templates" in VS Code) to give you GLSL
 * syntax highlighting.
 */

// ── Vertex Shader ─────────────────────────────────────────────────────────────
// Passthrough — all interesting work happens in the fragment shader.
// `vUv` carries the 0→1 UV coordinates to the fragment stage.
export const vertexShader = /* glsl */`
  varying vec2 vUv;

  void main() {
    vUv        = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// ── Fragment Shader ───────────────────────────────────────────────────────────
// Renders a very slow, soft animated gradient in the foundation's brand palette.
// The effect is intentionally subtle — it should read as a warm, living backdrop
// rather than compete with the content panel in the foreground.
//
// Uniforms fed in from app.js:
//   uTime       — seconds since page load (drives animation)
//   uResolution — viewport dimensions in pixels (available for aspect-ratio maths)
//
// Good starting points for experimentation:
//   • Change the `strength` value to make the colour wash stronger or weaker.
//   • Swap `teal`, `blue`, `green` for different hex-to-float values.
//   • Adjust the frequency multipliers on `uv` (the 2.5, 1.8, 3.2 etc.) to
//     change the scale of the pattern.
//   • Slow down or speed up by multiplying uTime by a smaller/larger constant.
export const fragmentShader = /* glsl */`
  uniform float uTime;
  uniform vec2  uResolution;
  varying vec2  vUv;

  // Smooth, tileable wave-based noise — no texture lookups required.
  // Returns a value in [0, 1].
  float smoothNoise(vec2 p) {
    return sin(p.x * 2.1 + sin(p.y * 1.7 + uTime * 0.08))
         * cos(p.y * 1.9 + cos(p.x * 2.3 - uTime * 0.065))
         * 0.5 + 0.5;
  }

  void main() {
    vec2 uv = vUv;

    // ── Base colour — mirrors --clr-bg in style.css ───────────────────────
    vec3 base  = vec3(0.933, 0.953, 0.945);   // #EEF3F1

    // ── Brand accent hues ─────────────────────────────────────────────────
    vec3 teal  = vec3(0.173, 0.471, 0.451);   // #2C7873
    vec3 blue  = vec3(0.290, 0.565, 0.643);   // #4A90A4
    vec3 green = vec3(0.322, 0.718, 0.533);   // #52B788

    // Three independent noise layers at different scales and speeds
    float n1 = smoothNoise(uv * 2.5);
    float n2 = smoothNoise(uv * 1.8 + vec2(3.71, 1.29));
    float n3 = smoothNoise(uv * 3.2 - vec2(1.13, 2.44));

    // Blend the three accent colours together using the noise layers
    vec3 accent = mix(teal,   blue,  n1);
    accent      = mix(accent, green, n2 * 0.42);

    // How strongly the accent bleeds over the base — keep this low for subtlety
    float strength = 0.11 + n3 * 0.07;

    vec3 color = mix(base, accent, strength);

    gl_FragColor = vec4(color, 1.0);
  }
`;
