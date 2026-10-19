// Fonction Vercel : reçoit la demande de rendez-vous du formulaire de la landing, la vérifie et l'envoie
// à la boîte mail Nextylab par SMTP (messagerie Hostinger). Variables d'environnement à définir dans Vercel
// (Settings > Environment Variables) :
// - SMTP_USER : adresse de la boîte qui envoie, par exemple contact@nextylab.com
// - SMTP_PASS : mot de passe de cette boîte
// - SMTP_HOST et SMTP_PORT : facultatifs, smtp.hostinger.com et 465 par défaut
// - DEMANDE_DESTINATAIRE : facultatif, adresse qui reçoit les demandes (SMTP_USER par défaut)
// Tant que SMTP_USER ou SMTP_PASS manque, la fonction répond 503 et le formulaire propose d'écrire à contact@nextylab.com.
const nodemailer = require('nodemailer');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s.()-]{9,}$/;
const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

const clean = (value, max) => String(value || '').trim().slice(0, max);
const escape = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return res.status(503).json({ ok: false, error: 'non-configure' });
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const to = process.env.DEMANDE_DESTINATAIRE || SMTP_USER;

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const data = {
    date: clean(body.date, 10),
    heure: clean(body.heure, 5),
    besoin: clean(body.besoin, 2000),
    nom: clean(body.nom, 120),
    contact: clean(body.contact, 160),
  };

  // Champ piège rempli : un robot, on fait comme si tout allait bien
  if (clean(body.site, 200)) return res.status(200).json({ ok: true });

  const day = new Date(`${data.date}T12:00:00Z`);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(data.date) && !Number.isNaN(day.getTime())
    && SLOTS.includes(data.heure) && data.besoin && data.nom
    && (EMAIL.test(data.contact) || PHONE.test(data.contact));
  if (!valid) return res.status(400).json({ ok: false, error: 'champs' });

  const jour = day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
  const heure = data.heure.replace(/^0/, '').replace(':00', ' h').replace(':', ' h ');
  const text = [
    'Nouvelle demande de rendez-vous',
    `Créneau souhaité : ${jour} à ${heure}`,
    `Nom : ${data.nom}`,
    `Contact : ${data.contact}`,
    '',
    'Besoin :',
    data.besoin,
  ].join('\n');
  const html = `
    <h2>Nouvelle demande de rendez-vous</h2>
    <p><strong>Créneau souhaité :</strong> ${escape(jour)} à ${escape(heure)}</p>
    <p><strong>Nom :</strong> ${escape(data.nom)}<br><strong>Contact :</strong> ${escape(data.contact)}</p>
    <p><strong>Besoin :</strong><br>${escape(data.besoin).replace(/\n/g, '<br>')}</p>`;

  try {
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    await transporter.sendMail({
      from: `"Site Nextylab" <${SMTP_USER}>`,
      to,
      replyTo: EMAIL.test(data.contact) ? data.contact : undefined,
      subject: `Demande de rendez-vous : ${data.nom}, ${jour} à ${heure}`,
      text,
      html,
    });
  } catch {
    return res.status(502).json({ ok: false, error: 'envoi' });
  }
  return res.status(200).json({ ok: true });
};
