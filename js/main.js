// Menu mobile, ombre de la barre de navigation et apparition des blocs au défilement.

// Une page rechargée repart toujours du haut : le navigateur ne restaure plus la position de défilement, et une
// ancre restée dans l'adresse (#methode après un clic dans le menu) est oubliée. Une arrivée depuis un lien
// (par exemple /#contact depuis une autre page) va toujours à sa section.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const navigationEntry = performance.getEntriesByType('navigation')[0];
if (navigationEntry && navigationEntry.type === 'reload') {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo(0, 0);
}
const header = document.querySelector('.site-header');
const nav = header.querySelector('.nav');
const toggle = header.querySelector('.nav__toggle');
const menu = document.getElementById('nav-menu');

function setMenuOpen(open) {
  nav.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
}

toggle.addEventListener('click', () => setMenuOpen(!nav.classList.contains('is-open')));

// Écran d'accueil : retiré une fois remonté ; un clic, la molette ou une touche le font remonter tout de suite
const intro = document.querySelector('.intro-screen');
if (intro) {
  if (!document.documentElement.classList.contains('intro')) {
    intro.remove();
  } else {
    intro.addEventListener('animationend', (event) => {
      if (event.animationName === 'intro-lift') intro.remove();
    });
    const skip = () => {
      if (!intro.isConnected) return;
      intro.classList.add('is-skip');
      document.documentElement.classList.add('intro-skip');
    };
    intro.addEventListener('click', skip);
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('wheel', skip, { once: true, passive: true });
  }
}

// Un lien choisi referme le menu
menu.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenuOpen(false);
});

