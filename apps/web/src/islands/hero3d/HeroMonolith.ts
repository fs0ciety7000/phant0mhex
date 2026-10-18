/**
 * Monolithe hero : dalle 1:4:9 (proportions 1.12 × 2.52 × 0.28), anneau de points, cube satellite,
 * grille au sol, balayage vertical. Rendu deux passes (scène → RT [R = luminance, G = accent] → trame Bayer 8×8).
 * Port fidèle de prototypes/motion-lab/index.html.
 *
 * Géométrie procédurale pour l'instant ; voir assets/3d/README.md pour brancher un GLB Blender.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ColorManagement,
  GridHelper,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { deg, fmtSweep, POSTER_TIME, rotY, sweepAt } from './poster';
import { monolithFragment, monolithVertex, postFragment, postVertex } from './shaders';

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
const HALF = new Vector3(0.56, 1.26, 0.14);

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

export function createHeroMonolith(opts: HeroOptions): HeroInstance {
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

  const monoMat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSweep: { value: 0 },
      uCam: { value: camera.position },
      uHalf: { value: HALF },
    },
    vertexShader: monolithVertex,
    fragmentShader: monolithFragment,
  });
  const monoGeo = new BoxGeometry(HALF.x * 2, HALF.y * 2, HALF.z * 2);
  rig.add(new Mesh(monoGeo, monoMat));

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
  ring.rotation.x = 0.32;
  ring.rotation.z = -0.12;
  rig.add(ring);

  const satGeo = new BoxGeometry(0.11, 0.11, 0.11);
  const satMat = new MeshBasicMaterial({ color: new Color(1, 1, 0) });
  const sat = new Mesh(satGeo, satMat);
  scene.add(sat);

  const grid = new GridHelper(18, 24, new Color(0, 0.55, 0), new Color(0, 0.38, 0));
  grid.position.y = -1.75;
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
    rig.position.y = H.scroll * 1.1 + Math.sin(t * 0.8) * 0.05;
    camera.position.y = 0.2 - ry * 0.25;
    camera.lookAt(0, H.scroll * 1.1 * 0.5, 0);
    const sw = sweepAt(t);
    (monoMat.uniforms.uTime as { value: number }).value = t;
    (monoMat.uniforms.uSweep as { value: number }).value = sw;
    sat.position.set(
      Math.cos(t * 0.9) * 2.1,
      Math.sin(t * 0.9) * 0.6 + H.scroll * 1.1,
      Math.sin(t * 0.9) * 2.1 * 0.92,
    );
    sat.rotation.set(t, t * 1.3, 0);
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
      for (const g of [monoGeo, ringGeo, satGeo, quadGeo]) g.dispose();
      for (const m of [monoMat, ringMat, satMat, post]) m.dispose();
      grid.geometry.dispose();
      (grid.material as { dispose: () => void }).dispose();
      rt.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
