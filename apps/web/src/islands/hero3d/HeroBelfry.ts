/**
 * Hero : le Beffroi de Mons, silhouette procédurale (trois ordres superposés, tourelles d'angle, bulbe,
 * lanterne et flèche), arêtes au trait, anneau de points (le carillon), grille au sol, balayage vertical.
 * Rendu deux passes (scène → RT [R = luminance, G = accent] → trame Bayer 8×8), repris de prototypes/motion-lab.
 *
 * Géométrie procédurale ; voir assets/3d/README.md pour brancher un GLB Blender.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ColorManagement,
  CylinderGeometry,
  EdgesGeometry,
  GridHelper,
  Group,
  LatheGeometry,
  LinearSRGBColorSpace,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { deg, fmtSweep, POSTER_TIME, rotY, sweepAt } from './poster';
import { belfryFragment, belfryVertex, postFragment, postVertex } from './shaders';

export interface HeroInput {
  scroll: number;
  mx: number;
  my: number;
}

export interface HeroHud {
  fps?: HTMLElement | null;
  rot?: HTMLElement | null;
  sweep?: HTMLElement | null;
  px?: HTMLElement | null;
}

export interface HeroOptions {
  /** Élément dimensionné (ResizeObserver) qui reçoit le canvas. */
  container: HTMLElement;
  hud?: HeroHud;
  getInput?: () => HeroInput;
  /** DPR imposé (sinon devicePixelRatio plafonné à 1.5 mobile / 2 bureau). */
  pixelRatio?: number;
  /** Plafond de fps (sinon 30 sur mobile / pointeur grossier, illimité ailleurs). */
  maxFps?: number;
  /** Rendu figé à POSTER_TIME, sans boucle (poster headless). */
  still?: boolean;
  preserveDrawingBuffer?: boolean;
  /** Appelé après le premier frame affiché (déclenche le fondu poster → canvas). */
  onFirstFrame?: (canvas: HTMLCanvasElement) => void;
  /** Contexte WebGL perdu : l'appelant réaffiche le poster. */
  onContextLost?: () => void;
}

export interface HeroInstance {
  canvas: HTMLCanvasElement;
  dispose: () => void;
}

const FG = 0xeaeaea;
const BG = 0x0b0b0b;
const ACCENT = 0xff2a2a;
/** Pied du beffroi, posé sur la grille. */
const GROUND = -1.75;
/** Échelle globale : la flèche s'arrête sous le bord haut du cadre. */
const SCALE = 0.84;

/** Profil de bulbe (rayon, hauteur) normalisé : base, panse, col, pointe. */
const BULB: [number, number][] = [
  [0.82, 0],
  [1, 0.16],
  [0.96, 0.36],
  [0.62, 0.62],
  [0.3, 0.84],
  [0.16, 1],
];

function bulb(radius: number, height: number, y: number, segments = 8): BufferGeometry {
  const g = new LatheGeometry(
    BULB.map(([r, h]) => new Vector2(r * radius, h * height)),
    segments,
  );
  g.translate(0, y, 0);
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return g;
}

function cyl(r: number, h: number, y: number, segments = 8, x = 0, z = 0): BufferGeometry {
  const g = new CylinderGeometry(r, r, h, segments);
  g.rotateY(Math.PI / segments);
  g.translate(x, y + h / 2, z);
  return g;
}

function cone(r: number, h: number, y: number, x = 0, z = 0): BufferGeometry {
  const g = new CylinderGeometry(0, r, h, 6);
  g.translate(x, y + h / 2, z);
  return g;
}

/**
 * Beffroi en unités locales (pied à y = 0) : trois niveaux en retrait séparés de corniches,
 * pilastres d'angle et baies sur chaque face, quatre tourelles, tambour octogonal, bulbe,
 * lanterne, petit bulbe et flèche. Facettes octogonales assumées : la trame 1-bit les lit mieux que du lisse.
 */