// Menus déroulants « Solutions » et « Métiers » : ouverture au clic (et au survol en bureau, en CSS),
// un seul ouvert à la fois
const dropdowns = [...document.querySelectorAll('.nav__dropdown')];
const setDropdownOpen = (dropdown, open) => {
  dropdown.classList.toggle('is-open', open);
  dropdown.querySelector('.nav__drop-btn').setAttribute('aria-expanded', String(open));
};
dropdowns.forEach((dropdown) => {
  dropdown.querySelector('.nav__drop-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    const open = !dropdown.classList.contains('is-open');
    dropdowns.forEach((other) => setDropdownOpen(other, other === dropdown && open));
  });
});
document.addEventListener('click', (event) => {
  dropdowns.forEach((dropdown) => {
    if (!dropdown.contains(event.target)) setDropdownOpen(dropdown, false);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const openDropdown = dropdowns.find((dropdown) => dropdown.classList.contains('is-open'));
  if (openDropdown) {
    setDropdownOpen(openDropdown, false);
    openDropdown.querySelector('.nav__drop-btn').focus();
  } else if (nav.classList.contains('is-open')) {
    setMenuOpen(false);
    toggle.focus();
  }
});

// Retour en largeur bureau : le menu redevient la barre normale
window.matchMedia('(min-width: 881px)').addEventListener('change', (event) => {
  if (event.matches) setMenuOpen(false);
});

const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Offres : carte focus. L'offre active est au centre, les deux autres en retrait de chaque côté (--pos, --dist).
// Flèches, points, clic sur une carte de côté, flèches du clavier, et glisser à la souris ou au doigt : pendant le
// geste les cartes suivent le pointeur en temps réel, puis se calent sur l'offre la plus proche au relâchement.
// La scène de la carte active bouge, les autres sont figées ; rien ne bouge avant que la section soit vue.
// Les offres défilent seules toutes les 8 s tant que la section est à l'écran, en pause au survol, et plus du tout
// dès que le visiteur a navigué lui-même.
const offers = document.querySelector('[data-offers]');
if (offers) {
  const stage = offers.querySelector('[data-offers-stage]');
  const cards = [...stage.querySelectorAll('.offer-card')];
  const dots = [...offers.querySelectorAll('[data-offers-dots] button')];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = window.matchMedia('(max-width: 760px)');
  const DELAY = 8000;
  const half = cards.length / 2;
  let active = 0;
  let seen = false;
  let inView = false;
  let hovered = false;
  let manual = false;
  let timer = 0;

  // Position ramenée entre -1,5 et 1,5 (pour 3 cartes) : au-delà de 1, la carte s'efface (CSS)
  const wrap = (pos) => ((((pos + half) % cards.length) + cards.length) % cards.length) - half;
  const place = (card, pos) => {
    card.dataset.pos = pos;
    card.style.setProperty('--pos', pos.toFixed(4));
    card.style.setProperty('--dist', Math.abs(pos).toFixed(4));
  };

  const show = (n) => {
    active = (n + cards.length) % cards.length;
    cards.forEach((card, i) => {
      const pos = Math.round(wrap(i - active));
      const from = Number(card.dataset.pos);
      // Une carte qui change de bord fait le tour par l'extérieur, effacée, au lieu de traverser le centre
      if (!Number.isNaN(from) && Math.abs(pos - from) > half) {
        card.style.transition = 'none';
        place(card, from + (pos > from ? cards.length : -cards.length));
        card.getBoundingClientRect();
        card.style.removeProperty('transition');
      }
      place(card, pos);
      card.classList.toggle('is-active', seen && pos === 0);
      card.setAttribute('aria-hidden', String(pos !== 0));
      card.querySelectorAll('a').forEach((link) => { link.tabIndex = pos === 0 ? 0 : -1; });
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === active)));
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === active));
  };

  const schedule = () => {
    clearTimeout(timer);
    if (still || manual || !inView || hovered) return;
    timer = setTimeout(() => {
      show(active + 1);
      schedule();
    }, DELAY);
  };

  const go = (n) => {
    manual = true;
    clearTimeout(timer);
    show(n);
  };

  offers.querySelector('[data-offers-prev]').addEventListener('click', () => go(active - 1));
  offers.querySelector('[data-offers-next]').addEventListener('click', () => go(active + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));

  // Glisser : un pas de carrousel vaut le décalage d'une carte de côté (68 % de sa largeur, 96 % sur mobile)
  let drag = null;
  let dragged = false;
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.pointerType === 'mouse') event.preventDefault(); // pas de sélection de texte pendant le geste
    drag = {
      id: event.pointerId,
      x: event.clientX,
      t: performance.now(),
      step: cards[0].offsetWidth * (narrow.matches ? 0.96 : 0.68),
      progress: 0,
    };
    dragged = false;
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!dragged) {
      if (Math.abs(dx) < 6) return; // en dessous, c'est un clic
      dragged = true;
      manual = true;
      clearTimeout(timer);
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('is-dragging');
    }
    drag.progress = dx / drag.step;
    cards.forEach((card, i) => place(card, wrap(i - active + drag.progress)));
  });
  const release = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const { progress, t } = drag;
    drag = null;
    if (!dragged) return;
    stage.classList.remove('is-dragging');
    // Au-delà d'un demi-pas on passe à l'offre suivante ; un petit geste vif suffit aussi
    let steps = Math.round(progress);
    const flick = performance.now() - t < 300 && Math.abs(progress) > 0.08;
    if (!steps && (Math.abs(progress) > 0.2 || flick)) steps = progress < 0 ? -1 : 1;
    show(active - steps);
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('dragstart', (event) => event.preventDefault());
  // Le clic qui termine un glisser n'ouvre ni une carte ni un lien
  stage.addEventListener('click', (event) => {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
    dragged = false;
  }, true);
  cards.forEach((card, i) => card.addEventListener('click', () => {
    if (i !== active) go(i);
  }));

  document.addEventListener('keydown', (event) => {
    if (!inView || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') go(active - 1);
    if (event.key === 'ArrowRight') go(active + 1);
  });

  if (window.matchMedia('(hover: hover)').matches) {
    stage.addEventListener('pointerenter', () => { hovered = true; schedule(); });
    stage.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  }

  const enter = (value) => {
    inView = value;
    if (value && !seen) {
      seen = true;
      stage.classList.add('is-seen');
      show(active);
    }
    schedule();
  };
  show(0);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => enter(entry.isIntersecting), { threshold: 0.35 }).observe(stage);
  } else {
    enter(true);
  }
}

