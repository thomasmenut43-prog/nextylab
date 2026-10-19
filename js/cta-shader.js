// CTA final : fond en dégradé granuleux découpé en lamelles verticales, comme vu à travers un verre cannelé.
// Shader WebGL maison, aux couleurs de la marque ; le côté du texte reste sombre pour la lisibilité.
// Il ne se dessine que lorsque la section est à l'écran ; sans WebGL, le halo CSS reste en place.
(() => {
  const section = document.querySelector('.cta');
  const canvas = section && section.querySelector('.cta__shader');
  if (!canvas || !('IntersectionObserver' in window)) return;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) return;

  const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  const FRAG = `
    precision mediump float;
    uniform vec2 uRes;
    uniform float uTime;

    float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes; // (0, 0) en bas à gauche
      float aspect = uRes.x / uRes.y;

      // Lamelles d'environ 12 px : chacune décale et étire l'image à sa façon
      float cols = max(32.0, uRes.x / 12.0);
      float c = floor(uv.x * cols);
      float fx = fract(uv.x * cols);
      float r1 = hash(c);
      float r2 = hash(c + 31.7);
      float r3 = hash(c + 71.3);
      vec2 p = uv;
      p.y += (r1 - 0.5) * 0.12 + sin(uTime * 0.25 + r2 * 6.2831) * 0.01;
      p.y *= mix(0.9, 1.1, r3);
      p.x += (fx - 0.5) / cols * 2.0;

      // Bandes de lumière qui montent vers la droite et dérivent lentement
      float d = p.y - p.x * aspect * 0.55;
      float b = pow(0.5 + 0.5 * sin(d * 4.2 + uTime * 0.3), 4.0) * 0.95
              + pow(0.5 + 0.5 * sin(d * 7.3 - uTime * 0.2 + 1.3), 8.0) * 0.3;

      // Le côté du texte reste sombre : la gauche sur grand écran, le haut sur mobile
      float mask = aspect > 1.0 ? smoothstep(0.3, 0.95, uv.x) : smoothstep(0.62, 0.05, uv.y);
      b *= mix(0.08, 1.0, mask);
      b *= 0.9 + 0.2 * r2;
      b += smoothstep(0.9, 1.0, fx) * 0.05 * b;

      vec3 col = mix(vec3(0.039), vec3(0.42, 0.14, 0.05), smoothstep(0.02, 0.3, b));
      col = mix(col, vec3(1.0, 0.42, 0.17), smoothstep(0.3, 0.72, b));
      col = mix(col, vec3(1.0, 0.86, 0.72), smoothstep(0.78, 1.08, b));
      col += (grain(gl_FragCoord.xy) - 0.5) * 0.09; // grain fixe, pour l'aspect mat
      gl_FragColor = vec4(col, 1.0);
    }`;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  // Un seul triangle qui couvre tout l'écran
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, 'uRes');
  const uTime = gl.getUniformLocation(program, 'uTime');

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = false;
  let raf = 0;
  let elapsed = 20; // point de départ de l'animation, en secondes
  let last = 0;

  const draw = () => {
    gl.uniform1f(uTime, elapsed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(section.clientWidth * dpr));
    const h = Math.max(1, Math.round(section.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
    draw();
  };
  const frame = (now) => {
    raf = 0;
    if (!visible) return;
    if (last) elapsed += Math.min(0.05, (now - last) / 1000);
    last = now;
    draw();
    raf = requestAnimationFrame(frame);
  };

  resize();
  section.classList.add('has-shader');
  new ResizeObserver(resize).observe(section);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    last = 0;
    if (visible && !still && !raf) raf = requestAnimationFrame(frame);
  }).observe(section);
})();
