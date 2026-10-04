'use client';

import { useEffect, useState } from 'react';

/**
 * Le QR à afficher dans la salle.
 *
 * Un seul pour tout le monde : cinquante QR personnels coûtent trop cher à
 * imprimer. Scanné avec l'appareil photo, il ouvre Safari — jamais le
 * navigateur d'une application de mail, où « Ajouter à l'écran d'accueil »
 * n'existe pas. C'est tout l'intérêt de passer par là plutôt que par un
 * lien cliqué dans un mail.
 *
 * Dessiné dans le navigateur : l'adresse dépend du domaine depuis lequel on
 * regarde, et le serveur ne la connaît pas.
 */
export function CrushAffiche({ racine }: { racine: string }) {
  const [image, setImage] = useState<string | null>(null);
  const adresse = `${racine}/crush`;

  useEffect(() => {
    let vivant = true;
    void (async () => {
      const { default: QR } = await import('qrcode');
      const url = await QR.toDataURL(adresse, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#1c130f', light: '#ffffff' },
      });
      if (vivant) setImage(url);
    })();
    return () => {
      vivant = false;
    };
  }, [adresse]);

  if (!image) return null;

  return (
    <div className="adm-affiche">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={`QR code vers ${adresse}`} />
      <div>
        <p className="adm-affiche-titre">Le QR de la salle</p>
        <p className="adm-hint" style={{ margin: '6px 0 0' }}>
          À scanner avec l’appareil photo, pas depuis une application de mail. Il mène à{' '}
          <strong>{adresse}</strong>, où chacun entre avec son adresse et les quatre chiffres
          reçus par mail.
        </p>
        <a className="adm-btn" href={image} download="crush-time-qr.png" style={{ marginTop: 12 }}>
          Télécharger pour imprimer
        </a>
      </div>
    </div>
  );
}
