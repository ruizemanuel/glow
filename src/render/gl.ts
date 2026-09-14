export interface GLContext {
  gl: WebGL2RenderingContext;
  /** true si se puede renderizar a R16F; si no, se usa RGBA8 con el calor escalado. */
  floatTargets: boolean;
}

export class WebGLUnavailableError extends Error {}

export function createContext(canvas: HTMLCanvasElement): GLContext {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new WebGLUnavailableError('WebGL2 is not available.');
  const floatTargets = Boolean(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  return { gl, floatTargets };
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not allocate a shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

export function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Could not allocate a shader program.');
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertex);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader link failed: ${log}`);
  }
  return program;
}

export function uniforms(gl: WebGL2RenderingContext, program: WebGLProgram, names: string[]): Record<string, WebGLUniformLocation | null> {
  const out: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) out[name] = gl.getUniformLocation(program, name);
  return out;
}

export interface Target {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

export function createTarget(ctx: GLContext, width: number, height: number): Target {
  const { gl } = ctx;
  const texture = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!texture || !fbo) throw new Error('Could not allocate a render target.');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (ctx.floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, width, height, 0, gl.RED, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    throw new Error(`Render target is incomplete (0x${status.toString(16)}).`);
  }
  return { fbo, texture, width, height };
}

export function deleteTarget(gl: WebGL2RenderingContext, t: Target): void {
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.texture);
}

/** Vertex shader de triángulo a pantalla completa sin atributos (usa gl_VertexID). */
export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function drawFullscreen(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject): void {
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