function buildBelfry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const tiers = [
    { w: 0.86, h: 0.85 },
    { w: 0.8, h: 0.7 },
    { w: 0.74, h: 0.62 },
  ];
  let y = 0;
  for (const [i, t] of tiers.entries()) {
    parts.push(box(t.w, t.h, t.w, 0, y, 0));
    const half = t.w / 2;
    // Pilastres d'angle.
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) parts.push(box(0.07, t.h, 0.07, sx * (half - 0.02), y, sz * (half - 0.02)));
    // Baies : un cadre en saillie au centre de chaque face (deux par face au niveau du bas).
    const bays = i === 0 ? [-0.17, 0.17] : [0];
    const bw = i === 0 ? 0.16 : 0.2;
    const bh = t.h * 0.55;
    const by = y + t.h * 0.22;
    for (const o of bays) {
      parts.push(box(bw, bh, 0.02, o, by, half + 0.01));
      parts.push(box(bw, bh, 0.02, o, by, -half - 0.01));
      parts.push(box(0.02, bh, bw, half + 0.01, by, o));
      parts.push(box(0.02, bh, bw, -half - 0.01, by, o));
    }
    y += t.h;
    const cw = i === tiers.length - 1 ? t.w + 0.1 : t.w + 0.08;
    const ch = i === tiers.length - 1 ? 0.06 : 0.05;
    parts.push(box(cw, ch, cw, 0, y, 0));
    y += ch;
  }
  // Tourelles d'angle : fût, petit bulbe, aiguille.
  const c = 0.33;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      parts.push(cyl(0.06, 0.2, y, 8, sx * c, sz * c));
      const tb = bulb(0.075, 0.18, y + 0.2);
      tb.translate(sx * c, 0, sz * c);
      parts.push(tb);
      parts.push(cone(0.012, 0.12, y + 0.38, sx * c, sz * c));
    }
  // Tambour, bulbe principal, lanterne, petit bulbe, flèche.
  parts.push(cyl(0.3, 0.22, y));
  y += 0.22;
  parts.push(bulb(0.36, 0.55, y));
  y += 0.55;
  parts.push(cyl(0.1, 0.18, y));
  y += 0.18;
  parts.push(bulb(0.12, 0.2, y));
  y += 0.2;
  parts.push(cone(0.016, 0.22, y));

  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  for (const g of parts) g.dispose();
  if (!merged) throw new Error('beffroi : fusion des géométries impossible');
  merged.scale(SCALE, SCALE, SCALE);
  merged.translate(0, GROUND, 0);
  return merged;
}

