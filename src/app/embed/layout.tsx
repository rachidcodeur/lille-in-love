/**
 * Le formulaire est affiché dans une iframe posée sur la page WordPress :
 * le fond reste transparent pour qu'on voie la page derrière. Le réglage est
 * porté par la feuille de style (body { background: transparent }), donc rien
 * à exécuter ici — ce layout ne sert qu'à isoler la route.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