// Scène de l'agent IA : les yeux suivent la souris. Sans souris (écran tactile) ou après quelques secondes
// sans mouvement, ils regardent autour d'eux. Le clignement est en CSS.
const faces = [...document.querySelectorAll('[data-face]')];
if (faces.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let pointer = null;
  let frame = 0;
  let idleTimer = 0;
  const look = (face, x, y) => {
    face.style.setProperty('--lx', x.toFixed(3));
    face.style.setProperty('--ly', y.toFixed(3));
  };
  const follow = () => {
    frame = 0;
    if (!pointer) return;
    faces.forEach((face) => {
      const box = face.getBoundingClientRect();
      if (!box.width || box.bottom < 0 || box.top > window.innerHeight) return;
      const dx = pointer.x - (box.left + box.width / 2);
      const dy = pointer.y - (box.top + box.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / box.width); // regard franc dès que la souris s'éloigne un peu
      look(face, (dx / distance) * reach, (dy / distance) * reach);
    });
  };
  const wander = () => {
    pointer = null;
    faces.forEach((face) => look(face, Math.random() * 1.6 - 0.8, Math.random() * 1.2 - 0.6));
    idleTimer = setTimeout(wander, 1800 + Math.random() * 1800);
  };
  const track = (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    pointer = { x: event.clientX, y: event.clientY };
    clearTimeout(idleTimer);
    idleTimer = setTimeout(wander, 5000);
    if (!frame) frame = requestAnimationFrame(follow);
  };
  window.addEventListener('pointermove', track, { passive: true });
  window.addEventListener('scroll', () => {
    if (pointer && !frame) frame = requestAnimationFrame(follow);
  }, { passive: true });
  wander();
}

// Engagements : chaque engagement pilote l'écran de droite. Quand la barre orange de l'engagement actif est pleine,
// on passe au suivant ; le survol de la liste met en pause (CSS) et tout s'arrête hors écran.
const pledges = document.querySelector('[data-pledges]');
if (pledges) {
  const items = [...pledges.querySelectorAll('.pledge')];
  const screens = [...pledges.querySelectorAll('.pledge-il')];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timers = [];
  let started = false;

  // Les étapes de l'illustration s'allument une à une (les points de saisie s'effacent devant le message)
  const play = (il) => {
    timers.forEach(clearTimeout);
    timers = [];
    const steps = [...il.querySelectorAll('[data-step]')];
    steps.forEach((step) => step.classList.remove('is-on'));
    if (still) {
      steps.forEach((step) => { if (!step.hasAttribute('data-transient')) step.classList.add('is-on'); });
      return;
    }
    let delay = 350;
    steps.forEach((step, k) => {
      timers.push(setTimeout(() => {
        const prev = steps[k - 1];
        if (prev && prev.hasAttribute('data-transient')) prev.classList.remove('is-on');
        step.classList.add('is-on');
      }, delay));
      delay += step.hasAttribute('data-transient') ? 1000 : 700;
    });
  };

  const show = (index) => {
    items.forEach((item, i) => {
      const active = i === index;
      item.classList.toggle('is-active', active);
      item.querySelector('.pledge__btn').setAttribute('aria-pressed', String(active));
      if (active) {
        // Relance la barre même si l'engagement était déjà actif
        const bar = item.querySelector('.pledge__bar');
        bar.style.animation = 'none';
        void bar.offsetWidth;
        bar.style.animation = '';
      }
    });
    screens.forEach((screen, i) => screen.classList.toggle('is-active', i === index));
    play(screens[index]);
  };

  items.forEach((item, i) => {
    item.querySelector('.pledge__btn').addEventListener('click', () => show(i));
    item.querySelector('.pledge__bar').addEventListener('animationend', () => show((i + 1) % items.length));
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      pledges.classList.toggle('is-paused', !entry.isIntersecting);
      if (entry.isIntersecting && !started) {
        started = true;
        show(0);
      }
    }, { threshold: 0.3 }).observe(pledges);
  } else {
    show(0);
  }
}

