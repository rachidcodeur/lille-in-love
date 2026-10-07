'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { reparerHeic } from '@/lib/heic';

export type PhotoRangee = { id: string; url: string };

type Props = {
  photos: PhotoRangee[];
  firstName: string;
  /** Présent : les photos peuvent être rangées. Absent : on ne fait que regarder. */
  memberId?: string;
};

/**
 * Les photos d'une candidature, leur visionneuse, et leur ordre.
 *
 * Juger un profil demande de regarder un visage de près : un clic ouvre la
 * photo en grand, un second l'agrandit encore et la fait suivre le curseur.
 * Les flèches passent d'une photo à l'autre, Échap referme.
 *
 * L'ordre n'est pas décoratif. La première photo est celle qui part partout,
 * et surtout celle que montre le profil pendant le crush time, où elle décide
 * à peu près seule du sort de la personne. On peut donc la choisir : par
 * glissé-déposé, ou d'un bouton — le glissé ne marche pas au doigt, et ce
 * back-office se consulte aussi sur un téléphone.
 */
export function PhotoGallery({ photos, firstName, memberId }: Props) {
  const router = useRouter();
  // L'ordre affiché bouge tout de suite, sans attendre le serveur : traîner
  // une photo et la voir revenir en place une demi-seconde donnerait
  // l'impression que le geste a raté.
  const [ordre, setOrdre] = useState<PhotoRangee[]>(photos);
  const [attrapee, setAttrapee] = useState<number | null>(null);
  const [souci, setSouci] = useState<string | null>(null);
  const rangeable = Boolean(memberId) && photos.length > 1;

  useEffect(() => setOrdre(photos), [photos]);

  const enregistrer = useCallback(
    async (suite: PhotoRangee[]) => {
      if (!memberId) return;
      setSouci(null);
      const r = await fetch('/api/admin/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, ordre: suite.map((p) => p.id) }),
      }).catch(() => null);

      if (!r?.ok) {
        // On remet ce que montre la base plutôt que de laisser croire que
        // c'est rangé : la photo de tête compte trop pour qu'on se trompe.
        setOrdre(photos);
        const res = (await r?.json().catch(() => null)) as { error?: string } | null;
        setSouci(res?.error ?? 'L’ordre n’a pas pu être enregistré.');
      }
    },
    [memberId, photos],
  );

  const deplacerVers = useCallback(
    (depuis: number, vers: number) => {
      if (depuis === vers) return;
      setOrdre((avant) => {
        const suite = [...avant];
        const [photo] = suite.splice(depuis, 1);
        suite.splice(vers, 0, photo);
        void enregistrer(suite);
        return suite;
      });
    },
    [enregistrer],
  );
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const [origine, setOrigine] = useState({ x: 50, y: 50 });

  // Les photos déposées avant la conversion à l'envoi peuvent être des HEIC,
  // que seul Safari affiche. On les décode ici, dans le navigateur du
  // curateur, et seulement celles qui n'ont pas su se charger.
  const [reparees, setReparees] = useState<Record<string, string>>({});
  const tentees = useRef(new Set<string>());

  const lisible = (url: string) => reparees[url] ?? url;

  const auSecours = useCallback(async (url: string) => {
    if (tentees.current.has(url)) return;
    tentees.current.add(url);
    const jpeg = await reparerHeic(url);
    if (jpeg) setReparees((avant) => ({ ...avant, [url]: jpeg }));
  }, []);

  // La fiche arrive toute faite du serveur : une image a le temps d'échouer
  // avant que React n'écoute, et son « error » se perd. On regarde donc
  // l'état de chacune à l'hydratation, sans attendre l'événement.
  const cadre = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cadre.current?.querySelectorAll('img').forEach((img) => {
      const origine = img.dataset.origine;
      if (origine && img.complete && img.naturalWidth === 0) void auSecours(origine);
    });
  }, [auSecours, reparees]);

  const fermerRef = useRef<HTMLButtonElement>(null);
  // Pour rendre le focus à la vignette d'où l'on vient.
  const declencheur = useRef<HTMLElement | null>(null);

  const ouvrir = (index: number, element: HTMLElement) => {
    declencheur.current = element;
    setZoom(false);
    setOuverte(index);
  };

  const fermer = useCallback(() => {
    setOuverte(null);
    setZoom(false);
    declencheur.current?.focus();
  }, []);

  const deplacer = useCallback(
    (pas: number) => {
      setZoom(false);
      setOuverte((actuelle) => {
        if (actuelle === null) return null;
        return (actuelle + pas + ordre.length) % ordre.length;
      });
    },
    [ordre.length],
  );

  /* --- Clavier et défilement de la page ---------------------------- */
  useEffect(() => {
    if (ouverte === null) return;

    const auClavier = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        fermer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        deplacer(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        deplacer(-1);
      }
    };

    document.addEventListener('keydown', auClavier);

    // La page derrière ne doit pas défiler pendant qu'on regarde une photo.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    fermerRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', auClavier);
      document.body.style.overflow = avant;
    };
  }, [ouverte, fermer, deplacer]);

  if (ordre.length === 0) {
    return <div className="adm-nophoto">Aucune photo reçue.</div>;
  }

  const legende = (index: number) =>
    ordre.length > 1
      ? `Photo ${index + 1} sur ${ordre.length} de ${firstName}`
      : `Photo de ${firstName}`;

  function Case(photo: PhotoRangee, index: number) {
    const glisse = rangeable
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            // Sans donnée attachée, Chromium annule le glissé avant qu'il
            // commence. Le rang y voyage aussi : plus sûr qu'un état de
            // React, qui peut avoir changé entre la prise et le dépôt.
            e.dataTransfer.setData('text/plain', String(index));
            e.dataTransfer.effectAllowed = 'move';
            setAttrapee(index);
          },
          onDragEnd: () => setAttrapee(null),
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            const depuis = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isInteger(depuis)) deplacerVers(depuis, index);
            setAttrapee(null);
          },
        }
      : {};

    return (
      <div
        className="adm-photo-case"
        key={photo.id}
        data-rang={index === 0 ? 'premiere' : undefined}
        data-attrapee={attrapee === index || undefined}
        {...glisse}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="adm-photo adm-photo-cliquable"
          draggable={false}
          src={lisible(photo.url)}
          data-origine={photo.url}
          alt={legende(index)}
          onError={() => auSecours(photo.url)}
          tabIndex={0}
          role="button"
          onClick={(e) => ouvrir(index, e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              ouvrir(index, e.currentTarget);
            }
          }}
        />

        {/* Retirer : ajouter une mauvaise photo sans recours serait un
            piège, et le fichier part avec la ligne. */}
        {memberId && (
          <button
            type="button"
            className="adm-photo-retirer"
            title="Retirer cette photo"
            onClick={async () => {
              const r = await fetch('/api/admin/fiche', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'retirer-photo', photoId: photo.id }),
              }).catch(() => null);
              if (r?.ok) router.refresh();
              else setSouci('La photo n’a pas pu être retirée.');
            }}
          >
            ×
          </button>
        )}

        {rangeable &&
          (index === 0 ? (
            <span className="adm-photo-rang">Photo du profil</span>
          ) : (
            // Le glissé-déposé n'existe pas au doigt, et ce back-office se
            // consulte aussi sur un téléphone. Ce bouton fait le geste le
            // plus demandé — « celle-ci devant » — en un clic.
            <button
              type="button"
              className="adm-photo-premier"
              onClick={() => deplacerVers(index, 0)}
            >
              Mettre en premier
            </button>
          ))}
      </div>
    );
  }

  return (
    <>
      <div className="adm-photos" ref={cadre}>
        {/* Appelée directement et non montée comme composant : sinon chaque
            réordonnancement recréerait les images, qui clignoteraient. */}
        {Case(ordre[0], 0)}

        {(ordre.length > 1 || ordre.length < 3) && (
          <div className="adm-photo-strip">
            {ordre.slice(1).map((photo, index) => Case(photo, index + 1))}

            {/* Les emplacements laissés vides : « 2 / 3 » en haut de la carte
                se comprend mieux quand on voit la place qui manque. */}
            {Array.from({ length: 3 - ordre.length }, (_, index) => (
              <div className="adm-photo-manquante" key={`vide-${index}`}>
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <circle cx="9" cy="10" r="1.8" />
                  <path d="m21 16-5-5-8 8" />
                </svg>
                <span>Pas de photo</span>
              </div>
            ))}
          </div>
        )}

        <p className="adm-photo-aide">
          {rangeable
            ? 'Clique pour agrandir, glisse pour ranger. La première est celle du profil — c’est elle que les participants verront pendant le crush time.'
            : `Clique la photo pour l’agrandir${ordre.length > 1 ? ' — les flèches passent de l’une à l’autre' : ''}.`}
        </p>

        {souci && (
          <div className="adm-feedback" data-kind="ko">
            {souci}
          </div>
        )}
      </div>

      {ouverte !== null && (
        <div
          className="adm-visionneuse"
          role="dialog"
          aria-modal="true"
          aria-label={legende(ouverte)}
          onClick={fermer}
        >
          <div className="adm-visionneuse-barre" onClick={(e) => e.stopPropagation()}>
            <span className="adm-visionneuse-compteur">
              {ordre.length > 1 ? `${ouverte + 1} / ${ordre.length}` : 'Photo'}
              {zoom && ' · agrandie'}
            </span>
            <button
              ref={fermerRef}
              type="button"
              className="adm-visionneuse-fermer"
              onClick={fermer}
              aria-label="Fermer"
            >
              Fermer <kbd>Échap</kbd>
            </button>
          </div>

          {ordre.length > 1 && (
            <>
              <button
                type="button"
                className="adm-visionneuse-fleche"
                data-cote="gauche"
                aria-label="Photo précédente"
                onClick={(e) => {
                  e.stopPropagation();
                  deplacer(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="adm-visionneuse-fleche"
                data-cote="droite"
                aria-label="Photo suivante"
                onClick={(e) => {
                  e.stopPropagation();
                  deplacer(1);
                }}
              >
                ›
              </button>
            </>
          )}

          {/* Pas de stopPropagation ici : cliquer à côté de la photo doit
              refermer, comme dans n'importe quelle visionneuse. Seule
              l'image elle-même retient le clic, pour zoomer. */}
          <div
            className="adm-visionneuse-cadre"
            onMouseMove={(e) => {
              if (!zoom) return;
              // L'agrandissement suit le curseur : on examine le détail qu'on
              // vise, sans avoir à faire défiler.
              const zone = e.currentTarget.getBoundingClientRect();
              setOrigine({
                x: ((e.clientX - zone.left) / zone.width) * 100,
                y: ((e.clientY - zone.top) / zone.height) * 100,
              });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="adm-visionneuse-image"
              data-zoom={zoom}
              style={
                zoom ? { transformOrigin: `${origine.x}% ${origine.y}%` } : undefined
              }
              src={lisible(ordre[ouverte].url)}
              alt={legende(ouverte)}
              onError={() => auSecours(ordre[ouverte].url)}
              onClick={(e) => {
                e.stopPropagation();
                setZoom((z) => !z);
              }}
            />
          </div>

          <p className="adm-visionneuse-pied" onClick={(e) => e.stopPropagation()}>
            {zoom ? 'Clique à nouveau pour revenir à la taille normale.' : 'Clique la photo pour zoomer.'}
          </p>
        </div>
      )}
    </>
  );
}
