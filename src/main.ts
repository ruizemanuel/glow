// Loop de la fase 3: simulación completa con transición por clic. El pulido (a11y, perf, errores) llega en la tarea 15.
import { CONFIG } from './config';
import { createRenderer } from './render/renderer';
import { buildShapes } from './shapes/build';
import { rasterizePaths } from './shapes/raster';
import { createSim, setLayout, stepSim, writeInstances } from './sim/step';
import { initialState, reduce, type SceneState } from './sim/state';
import { computeLayout, screenToWorld } from './view';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const hint = document.getElementById('hint') as HTMLButtonElement;
const shapes = buildShapes(rasterizePaths, CONFIG.particles.nMax, CONFIG);
const measure = () => computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, shapes, CONFIG);
let layout = measure();
const sim = createSim(shapes, layout, layout.mobile ? CONFIG.particles.capMobile : CONFIG.particles.capDesktop, false, CONFIG);
const renderer = createRenderer(canvas, sim.particles.capacity, CONFIG);
renderer.resize(layout);
const instances = new Float32Array(sim.particles.capacity * 5);
let state: SceneState = initialState();

const toggle = () => {
  state = reduce(state, { type: 'toggle' }, CONFIG.timing);
};
canvas.addEventListener('click', toggle);
hint.addEventListener('click', toggle);
canvas.addEventListener('pointermove', (e) => {
  const [x, y] = screenToWorld(layout, e.clientX, e.clientY);
  sim.pointer.active = true;
  sim.pointer.x = x;
  sim.pointer.y = y;
  sim.pointer.nx = (e.clientX / window.innerWidth - 0.5) * 2;
  sim.pointer.ny = (e.clientY / window.innerHeight - 0.5) * 2;
});
canvas.addEventListener('pointerleave', () => {
  sim.pointer.active = false;
});
window.addEventListener('resize', () => {
  layout = measure();
  setLayout(sim, layout);
  renderer.resize(layout);
});

let last = 0;
function frame(now: number): void {
  const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, 1 / 30);
  last = now;
  state = reduce(state, { type: 'tick', dt }, CONFIG.timing);
  stepSim(sim, state, dt, false);
  const count = writeInstances(sim, instances);
  renderer.render({ instances, count, yaw: sim.tilt.yaw, pitch: sim.tilt.pitch, time: sim.time, fade: 1 });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
