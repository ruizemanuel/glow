// Vista estática de la fase 2: objetivos de las formas con calor fijo, sin simulación. Clic alterna la forma.
import { CONFIG } from './config';
import { createRenderer } from './render/renderer';
import { buildShapes, type ShapeGroup } from './shapes/build';
import { rasterizePaths } from './shapes/raster';
import { KIND_HALO, KIND_VOLUME } from './shapes/sample';
import { computeLayout, type Layout } from './view';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const shapes = buildShapes(rasterizePaths, CONFIG.particles.nMax, CONFIG);
const renderer = createRenderer(canvas, CONFIG.particles.nMax, CONFIG);
const instances = new Float32Array(CONFIG.particles.nMax * 5);
let showWord = new URLSearchParams(location.search).get('shape') === 'word';
let count = 0;

function fill(layout: Layout): number {
  const scale = showWord ? layout.wordScale : 1;
  const set = showWord ? shapes.word : shapes.iso;
  const groups: Array<[ShapeGroup, number]> = [
    [set.body, 0.9],
    [set.dot, 1.8],
  ];
  let n = 0;
  for (const [group, heat] of groups) {
    const e = group.embedded;
    for (let i = 0; i < group.points.count; i++) {
      const kind = group.points.kind[i];
      const o = n * 5;
      instances[o] = e.tx[i] * scale;
      instances[o + 1] = e.ty[i] * scale;
      instances[o + 2] = e.tz[i] * scale;
      instances[o + 3] = CONFIG.render.particleRadius * 0.8;
      instances[o + 4] = kind === KIND_HALO ? 0.25 : kind === KIND_VOLUME ? 0.35 : heat;
      n++;
    }
  }
  return n;
}

function resize(): void {
  const layout = computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, shapes, CONFIG);
  renderer.resize(layout);
  count = fill(layout);
}

function frame(now: number): void {
  renderer.render({ instances, count, yaw: 0, pitch: 0, time: now / 1000, fade: 1 });
  requestAnimationFrame(frame);
}

canvas.addEventListener('click', () => {
  showWord = !showWord;
  resize();
});
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
