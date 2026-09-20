import { BRAND } from '@/lib/brand';
import { divider, escapeHtml, lead, note, p, render, signature, toPlainText } from './layout';

/**
 * La séquence email du club — deux messages, pas un de plus.
 *
 *   01 · Candidature reçue  → à l'inscription, tout de suite ;
 *   02 · Bienvenue          → après validation, au délai configuré.
 *
 * Le principe : on adhère au club une seule fois, puis on reçoit une invitation
 * pour chaque soirée. Personne ne remplit deux fois le formulaire, et personne
 * n'est refusé : ce sont les groupes qui disent à quelle soirée une candidature
 * correspond.
 *
 * Le ton : on écrit comme on parlerait à quelqu'un en face. Se lancer demande
 * un peu de courage — on enlève la pression, et on n'oublie pas que la personne
 * en face peut être fatiguée des applis, ou intimidée à l'idée de venir seule.
 */

export type TemplateId = '01_candidature_recue' | '02_bienvenue';

export type EmailPayload = { subject: string; html: string; text: string };

type Vars = { firstName: string };

const CONTACT = BRAND.contactEmail;

const REPLY_FOOTER = 'Une question ? Réponds simplement à ce mail, on lit tout.';
const REPLY_FOOTER_CONTACT = `Une question ? Réponds simplement à ce mail, ou écris-nous à <a href="mailto:${CONTACT}" style="color:#77664C;">${CONTACT}</a>.`;

/** 01 · Candidature reçue — automatique, dès l'envoi du formulaire. */
function candidatureRecue({ firstName }: Vars): EmailPayload {
  const name = escapeHtml(firstName);
  const html = render({
    preheader: 'On a bien reçu ta candidature. On revient vers toi très vite.',
    body: [
      lead(`Bonjour ${name},`),
      p('Merci d’avoir répondu au questionnaire.'),
      p(
        'Chez nous, pas d’algorithme : on valide chaque profil manuellement. C’est plus lent, mais c’est exactement ce qui fait que les soirées se passent bien.',
      ),
      p(
        'On revient vers toi très vite pour te dire si ton inscription au club est validée. D’ici là, tu n’as rien à faire — on s’occupe du reste.',
      ),
      signature(),
    ],
    footer: REPLY_FOOTER,
  });
  return { subject: `Inscription ${firstName}`, html, text: toPlainText(html) };
}

/** 02 · Bienvenue dans le club — 24 h après la validation par les deux curateurs. */
function bienvenue({ firstName }: Vars): EmailPayload {
  const name = escapeHtml(firstName);
  const html = render({
    preheader: 'Ta place dans le club est acquise. Rien à payer, rien à refaire.',
    body: [
      lead(`Bonne nouvelle, ${name}`),
      p('Ta description nous a convaincus. Tu fais maintenant partie du club Lille in Love.'),
      divider(),
      p(
        'Ce que ça veut dire, concrètement : dès qu’une soirée correspond à ton profil (tranche d’âge, attentes…), tu reçois une invitation avec la date, le lieu et le tarif. Tu viens si tu en as envie. Aucune obligation.',
      ),
      note(
        'Rien à payer aujourd’hui, et rien à refaire non plus : ta place dans le club est acquise une fois pour toutes.',
      ),
      p('On a hâte de te rencontrer pour de vrai.'),
      signature(),
    ],
    footer: REPLY_FOOTER_CONTACT,
  });
  return { subject: 'Bienvenue dans le club', html, text: toPlainText(html) };
}

const BUILDERS: Record<TemplateId, (vars: Vars) => EmailPayload> = {
  '01_candidature_recue': candidatureRecue,
  '02_bienvenue': bienvenue,
};

export function buildEmail(template: TemplateId, vars: Vars): EmailPayload {
  return BUILDERS[template](vars);
}

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  '01_candidature_recue': '01 · Candidature reçue',
  '02_bienvenue': '02 · Bienvenue dans le club',
};

/* ====================================================================
   L'alerte interne — celle qu'on s'envoie à soi-même
   ==================================================================== */

/** Le modèle sous lequel l'alerte est journalisée, à côté de la séquence. */
export const ALERTE_INTERNE = '00_alerte_interne';

export type AlerteVars = {
  prenom: string;
  nom: string;
  email: string;
  parcours: 'court' | 'complet';
  ville?: string | null;
  age?: number | null;
  ficheUrl?: string | null;
};

/**
 * Prévient l'équipe qu'une candidature vient d'arriver.
 *
 * Ce message ne part pas au candidat mais à nous : on répond directement à
 * la personne en cliquant « Répondre », et le lien mène droit à sa fiche.
 */
export function buildAlerteInterne(vars: AlerteVars): EmailPayload {
  const qui = escapeHtml(`${vars.prenom} ${vars.nom}`.trim());
  const reperes = [
    vars.age ? `${vars.age} ans` : null,
    vars.ville,
    vars.parcours === 'court' ? 'formulaire court' : 'questionnaire complet',
  ]
    .filter(Boolean)
    .map((bout) => escapeHtml(String(bout)))
    .join(' · ');

  const html = render({
    preheader: `${qui} vient de s’inscrire.`,
    body: [
      lead(`Nouvelle candidature — ${qui}`),
      p(`<strong>${escapeHtml(vars.email)}</strong><br>${reperes}`),
      ...(vars.ficheUrl
        ? [note(`<a href="${escapeHtml(vars.ficheUrl)}">Ouvrir la fiche dans l’espace curation</a>`)]
        : []),
      p('Réponds à ce message pour écrire directement à la personne.'),
    ],
  });

  return { subject: `Nouvelle candidature — ${vars.prenom} ${vars.nom}`.trim(), html, text: toPlainText(html) };
}
