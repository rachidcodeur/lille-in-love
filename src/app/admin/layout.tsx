import type { Metadata } from 'next';
import Link from 'next/link';
import { isAdminAllowed } from '@/lib/admin';
import { GateForm } from '@/components/admin/GateForm';
import { AdminNav } from '@/components/admin/AdminNav';
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
            <span className="adm-brand-mark" aria-hidden="true">
              L
            </span>
            <span className="adm-brand-nom">Lille in Love</span>
            <span className="adm-brand-tag">Curation</span>
          </Link>
          {allowed && <AdminNav />}
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
    </div>
  );
}
