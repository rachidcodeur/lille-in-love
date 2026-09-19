'use client';

import { useCallback, useRef, useState } from 'react';
import { decoder, estHeic, versJpeg } from '@/lib/heic';

export type UploadedPhoto = {
  /** Identifiant local, le temps de l'affichage. */
  key: string;
  previewUrl: string;
  /** Chemin renvoyé par /api/upload — c'est lui qu'on envoie à la soumission. */
  path?: string;
  mimeType?: string;
  sizeBytes?: number;
  status: 'envoi' | 'pret' | 'echec';
  error?: string;
};

type Props = {
  apiBase: string;
  photos: UploadedPhoto[];
  max: number;
  onChange: (photos: UploadedPhoto[]) => void;
  error?: string;
};

// « image/* » plutôt qu'une liste : sur iPhone, restreindre les types pousse
// le sélecteur à proposer « Parcourir » plutôt que la photothèque, et certains
// Android ne déclarent aucun type pour un HEIC — il serait alors refusé avant
// même d'être lu. Le format réel est vérifié à la lecture, puis sur le serveur.
const ACCEPT = 'image/*';
const MAX_BYTES = 8 * 1024 * 1024;
// La limite des 8 Mo s'applique à ce qui part, pas à ce qui est choisi : une
// photo d'iPhone de 12 Mo devient un JPEG de 400 Ko. On écarte seulement ce
// qui serait déraisonnable à charger en mémoire pour être converti.
const MAX_BRUT = 30 * 1024 * 1024;

/**
 * Met une photo en état d'être envoyée.
 *
 * Deux problèmes d'un coup : le poids (4 à 10 Mo sur un téléphone) et le
 * format. Le HEIC de l'iPhone n'est lisible que par Safari : converti ici en
 * JPEG, il s'affiche ensuite partout — dans la vignette, dans le back-office,
 * et dans le navigateur du curateur.
 *
 * Si rien ne parvient à décoder le fichier, on renvoie l'original : une
 * candidature ne se perd pas pour un format.
 */
async function preparer(fichier: File): Promise<File> {
  try {
    const heic = await estHeic(fichier, fichier.name);

    // Une petite photo déjà lisible partout n'a aucune raison d'être retouchée.
    if (!heic && fichier.size < 900 * 1024) return fichier;

    const bitmap = await decoder(fichier, heic);
    if (!bitmap) return fichier;

    const jpeg = await versJpeg(bitmap, fichier.name);
    bitmap.close();

    if (!jpeg) return fichier;
    // Ne pas alourdir : une photo déjà légère et lisible reste telle quelle.
    return !heic && jpeg.size >= fichier.size ? fichier : jpeg;
  } catch {
    return fichier;
  }
}

export function PhotoUpload({ apiBase, photos, max, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Les envois se terminent dans le désordre et peuvent aboutir avant le
  // re-rendu de React. On tient donc la liste à jour dans une ref, mise à
  // jour au moment même où on la publie : sans cela, un envoi rapide
  // s'appliquerait à une liste qui ne contient pas encore sa photo, et la
  // vignette resterait bloquée sur « Envoi… ».
  const latest = useRef(photos);
  latest.current = photos;

  const commit = useCallback(
    (next: UploadedPhoto[]) => {
      latest.current = next;
      onChange(next);
    },
    [onChange],
  );

  const upload = useCallback(
    async (file: File, key: string) => {
      const patch = (update: Partial<UploadedPhoto>) => {
        commit(latest.current.map((p) => (p.key === key ? { ...p, ...update } : p)));
      };

      try {
        const prepared = await preparer(file);

        // La vignette montrait le fichier d'origine : un HEIC n'y apparaît
        // pas hors de Safari. Une fois converti, on la remplace — la personne
        // voit enfin ce qu'elle vient de choisir.
        if (prepared !== file) {
          const ancienne = latest.current.find((p) => p.key === key)?.previewUrl;
          patch({ previewUrl: URL.createObjectURL(prepared) });
          if (ancienne) URL.revokeObjectURL(ancienne);
        }

        if (prepared.size > MAX_BYTES) {
          patch({ status: 'echec', error: 'Photo trop lourde (8 Mo max).' });
          return;
        }

        const body = new FormData();
        body.append('file', prepared);

        const response = await fetch(`${apiBase}/api/upload`, { method: 'POST', body });
        const payload = (await response.json()) as {
          path?: string;
          mimeType?: string;
          sizeBytes?: number;
          error?: string;
        };

        if (!response.ok || !payload.path) {
          patch({ status: 'echec', error: payload.error ?? 'Envoi impossible.' });
          return;
        }

        patch({
          status: 'pret',
          path: payload.path,
          mimeType: payload.mimeType,
          sizeBytes: payload.sizeBytes,
        });
      } catch {
        patch({ status: 'echec', error: 'Connexion interrompue. Réessaie.' });
      }
    },
    [apiBase, commit],
  );

  const accept = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;

      const room = max - latest.current.length;
      if (room <= 0) return;

      const incoming: UploadedPhoto[] = [];
      const queue: { file: File; key: string }[] = [];

      for (const file of Array.from(fileList).slice(0, room)) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (file.size > MAX_BRUT) {
          incoming.push({
            key,
            previewUrl: '',
            status: 'echec',
            error: 'Fichier trop lourd (30 Mo max).',
          });
          continue;
        }
        incoming.push({ key, previewUrl: URL.createObjectURL(file), status: 'envoi' });
        queue.push({ file, key });
      }

      // La liste d'abord, les envois ensuite.
      commit([...latest.current, ...incoming]);
      for (const item of queue) void upload(item.file, item.key);
    },
    [max, commit, upload],
  );

  const remove = (key: string) => {
    const target = latest.current.find((p) => p.key === key);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    commit(latest.current.filter((p) => p.key !== key));
  };

  const full = photos.length >= max;

  return (
    <div>
      {!full && (
        <div
          className="lil-dropzone"
          role="button"
          tabIndex={0}
          data-dragging={dragging}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files);
          }}
        >
          <p className="lil-dropzone-title">
            {photos.length === 0 ? 'Choisis tes photos' : 'Ajouter une autre photo'}
          </p>
          <p className="lil-dropzone-sub">
            JPG, PNG ou HEIC — {max - photos.length} restante
            {max - photos.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          accept(event.target.files);
          // Permet de re-choisir le même fichier après l'avoir retiré.
          event.target.value = '';
        }}
      />

      {photos.length > 0 && (
        <div className="lil-thumbs">
          {photos.map((photo) => (
            <div className="lil-thumb" key={photo.key}>
              {photo.previewUrl && <img src={photo.previewUrl} alt="" />}
              {photo.status !== 'pret' && (
                <div className="lil-thumb-progress">
                  {photo.status === 'envoi' ? 'Envoi…' : (photo.error ?? 'Échec')}
                </div>
              )}
              <button
                type="button"
                className="lil-thumb-remove"
                aria-label="Retirer cette photo"
                onClick={() => remove(photo.key)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="lil-error" role="alert">
          <span aria-hidden="true">↳</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
