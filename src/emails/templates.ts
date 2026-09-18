import { BRAND } from '@/lib/brand';
import { divider, escapeHtml, lead, note, p, render, signature, toPlainText } from './layout';

/**
 * La séquence email du club.
 *
 * Le principe : on adhère au club une seule fois, puis on reçoit une invitation
 * pour chaque soirée. Personne ne remplit deux fois le formulaire, et personne
 * n'est jamais définitivement écarté.
 *
 * Le ton : on écrit comme on parlerait à quelqu'un en face. Se lancer demande
 * un peu de courage — on enlève la pression, et on n'oublie pas que la personne
 * en face peut être fatiguée des applis, ou intimidée à l'idée de venir seule.
 */

export type TemplateId =
  | '01_candidature_recue'
  | '02_bienvenue'
  | '03_on_reviendra'
  | '04_tranche_age';

export type EmailPayload = { subject: string; html: string; text: string };

type Vars = {
  firstName: string;
  /** Classe d'âge de la soirée qui déclenche l'envoi, ex. « 27-35 ». Sert au 04. */
  trancheAge?: string;
};

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

/** 03 · On reviendra vers toi — envoyé à la publication d'une soirée aux profils non retenus. */
function onReviendra({ firstName }: Vars): EmailPayload {
  const name = escapeHtml(firstName);
  const html = render({
    preheader: 'On garde ta candidature — et tu n’auras rien à refaire.',
    body: [
      lead(`Bonjour ${name},`),
      p(
        'Merci d’avoir pris le temps de nous écrire, et de nous avoir fait confiance avec tes réponses. Ce n’est pas rien.',
      ),
      p(
        'Pour l’instant, on ne va pas pouvoir te proposer de place. Ce n’est pas un jugement sur toi : on compose des groupes restreints — tranches d’âge, attentes, centres d’intérêt, parité, distance géographique — et l’équilibre de l’ensemble compte autant que chaque personne prise séparément.',
      ),
      note(
        'On garde ta candidature. Si elle correspond à une prochaine soirée, on revient vers toi — et tu n’auras rien à refaire.',
      ),
      p('En attendant, on te souhaite sincèrement de belles rencontres.'),
      signature(),
    ],
    footer: REPLY_FOOTER,
  });
  return { subject: `Candidature, ${firstName}`, html, text: toPlainText(html) };
}

/** 04 · Tranche d'âge — envoyé à la publication d'une soirée aux validés hors de sa classe d'âge. */
function trancheAge({ firstName, trancheAge: tranche }: Vars): EmailPayload {
  const name = escapeHtml(firstName);
  const classe = escapeHtml(tranche ?? '27-35');
  const html = render({
    preheader: 'Tu fais partie du club. Ta tranche d’âge ouvre juste après la prochaine soirée.',
    body: [
      lead(`Bonne nouvelle, ${name}`),
      p('Ta candidature est retenue : tu fais partie du club.'),
      p(
        `Une seule chose : notre prochaine soirée est réservée aux ${classe} ans, et ta tranche d’âge ouvrira juste après. On prend notre temps pour que tu vives la meilleure expérience possible lors de nos événements.`,
      ),
      note(
        'Tu seras dans les premiers prévenus à l’ouverture de la tienne. Pour l’instant, tu n’as rien à faire et rien à surveiller : on s’en occupe.',
      ),
      p('Merci de ta patience.'),
      signature(),
    ],
    footer: REPLY_FOOTER,
  });
  return { subject: `Inscription, ${firstName}`, html, text: toPlainText(html) };
}

const BUILDERS: Record<TemplateId, (vars: Vars) => EmailPayload> = {
  '01_candidature_recue': candidatureRecue,
  '02_bienvenue': bienvenue,
  '03_on_reviendra': onReviendra,
  '04_tranche_age': trancheAge,
};

export function buildEmail(template: TemplateId, vars: Vars): EmailPayload {
  return BUILDERS[template](vars);
}

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  '01_candidature_recue': '01 · Candidature reçue',
  '02_bienvenue': '02 · Bienvenue dans le club',
  '03_on_reviendra': '03 · On reviendra vers toi',
  '04_tranche_age': '04 · Ta tranche d’âge ouvrira plus tard',
};
