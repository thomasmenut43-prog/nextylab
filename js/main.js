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

// Offres : la liste pilote l'objet 3D. Quand la barre de l'offre active est pleine, on passe à la
// suivante ; le survol met en pause (CSS) et l'animation s'arrête hors écran.
const offers = document.querySelector('[data-offers]');
if (offers) {
  const items = [...offers.querySelectorAll('.offer-item')];
  const images = [...offers.querySelectorAll('.offers__img')];

  const showOffer = (index) => {
    items.forEach((item, i) => {
      const active = i === index;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-current', String(active));
      if (active) {
        // Relance la barre même si l'offre était déjà active
        const bar = item.querySelector('.offer-item__bar');
        bar.style.animation = 'none';
        void bar.offsetWidth;
        bar.style.animation = '';
      }
    });
    images.forEach((img, i) => img.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
  };

  // Mobile : un glissement horizontal sur l'image passe à l'offre suivante ou précédente
  const dots = [...offers.querySelectorAll('.offers__dots i')];
  const visual = offers.querySelector('.offers__visual');
  let touchStart = null;
  visual.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  visual.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const current = items.findIndex((item) => item.classList.contains('is-active'));
    showOffer((current + (dx < 0 ? 1 : -1) + items.length) % items.length);
  }, { passive: true });

  items.forEach((item, i) => {
    item.addEventListener('click', () => showOffer(i));
    item.querySelector('.offer-item__bar').addEventListener('animationend', () => {
      showOffer((i + 1) % items.length);
    });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      offers.classList.toggle('is-paused', !entry.isIntersecting);
    }).observe(offers);
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
    const tallest = Math.max(...stepCards.map((card) => card.offsetHeight));
    cardsList.style.setProperty('--card-h', `${tallest}px`);
    const step = parseFloat(getComputedStyle(cardsList).getPropertyValue('--stack-step')) || 0;
    const stack = (stepCards.length - 1) * step;
    methodInner.classList.remove('has-pinned-intro');
    const introBottom = INTRO_TOP + intro.offsetHeight + 24;
    const free = window.innerHeight - introBottom - tallest - stack;
    const pinned = window.matchMedia('(min-width: 861px)').matches && free >= 16;
    methodInner.classList.toggle('has-pinned-intro', pinned);
    const top = pinned
      ? introBottom + Math.max(16, free / 2)
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

  // La révélation commence quand la section arrive à mi-écran et finit un peu avant qu'elle reparte
  const updateReveal = () => {
    const rect = revealSection.getBoundingClientRect();
    const start = window.innerHeight * 0.5;
    const total = rect.height - window.innerHeight + start;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / total));
    text.style.setProperty('--p', Math.min(1, progress / 0.85).toFixed(4));
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
  window.addEventListener('resize', updateReveal);
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