/** PRNG déterministe : l'anneau est identique entre poster et live. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZERO: HeroInput = { scroll: 0, mx: 0, my: 0 };

export function createHeroBelfry(opts: HeroOptions): HeroInstance {
  const { container, hud = {}, getInput = () => ZERO, still = false } = opts;
  const mobile = matchMedia('(pointer: coarse), (max-width: 767px)').matches;
  const dpr = opts.pixelRatio ?? Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
  const maxFps = opts.maxFps ?? (mobile ? 30 : 0);

  ColorManagement.enabled = false; // hex des tokens exacts en sortie
  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
  });
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 1);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'hero3d-canvas';

  /* ---- scène : R = luminance, G = masque accent ---- */
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.2, 6.4);
  const rig = new Group();
  scene.add(rig);

  const towerMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSweep: { value: 0 },
      uCam: { value: camera.position },
    },
    vertexShader: belfryVertex,
    fragmentShader: belfryFragment,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const towerGeo = buildBelfry();
  rig.add(new Mesh(towerGeo, towerMat));
  // Arêtes au trait (R = 1) : la silhouette reste lisible malgré la trame.
  const edgeGeo = new EdgesGeometry(towerGeo, 24);
  const edgeMat = new LineBasicMaterial({ color: new Color(1, 0, 0) });
  rig.add(new LineSegments(edgeGeo, edgeMat));

  const N = 180;
  const rand = mulberry32(0x4e4401);
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2;
    const r = 2.1 + (rand() - 0.5) * 0.08;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = (rand() - 0.5) * 0.06;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const ringGeo = new BufferGeometry();
  ringGeo.setAttribute('position', new BufferAttribute(pos, 3));
  const ringMat = new PointsMaterial({ color: new Color(0, 1, 0), size: 3 * dpr, sizeAttenuation: false });
  const ring = new Points(ringGeo, ringMat);
  ring.position.y = 0.55; // à hauteur de la chambre des cloches
  ring.rotation.x = 0.32;
  ring.rotation.z = -0.12;
  rig.add(ring);

  const grid = new GridHelper(18, 24, new Color(0, 0.55, 0), new Color(0, 0.38, 0));
  grid.position.y = GROUND;
  scene.add(grid);

  /* ---- post : tramage ordonné 1-bit ---- */
  const rt = new WebGLRenderTarget(2, 2, { depthBuffer: true });
  const post = new ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture },
      uRes: { value: new Vector2(1, 1) },
      uPx: { value: 3 },
      uFg: { value: new Color().setHex(FG) },
      uBg: { value: new Color().setHex(BG) },
      uAc: { value: new Color().setHex(ACCENT) },
    },
    vertexShader: postVertex,
    fragmentShader: postFragment,
    depthTest: false,
    depthWrite: false,
  });
  const pScene = new Scene();
  const pCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new PlaneGeometry(2, 2);
  pScene.add(new Mesh(quadGeo, post));

  /* ---- frame ---- */
  let rx = 0;
  let ry = 0;
  let lastRot = '';
  let lastSweep = '';
  const frame = (t: number, dt: number) => {
    const H = getInput();
    const k = dt > 0 ? Math.min(1, dt * 3) : 1;
    rx += (H.mx - rx) * k;
    ry += (H.my - ry) * k;
    rig.rotation.y = rotY(t, rx);
    rig.rotation.x = ry * 0.1 + H.scroll * 0.25;
    ring.rotation.y = t * 0.22;
    rig.position.y = H.scroll * 1.1;
    camera.position.y = 0.2 - ry * 0.25;
    camera.lookAt(0, H.scroll * 1.1 * 0.5, 0);
    const sw = sweepAt(t);
    (towerMat.uniforms.uTime as { value: number }).value = t;
    (towerMat.uniforms.uSweep as { value: number }).value = sw;
    grid.position.z = (t * 0.35) % 0.5;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(pScene, pCam);
    const rot = `${deg(rig.rotation.y)}° / ${deg(rig.rotation.x)}°`;
    if (hud.rot && rot !== lastRot) hud.rot.textContent = lastRot = rot;
    const s = fmtSweep(sw);
    if (hud.sweep && s !== lastSweep) hud.sweep.textContent = lastSweep = s;
  };

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w < 600 ? 8.2 : 6.4;
    camera.updateProjectionMatrix();
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    rt.setSize(bw, bh);
    (post.uniforms.uRes as { value: Vector2 }).value.set(bw, bh);
    const px = Math.max(2, Math.round(2 * dpr));
    (post.uniforms.uPx as { value: number }).value = px;
    if (hud.px) hud.px.textContent = String(px);
    if (!running) frame(time, 0); // garde l'image juste même en pause / figée
  };

  /* ---- boucle : pause hors écran et onglet caché, plafond fps mobile ---- */
  let time = POSTER_TIME;
  let running = false;
  let visible = true;
  let prev = 0;
  let since = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;
  let first = true;
  const minStep = maxFps > 0 ? 1 / maxFps - 0.002 : 0;

  const tick = (now: number) => {
    const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0;
    prev = now;
    since += dt;
    if (since < minStep) return;
    const step = since;
    since = 0;
    time += step;
    frame(time, step);
    fpsAcc += step;
    fpsFrames++;
    if (fpsAcc >= 0.5) {
      if (hud.fps) hud.fps.textContent = String(Math.round(fpsFrames / fpsAcc)).padStart(2, '0');
      fpsAcc = 0;
      fpsFrames = 0;
    }
    if (first) {
      first = false;
      opts.onFirstFrame?.(canvas);
    }
  };
  const sync = () => {
    const should = !still && visible && !document.hidden && !disposed;
    if (should === running) return;
    running = should;
    prev = 0;
    renderer.setAnimationLoop(should ? tick : null);
  };

  let disposed = false;
  container.prepend(canvas);
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      sync();
    },
    { threshold: 0 },
  );
  io.observe(container);
  document.addEventListener('visibilitychange', sync);

  const lost = (e: Event) => {
    e.preventDefault();
    opts.onContextLost?.();
  };
  canvas.addEventListener('webglcontextlost', lost);

  if (still) {
    frame(POSTER_TIME, 0);
    opts.onFirstFrame?.(canvas);
  } else sync();

  return {
    canvas,
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('webglcontextlost', lost);
      for (const g of [towerGeo, edgeGeo, ringGeo, quadGeo]) g.dispose();
      for (const m of [towerMat, edgeMat, ringMat, post]) m.dispose();
      grid.geometry.dispose();
      (grid.material as { dispose: () => void }).dispose();
      rt.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