// Méthode : où les cartes se figent. Si l'écran est assez grand, le titre reste figé en haut et
// les cartes se centrent dans la place restante ; sinon elles se centrent dans l'écran.
const stepCards = [...document.querySelectorAll('.step-card')];
if (stepCards.length) {
  const cardsList = stepCards[0].parentElement;
  const methodInner = cardsList.parentElement;
  const intro = methodInner.querySelector('.method__intro');
  const INTRO_TOP = 100; // sous la barre de navigation
  const placeCards = () => {
    // Toutes les cartes prennent la hauteur de la plus grande, pour une pile régulière
    cardsList.style.removeProperty('--card-h');
    const measured = Math.max(...stepCards.map((card) => card.offsetHeight));
    const step = parseFloat(getComputedStyle(cardsList).getPropertyValue('--stack-step')) || 0;
    const stack = (stepCards.length - 1) * step;
    methodInner.classList.remove('has-pinned-intro');
    const introBottom = INTRO_TOP + intro.offsetHeight + 24;
    const desktop = window.matchMedia('(min-width: 861px)').matches;
    // En bureau, les cartes gagnent jusqu'à 64 px de hauteur, tant que le titre figé et la pile tiennent à l'écran
    const extra = desktop ? Math.min(64, Math.max(0, window.innerHeight - introBottom - measured - stack - 16)) : 0;
    const tallest = measured + extra;
    cardsList.style.setProperty('--card-h', `${tallest}px`);
    const free = window.innerHeight - introBottom - tallest - stack;
    const pinned = desktop && free >= 16;
    methodInner.classList.toggle('has-pinned-intro', pinned);
    // Au plus près du centre de l'écran, sans jamais passer sous le titre figé
    const top = pinned
      ? Math.max(introBottom + 16, (window.innerHeight - tallest - stack) / 2)
      : Math.max(INTRO_TOP - 16, (window.innerHeight - tallest - stack) / 2);
    cardsList.style.setProperty('--stick-top', `${Math.round(top)}px`);
  };
  placeCards();
  window.addEventListener('resize', placeCards);
  window.addEventListener('load', placeCards);
}

// Méthode, pendant le défilement :
// - chaque carte recule d'un cran par carte déjà figée devant elle (pile régulière) ;
// - quand la pile repart vers le haut, le titre figé remonte du même nombre de pixels,
//   pour qu'il ne passe jamais par-dessus les cartes.
if (stepCards.length > 1) {
  const cardsList = stepCards[0].parentElement;
  const methodInner = cardsList.parentElement;
  const intro = methodInner.querySelector('.method__intro');
  const lastCard = stepCards[stepCards.length - 1];
  const animateDepth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ticking = false;
  const stackCards = () => {
    ticking = false;
    const base = parseFloat(cardsList.style.getPropertyValue('--stick-top')) || 0;
    const step = parseFloat(getComputedStyle(cardsList).getPropertyValue('--stack-step')) || 0;

    const lastTarget = base + (stepCards.length - 1) * step;
    const lift = methodInner.classList.contains('has-pinned-intro')
      ? Math.max(0, lastTarget - lastCard.getBoundingClientRect().top)
      : 0;
    intro.style.transform = lift > 0.5 ? `translateY(${-Math.round(lift)}px)` : '';

    if (!animateDepth) return;
    const stuck = stepCards.map((card, j) => card.getBoundingClientRect().top <= base + j * step + 1);
    stepCards.forEach((card, i) => {
      const depth = stuck.slice(i + 1).filter(Boolean).length;
      card.style.transform = depth ? `scale(${1 - depth * 0.035})` : '';
      card.style.filter = depth ? `brightness(${1 - depth * 0.05})` : '';
    });
  };
  window.addEventListener('resize', stackCards);
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(stackCards);
    }
  }, { passive: true });
  stackCards();
}

// Constat : le texte passe du flou au net lettre par lettre, au rythme du défilement.
// Les lettres découpées sont masquées aux lecteurs d'écran, qui lisent une copie intacte du texte.
const revealSection = document.querySelector('[data-reveal-section]');
if (revealSection) {
  const text = revealSection.querySelector('[data-reveal-text]');
  const original = text.textContent.replace(/\s+/g, ' ').trim();
  let index = 0;

  const split = (node) => {
    const frag = document.createDocumentFragment();
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.append(' ');
            return;
          }
          const word = document.createElement('span');
          word.className = 'pains__word';
          for (const char of part) {
            const letter = document.createElement('span');
            letter.className = 'pains__char';
            letter.style.setProperty('--i', index++);
            letter.textContent = char;
            word.append(letter);
          }
          frag.append(word);
        });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const wrapper = child.cloneNode(false);
        wrapper.append(split(child));
        frag.append(wrapper);
      }
    });
    return frag;
  };

  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  visual.append(split(text));
  const readable = document.createElement('span');
  readable.className = 'sr-only';
  readable.textContent = original;
  text.replaceChildren(readable, visual);
  text.style.setProperty('--n', index);

  // La révélation commence quand la section arrive à mi-écran et finit un peu avant qu'elle reparte.
  // Sur mobile, la barre d'adresse qui se replie change innerHeight en plein défilement : on garde donc une
  // hauteur d'écran fixe, mise à jour seulement quand la largeur change (rotation), pour éviter les à-coups.
  let viewH = window.innerHeight;
  let viewW = window.innerWidth;
  let lastP = -1;
  const updateReveal = () => {
    const rect = revealSection.getBoundingClientRect();
    const start = viewH * 0.5;
    const total = rect.height - viewH + start;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / total));
    const p = Math.min(1, progress / 0.85);
    if (Math.abs(p - lastP) < 0.001) return; // rien n'a bougé : pas de recalcul des 150 lettres
    lastP = p;
    text.style.setProperty('--p', p.toFixed(4));
  };
  const onResize = () => {
    if (window.innerWidth !== viewW) {
      viewW = window.innerWidth;
      viewH = window.innerHeight;
    }
    updateReveal();
  };
  let revealPending = false;
  window.addEventListener('scroll', () => {
    if (revealPending) return;
    revealPending = true;
    requestAnimationFrame(() => {
      revealPending = false;
      updateReveal();
    });
  }, { passive: true });
  window.addEventListener('resize', onResize);
  updateReveal();
}

