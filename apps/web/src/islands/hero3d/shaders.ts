/**
 * Shaders du hero (post-traitement porté à l'identique depuis prototypes/motion-lab).
 * Passe 1 (scène → render target) : R = luminance, G = masque accent.
 * Passe 2 (plein écran) : tramage ordonné Bayer 8×8, 1-bit phosphore + accent, cellules de `uPx` pixels.
 */

export const belfryVertex = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Éclairage plat (normales de facettes par dérivées écran), assises de pierre défilantes,
// bande d'accent du balayage vertical. Les arêtes sont tracées à part (LineSegments).
export const belfryFragment = /* glsl */ `
uniform float uTime;
uniform float uSweep;
uniform vec3 uCam;
varying vec3 vW;
void main() {
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 V = normalize(uCam - vW);
  if (dot(n, V) < 0.0) n = -n;
  vec3 L = normalize(vec3(-0.7, 0.8, 0.45));
  float dif = max(dot(n, L), 0.0);
  float lum = 0.07 + 0.8 * dif;
  lum += step(0.96, fract(vW.y * 11.0 - uTime * 0.2)) * 0.16;
  float band = smoothstep(0.035, 0.0, abs(vW.y - uSweep));
  gl_FragColor = vec4(clamp(lum, 0.0, 1.0), band, 0.0, 1.0);
}`;

export const postVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const postFragment = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uPx;
uniform vec3 uFg;
uniform vec3 uBg;
uniform vec3 uAc;
float b2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float b4(vec2 a) { return b2(0.5 * a) * 0.25 + b2(a); }
float b8(vec2 a) { return b4(0.5 * a) * 0.25 + b2(a); }
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uPx);
  vec2 uv = (cell * uPx + uPx * 0.5) / uRes;
  vec4 c = texture2D(tDiffuse, uv);
  float vig = smoothstep(1.05, 0.35, length((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0)) * 0.9);
  float lum = c.r * mix(0.55, 1.0, vig);
  float t = b8(cell) + 0.001;
  float on = step(t, lum);
  vec3 o = mix(uBg, uFg, on);
  float acc = step(t, c.g * 0.95);
  o = mix(o, uAc, acc);
  gl_FragColor = vec4(o, 1.0);
}`;
