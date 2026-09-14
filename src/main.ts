import { CONFIG } from './config';
import { adaptCount, createPerf, recordFrame } from './perf';
import { WebGLUnavailableError } from './render/gl';
import { createRenderer, type Renderer } from './render/renderer';
import { buildShapes } from './shapes/build';
import { rasterizePaths } from './shapes/raster';
import { setActiveCount, setLayout, createSim, stepSim, writeInstances } from './sim/step';
import { initialState, reduce, type SceneState } from './sim/state';
import { computeLayout, screenToWorld } from './view';

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}.`);
  return el as T;
}

const canvas = element<HTMLCanvasElement>('scene');
const hint = element<HTMLButtonElement>('hint');
const fpsLabel = element<HTMLSpanElement>('fps');
const overlay = element<HTMLDivElement>('overlay');

function showError(message: string, error?: unknown): void {
  if (error) console.error(error);
  overlay.textContent = message;
  overlay.hidden = false;
  canvas.hidden = true;
  hint.hidden = true;
  fpsLabel.hidden = true;
}

function start(): void {
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  const timing = () => (reduced ? { intro: 0, morph: CONFIG.timing.morphReduced } : { intro: CONFIG.timing.intro, morph: CONFIG.timing.morph });

  const shapes = buildShapes(rasterizePaths, CONFIG.particles.nMax, CONFIG);
  const measure = () => computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, shapes, CONFIG);

  let layout = measure();
  const cap = () => (layout.mobile ? CONFIG.particles.capMobile : CONFIG.particles.capDesktop);
  const floor = () => (layout.mobile ? CONFIG.particles.minMobile : CONFIG.particles.minDesktop);

  const sim = createSim(shapes, layout, cap(), reduced, CONFIG);
  const perf = createPerf(sim.nActive);
  const instances = new Float32Array(sim.particles.capacity * 5);
  let state: SceneState = initialState();

  let renderer: Renderer = createRenderer(canvas, sim.particles.capacity, CONFIG);
  renderer.resize(layout);
  let contextLost = false;

  const isTouch = matchMedia('(pointer: coarse)').matches;
  const updateLabels = () => {
    const onWord = state.phase === 'idleWord' || (state.phase === 'morph' && state.dir === 1);
    hint.textContent = `${isTouch ? 'tocá' : 'click'} para transformar`;
    canvas.setAttribute('aria-label', `Escultura de partículas con la forma ${onWord ? 'basement.' : 'b.'}`);
  };
  const toggle = () => {
    state = reduce(state, { type: 'toggle' }, timing());
    updateLabels();
  };
  updateLabels();

  // Entrada.
  let down: { x: number; y: number; t: number; id: number } | null = null;
  const movePointer = (e: PointerEvent) => {
    const [x, y] = screenToWorld(layout, e.clientX, e.clientY);
    sim.pointer.x = x;
    sim.pointer.y = y;
    sim.pointer.nx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth - 0.5) * 2));
    sim.pointer.ny = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight - 0.5) * 2));
    sim.pointer.active = e.pointerType === 'mouse' || down !== null;
  };
  canvas.addEventListener('pointermove', movePointer, { passive: true });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    if (e.pointerType !== 'mouse') canvas.setPointerCapture(e.pointerId);
    movePointer(e);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 500) toggle();
    down = null;
    if (e.pointerType !== 'mouse') sim.pointer.active = false;
  });
  canvas.addEventListener('pointercancel', () => {
    down = null;
    sim.pointer.active = false;
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') sim.pointer.active = false;
  });
  hint.addEventListener('click', toggle);
  window.addEventListener('keydown', (e) => {
    if (e.target === hint || e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      toggle();
    }
  });

  motionQuery.addEventListener('change', (e) => {
    reduced = e.matches;
  });

  const onResize = () => {
    layout = measure();
    setLayout(sim, layout);
    if (!contextLost) renderer.resize(layout);
    perf.nActive = Math.min(perf.nActive, cap());
    setActiveCount(sim, perf.nActive);
  };
  new ResizeObserver(onResize).observe(document.documentElement);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      renderer = createRenderer(canvas, sim.particles.capacity, CONFIG);
      renderer.resize(layout);
      contextLost = false;
    } catch (error) {
      showError('No se pudo recuperar el contexto gráfico.', error);
    }
  });

  // Loop.
  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    try {
      const frameMs = last ? now - last : 16.67;
      last = now;
      if (contextLost) return;
      const dt = Math.min(frameMs / 1000, 1 / 30);
      state = reduce(state, { type: 'tick', dt }, timing());
      stepSim(sim, state, dt, reduced);
      const count = writeInstances(sim, instances);
      const fade = reduced && state.phase === 'morph' ? Math.abs(1 - 2 * state.p) : 1;
      renderer.render({ instances, count, yaw: sim.tilt.yaw, pitch: sim.tilt.pitch, time: sim.time, fade });

      if (recordFrame(perf, frameMs)) fpsLabel.textContent = `${perf.fps} FPS`;
      if (!reduced && adaptCount(perf, dt, floor(), cap(), CONFIG.perf)) setActiveCount(sim, perf.nActive);
      if (state.phase !== 'morph') updateLabels();
    } catch (error) {
      cancelAnimationFrame(raf);
      showError('El experimento se detuvo por un error. Revisá la consola.', error);
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  });
  raf = requestAnimationFrame(frame);
}

try {
  start();
} catch (error) {
  if (error instanceof WebGLUnavailableError) showError('Este experimento necesita WebGL2.');
  else showError('No se pudo iniciar el experimento. Revisá la consola.', error);
}
