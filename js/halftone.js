// Symbole Nextylab imprimé en trame de points, dans le hero.
// Chaque point est dimensionné par la part du symbole qui couvre sa cellule, donc le tracé garde
// ses bords à toutes les tailles. Le pointeur écarte les points sur des ressorts, ils chauffent en
// couleur quand ils quittent leur place, et un clic envoie une onde à travers le symbole.
// Adapté du composant React « Halftone Wordmark Footer » en JavaScript natif, sans dépendance.
(() => {
  const root = document.querySelector('[data-halftone]');
  if (!root) return;
  const canvas = root.querySelector('canvas');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  // Les deux modules du symbole (viewBox 90 × 90) : le premier à l'encre, le second en Next Orange.
  const MODULES = [
    {
      d: 'M15.6661 42.5556L34.6109 23.6108C40.3554 17.8663 49.6445 17.8663 55.389 23.6108L62.1113 30.3331L52.3334 40.1111L46.8333 34.611C45.1222 32.8998 42.4332 32.8998 40.7221 34.611L24.2218 51.1113C23.0349 51.4526 21.7782 51.4698 20.5823 51.161C19.3865 50.8523 18.2952 50.2288 17.4219 49.3555C16.5486 48.4822 15.9251 47.3909 15.6164 46.1951C15.3076 44.9992 15.3248 43.7425 15.6661 42.5556Z',
      ink: [10, 10, 10],
      warm: [255, 107, 44],
    },
    {
      d: 'M74.3336 47.4444L55.3889 66.3891C49.6443 72.1337 40.3553 72.1337 34.6108 66.3891L27.8884 59.6668L37.6664 49.8889L43.1665 55.389C44.8776 57.1001 47.5665 57.1001 49.2777 55.389L65.7779 38.8887C66.9649 38.5473 68.2216 38.5301 69.4174 38.8389C70.6133 39.1477 71.7046 39.7711 72.5779 40.6444C73.4512 41.5178 74.0746 42.6091 74.3834 43.8049C74.6922 45.0007 74.675 46.2574 74.3336 47.4444Z',
      ink: [255, 107, 44],
      warm: [168, 59, 18],
    },
  ];
  const BOX = { x: 15.3, y: 17.8, w: 59.4, h: 54.4 }; // emprise du symbole dans son viewBox
  const RADIUS = 90; // portée du pointeur, en px CSS
  const STRIDE = 8; // x, y, vx, vy, hx, hy, rayon, module

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colorCache = MODULES.map((m) => 'rgb(' + m.ink.join(',') + ')');

  let w = 0;
  let h = 0;
  let dpr = 1;
  let px = -1e5;
  let py = -1e5;
  let raf = 0;
  let visible = true;
  let awake = true;
  let ring = { x: 0, y: 0, t: -1 };
  let dots = new Float32Array(0);
  let count = 0;
  let grainPattern = null;

  // Rayon d'un point selon la couverture de sa cellule : fidèle à l'aire, pour un ton régulier.
  const dotRadius = (coverage, gap) => Math.sqrt(Math.min(1, Math.max(0, coverage))) * gap * 0.56;

  function layout() {
    const rect = root.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const gap = w < 420 ? 6 : 7;
    const scale = Math.min((w * 0.88) / BOX.w, (h * 0.88) / BOX.h);
    const ox = (w - BOX.w * scale) / 2 - BOX.x * scale;
    const oy = (h - BOX.h * scale) / 2 - BOX.y * scale;

    // Un masque par module, dessiné une fois à la taille réelle
    const masks = MODULES.map((m) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.setTransform(scale, 0, 0, scale, ox, oy);
      g.fill(new Path2D(m.d));
      return g.getImageData(0, 0, w, h).data;
    });

    const cols = Math.ceil(w / gap);
    const rows = Math.ceil(h / gap);
    const tmp = [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        let best = 0;
        let module = 0;
        for (let k = 0; k < masks.length; k++) {
          // Couverture : moyenne de l'opacité sur 3 × 3 échantillons de la cellule
          let sum = 0;
          for (let sy = 0; sy < 3; sy++) {
            for (let sx = 0; sx < 3; sx++) {
              const x = Math.min(w - 1, Math.floor(gx * gap + ((sx + 0.5) * gap) / 3));
              const y = Math.min(h - 1, Math.floor(gy * gap + ((sy + 0.5) * gap) / 3));
              sum += masks[k][(y * w + x) * 4 + 3];
            }
          }
          const cov = sum / (9 * 255);
          if (cov > best) {
            best = cov;
            module = k;
          }
        }
        if (best < 0.06) continue;
        const hx = gx * gap + gap / 2;
        const hy = gy * gap + gap / 2;
        tmp.push(hx, hy, 0, 0, hx, hy, dotRadius(best, gap), module);
      }
    }
    dots = new Float32Array(tmp);
    count = tmp.length / STRIDE;

    // Grain d'impression, posé uniquement sur les points
    const tile = document.createElement('canvas');
    tile.width = 128;
    tile.height = 128;
    const t = tile.getContext('2d');
    const id = t.createImageData(128, 128);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random() * 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
    }
    t.putImageData(id, 0, 0);
    grainPattern = ctx.createPattern(tile, 'repeat');
    awake = true;
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const r = reduced ? 0 : RADIUS;
    const ringAge = ring.t < 0 ? 1e9 : now - ring.t;
    const ringR = ringAge * 0.9;
    let moving = false;

    for (let i = 0; i < count; i++) {
      const j = i * STRIDE;
      let x = dots[j];
      let y = dots[j + 1];
      let vx = dots[j + 2];
      let vy = dots[j + 3];
      const hx = dots[j + 4];
      const hy = dots[j + 5];

      if (!reduced) {
        // Onde du clic
        if (ringAge < 900) {
          const dx = hx - ring.x;
          const dy = hy - ring.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
          const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
          if (band > 0) {
            const f = band * 3.2 * (1 - ringAge / 900);
            vx += (dx / d) * f;
            vy += (dy / d) * f;
          }
        }
        // Poussée du pointeur, puis ressort qui ramène le point chez lui
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (r > 0 && d2 < r * r) {
          const d = Math.sqrt(d2) + 0.001;
          const f = (1 - d / r) * 2.6;
          vx += (dx / d) * f;
          vy += (dy / d) * f;
        }
        vx = (vx + (hx - x) * 0.05) * 0.84;
        vy = (vy + (hy - y) * 0.05) * 0.84;
        x += vx;
        y += vy;

        if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) {
          moving = true;
        } else {
          x = hx;
          y = hy;
          vx = 0;
          vy = 0;
        }
        dots[j] = x;
        dots[j + 1] = y;
        dots[j + 2] = vx;
        dots[j + 3] = vy;
      }

      // Plus le point est loin de sa place, plus il prend la couleur chaude de son module
      const m = MODULES[dots[j + 7]];
      const k = Math.min(1, Math.hypot(x - hx, y - hy) / 28);
      ctx.fillStyle = k > 0.02
        ? 'rgb(' +
          Math.round(m.ink[0] + (m.warm[0] - m.ink[0]) * k) + ',' +
          Math.round(m.ink[1] + (m.warm[1] - m.ink[1]) * k) + ',' +
          Math.round(m.ink[2] + (m.warm[2] - m.ink[2]) * k) + ')'
        : colorCache[dots[j + 7]];
      ctx.beginPath();
      ctx.arc(x, y, dots[j + 6], 0, 6.2832);
      ctx.fill();
    }

    if (grainPattern) {
      ctx.globalAlpha = 0.1;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // On s'endort quand tout est revenu en place et que rien ne pousse
    awake = moving || ringAge < 900 || px > -1e4;
  }

  function loop(now) {
    raf = 0;
    if (!visible) return;
    draw(now);
    if (awake && !reduced) raf = requestAnimationFrame(loop);
  }

  function wake() {
    awake = true;
    if (!raf && visible) raf = requestAnimationFrame(loop);
  }

  function toLocal(event) {
    const b = canvas.getBoundingClientRect();
    return [event.clientX - b.left, event.clientY - b.top];
  }

  if (!reduced) {
    root.addEventListener('pointermove', (event) => {
      [px, py] = toLocal(event);
      wake();
    });
    root.addEventListener('pointerleave', () => {
      px = -1e5;
      py = -1e5;
      wake();
    });
    root.addEventListener('pointerdown', (event) => {
      const [x, y] = toLocal(event);
      ring = { x, y, t: performance.now() };
      wake();
    });
  }

  layout();
  draw(performance.now());

  new ResizeObserver(() => {
    layout();
    draw(performance.now());
    wake();
  }).observe(root);

  new IntersectionObserver((entries) => {
    visible = entries[0] ? entries[0].isIntersecting : true;
    if (visible) wake();
  }).observe(root);
})();
