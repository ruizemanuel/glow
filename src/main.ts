// Vista de depuración de la fase 1: puntos crudos de las formas con Canvas 2D.
// Blanco = surface, gris = volume, naranja = rim, azul = halo, amarillo = punto. Clic alterna la forma.
import { CONFIG } from './config';
import { buildShapes, type ShapeGroup } from './shapes/build';
import { rasterizePaths } from './shapes/raster';
import { computeLayout, projectToScreen } from './view';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is unavailable.');
const shapes = buildShapes(rasterizePaths, CONFIG.particles.nMax, CONFIG);
let showWord = new URLSearchParams(location.search).get('shape') === 'word';
const colors = ['#ffffff', '#777777', '#ff4d00', '#3399ff'];

function draw(): void {
  const layout = computeLayout(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, shapes, CONFIG);
  canvas.width = layout.width;
  canvas.height = layout.height;
  ctx!.fillStyle = '#000';
  ctx!.fillRect(0, 0, layout.width, layout.height);
  const scale = showWord ? layout.wordScale : 1;
  const plot = (group: ShapeGroup, isDot: boolean) => {
    const e = group.embedded;
    for (let i = 0; i < group.points.count; i++) {
      const [px, py] = projectToScreen(layout, CONFIG.camDist, e.tx[i] * scale, e.ty[i] * scale, e.tz[i] * scale);
      ctx!.fillStyle = isDot ? '#ffd400' : colors[group.points.kind[i]];
      ctx!.fillRect(px, py, layout.dpr, layout.dpr);
    }
  };
  const set = showWord ? shapes.word : shapes.iso;
  plot(set.body, false);
  plot(set.dot, true);
}

canvas.addEventListener('click', () => {
  showWord = !showWord;
  draw();
});
window.addEventListener('resize', draw);
draw();
