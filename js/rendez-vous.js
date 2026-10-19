// CTA final : demande de rendez-vous en trois étapes. 1) un jour ouvré dans les 60 prochains jours, 2) un créneau,
// 3) le besoin et les coordonnées ; la demande part en JSON vers /api/demande (fonction Vercel).
// C'est une demande : le créneau est confirmé ensuite par Nextylab.
(() => {
  const form = document.querySelector('[data-booking]');
  if (!form) return;

  const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
  const DAYS_AHEAD = 60;
  const panels = [...form.querySelectorAll('[data-panel]')];
  const steps = [...form.querySelectorAll('.booking__progress li')];
  const daysBox = form.querySelector('[data-cal-days]');
  const title = form.querySelector('[data-cal-title]');
  const prev = form.querySelector('[data-cal-prev]');
  const next = form.querySelector('[data-cal-next]');
  const slotsBox = form.querySelector('[data-slots]');
  const chosenDate = form.querySelector('[data-chosen-date]');
  const chosenSlot = form.querySelector('[data-chosen-slot]');
  const submit = form.querySelector('[data-submit]');
  const status = form.querySelector('[data-status]');
  const field = (name) => form.elements.namedItem(name);

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const label = (time) => time.replace(/^0/, '').replace(':00', ' h').replace(':', ' h ');
  const longDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const first = new Date(today);
  first.setDate(first.getDate() + 1); // à partir de demain
  const last = new Date(today);
  last.setDate(last.getDate() + DAYS_AHEAD);
  let view = new Date(first.getFullYear(), first.getMonth(), 1);
  let date = '';
  let time = '';
  let current = 1;

  // Passe à une étape ; on ne peut aller qu'à une étape déjà débloquée
  const goTo = (n) => {
    if ((n >= 2 && !date) || (n >= 3 && !time)) return;
    current = n;
    panels.forEach((panel) => { panel.hidden = Number(panel.dataset.panel) !== n; });
    steps.forEach((step, i) => {
      step.classList.toggle('is-active', i + 1 === n);
      step.classList.toggle('is-done', i + 1 < n);
      if (i + 1 === n) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    const legend = panels[n - 1].querySelector('legend');
    if (legend && form.contains(document.activeElement)) legend.focus({ preventScroll: true });
  };

  const bookable = (d) => d >= first && d <= last && d.getDay() !== 0 && d.getDay() !== 6;

  const renderMonth = () => {
    title.textContent = view.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const year = view.getFullYear();
    const month = view.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7; // semaine qui commence le lundi
    const count = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push('<span></span>');
    for (let day = 1; day <= count; day += 1) {
      const d = new Date(year, month, day);
      const value = iso(d);
      const classes = ['booking__day'];
      if (value === iso(today)) classes.push('is-today');
      if (value === date) classes.push('is-selected');
      cells.push(`<button class="${classes.join(' ')}" type="button" data-date="${value}"${bookable(d) ? '' : ' disabled'}
        aria-pressed="${value === date}" aria-label="${longDate(value)}">${day}</button>`);
    }
    daysBox.innerHTML = cells.join('');
    prev.disabled = view <= new Date(first.getFullYear(), first.getMonth(), 1);
    next.disabled = new Date(year, month + 1, 1) > last;
  };

  const renderSlots = () => {
    slotsBox.innerHTML = SLOTS.map((value) => `<button class="booking__slot${value === time ? ' is-selected' : ''}" type="button"
      data-time="${value}" aria-pressed="${value === time}">${label(value)}</button>`).join('');
  };

  prev.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderMonth(); });
  next.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderMonth(); });

  // Étape 1 : choisir un jour mène directement aux créneaux
  daysBox.addEventListener('click', (event) => {
    const button = event.target.closest('[data-date]');
    if (!button || button.disabled) return;
    date = button.dataset.date;
    field('date').value = date;
    chosenDate.textContent = capital(longDate(date));
    renderMonth();
    renderSlots();
    goTo(2);
  });

  // Étape 2 : choisir un créneau mène aux coordonnées
  slotsBox.addEventListener('click', (event) => {
    const button = event.target.closest('[data-time]');
    if (!button) return;
    time = button.dataset.time;
    field('heure').value = time;
    chosenSlot.textContent = `${capital(longDate(date))} à ${label(time)}`;
    renderSlots();
    goTo(3);
  });

  // Retour en arrière : liens « Changer » et étapes déjà franchies de l'indicateur
  form.addEventListener('click', (event) => {
    const target = event.target.closest('[data-goto]');
    if (!target) return;
    const n = Number(target.dataset.goto);
    if (n < current) goTo(n);
  });

  const setStatus = (html, error) => {
    status.innerHTML = html;
    status.classList.toggle('is-error', Boolean(error));
  };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE = /^\+?[\d\s.()-]{9,}$/;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = {
      date,
      heure: time,
      besoin: field('besoin').value.trim(),
      nom: field('nom').value.trim(),
      contact: field('contact').value.trim(),
      site: field('site').value,
    };
    ['besoin', 'nom', 'contact'].forEach((name) => field(name).removeAttribute('aria-invalid'));
    const contactOk = EMAIL.test(values.contact) || PHONE.test(values.contact);
    const missing = [];
    if (!values.besoin) { missing.push('votre besoin'); field('besoin').setAttribute('aria-invalid', 'true'); }
    if (!values.nom) { missing.push('votre nom'); field('nom').setAttribute('aria-invalid', 'true'); }
    if (!contactOk) { missing.push('un téléphone ou un e-mail valide'); field('contact').setAttribute('aria-invalid', 'true'); }
    if (missing.length) {
      setStatus(`Il manque ${missing.join(', ')}.`, true);
      return;
    }

    submit.disabled = true;
    setStatus('Envoi en cours…');
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error(String(response.status));
      form.innerHTML = `<div class="booking__done" role="status">
        <b aria-hidden="true">✓</b>
        <strong>Demande envoyée</strong>
        <p>On vous recontacte pour confirmer le ${longDate(values.date)} à ${label(values.heure)}.</p>
      </div>`;
    } catch {
      submit.disabled = false;
      setStatus('L\'envoi n\'a pas abouti. Écrivez-nous à <a href="mailto:contact@nextylab.com">contact@nextylab.com</a>.', true);
    }
  });

  renderMonth();
  goTo(1);
})();
