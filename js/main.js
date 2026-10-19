// Menu mobile, ombre de la barre de navigation et apparition des blocs au défilement.
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

// Un lien choisi referme le menu
menu.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenuOpen(false);
});

// Menu déroulant « Métiers » : ouverture au clic (et au survol en bureau, en CSS)
const dropdown = document.querySelector('.nav__dropdown');
const dropButton = dropdown && dropdown.querySelector('.nav__drop-btn');
const setDropdownOpen = (open) => {
  if (!dropdown) return;
  dropdown.classList.toggle('is-open', open);
  dropButton.setAttribute('aria-expanded', String(open));
};
if (dropdown) {
  dropButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setDropdownOpen(!dropdown.classList.contains('is-open'));
  });
  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target)) setDropdownOpen(false);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (dropdown && dropdown.classList.contains('is-open')) {
    setDropdownOpen(false);
    dropButton.focus();
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
// Flèches, points, clic sur une carte de côté, glisser au doigt et flèches du clavier quand la section est à l'écran.
// La scène de la carte active se joue quand elle devient active ; la toute première attend que la section soit vue.
// Les offres défilent seules toutes les 8 s tant que la section est à l'écran, en pause au survol, et plus du tout
// dès que le visiteur a navigué lui-même.
const offers = document.querySelector('[data-offers]');
if (offers) {
  const stage = offers.querySelector('[data-offers-stage]');
  const cards = [...stage.querySelectorAll('.offer-card')];
  const dots = [...offers.querySelectorAll('[data-offers-dots] button')];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DELAY = 8000;
  let active = 0;
  let seen = false;
  let inView = false;
  let hovered = false;
  let manual = false;
  let timer = 0;

  const show = (n) => {
    active = (n + cards.length) % cards.length;
    cards.forEach((card, i) => {
      let pos = i - active;
      if (pos > 1) pos -= cards.length;
      if (pos < -1) pos += cards.length;
      card.style.setProperty('--pos', pos);
      card.style.setProperty('--dist', Math.abs(pos));
      card.classList.toggle('is-active', seen && pos === 0);
      card.setAttribute('aria-hidden', String(pos !== 0));
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

  // Glisser : au-delà de 50 px on change d'offre, et le clic qui suit le geste est ignoré
  let startX = null;
  let swiped = false;
  stage.addEventListener('pointerdown', (event) => { startX = event.clientX; swiped = false; });
  stage.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) {
      swiped = true;
      go(active + (dx < 0 ? 1 : -1));
    }
  });
  stage.addEventListener('pointercancel', () => { startX = null; });
  cards.forEach((card, i) => card.addEventListener('click', () => {
    if (swiped || i === active) return;
    go(i);
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
