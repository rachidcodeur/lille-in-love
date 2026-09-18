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
import { DECISION_TEMPLATES, templateAttendu } from '@/lib/decision';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/** Une réponse du questionnaire, ou la mention qu'elle n'a pas été demandée. */
function Answer({ term, value }: { term: string; value: string | null | undefined }) {
  return (
    <div className="adm-answer">
      <dt>{term}</dt>
      <dd className={value ? undefined : 'vide'}>{value || 'non renseigné'}</dd>
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

      <div className="adm-fiche">
        {/* ---- Colonne gauche : le visage et la décision ---- */}
        <div>
          <div className="adm-card">
            <p className="adm-card-title">Photos</p>
            <PhotoGallery photos={photos} firstName={member.first_name} />
          </div>

          <div className="adm-card">
            <GroupePicker memberId={member.id} groupe={member.soiree_group} />
          </div>

          <div className="adm-card adm-decision">
            <p className="adm-card-title">Décision</p>
            <FicheActions
              memberId={member.id}
              status={member.status}
              votesOui={member.votes_oui}
              votesRequis={env.votesRequis()}
              delaiMinutes={env.delaiReponseMinutes()}
            />
          </div>
        </div>

        {/* ---- Colonne droite : ce que la personne a répondu ---- */}
        <div>
          <div className="adm-card">
            <h1 className="adm-name">
              {member.first_name} {member.last_name}
            </h1>
            <p className="adm-ident">
              <a href={`mailto:${member.email}`}>{member.email}</a>
              {member.phone && <> · {member.phone}</>}
              <br />
              Candidature reçue {relative(member.created_at)}
              {isCourt && ' · formulaire court'}
            </p>

            <dl className="adm-answers">
              <Answer term="Je suis" value={label.gender(member.gender)} />
              <Answer
                term="Âge"
                value={
                  member.age
                    ? `${member.age} ans${
                        member.birth_date ? ` (${formatDate(member.birth_date)})` : ''
                      }`
                    : null
                }
              />
              <Answer
                term="Où"
                value={
                  member.city ? `${member.city}${member.postal_code ? ` (${member.postal_code})` : ''}` : null
                }
              />
              <Answer term="Orientation" value={label.orientation(member.orientation)} />
              <Answer
                term="Enfants"
                value={member.has_children === null ? null : member.has_children ? 'Oui' : 'Non'}
              />
              <Answer term="Cherche" value={label.lookingFor(member.looking_for)} />
              {member.children_preference && (
                <Answer
                  term="Enfants du partenaire"
                  value={label.childrenPreference(member.children_preference)}
                />
              )}
              <Answer term="Taille" value={member.height_cm ? `${member.height_cm} cm` : null} />
              <Answer term="Profession" value={member.profession} />
              <Answer term="Signe" value={label.zodiac(member.zodiac)} />
              <Answer term="Instagram" value={member.instagram} />
              <Answer term="Nous a connus par" value={label.referral(member.referral)} />
              <Answer
                term="Vient avec"
                value={
                  member.comes_with
                    ? [member.companion_first_name, member.companion_email]
                        .filter(Boolean)
                        .join(' · ') || 'Oui'
                    : member.comes_with === false
                      ? 'Seul·e'
                      : null
                }
              />
            </dl>
          </div>

          {(member.about || member.motivation || member.interests?.length) && (
            <div className="adm-card">
              <p className="adm-card-title">Ce qu’elle ou il raconte</p>
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
          )}

          <div className="adm-card">
            <p className="adm-card-title">Emails</p>
            {emails.length === 0 ? (
              <p className="adm-hint" style={{ margin: 0 }}>
                Aucun email pour l’instant.
              </p>
            ) : (
              <div className="adm-mails">
                {emails.map((mail) => (
                  <div className="adm-mail" key={mail.id}>
                    <span className="adm-dot" data-status={mail.status} aria-hidden="true" />
                    <div className="adm-mail-main">
                      <p className="adm-mail-name">{label.template(mail.template)}</p>
                      <p className="adm-mail-meta">
                        {EMAIL_STATUS_LABELS[mail.status] ?? mail.status}
                        {mail.status === 'programme' && mail.scheduled_at && (
                          <> · part {relative(mail.scheduled_at)} ({formatDateTime(mail.scheduled_at)})</>
                        )}
                        {mail.status === 'envoye' && mail.sent_at && (
                          <> · {formatDateTime(mail.sent_at)}</>
                        )}
                        {mail.status === 'echec' && mail.error && <> · {mail.error}</>}
                        {mail.soiree_nom && <> · soirée « {mail.soiree_nom} »</>}
                      </p>
                    </div>
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
