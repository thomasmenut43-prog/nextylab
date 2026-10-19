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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) {
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
  };

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
    const tallest = Math.max(...stepCards.map((card) => card.offsetHeight));
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

// Méthode : une carte recouverte par la suivante recule légèrement et s'assombrit
if (stepCards.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let ticking = false;
  const stackCards = () => {
    ticking = false;
    stepCards.forEach((card, i) => {
      const next = stepCards[i + 1];
      if (!next) return;
      const overlap = card.getBoundingClientRect().bottom - next.getBoundingClientRect().top;
      const covered = Math.max(0, Math.min(1, overlap / card.offsetHeight));
      card.style.transform = `scale(${1 - covered * 0.06})`;
      card.style.filter = `brightness(${1 - covered * 0.12})`;
    });
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(stackCards);
    }
  }, { passive: true });
  stackCards();
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
