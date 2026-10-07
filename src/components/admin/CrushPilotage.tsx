'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { nomManche } from '@/lib/crush-regles';
import { sansAccent } from '@/lib/groupes';
import { Icone } from './Icones';

type Manche = {
  id: string;
  numero: number;
  prevu_a: string;
  ouvert_at: string | null;
  ferme_at: string | null;
  duree_minutes?: number | null;
};

type Personne = {
  id: string;
  first_name: string;
  email: string;
  photo: string | null;
  gender: 'femme' | 'homme' | null;
  retire_at: string | null;
  member_id: string | null;
  jeton: string;
  code?: string | null;
  notifiable: boolean;
};

async function commander(corps: Record<string, unknown>): Promise<string | null> {
  const r = await fetch('/api/admin/crush', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }).catch(() => null);
  if (r?.ok) return null;
  const res = (await r?.json().catch(() => null)) as { error?: string } | null;
  return res?.error ?? 'Le serveur n’a pas répondu.';
}

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Le tableau de bord du soir.
 *
 * Il sera consulté debout, dans une salle bruyante, par quelqu'un qui a
 * autre chose à faire. D'où les gros boutons, un seul geste par ligne, et
 * aucune confirmation sur ce qui se défait — ouvrir trop tôt se referme,
 * retirer quelqu'un se remet.
 *
 * Deux colonnes, et l'ordre n'est pas décoratif : à gauche ce qu'on fait
 * pendant la soirée — ouvrir une manche, faire l'appel —, à droite ce
 * qu'on consulte ou qu'on ne fait qu'une fois. L'œil va à gauche, et c'est
 * là qu'est le geste.
 */
