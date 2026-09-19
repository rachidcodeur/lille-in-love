'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icone } from './Icones';

/**
 * Les deux espaces du back-office.
 *
 * « Soirées » ressort volontairement : c'est le geste rare, celui qui envoie
 * des emails à tout le monde, et celui qu'on cherche des yeux quand on a fini
 * de trier. L'onglet courant, lui, se reconnaît à sa pastille pleine.
 */
export function AdminNav() {
  const chemin = usePathname();
  const surSoirees = chemin.startsWith('/admin/soirees');

  return (
    <nav className="adm-nav">
      <Link href="/admin" data-on={!surSoirees}>
        Candidatures
      </Link>
      <Link href="/admin/soirees" className="adm-nav-soirees" data-on={surSoirees}>
        <Icone nom="calendrier" taille={16} />
        Soirées
      </Link>
    </nav>
  );
}
