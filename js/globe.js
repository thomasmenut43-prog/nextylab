// Données en Europe : globe en points centré sur l'Europe (bibliothèque cobe, licence MIT).
// Chargé à l'approche de la section, il oscille doucement autour de l'Europe, se fait tourner
// au glisser puis revient, et ne se redessine plus hors écran. Sans WebGL, l'icône reste affichée.
const COBE_URL = 'https://cdn.jsdelivr.net/npm/cobe@2.0.1/dist/index.esm.js';

const wrap = document.querySelector('[data-globe]');
const canvas = wrap && wrap.querySelector('canvas');

const hasWebGL = () => {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
};

// Rotation qui amène une longitude face à l'écran
const facing = (lon) => Math.PI - ((lon * Math.PI) / 180 - Math.PI / 2);

const CITIES = {
  paris: [48.8566, 2.3522],
  francfort: [50.1109, 8.6821],
  amsterdam: [52.3676, 4.9041],
  dublin: [53.3498, -6.2603],
  madrid: [40.4168, -3.7038],
  milan: [45.4642, 9.19],
  stockholm: [59.3293, 18.0686],
  varsovie: [52.2297, 21.0122],
};
const LINKS = [
  ['paris', 'francfort'], ['francfort', 'amsterdam'], ['paris', 'dublin'], ['paris', 'madrid'],
  ['paris', 'milan'], ['francfort', 'stockholm'], ['francfort', 'varsovie'],
];
const ORANGE = [1, 0.42, 0.17];
const HOME = facing(8);
const THETA = 0.42;

async function startGlobe() {
  let createGlobe;
  try {
    ({ default: createGlobe } = await import(COBE_URL));
  } catch {
    return;
  }

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let size = canvas.offsetWidth;
  let phi = HOME;
  let sway = 0;
  let dragX = null;
  let dragFrom = 0;
  let holdUntil = 0;
  let warmup = 90; // quelques images le temps que la carte se charge
  let visible = true;
  let raf = 0;
  let last = 0;

  const globe = createGlobe(canvas, {
    // Le globe est grand : on plafonne le canevas à 2000 px de côté pour ménager la carte graphique
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2, 2000 / size),
    width: size,
    height: size,
    phi,
    theta: THETA,
    dark: 1,
    opacity: 0.6, // sphère seule : marqueurs et arcs restent à pleine opacité
    diffuse: 1.2,
    mapSamples: 24000,
    mapBrightness: 6,
    baseColor: [0.3, 0.3, 0.3],
    markerColor: ORANGE,
    glowColor: [0.13, 0.13, 0.13],
    markers: Object.values(CITIES).map((location) => ({ location, size: 0.016 })),
    arcs: LINKS.map(([from, to]) => ({ from: CITIES[from], to: CITIES[to] })),
    arcColor: ORANGE,
    arcWidth: 0.4,
    arcHeight: 0.22,
    markerElevation: 0.01,
  });

  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    let moving = false;

    if (dragX === null && now >= holdUntil) {
      if (!still) sway += dt;
      const target = HOME + (still ? 0 : Math.sin(sway * 0.25) * 0.35);
      phi += (target - phi) * (1 - Math.exp(-dt * 2.2));
      moving = !still || Math.abs(target - phi) > 0.001;
    }
    globe.update({ phi });

    if (warmup > 0) warmup -= 1;
    if (visible && (moving || dragX !== null || warmup > 0 || now < holdUntil)) wake();
  };

  function wake() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Glisser à l'horizontale fait tourner le globe ; le défilement vertical reste possible au doigt
  canvas.addEventListener('pointerdown', (event) => {
    dragX = event.clientX;
    dragFrom = phi;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-grabbing');
    last = 0;
    wake();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (dragX === null) return;
    phi = dragFrom + ((event.clientX - dragX) / size) * 3;
  });
  const release = () => {
    if (dragX === null) return;
    dragX = null;
    holdUntil = performance.now() + 1200;
    canvas.classList.remove('is-grabbing');
    wake();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  new ResizeObserver(() => {
    const next = canvas.offsetWidth;
    if (!next || next === size) return;
    size = next;
    globe.update({ width: size, height: size });
    warmup = Math.max(warmup, 2);
    wake();
  }).observe(canvas);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      last = 0;
      wake();
    }
  }).observe(wrap);

  wake();
  setTimeout(() => wrap.classList.add('is-ready'), 120);
}

if (canvas && 'IntersectionObserver' in window && 'ResizeObserver' in window && hasWebGL()) {
  const loader = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    loader.disconnect();
    startGlobe();
  }, { rootMargin: '400px 0px' });
  loader.observe(wrap);
}
