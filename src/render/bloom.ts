import { createProgram, createTarget, deleteTarget, drawFullscreen, FULLSCREEN_VS, uniforms, type GLContext, type Target } from './gl';

const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 outColor;
float s(float x, float y) { return texture(uSrc, vUv + vec2(x, y) * uTexel).r; }
void main() {
  float e = s(0.0, 0.0);
  float corners = s(-2.0, 2.0) + s(2.0, 2.0) + s(-2.0, -2.0) + s(2.0, -2.0);
  float edges = s(0.0, 2.0) + s(-2.0, 0.0) + s(2.0, 0.0) + s(0.0, -2.0);
  float inner = s(-1.0, 1.0) + s(1.0, 1.0) + s(-1.0, -1.0) + s(1.0, -1.0);
  outColor = vec4(e * 0.125 + corners * 0.03125 + edges * 0.0625 + inner * 0.125, 0.0, 0.0, 1.0);
}`;

const UP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 outColor;
float s(float x, float y) { return texture(uSrc, vUv + vec2(x, y) * uTexel).r; }
void main() {
  float sum = s(-1.0, -1.0) + 2.0 * s(0.0, -1.0) + s(1.0, -1.0)
            + 2.0 * s(-1.0, 0.0) + 4.0 * s(0.0, 0.0) + 2.0 * s(1.0, 0.0)
            + s(-1.0, 1.0) + 2.0 * s(0.0, 1.0) + s(1.0, 1.0);
  outColor = vec4(sum / 16.0, 0.0, 0.0, 1.0);
}`;

export interface BloomPass {
  resize(width: number, height: number): void;
  /** Devuelve el nivel ½ con el bloom acumulado. */
  run(source: Target): Target;
  dispose(): void;
}

const LEVELS = 4;

export function createBloomPass(ctx: GLContext): BloomPass {
  const { gl } = ctx;
  const down = createProgram(gl, FULLSCREEN_VS, DOWN_FS);
  const up = createProgram(gl, FULLSCREEN_VS, UP_FS);
  const downLoc = uniforms(gl, down, ['uSrc', 'uTexel']);
  const upLoc = uniforms(gl, up, ['uSrc', 'uTexel']);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('Could not allocate the bloom vertex array.');
  let levels: Target[] = [];

  function pass(program: WebGLProgram, loc: Record<string, WebGLUniformLocation | null>, src: Target, dst: Target): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, dst.width, dst.height);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.texture);
    gl.uniform1i(loc.uSrc, 0);
    gl.uniform2f(loc.uTexel, 1 / src.width, 1 / src.height);
    drawFullscreen(gl, vao!);
  }

  return {
    resize(width, height) {
      levels.forEach((t) => deleteTarget(gl, t));
      levels = [];
      let w = width;
      let h = height;
      for (let i = 0; i < LEVELS; i++) {
        w = Math.max(1, Math.floor(w / 2));
        h = Math.max(1, Math.floor(h / 2));
        levels.push(createTarget(ctx, w, h));
      }
    },
    run(source) {
      gl.disable(gl.BLEND);
      pass(down, downLoc, source, levels[0]);
      for (let i = 1; i < LEVELS; i++) pass(down, downLoc, levels[i - 1], levels[i]);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = LEVELS - 1; i > 0; i--) pass(up, upLoc, levels[i], levels[i - 1]);
      gl.disable(gl.BLEND);
      return levels[0];
    },
    dispose() {
      levels.forEach((t) => deleteTarget(gl, t));
      gl.deleteProgram(down);
      gl.deleteProgram(up);
      gl.deleteVertexArray(vao);
    },
  };
}
