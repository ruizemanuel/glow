import { createProgram, uniforms, type GLContext, type Target } from './gl';

const VS = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aPos;
layout(location = 2) in float aRadius;
layout(location = 3) in float aHeat;
uniform mat3 uTilt;
uniform float uCamDist;
uniform float uPxPerUnit;
uniform vec2 uCenter;
uniform vec2 uResolution;
uniform float uMinRadiusPx;
out vec2 vUv;
out float vHeat;
void main() {
  vec3 p = uTilt * aPos;
  float s = uCamDist / max(1.6, uCamDist - p.z);
  vec2 center = uCenter + vec2(p.x, -p.y) * s * uPxPerUnit;
  float radiusPx = aRadius * s * uPxPerUnit;
  float r = max(uMinRadiusPx, radiusPx);
  float shrink = min(1.0, radiusPx / uMinRadiusPx);
  vec2 pixel = center + aCorner * r;
  vec2 clip = pixel / uResolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aCorner;
  vHeat = aHeat * shrink * shrink;
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vHeat;
uniform float uHeatScale;
out vec4 outColor;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float h = vHeat * (0.75 * exp(-r2 * 18.0) + 0.25 * exp(-r2 * 3.5)) * (1.0 - r2);
  outColor = vec4(h * uHeatScale, 0.0, 0.0, 1.0);
}`;

export interface ParticleUniforms {
  tilt: Float32Array;
  camDist: number;
  pxPerUnit: number;
  centerX: number;
  centerY: number;
  minRadiusPx: number;
}

export interface ParticlePass {
  draw(target: Target, instances: Float32Array, count: number, u: ParticleUniforms): void;
  dispose(): void;
}

export function createParticlePass(ctx: GLContext, capacity: number): ParticlePass {
  const { gl } = ctx;
  const program = createProgram(gl, VS, FS);
  const loc = uniforms(gl, program, ['uTilt', 'uCamDist', 'uPxPerUnit', 'uCenter', 'uResolution', 'uMinRadiusPx', 'uHeatScale']);
  const vao = gl.createVertexArray();
  const corners = gl.createBuffer();
  const instances = gl.createBuffer();
  if (!vao || !corners || !instances) throw new Error('Could not allocate particle buffers.');

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * 5 * 4, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 12);
  gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 20, 16);
  gl.vertexAttribDivisor(3, 1);
  gl.bindVertexArray(null);

  return {
    draw(target, data, count, u) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count === 0) return;
      gl.useProgram(program);
      gl.uniformMatrix3fv(loc.uTilt, false, u.tilt);
      gl.uniform1f(loc.uCamDist, u.camDist);
      gl.uniform1f(loc.uPxPerUnit, u.pxPerUnit);
      gl.uniform2f(loc.uCenter, u.centerX, u.centerY);
      gl.uniform2f(loc.uResolution, target.width, target.height);
      gl.uniform1f(loc.uMinRadiusPx, u.minRadiusPx);
      gl.uniform1f(loc.uHeatScale, ctx.floatTargets ? 1 : 0.25);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instances);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * 5);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(corners);
      gl.deleteBuffer(instances);
    },
  };
}