export function CrushPilotage({
  manches,
  gens,
  soireeId,
  notificationsConfigurees,
  colonneDroite,
}: {
  soireeId: string;
  /** Ce qui vit à droite : le code, le QR, et l'ajout de dernière minute. */
  colonneDroite: React.ReactNode;
  manches: Manche[];
  gens: Personne[];
  /** Les clés VAPID sont-elles en place sur ce serveur ? */
  notificationsConfigurees: boolean;
}) {
  const router = useRouter();
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [duree, setDuree] = useState('5');
  const [pause, setPause] = useState('0');

  async function agir(cle: string, corps: Record<string, unknown>) {
    setOccupe(cle);
    setErreur(await commander(corps));
    setOccupe(null);
    router.refresh();
  }

  const presents = gens.filter((p) => !p.retire_at);
  const femmes = presents.filter((p) => p.gender === 'femme').length;
  const hommes = presents.filter((p) => p.gender === 'homme').length;
  const incomplets = presents.filter((p) => !p.gender);
  const notifiables = presents.filter((p) => p.notifiable).length;

  /**
   * Le piège qui coûterait une soirée.
   *
   * NEXT_PUBLIC_VAPID_PUBLIC_KEY est inscrite dans le code du navigateur
   * au moment de la compilation, pas lue au démarrage. Ajouter la variable
   * chez l'hébergeur puis seulement redémarrer laisse donc le serveur
   * croire que tout va bien — /api/health dit « oui » — pendant que
   * l'application livrée aux téléphones, elle, ne la connaît pas. Personne
   * ne voit alors le bouton pour activer, et rien ne le dit.
   *
   * Ce composant tourne dans le navigateur : la valeur qu'il lit est celle
   * de la compilation. Les comparer suffit à démasquer le cas.
   */
  const clePubliqueCompilee = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const compilationEnRetard = notificationsConfigurees && !clePubliqueCompilee;

  // Avant la première ouverture, cet écran sert à l'appel. Après, il sert à
  // rattraper : les deux ne se racontent pas de la même façon.
  const aucuneOuverte = manches.every((m) => !m.ouvert_at);

  // Seule la manche suivante porte le bouton franc. Trois boutons également
  // engageants, c'est une invitation à ouvrir le troisième crush time à 20h.
  const prochaine = manches.find((m) => !m.ouvert_at);

  // Le lien personnel de chacun. En production il porte le domaine du crush
  // time ; ailleurs, l'adresse qu'on a sous les yeux — un lien de maquette
  // doit rester cliquable depuis la maquette.
  //
  // Lue après coup et non pendant le rendu : le serveur ne connaît pas
  // l'adresse, et poser ici deux valeurs différentes mettait l'attribut
  // « title » en désaccord entre le serveur et le navigateur.
  const [racine, setRacine] = useState(BRAND.crushUrl);
  useEffect(() => setRacine(BRAND.crushUrl || window.location.origin), []);
  const lienDe = (p: Personne) => `${racine}/crush/c/${p.jeton}`;

  async function copier(texte: string, quoi: string) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(quoi);
      setTimeout(() => setCopie(null), 2000);
    } catch {
      setErreur('Le navigateur a refusé le presse-papiers. Sélectionne le texte à la main.');
    }
  }

  const terme = sansAccent(recherche.trim());
  const visibles = terme
    ? gens.filter(
        (p) => sansAccent(p.first_name).includes(terme) || sansAccent(p.email).includes(terme),
      )
    : gens;

  return (
    <div className="adm-pilotage">
      <div className="adm-pilotage-principal">
      <div className="adm-card">
        <div className="adm-card-head">
          <p className="adm-card-title">Les trois crush times</p>
          {aucuneOuverte && <span className="adm-card-aside">rien n’a encore été lancé</span>}
        </div>

        <div className="adm-manches">
          {manches.map((manche) => {
            // Une manche dont les quinze minutes sont écoulées est close,
            // même si personne ne l'a refermée : c'est ce que voit le
            // serveur quand quelqu'un essaie de liker.
            const fin = manche.ouvert_at
              ? new Date(manche.ouvert_at).getTime() + (manche.duree_minutes ?? 15) * 60_000
              : null;
            const ecoulee = fin !== null && Date.now() >= fin;
            const ouverte = Boolean(manche.ouvert_at) && !manche.ferme_at && !ecoulee;
            const finie = Boolean(manche.ferme_at) || ecoulee;
            return (
              <div
                className="adm-manche"
                key={manche.id}
                data-etat={ouverte ? 'ouverte' : finie ? 'finie' : 'attente'}
                data-suivante={manche.id === prochaine?.id || undefined}
              >
                <div>
                  <p className="adm-manche-nom">
                    {/* Celle qui tourne se repère sans lire : c'est l'état
                        qu'on cherche des yeux en arrivant sur la page. */}
                    {ouverte && <span className="adm-pastille-vive" aria-hidden="true" />}
                    {nomManche(manche.numero)}
                  </p>
                  <p className="adm-manche-heure">
                    {ouverte
                      ? `Ouvert à ${heure(manche.ouvert_at!)} · se referme à ${heure(new Date(fin!).toISOString())}`
                      : finie
                        ? `Terminé à ${heure(manche.ferme_at ?? new Date(fin!).toISOString())}`
                        : `Annoncé à ${heure(manche.prevu_a)}`}
                  </p>
                </div>
                {ouverte ? (
                  <button
                    type="button"
                    className="adm-btn adm-btn-grand"
                    disabled={occupe === manche.id}
                    onClick={() => agir(manche.id, { action: 'fermer', mancheId: manche.id })}
                  >
                    Fermer
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`adm-btn${
                      manche.id === prochaine?.id ? ' adm-btn-yes adm-btn-grand' : ''
                    }`}
                    disabled={occupe === manche.id}
                    onClick={() => agir(manche.id, { action: 'ouvrir', mancheId: manche.id })}
                  >
                    {finie ? 'Rouvrir' : 'Ouvrir'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="adm-hint">
          Tu lances le premier ; <strong>les suivants s’ouvrent seuls à l’heure annoncée</strong>,
          et chacun se referme au bout de sa durée. Rien ne part avant ton premier geste. Rouvrir
          une manche renvoie la notification, sauf si tu viens d’appuyer : deux ouvertures à moins
          d’une minute ne sonnent qu’une fois.
        </p>

        {/* Un essai ne se joue pas à 21h, 22h30 et 23h45. Plutôt que de
            faire recalculer trois heures à la main — et de se tromper —,
            on les pose d'un bouton. */}
        <details className="adm-essai">
          <summary>Régler les heures pour un essai</summary>
          <div className="adm-form-grille">
            <div className="adm-champ">
              <label htmlFor="essai-duree">Durée d’un crush time (minutes)</label>
              <input
                id="essai-duree"
                className="lil-input"
                type="number"
                min={1}
                max={240}
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
              />
            </div>
            <div className="adm-champ">
              <label htmlFor="essai-pause">Pause entre deux (minutes)</label>
              <input
                id="essai-pause"
                className="lil-input"
                type="number"
                min={0}
                max={240}
                value={pause}
                onChange={(e) => setPause(e.target.value)}
              />
            </div>
          </div>
          <p className="adm-hint">
            Le premier crush time sera annoncé pour maintenant, les suivants à la file. Les
            manches déjà jouées repartent à zéro — à ne pas faire pendant une vraie soirée.
          </p>
          <button
            type="button"
            className="adm-btn adm-btn-yes"
            disabled={occupe === 'regler'}
            onClick={() =>
              agir('regler', {
                action: 'regler',
                soireeId,
                dureeMinutes: Number(duree) || 5,
                pauseMinutes: Number(pause) || 0,
              })
            }
          >
            {occupe === 'regler' ? 'Réglage…' : 'Replanifier les trois crush times'}
          </button>
        </details>
      </div>

      <div className="adm-card">
        <div className="adm-card-head">
          <p className="adm-card-title">Qui est là ce soir</p>
          <span className="adm-card-aside">
            {presents.length} présents · {femmes} femmes · {hommes} hommes
            {/* Sans cette mention, le compte ne s'additionne pas et on
                cherche l'erreur là où il n'y en a pas. */}
            {incomplets.length > 0 && ` · ${incomplets.length} sans profil`}
          </span>
        </div>

        {incomplets.length > 0 && (
          <div className="adm-alerte" data-gravite="haute">
            <strong>
              {incomplets.length} {incomplets.length > 1 ? 'personnes' : 'personne'} sans profil
            </strong>{' '}
            — {incomplets.map((p) => p.first_name).join(', ')}.{' '}
            {incomplets.length > 1
              ? 'Elles ont acheté un billet sans avoir rempli le questionnaire : elles ne voient personne et personne ne les voit. Retire-les, ou fais-leur remplir le formulaire avant la première manche.'
              : 'Cette personne a acheté un billet sans avoir rempli le questionnaire : elle ne voit personne et personne ne la voit. Retire-la, ou fais-lui remplir le formulaire avant la première manche.'}
          </div>
        )}

        <div className="adm-choix-barre">
          <button
            type="button"
            className="adm-btn"
            onClick={() =>
              copier(
                presents
                  .map((p) => `${p.first_name}\t${p.email}\t${p.code ?? ''}\t${lienDe(p)}`)
                  .join('\n'),
                'tous',
              )
            }
          >
            {copie === 'tous' ? '✓ Copiés' : `Copier les ${presents.length} accès`}
          </button>
          <span className="adm-hint" style={{ margin: 0 }}>
            Prénom, adresse, code, lien — séparés par des tabulations, à coller dans un tableur
            ou un outil d’envoi.
          </span>
        </div>

        {/* Sans clés, rien ne part — et c'est invisible depuis le
            téléphone de quelqu'un : il voit « activées » et ne reçoit
            jamais rien. */}
        {!notificationsConfigurees && (
          <div className="adm-alerte" data-gravite="haute">
            <strong>Les notifications ne sont pas configurées sur ce serveur.</strong> Il manque{' '}
            <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> et <code>VAPID_PRIVATE_KEY</code> dans les
            variables d’environnement. Tant qu’elles manquent, ouvrir un crush time ne fera sonner
            aucun téléphone, et personne ne verra le bouton pour les activer.
          </div>
        )}

        {compilationEnRetard && (
          <div className="adm-alerte" data-gravite="haute">
            <strong>Les clés sont là, mais l’application n’a pas été recompilée depuis.</strong>{' '}
            <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> est inscrite dans le code envoyé aux
            téléphones au moment de la compilation, pas lue au démarrage. Relance un déploiement
            complet — un simple redémarrage ne suffit pas, et personne ne verra le bouton pour
            activer les notifications.
          </div>
        )}

        {/* Le seul moyen de savoir, avant la soirée, combien de téléphones
            sonneront réellement. Une notification ne s'envoie qu'à qui a
            posé l'application et accordé la permission. */}
        {notificationsConfigurees && (
          <div className="adm-notifiables" data-aucun={notifiables === 0 || undefined}>
            <strong>
              {notifiables} / {presents.length}
            </strong>{' '}
            {notifiables === 0
              ? 'téléphone prêt à recevoir une notification. Tant que personne n’a installé l’application et accordé la permission, ouvrir un crush time ne fera sonner personne.'
              : `téléphone${notifiables > 1 ? 's' : ''} recevront les notifications. Les autres verront l’écran basculer s’ils ont l’application ouverte.`}
          </div>
        )}

        <div className="adm-recherche" style={{ margin: '0 0 16px' }}>
          <span className="adm-recherche-loupe" aria-hidden="true">
            <Icone nom="loupe" taille={18} />
          </span>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un prénom, un email…"
            aria-label="Chercher un participant"
          />
        </div>

        <div className="adm-emargement">
          {visibles.map((p) => (
            <div className="adm-present" key={p.id} data-retire={Boolean(p.retire_at)}>
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="adm-avatar" src={p.photo} alt="" loading="lazy" />
              ) : (
                <div className="adm-avatar adm-avatar-empty" aria-hidden="true">
                  {p.first_name.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="adm-present-main">
                <p className="adm-present-nom">
                  {p.first_name}
                  {p.notifiable && (
                    <span className="adm-cloche" title="Notifications activées">
                      ●
                    </span>
                  )}
                  {!p.gender && <span className="adm-tag">profil incomplet</span>}
                  {p.retire_at && <span className="adm-tag">retiré</span>}
                </p>
                <p className="adm-present-mail">
                  {p.email}
                  {p.code && <span className="adm-present-code">{p.code}</span>}
                </p>
              </div>

              {!p.retire_at && p.notifiable && (
                <button
                  type="button"
                  className="adm-btn"
                  title="Envoyer une notification d’essai à cette personne"
                  disabled={occupe === `essai-${p.id}`}
                  onClick={async () => {
                    setOccupe(`essai-${p.id}`);
                    setErreur(await commander({ action: 'essai', participantId: p.id }));
                    setCopie(`essai-${p.id}`);
                    setTimeout(() => setCopie(null), 2500);
                    setOccupe(null);
                  }}
                >
                  {copie === `essai-${p.id}` ? '✓ Envoyée' : 'Tester'}
                </button>
              )}

              <button
                type="button"
                className="adm-btn"
                disabled={occupe === p.id}
                onClick={() =>
                  agir(p.id, {
                    action: p.retire_at ? 'remettre' : 'retirer',
                    participantId: p.id,
                  })
                }
              >
                {p.retire_at ? 'Remettre' : 'Retirer'}
              </button>
            </div>
          ))}
        </div>

        <p className="adm-hint">
          {aucuneOuverte
            ? 'Fais l’appel avant d’ouvrir le premier crush time : quelqu’un qui a payé sans venir occuperait une place dans les profils toute la soirée. Retiré, il disparaît ; remis, il revient.'
            : 'Les crush times ont commencé. Retirer quelqu’un maintenant le fait disparaître des profils et rend son choix à qui l’avait liké sur la manche en cours — mais les matchs déjà faits restent, ils appartiennent aussi à l’autre.'}
        </p>
      </div>

      {erreur && (
        <div className="adm-feedback" data-kind="ko">
          {erreur}
        </div>
      )}
      </div>

      <aside className="adm-pilotage-cote">{colonneDroite}</aside>
    </div>
  );
}
