// CTA final : fond « Gradient Blinds » (React Bits, licence MIT + Commons Clause), porté en JavaScript simple.
// Des lamelles orange en dégradé, éclairées par une lumière qui suit la souris (ou dérive seule), avec une onde
// au clic. Rendu WebGL2, arrêté hors écran ; sans WebGL2, le halo CSS reste en place.
(() => {
  const section = document.querySelector('.cta');
  const canvas = section && section.querySelector('.cta__shader');
  if (!canvas || !('IntersectionObserver' in window) || !('ResizeObserver' in window)) return;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  if (!gl) return;

  // Réglages choisis par Thomas (les autres valeurs sont celles du composant d'origine)
  const S = {
    gradientColors: ['#ffac73', '#ff6800'],
    angle: -14,
    noise: 0.4,
    blindCount: 14,
    blindMinWidth: 60,
    mouseDampening: 0.15,
    mirrorGradient: false,
    spotlightRadius: 0.62,
    spotlightSoftness: 1.3,
    spotlightOpacity: 0.7, // atténué pour la lisibilité du texte (1 dans le réglage d'origine)
    distortAmount: 0,
    shineDirection: 'left',
    lightColor: '#ffe4c4',
    perspective: 0,
    gradientSpeed: 0,
    shine: 0.8,
    relief: 0.75,
    glow: 0.3,
    sway: 0.35,
    speed: 1,
    hoverTilt: 0.6,
    clickEffect: 'ripple',
    idle: 'drift',
    intro: true,
    lightMode: false,
    maxDpr: 1.5, // plafonné pour ménager la carte graphique sur une section plein écran
  };

  const MAX_COLORS = 8;
  const MAX_WAVES = 4;
  const INTRO_SECONDS = 1.8;
  const RIPPLE_SECONDS = 1.6;

  const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3 uColors[8];
uniform int uColorCount;
uniform float uLightMode;
uniform float uShine;
uniform float uRelief;
uniform float uGlow;
uniform float uSway;
uniform float uSwayTime;
uniform float uHover;
uniform vec4 uWaves[4];
uniform float uIntro;
uniform float uGrainTime;
uniform vec3 uLightColor;
uniform float uPerspective;
uniform float uGradientShift;

out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 rotate2D(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec2 blindSpace(vec2 uv0) {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = uv0 * 2.0 - 1.0;
  p.x *= aspect;
  vec2 pr = rotate2D(p, uAngle);
  pr.x /= aspect;
  vec2 uv = pr * 0.5 + 0.5;
  if (abs(uPerspective) > 0.001) {
    float k = uPerspective * 2.2;
    uv.x = (exp(k * uv.x) - 1.0) / (exp(k) - 1.0);
  }
  if (uDistort > 0.0) {
    float a = uv.y * 6.0;
    float b = uv.x * 6.0;
    float w = 0.01 * uDistort;
    uv.x += sin(a) * w;
    uv.y += cos(b) * w;
  }
  return uv;
}

vec3 gradientColor(float t) {
  float tt = clamp(t, 0.0, 1.0);
  int count = max(uColorCount, 2);
  float scaled = tt * float(count - 1);
  int seg = min(int(floor(scaled)), count - 2);
  float f = scaled - float(seg);
  if (tt >= 1.0) return uColors[count - 1];
  return mix(uColors[seg], uColors[seg + 1], f);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv0 = frag / uResolution;
  vec2 uvMod = blindSpace(uv0);

  float count = max(uBlindCount, 1.0);
  float stripePhase = uvMod.x * count;
  float pixel = max(fwidth(stripePhase), 1e-5);

  float t = uvMod.x;
  if (uGradientShift != 0.0) {
    t = 1.0 - abs(1.0 - fract((t + uGradientShift) * 0.5) * 2.0);
  }
  if (uMirror > 0.5) {
    t = 1.0 - abs(1.0 - 2.0 * fract(t));
  }
  vec3 base = gradientColor(t);

  vec2 offset = uMouse / uResolution;
  float d = length(uv0 - offset);
  float r = max(uSpotlightRadius, 1e-4);
  float spot = (1.0 - 2.0 * pow(d / r, uSpotlightSoftness)) * uSpotlightOpacity;

  float slat = floor(stripePhase);
  float s = stripePhase - slat;
  float stripeAA = clamp(count * 1.25 / min(uResolution.x, uResolution.y), 0.001, 0.12);
  float edgeBlend = 1.0 - smoothstep(0.0, stripeAA, min(s, 1.0 - s));
  float across = mix(s, 0.5, edgeBlend);
  float ramp = uShineFlip > 0.5 ? 1.0 - across : across;

  float unit = min(uResolution.x, uResolution.y);
  float reach = max(uSpotlightRadius, 0.05) * unit;
  vec2 toLight = uMouse - frag;
  float nearLight = exp(-dot(toLight, toLight) / (reach * reach));

  float tilt = 0.0;
  float pulse = 0.0;
  if (uSway > 0.0) {
    tilt += uSway * 0.5 * sin(uSwayTime * 0.9 + slat * 0.55) * (0.6 + 0.4 * sin(uSwayTime * 0.37 + slat * 0.21));
  }
  tilt += uHover * nearLight * 0.7;
  for (int i = 0; i < 4; i++) {
    vec4 wave = uWaves[i];
    if (wave.w <= 0.0) continue;
    float age = uTime - wave.z;
    if (age < 0.0 || age > ${RIPPLE_SECONDS.toFixed(2)}) continue;
    float life = age / ${RIPPLE_SECONDS.toFixed(2)};
    vec2 origin = blindSpace(wave.xy / uResolution);
    float slats = abs(slat + 0.5 - origin.x * count);
    float front = age * max(count, 4.0) * 0.95;
    float k = (slats - front) / (0.8 + life * 1.2);
    float along = (uvMod.y - origin.y) / max(0.42 + life * 0.5, 0.01);
    float fade = (1.0 - life) * (1.0 - life);
    float ring = exp(-k * k) * exp(-along * along) * fade * smoothstep(0.0, 0.2, age);
    tilt += ring * 0.9;
    pulse += ring;
  }
  if (uIntro < 1.0) {
    float settle = smoothstep(0.0, 1.0, clamp(uIntro * 1.5 - uv0.x * 0.5, 0.0, 1.0));
    tilt -= (1.0 - settle) * 1.2;
  }

  float edge = ramp;
  float calm = 1.0 - 0.6 * clamp(spot, 0.0, 1.0);
  ramp = pow(clamp(ramp, 0.0, 1.0), exp(tilt * 0.9));
  ramp *= 1.0 - 0.3 * min(pulse, 1.0) * calm;
  float crease = uRelief * 0.38 * smoothstep(0.62, 1.0, ramp);
  float sheen = uShine * exp(-pow((edge - 0.035) / 0.07, 2.0)) * (0.3 + 0.7 * nearLight) * (1.0 - edgeBlend);

  vec3 lit = spot > 0.0 ? uLightColor * spot : vec3(spot);
  lit += uLightColor * min(pulse, 1.0) * 0.35 * calm;
  vec3 revealSignal = lit + base - vec3(ramp + crease);

  vec3 col;
  if (uLightMode > 0.5) {
    vec3 luma = vec3(0.2126, 0.7152, 0.0722);
    float peak = max(base.r, max(base.g, base.b));
    float low = min(base.r, min(base.g, base.b));
    float chroma = (peak - low) / max(peak, 0.0001);
    vec3 hue = base / max(peak, 0.0001);
    hue = clamp(mix(vec3(dot(hue, luma)), hue, 1.3), 0.0, 1.0);
    hue *= mix(1.0, 0.82, smoothstep(0.55, 0.9, dot(hue, luma)));
    vec3 tint = mix(base, hue, smoothstep(0.06, 0.28, chroma));
    vec3 revealed = clamp(revealSignal, 0.0, 1.0);
    float coverage = max(revealed.r, max(revealed.g, revealed.b));
    float stroke = 1.0 - smoothstep(pixel, pixel * 2.2, edge);
    col = mix(vec3(1.0), tint, 0.72 * smoothstep(0.0, 1.0, coverage));
    col = mix(col, tint * 0.85, stroke * clamp(coverage * 1.5, 0.0, 1.0) * 0.7);
    col = mix(col, vec3(1.0), clamp(sheen, 0.0, 1.0) * 0.5);
    float grain = max(0.5 * (hash(frag + uGrainTime) + hash(frag.yx + uGrainTime * 1.7)) - 0.5, 0.0);
    col = clamp(col - vec3(grain * uNoise * 0.12 * coverage), 0.0, 1.0);
  } else {
    vec3 haze = base * uGlow * 0.4 * smoothstep(0.0, 1.0, spot) * (0.4 + 0.6 * ramp);
    col = revealSignal + haze + mix(base, uLightColor, 0.45) * sheen * 0.7;
    vec3 over = max(col - 0.8, 0.0);
    col = min(col, vec3(0.8)) + 0.2 * (1.0 - exp(-over / 0.2));
    float luma = dot(clamp(col, 0.0, 1.0), vec3(0.2126, 0.7152, 0.0722));
    float grain = 0.5 * (hash(frag + uGrainTime) + hash(frag.yx + uGrainTime * 1.7)) - 0.5;
    col += grain * uNoise * (0.45 + 0.55 * smoothstep(0.0, 0.5, luma));
  }

  float presence = smoothstep(0.0, 0.65, uIntro);
  col = uLightMode > 0.5 ? mix(vec3(1.0), col, presence) : col * presence;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  const u = {};
  for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i += 1) {
    const info = gl.getActiveUniform(program, i);
    if (info) {
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(program, name);
    }
  }
  const vao = gl.createVertexArray();

  const hexToRGB = (hex) => {
    const c = String(hex || '').replace('#', '').padEnd(6, '0');
    return [parseInt(c.slice(0, 2), 16) / 255 || 0, parseInt(c.slice(2, 4), 16) / 255 || 0, parseInt(c.slice(4, 6), 16) / 255 || 0];
  };
  const stops = S.gradientColors.slice(0, MAX_COLORS);
  while (stops.length < MAX_COLORS) stops.push(stops[stops.length - 1]);
  const colorFlat = new Float32Array(MAX_COLORS * 3);
  stops.forEach((hex, i) => colorFlat.set(hexToRGB(hex), i * 3));
  const colorCount = Math.max(2, Math.min(MAX_COLORS, S.gradientColors.length));
  const lightRGB = hexToRGB(S.lightColor);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const view = { width: 1, height: 1, ratio: 1 };
  const pointer = { x: 0, y: 0, inside: false };
  const light = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, ready: false };
  const waves = new Float32Array(MAX_WAVES * 4);
  let waveIndex = 0;
  let hover = 0;
  let time = 0;
  let swayTime = 0;
  let shift = 0;
  let grainTime = 0;
  let introClock = S.intro && !reduce ? 0 : 1;
  let raf = 0;
  let last = 0;
  let visible = false;

  const blindTotal = () => {
    const byWidth = Math.max(1, Math.floor(view.width / S.blindMinWidth));
    return Math.max(1, Math.min(S.blindCount, byWidth));
  };

  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform2f(u.uResolution, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uMouse, light.x * view.ratio, (view.height - light.y) * view.ratio);
    gl.uniform1f(u.uAngle, (S.angle * Math.PI) / 180);
    gl.uniform1f(u.uNoise, S.noise);
    gl.uniform1f(u.uBlindCount, blindTotal());
    gl.uniform1f(u.uSpotlightRadius, S.spotlightRadius);
    gl.uniform1f(u.uSpotlightSoftness, S.spotlightSoftness);
    gl.uniform1f(u.uSpotlightOpacity, S.spotlightOpacity);
    gl.uniform1f(u.uMirror, S.mirrorGradient ? 1 : 0);
    gl.uniform1f(u.uDistort, S.distortAmount);
    gl.uniform1f(u.uShineFlip, S.shineDirection === 'right' ? 1 : 0);
    gl.uniform3fv(u.uColors, colorFlat);
    gl.uniform1i(u.uColorCount, colorCount);
    gl.uniform1f(u.uLightMode, S.lightMode ? 1 : 0);
    gl.uniform1f(u.uShine, S.shine);
    gl.uniform1f(u.uRelief, S.relief);
    gl.uniform1f(u.uGlow, S.glow);
    gl.uniform1f(u.uSway, reduce ? 0 : S.sway);
    gl.uniform1f(u.uSwayTime, swayTime);
    gl.uniform1f(u.uHover, hover * S.hoverTilt);
    gl.uniform4fv(u.uWaves, waves);
    gl.uniform1f(u.uIntro, introClock);
    gl.uniform1f(u.uGrainTime, grainTime);
    gl.uniform3fv(u.uLightColor, lightRGB);
    gl.uniform1f(u.uPerspective, S.perspective);
    gl.uniform1f(u.uGradientShift, shift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  // Où va la lumière : sur la souris, sinon elle dérive doucement derrière le formulaire (à droite sur grand écran,
  // en bas sur mobile), loin du texte
  const aim = () => {
    const wide = view.width > 960;
    const cx = wide ? 0.7 : 0.5;
    const cy = wide ? 0.5 : 0.68;
    if (pointer.inside) {
      light.tx = pointer.x;
      light.ty = pointer.y;
    } else if (S.idle === 'center') {
      light.tx = view.width / 2;
      light.ty = view.height / 2;
    } else if (S.idle === 'drift' && !reduce) {
      light.tx = view.width * (cx + 0.16 * Math.sin(swayTime * 0.23) + 0.05 * Math.sin(swayTime * 0.61 + 1.3));
      light.ty = view.height * (cy + 0.16 * Math.sin(swayTime * 0.31 + 0.7) + 0.04 * Math.sin(swayTime * 0.83));
    }
  };

  // Ressort amorti : la lumière rattrape sa cible en douceur
  const follow = (dt) => {
    const tau = S.mouseDampening;
    if (tau <= 0) {
      light.x = light.tx;
      light.y = light.ty;
      light.vx = 0;
      light.vy = 0;
      return;
    }
    const omega = 2.4 / tau;
    const k = omega * omega;
    const c = 2 * omega;
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      light.vx += (k * (light.tx - light.x) - c * light.vx) * h;
      light.vy += (k * (light.ty - light.y) - c * light.vy) * h;
      light.x += light.vx * h;
      light.y += light.vy * h;
    }
  };

  function wake() {
    if (!raf && visible && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? clamp((now - last) / 1000, 0.001, 1 / 20) : 1 / 60;
    last = now;
    time += dt;
    if (!reduce) {
      swayTime += dt * S.speed;
      shift = (shift + dt * S.gradientSpeed * 0.06) % 2;
    }
    grainTime = Math.floor(time * 24) * 17.13;
    if (introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS);
    hover += ((pointer.inside ? 1 : 0) - hover) * (1 - Math.exp(-dt / 0.35));
    aim();
    follow(dt);
    for (let i = 0; i < MAX_WAVES; i += 1) {
      if (waves[i * 4 + 3] > 0 && time - waves[i * 4 + 2] > RIPPLE_SECONDS) waves[i * 4 + 3] = 0;
    }
    draw();
    const settling = Math.abs(light.tx - light.x) > 0.05 || Math.abs(light.ty - light.y) > 0.05
      || Math.abs(light.vx) + Math.abs(light.vy) > 0.05 || Math.abs((pointer.inside ? 1 : 0) - hover) > 0.002;
    const active = settling || introClock < 1 || waves.some((value, index) => index % 4 === 3 && value > 0)
      || (!reduce && (S.noise > 0 || S.gradientSpeed !== 0 || (S.sway > 0 && S.speed > 0) || (S.idle === 'drift' && !pointer.inside)));
    if (active) raf = requestAnimationFrame(frame);
  }

  const resize = () => {
    view.width = Math.max(1, section.clientWidth);
    view.height = Math.max(1, section.clientHeight);
    view.ratio = Math.min(window.devicePixelRatio || 1, S.maxDpr);
    canvas.width = Math.max(1, Math.round(view.width * view.ratio));
    canvas.height = Math.max(1, Math.round(view.height * view.ratio));
    if (!light.ready) {
      light.ready = true;
      light.x = light.tx = view.width * (view.width > 960 ? 0.7 : 0.5);
      light.y = light.ty = view.height * (view.width > 960 ? 0.5 : 0.68);
    }
    draw();
    wake();
  };

  const locate = (event) => {
    const rect = section.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
  };

  window.addEventListener('pointermove', (event) => {
    const { x, y, inside } = locate(event);
    pointer.x = x;
    pointer.y = y;
    pointer.inside = inside;
    if (inside) wake();
  }, { passive: true });
  // Un clic sur le fond envoie une onde à travers les lamelles ; pas sur les champs et boutons du formulaire
  window.addEventListener('pointerdown', (event) => {
    const { x, y, inside } = locate(event);
    if (!inside || reduce || S.clickEffect !== 'ripple') return;
    if (event.target.closest('a, button, input, textarea, label, .booking')) return;
    const o = waveIndex * 4;
    waves[o] = x * view.ratio;
    waves[o + 1] = (view.height - y) * view.ratio;
    waves[o + 2] = time;
    waves[o + 3] = 1;
    waveIndex = (waveIndex + 1) % MAX_WAVES;
    wake();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; wake(); });
  document.addEventListener('visibilitychange', () => { last = 0; wake(); });

  new ResizeObserver(resize).observe(section);
  new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) wake();
  }).observe(section);
  resize();
  section.classList.add('has-shader');
})();
