import type { Config } from '../config';
import { tiltMatrix, type Layout } from '../view';
import { createBloomPass, type BloomPass } from './bloom';
import { createCompositePass, type CompositePass } from './composite';
import { createContext, createTarget, deleteTarget, type GLContext, type Target } from './gl';
import { createParticlePass, type ParticlePass } from './particles';

export interface FrameInput {
  instances: Float32Array;
  count: number;
  yaw: number;
  pitch: number;
  time: number;
  fade: number;
}

export interface Renderer {
  readonly ctx: GLContext;
  resize(layout: Layout): void;
  render(frame: FrameInput): void;
  dispose(): void;
}

export function createRenderer(canvas: HTMLCanvasElement, capacity: number, cfg: Config): Renderer {
  const ctx = createContext(canvas);
  const { gl } = ctx;
  const particles: ParticlePass = createParticlePass(ctx, capacity);
  const bloom: BloomPass = createBloomPass(ctx);
  const composite: CompositePass = createCompositePass(ctx);
  let heat: Target | null = null;
  let layout: Layout | null = null;

  return {
    ctx,
    resize(next) {
      layout = next;
      if (canvas.width !== next.width) canvas.width = next.width;
      if (canvas.height !== next.height) canvas.height = next.height;
      if (heat) deleteTarget(gl, heat);
      heat = createTarget(ctx, next.width, next.height);
      bloom.resize(next.width, next.height);
    },
    render(frame) {
      if (!heat || !layout || gl.isContextLost()) return;
      particles.draw(heat, frame.instances, frame.count, {
        tilt: tiltMatrix(frame.yaw, frame.pitch),
        camDist: cfg.camDist,
        pxPerUnit: layout.pxPerUnit,
        centerX: layout.centerX,
        centerY: layout.centerY,
        minRadiusPx: cfg.render.minRadiusPx * layout.dpr,
      });
      const glow = bloom.run(heat);
      composite.draw(heat, glow, layout.width, layout.height, {
        bloomStrength: cfg.render.bloomStrength,
        exposure: cfg.render.exposure,
        grain: cfg.render.grain,
        time: frame.time,
        fade: frame.fade,
      });
    },
    dispose() {
      if (heat) deleteTarget(gl, heat);
      particles.dispose();
      bloom.dispose();
      composite.dispose();
    },
  };
}
