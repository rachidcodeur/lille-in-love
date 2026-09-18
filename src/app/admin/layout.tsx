import type { Metadata } from 'next';
import Link from 'next/link';
import { isAdminAllowed } from '@/lib/admin';
import { env } from '@/lib/env';
import { GateForm } from '@/components/admin/GateForm';
import './admin.css';

export const metadata: Metadata = {
  title: 'Curation — Lille in Love',
  // Ces pages montrent des noms, des emails et des visages : elles ne doivent
  // apparaître dans aucun moteur de recherche, quel que soit le réglage d'accès.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // ADMIN_CODE vide = accès libre. La remplir ferme l'interface sans
  // rien changer au code.
  const allowed = await isAdminAllowed();

  return (
    <div className="adm">
      <header className="adm-bar">
        <div className="adm-bar-inner">
          <Link href="/admin" className="adm-brand">
            Lille in Love <span>· curation</span>
          </Link>
          {allowed && (
            <nav className="adm-nav">
              <Link href="/admin">Candidatures</Link>
              <Link href="/admin/soirees">Soirées</Link>
            </nav>
          )}
        </div>
      </header>

      {allowed ? (
        children
      ) : (
        <div className="adm-gate">
          <h1 className="adm-title">Espace curateurs</h1>
          <p className="adm-sub">Saisis le code d’accès pour voir les candidatures.</p>
          <GateForm />
        </div>
      )}

      {!env.adminCode() && (
        <p className="adm-hint" style={{ textAlign: 'center', paddingBottom: 28 }}>
          Accès libre : toute personne connaissant cette adresse voit les candidatures.
          Renseigne <code>ADMIN_CODE</code> pour la fermer.
        </p>
      )}
    </div>
  );
}
