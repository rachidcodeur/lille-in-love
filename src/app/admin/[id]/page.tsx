import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEmailLog, getMember, photoUrls } from '@/lib/admin';
import { env } from '@/lib/env';
import {
  EMAIL_STATUS_LABELS,
  formatDate,
  formatDateTime,
  label,
  relative,
} from '@/lib/libelles';
import { FicheActions } from '@/components/admin/FicheActions';
import { PhotoGallery } from '@/components/admin/PhotoGallery';
import { AnnulerEnvoi } from '@/components/admin/AnnulerEnvoi';
import { GroupePicker } from '@/components/admin/GroupePicker';
import { ActionsCorbeille } from '@/components/admin/ActionsCorbeille';
import { Icone, type NomIcone } from '@/components/admin/Icones';
import { Vignette } from '@/components/admin/Vignette';
import { DECISION_TEMPLATES, templateAttendu } from '@/lib/decision';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

type Fait = { terme: string; valeur: string | null; icone: NomIcone };

/** Une réponse du questionnaire, ou la mention qu'elle n'a pas été donnée. */
function Answer({ terme, valeur, icone }: Fait) {
  return (
    <div className="adm-answer adm-fact" data-rempli={Boolean(valeur)}>
      <dt>
        <span className="adm-fact-ico">
          <Icone nom={icone} taille={14} />
        </span>
        {terme}
      </dt>
      <dd className={valeur ? undefined : 'vide'}>{valeur || 'non renseigné'}</dd>
    </div>
  );
}

