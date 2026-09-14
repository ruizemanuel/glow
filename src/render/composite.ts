import { createProgram, drawFullscreen, FULLSCREEN_VS, uniforms, type GLContext, type Target } from './gl';
import { rampGlsl } from './ramp';

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uHeat;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uHeatUnscale;
uniform float uGrain;
uniform float uTime;
uniform float uFade;
out vec4 outColor;
${rampGlsl()}
void main() {
  float h = (texture(uHeat, vUv).r + uBloomStrength * texture(uBloom, vUv).r) * uHeatUnscale * uFade;
  float m = 1.0 - exp(-h * uExposure);
  vec3 color = ramp(m);
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  color += (n - 0.5) * 2.0 * uGrain * m;
  outColor = vec4(color, 1.0);
}`;

export interface CompositeUniforms {
  bloomStrength: number;
  exposure: number;
  grain: number;
  time: number;
  /** Opacidad global (fundido de movimiento reducido). */
  fade: number;
}

export interface CompositePass {
  draw(heat: Target, bloom: Target, width: number, height: number, u: CompositeUniforms): void;
  dispose(): void;
}

export function createCompositePass(ctx: GLContext): CompositePass {
  const { gl } = ctx;
  const program = createProgram(gl, FULLSCREEN_VS, FS);
  const loc = uniforms(gl, program, ['uHeat', 'uBloom', 'uBloomStrength', 'uExposure', 'uHeatUnscale', 'uGrain', 'uTime', 'uFade']);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('Could not allocate the composite vertex array.');
  return {
    draw(heat, bloom, width, height, u) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, heat.texture);
      gl.uniform1i(loc.uHeat, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bloom.texture);
      gl.uniform1i(loc.uBloom, 1);
      gl.uniform1f(loc.uBloomStrength, u.bloomStrength);
      gl.uniform1f(loc.uExposure, u.exposure);
      gl.uniform1f(loc.uHeatUnscale, ctx.floatTargets ? 1 : 4);
      gl.uniform1f(loc.uGrain, u.grain);
      gl.uniform1f(loc.uTime, u.time % 1000);
      gl.uniform1f(loc.uFade, u.fade);
      drawFullscreen(gl, vao);
      gl.activeTexture(gl.TEXTURE0);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
    },
  };
}