// Logos clients : les versions en couleur (survol) sont préchargées une fois la page chargée
if (window.matchMedia('(hover: hover)').matches) {
  window.addEventListener('load', () => {
    const urls = new Set([...document.querySelectorAll('.clients__group li')]
      .map((li) => (li.style.getPropertyValue('--logo').match(/url\(['"]?([^'")]+)/) || [])[1])
      .filter(Boolean));
    const preload = () => urls.forEach((url) => { new Image().src = url; });
    if ('requestIdleCallback' in window) requestIdleCallback(preload);
    else setTimeout(preload, 1500);
  });
}

// Simulateur : fois par jour × minutes à chaque fois, ramené au mois (21 jours travaillés) et à l'année
// (journées de 7 h). Les curseurs sont continus (sans cran) ; les valeurs affichées sont arrondies.
// Micro-interactions d'après la bibliothèque Arc : les chiffres roulent jusqu'à la nouvelle valeur, le surlignage
// glisse d'une tâche à l'autre, « Autre tâche » ouvre un champ pour nommer la sienne, un curseur poussé au-delà de
// sa butée résiste puis revient, et le bouton confirme avant d'amener au formulaire, où il note la tâche si le
// visiteur n'a rien écrit. Tout se joue la première fois que la section entre à l'écran.
const savings = document.querySelector('[data-savings]');
if (savings) {
  const DAYS_PER_MONTH = 21;
  const HOURS_PER_DAY = 7;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inputs = {
    nombre: savings.querySelector('[data-savings-in="nombre"]'),
    minutes: savings.querySelector('[data-savings-in="minutes"]'),
  };
  const out = (name) => savings.querySelector(`[data-savings-out="${name}"]`);
  const pick = (name) => savings.querySelector(`[data-savings-${name}]`);
  const tabs = savings.querySelector('.savings__tabs');
  const glide = savings.querySelector('.savings__glide');
  const other = pick('other');
  const namePanel = pick('name');
  const nameInput = namePanel.querySelector('input');
  const duration = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (!h) return `${m} min`;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  };
  const valueOf = (input) => Math.round(Number(input.value));

  // Chiffres qui roulent : une colonne 0 à 9 par chiffre, décalée jusqu'au bon chiffre
  const DIGITS = '0123456789'.split('').map((d) => `<span>${d}</span>`).join('');
  const roll = (el, text) => {
    const tokens = text.match(/\d|\s|[^\d\s]+/g);
    const shape = tokens.map((t) => (/\d/.test(t) ? '#' : t)).join('');
    if (el.dataset.shape !== shape) {
      el.dataset.shape = shape;
      el.innerHTML = tokens.map((t) => {
        if (/\d/.test(t)) return `<span class="roll"><span class="roll__strip">${DIGITS}</span></span>`;
        if (/\s/.test(t)) return '<span class="roll__space"> </span>';
        return `<span class="roll__unit">${t}</span>`;
      }).join('');
      el.getBoundingClientRect(); // une nouvelle forme part de 0 et roule jusqu'à sa valeur
    }
    const strips = el.querySelectorAll('.roll__strip');
    tokens.filter((t) => /\d/.test(t)).forEach((d, k) => {
      strips[k].style.transitionDelay = `${k * 30}ms`;
      strips[k].style.transform = `translateY(${-Number(d) * 10}%)`;
    });
  };

  const moveGlide = () => {
    const label = savings.querySelector('input[name="tache"]:checked').closest('label');
    glide.style.width = `${label.offsetWidth}px`;
    glide.style.height = `${label.offsetHeight}px`;
    glide.style.transform = `translate(${label.offsetLeft}px, ${label.offsetTop}px)`;
  };

  // La tâche : une suggestion (« à relancer des clients ») ou le nom donné par le visiteur (« sur « … » »)
  const customName = () => nameInput.value.trim();
  const phrase = () => {
    const el = pick('phrase');
    const b = document.createElement('b');
    if (other.checked) {
      b.textContent = customName() ? `« ${customName()} »` : 'cette tâche';
      el.replaceChildren(customName() ? 'sur ' : 'pour ', b);
    } else {
      b.textContent = savings.querySelector('input[name="tache"]:checked').value;
      el.replaceChildren('à ', b);
    }
  };
  const taskLabel = () => {
    if (!other.checked) return savings.querySelector('input[name="tache"]:checked').value;
    return customName() || 'une tâche répétitive';
  };

  let seen = false;
  let summary = '';
  let liveTimer = 0;
  const atLimit = {};
  const update = () => {
    const nombre = valueOf(inputs.nombre);
    const minutes = valueOf(inputs.minutes);
    Object.entries(inputs).forEach(([name, input]) => {
      input.style.setProperty('--p', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
      // Arrivé en butée, la valeur le signale d'une légère pulsation
      const limit = Number(input.value) <= Number(input.min) || Number(input.value) >= Number(input.max);
      if (limit && !atLimit[name] && seen) {
        const field = input.closest('.savings__field');
        field.classList.add('is-limit');
        setTimeout(() => field.classList.remove('is-limit'), 500);
      }
      atLimit[name] = limit;
    });
    out('nombre').textContent = `${nombre} fois`;
    out('minutes').textContent = duration(minutes);
    namePanel.classList.toggle('is-open', other.checked);
    nameInput.tabIndex = other.checked ? 0 : -1;
    phrase();
    moveGlide();

    const perDay = nombre * minutes;
    const perMonth = perDay * DAYS_PER_MONTH;
    const days = Math.round((perMonth * 12) / 60 / HOURS_PER_DAY);
    pick('day').textContent = duration(perDay);
    pick('year').textContent = days < 1 ? "moins d'un jour de travail" : `${days} jour${days > 1 ? 's' : ''} de travail`;
    summary = `Automatiser une tâche : ${taskLabel()}, environ ${nombre} fois par jour, ${duration(minutes)} à chaque fois (soit ${duration(perMonth)} par mois).`;
    if (!seen) return;
    roll(pick('total'), duration(perMonth));
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { pick('live').textContent = `${duration(perMonth)} par mois.`; }, 600);
  };

  savings.addEventListener('input', update);
  window.addEventListener('resize', moveGlide, { passive: true });
  other.addEventListener('change', () => {
    if (other.checked) setTimeout(() => nameInput.focus({ preventScroll: true }), 250);
  });

  Object.values(inputs).forEach((input) => {
    const field = input.closest('.savings__field');
    // Clavier : un pas d'une unité (cinq avec Page précédente / suivante), puisque le curseur est continu
    input.addEventListener('keydown', (event) => {
      const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 };
      let next = null;
      if (event.key in steps) next = valueOf(input) + steps[event.key];
      if (event.key === 'Home') next = Number(input.min);
      if (event.key === 'End') next = Number(input.max);
      if (next === null) return;
      event.preventDefault();
      input.value = Math.min(Number(input.max), Math.max(Number(input.min), next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Butée élastique : tant qu'on tire au-delà du bout du curseur, il suit un peu, puis revient au relâchement
    let dragging = false;
    const release = () => {
      if (!dragging) return;
      dragging = false;
      input.classList.remove('is-pulling');
      input.style.setProperty('--pull', '0px');
      field.classList.remove('is-limit');
    };
    input.addEventListener('pointerdown', () => { dragging = !still; });
    window.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const box = input.getBoundingClientRect();
      let over = 0;
      if (event.clientX > box.right && Number(input.value) >= Number(input.max)) over = event.clientX - box.right;
      if (event.clientX < box.left && Number(input.value) <= Number(input.min)) over = event.clientX - box.left;
      const pull = Math.sign(over) * Math.min(14, Math.sqrt(Math.abs(over)) * 1.6); // plus on tire, moins il suit
      input.classList.toggle('is-pulling', over !== 0);
      input.style.setProperty('--pull', `${pull.toFixed(1)}px`);
      field.classList.toggle('is-limit', over !== 0);
    }, { passive: true });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  });

  // Bouton : confirmation sur place, puis le formulaire, avec la tâche notée dans le besoin
  const cta = pick('cta');
  cta.addEventListener('click', (event) => {
    const besoin = document.querySelector('textarea[name="besoin"]');
    if (besoin && (!besoin.value.trim() || besoin.dataset.fromSimulator === 'true')) {
      besoin.value = summary;
      besoin.dataset.fromSimulator = 'true';
      besoin.addEventListener('input', () => { besoin.dataset.fromSimulator = 'false'; }, { once: true });
    }
    if (still) return;
    event.preventDefault();
    cta.classList.add('is-done');
    setTimeout(() => {
      document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => cta.classList.remove('is-done'), 1500);
    }, 750);
  });

  // Première apparition : le titre se dévoile mot à mot et le total roule depuis zéro
  const title = savings.querySelector('[data-blur-title]');
  if (!still) {
    const words = title.textContent.trim().split(' ');
    title.innerHTML = words.map((word, i) => `<span class="bw" style="--w: ${i}">${word}</span>`).join(' ');
  }
  roll(pick('total'), pick('total').textContent.replace(/\d/g, '0'));
  update();
  requestAnimationFrame(() => tabs.classList.add('is-ready'));
  const enter = () => {
    if (seen) return;
    seen = true;
    title.classList.add('is-in');
    update();
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      enter();
      observer.disconnect();
    }, { threshold: 0.3 });
    observer.observe(savings);
  } else {
    enter();
  }
}

// FAQ : une question ouverte à la fois ; à l'ouverture, l'assistant « écrit » un instant puis sa réponse apparaît
const faq = document.querySelector('[data-faq]');
if (faq) {
  const items = [...faq.querySelectorAll('.faq__item')];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  items.forEach((item) => {
    item.querySelector('.faq__q').addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      items.forEach((other) => {
        const on = other === item && open;
        other.classList.toggle('is-open', on);
        other.querySelector('.faq__q').setAttribute('aria-expanded', String(on));
      });
      if (open && !still) {
        item.classList.add('is-typing');
        setTimeout(() => item.classList.remove('is-typing'), 700);
      }
    });
  });
}