export default async function FichePage({ params }: Props) {
  const { id } = await params;

  const member = await getMember(id);
  if (!member) notFound();

  const [photos, emails] = await Promise.all([photoUrls(member.id), getEmailLog(member.id)]);
  const isCourt = member.form_version === 'court';

  // Une réponse encore en attente qui ne correspond plus à la décision : elle
  // partirait à tort. On la signale et on propose de la stopper.
  const attendu = templateAttendu(member.status);
  const reponseIncoherente = emails.find(
    (mail) =>
      mail.status === 'programme' &&
      (DECISION_TEMPLATES as string[]).includes(mail.template) &&
      mail.template !== attendu,
  );

  // Les réponses, décrites une fois : l'affichage et le compteur
  // « N / M renseignés » lisent la même liste.
  const faits: Fait[] = [
    { terme: 'Je suis', valeur: label.gender(member.gender), icone: 'personne' },
    {
      terme: 'Âge',
      valeur: member.age
        ? `${member.age} ans${member.birth_date ? ` (${formatDate(member.birth_date)})` : ''}`
        : null,
      icone: 'calendrier',
    },
    {
      terme: 'Où',
      valeur: member.city
        ? `${member.city}${member.postal_code ? ` (${member.postal_code})` : ''}`
        : null,
      icone: 'lieu',
    },
    { terme: 'Orientation', valeur: label.orientation(member.orientation), icone: 'coeur' },
    {
      terme: 'Enfants',
      valeur: member.has_children === null ? null : member.has_children ? 'Oui' : 'Non',
      icone: 'enfants',
    },
    { terme: 'Cherche', valeur: label.lookingFor(member.looking_for), icone: 'loupe' },
    { terme: 'Taille', valeur: member.height_cm ? `${member.height_cm} cm` : null, icone: 'taille' },
    { terme: 'Profession', valeur: member.profession, icone: 'mallette' },
    { terme: 'Signe', valeur: label.zodiac(member.zodiac), icone: 'etoile' },
    { terme: 'Instagram', valeur: member.instagram, icone: 'instagram' },
    { terme: 'Nous a connus par', valeur: label.referral(member.referral), icone: 'avion' },
    {
      terme: 'Vient avec',
      valeur: member.comes_with
        ? [member.companion_first_name, member.companion_email].filter(Boolean).join(' · ') || 'Oui'
        : member.comes_with === false
          ? 'Seul·e'
          : null,
      icone: 'duo',
    },
  ];

  // Reprise de l'ancien formulaire : la question n'est plus posée, on ne
  // montre la case que lorsqu'une réponse existe.
  if (member.children_preference) {
    faits.splice(5, 0, {
      terme: 'Enfants du partenaire',
      valeur: label.childrenPreference(member.children_preference),
      icone: 'enfants',
    });
  }

  const renseignes = faits.filter((fait) => fait.valeur).length;
  const recit = member.about || member.motivation || member.interests?.length;

  return (
    <main className="adm-main">
      <Link href="/admin" className="adm-back">
        ← Toutes les candidatures
      </Link>

      {reponseIncoherente && (
        <AnnulerEnvoi
          memberId={member.id}
          reponse={label.template(reponseIncoherente.template)}
          partDans={relative(reponseIncoherente.scheduled_at)}
        />
      )}

      {member.suspect && (
        <div className="adm-alerte">
          <strong>Envoi inhabituel</strong> — {member.suspect_raison ?? 'rempli très vite'}.
          La candidature est conservée : c’est peut-être simplement quelqu’un de pressé.
          Jette un œil aux réponses avant de décider.
        </div>
      )}

      {/* ---- Bandeau : le visage, le nom, l'état ---- */}
      <section className="adm-hero">
        {photos[0] ? (
          <Vignette
            className="adm-avatar adm-avatar-hero"
            src={photos[0]}
            initiale={member.first_name.slice(0, 1).toUpperCase()}
          />
        ) : (
          <div className="adm-avatar adm-avatar-hero adm-avatar-empty" aria-hidden="true">
            {member.first_name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="adm-hero-main">
          <h1 className="adm-name">
            {member.first_name} {member.last_name}
          </h1>
          <p className="adm-ident">
            <a href={`mailto:${member.email}`}>{member.email}</a>
            {member.phone && <> · {member.phone}</>} · Candidature reçue{' '}
            {relative(member.created_at)}
            {isCourt && <span className="adm-tag">formulaire court</span>}
          </p>
        </div>

        <span className="adm-chip" data-status={member.status}>
          {label.status(member.status)}
        </span>
      </section>

      <div className="adm-fiche">
        {/* ---- Colonne gauche : les photos, le rangement, la décision ---- */}
        <div>
          <div className="adm-card">
            <div className="adm-card-head">
              <p className="adm-card-title">Photos</p>
              <span className="adm-card-aside">{photos.length} / 3</span>
            </div>
            <PhotoGallery photos={photos} firstName={member.first_name} />
          </div>

          <div className="adm-card">
            <GroupePicker memberId={member.id} groupe={member.soiree_group} />
          </div>

          <div className="adm-card adm-decision">
            <div className="adm-card-head">
              <p className="adm-card-title">Décision</p>
            </div>
            <FicheActions
              memberId={member.id}
              status={member.status}
              votesOui={member.votes_oui}
              votesRequis={env.votesRequis()}
              delaiMinutes={env.delaiReponseMinutes()}
            />
          </div>

          <div className="adm-card">
            <div className="adm-card-head">
              <p className="adm-card-title">Retirer</p>
            </div>
            <ActionsCorbeille memberId={member.id} nom={member.first_name} place="fiche" />
          </div>
        </div>

        {/* ---- Colonne droite : ce que la personne a répondu ---- */}
        <div>
          <div className="adm-card">
            <div className="adm-card-head">
              <p className="adm-card-title">Profil</p>
              <span className="adm-progres">
                {renseignes} / {faits.length} renseignés
                <span className="adm-progres-barre">
                  <i style={{ width: `${Math.round((renseignes / faits.length) * 100)}%` }} />
                </span>
              </span>
            </div>

            <dl className="adm-answers adm-facts">
              {faits.map((fait) => (
                <Answer key={fait.terme} {...fait} />
              ))}
            </dl>
          </div>

          {recit ? (
            <div className="adm-card">
              <div className="adm-card-head">
                <p className="adm-card-title">Ce qu’elle ou il raconte</p>
              </div>
              {member.about && (
                <>
                  <p className="adm-prose-label">En deux lignes</p>
                  <p className="adm-prose">{member.about}</p>
                </>
              )}
              {member.motivation && (
                <>
                  <p className="adm-prose-label">Pourquoi venir</p>
                  <p className="adm-prose">{member.motivation}</p>
                </>
              )}
              {member.interests?.length ? (
                <>
                  <p className="adm-prose-label">Centres d’intérêt</p>
                  <p className="adm-prose">
                    {label.interests(member.interests)}
                    {member.interests_other ? ` — ${member.interests_other}` : ''}
                  </p>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="adm-card">
            <div className="adm-card-head">
              <p className="adm-card-title">Emails</p>
              {emails.length > 0 && <span className="adm-card-aside">{emails.length}</span>}
            </div>

            {emails.length === 0 ? (
              <p className="adm-hint" style={{ margin: 0 }}>
                Aucun email pour l’instant.
              </p>
            ) : (
              <div className="adm-mails">
                {emails.map((mail) => (
                  <div className="adm-mail" key={mail.id}>
                    <span className="adm-mail-ico" aria-hidden="true">
                      <Icone nom="enveloppe" taille={17} />
                    </span>
                    <div className="adm-mail-main">
                      <p className="adm-mail-name">{label.template(mail.template)}</p>
                      <p className="adm-mail-meta">
                        {mail.status === 'programme' && mail.scheduled_at && (
                          <>
                            part {relative(mail.scheduled_at)} ({formatDateTime(mail.scheduled_at)})
                          </>
                        )}
                        {mail.status === 'envoye' && mail.sent_at && formatDateTime(mail.sent_at)}
                        {mail.status === 'echec' && mail.error}
                        {mail.soiree_nom && <> · soirée « {mail.soiree_nom} »</>}
                      </p>
                    </div>
                    <span className="adm-mail-etat" data-status={mail.status}>
                      <span className="adm-dot" data-status={mail.status} aria-hidden="true" />
                      {EMAIL_STATUS_LABELS[mail.status] ?? mail.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
