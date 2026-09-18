'use client';

import { useCallback, useRef, useState } from 'react';

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

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Réduit une photo avant l'envoi.
 *
 * Les photos de téléphone font 4 à 10 Mo : les redimensionner ici évite les
 * envois qui échouent sur une connexion moyenne, et suffit largement pour
 * reconnaître quelqu'un le soir venu. Si le navigateur n'y arrive pas (HEIC
 * non décodé, par exemple), on renvoie le fichier d'origine.
 */
async function shrink(file: File): Promise<File> {
  if (file.size < 900 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2 * 1024 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
      type: 'image/jpeg',
    });
  } catch {
    return file;
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
        const prepared = await shrink(file);
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
        if (file.size > MAX_BYTES) {
          incoming.push({
            key,
            previewUrl: '',
            status: 'echec',
            error: 'Photo trop lourde (8 Mo max).',
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