// Machine à écrire (page Étude de cas) : les textes de data-typewriter s'écrivent puis s'effacent en boucle.
// Le dernier reste affiché plus longtemps ; sans animation, seul le texte d'origine reste en place.
document.querySelectorAll('[data-typewriter]').forEach((el) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let words;
  try { words = JSON.parse(el.dataset.typewriter); } catch { return; }
  if (!Array.isArray(words) || !words.length) return;
  let w = words.length - 1;
  let text = el.textContent;
  let deleting = true;
  const tick = () => {
    const target = words[w];
    if (deleting) {
      text = text.slice(0, -1);
      if (!text) { deleting = false; w = (w + 1) % words.length; }
    } else {
      text = target.slice(0, text.length + 1);
      if (text === target) {
        deleting = true;
        el.textContent = text;
        setTimeout(tick, w === words.length - 1 ? 3200 : 1600);
        return;
      }
    }
    el.textContent = text;
    setTimeout(tick, deleting ? 35 : 70);
  };
  setTimeout(tick, 2400);
});

// Étape 1 : le chronomètre de la visio avance chaque seconde
const callTimer = document.querySelector('[data-call-timer]');
if (callTimer) {
  let seconds = 12 * 60 + 4;
  setInterval(() => {
    seconds += 1;
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    callTimer.textContent = `${mm}:${ss}`;
  }, 1000);
}

// Chaque bloc .reveal apparaît une fois, quand il entre dans l'écran.
// Sans IntersectionObserver, les blocs restent simplement visibles.
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px' });

  document.documentElement.classList.add('js');
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
}

// Arrivée depuis une autre page sur une ancre (par exemple /#contact) : on attend que la mise en page soit stable
// (cartes de la Méthode, polices), puis on va directement à la section, sans défilement animé sur toute la page.
if (location.hash.length > 1) {
  const anchorTarget = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (anchorTarget) {
    window.addEventListener('load', () => {
      requestAnimationFrame(() => {
        const root = document.documentElement;
        root.style.scrollBehavior = 'auto';
        anchorTarget.scrollIntoView();
        root.style.removeProperty('scroll-behavior');
      });
    });
  }
}
