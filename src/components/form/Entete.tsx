import { SOIREE } from '@/lib/brand';

/**
 * Le haut du formulaire : ce qu'on propose, avant de demander quoi que ce soit.
 *
 * Quelqu'un qui arrive sur la page doit savoir en trois lignes de quelle
 * soirée il s'agit, pour qui, et combien ça coûte — le prix surtout, qu'il
 * vaut mieux annoncer soi-même que laisser découvrir à la fin.
 */
export function Entete() {
  return (
    <header className="lil-entete">
      <p className="lil-entete-ligne">
        <span>Lille in Love · Inscription</span>
        <span>Un court instant</span>
      </p>

      <h1 className="lil-titre">
        Je veux <em>participer</em>.
      </h1>

      <section className="lil-soiree" aria-label="La soirée">
        <p className="lil-soiree-chapeau">{SOIREE.chapeau}</p>
        <p className="lil-soiree-titre">{SOIREE.titre}</p>
        <p className="lil-soiree-precision">{SOIREE.precision}</p>

        <ul className="lil-reperes">
          {SOIREE.reperes.map((repere) => (
            <li key={repere}>{repere}</li>
          ))}
          {/* Le prix se détache des autres repères : c'est la seule
              information que personne ne veut découvrir trop tard. */}
          <li className="lil-repere-prix">
            <b>{SOIREE.prix}</b> {SOIREE.prixDetail}
          </li>
        </ul>
      </section>
    </header>
  );
}
